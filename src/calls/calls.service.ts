import { Injectable, ForbiddenException } from "@nestjs/common";
import { DataSource } from "typeorm";
import type { Assessment } from "../ai/classification.service";
import type { AccountSettings } from "../account/account-settings.service";

@Injectable()
export class CallsService {
  constructor(private readonly db: DataSource) {}

  async uniqueEvent(id: string, type: string): Promise<boolean> {
    const result: any = await this.db.query(
      "INSERT IGNORE INTO webhook_events (event_id,event_type) VALUES (?,?)",
      [id, type],
    );
    return result.affectedRows > 0;
  }

  async create(
    userId: number,
    controlId: string,
    from: string,
    to: string,
    contactId: number | null,
    decision: string,
    accountId: number,
  ) {
    await this.db.query(
      "INSERT IGNORE INTO calls (user_id,call_control_id,from_e164,to_e164,contact_id,decision, account_id) VALUES (?,?,?,?,?,?,?)",
      [userId, controlId, from, to, contactId, decision, accountId],
    );
  }

  async stateIfActive(id: string, status: string) {
    await this.db.query(
      "UPDATE calls SET status=? WHERE call_control_id=? AND status NOT IN ('HUNG_UP','ERROR')",
      [status, id],
    );
  }

  async decision(id: string): Promise<string> {
    const r: any[] = await this.db.query(
      "SELECT decision FROM calls WHERE call_control_id=? LIMIT 1",
      [id],
    );
    return r[0]?.decision ?? "UNKNOWN";
  }

  async phase(id: string): Promise<string> {
    const r: any[] = await this.db.query(
      "SELECT processing_phase FROM calls WHERE call_control_id=? LIMIT 1",
      [id],
    );
    return r[0]?.processing_phase ?? "";
  }

  async setPhase(id: string, phase: string) {
    await this.db.query(
      "UPDATE calls SET processing_phase=? WHERE call_control_id=?",
      [phase, id],
    );
  }

  async isEnded(id: string): Promise<boolean> {
    const r: any[] = await this.db.query(
      "SELECT status FROM calls WHERE call_control_id=? LIMIT 1",
      [id],
    );
    return r[0]?.status === "HUNG_UP";
  }

  async callerContext(id: string): Promise<any> {
    const r: any[] = await this.db.query(
      "SELECT contact_id,decision FROM calls WHERE call_control_id=? LIMIT 1",
      [id],
    );
    return r[0] ?? null;
  }

  /** Caller ID is a routing hint, not proof that the number can receive callbacks. */
  async callerPhone(id: string): Promise<string | null> {
    const rows: any[] = await this.db.query(
      "SELECT from_e164 FROM calls WHERE call_control_id=? LIMIT 1",
      [id],
    );
    const value = rows[0]?.from_e164;
    return typeof value === "string" && value.trim() ? value.trim() : null;
  }

  async end(id: string) {
    await this.db.query(
      "UPDATE calls SET status='HUNG_UP',ended_at=COALESCE(ended_at,CURRENT_TIMESTAMP) WHERE call_control_id=?",
      [id],
    );
  }

  async queueRecording(
    recordingId: string,
    callId: string,
    url: string,
    turn: number,
  ) {
    await this.db.query(
      "INSERT IGNORE INTO recording_jobs (recording_id,call_control_id,recording_url,turn_number,status) VALUES (?,?,?,?,'QUEUED')",
      [recordingId, callId, url, turn],
    );
  }

  async transcriptLanguage(id: string): Promise<string> {
    const rows: any[] = await this.db.query(
      "SELECT transcript_language FROM calls WHERE call_control_id=? LIMIT 1",
      [id],
    );
    return String(rows[0]?.transcript_language || "unknown");
  }

  async previousTranscript(id: string): Promise<string> {
    const rows: any[] = await this.db.query(
      "SELECT transcript_original FROM calls WHERE call_control_id=? LIMIT 1",
      [id],
    );
    return String(rows[0]?.transcript_original || "");
  }

  async recordRelayTranscript(
    id: string,
    transcript: string,
    lang: string,
    assessment: Assessment,
  ): Promise<void> {
    console.log("CALLBACK ASSESSMENT RECEIVED:", {
      confirmed: assessment.callbackPhoneConfirmed,
      source: assessment.callbackPhoneSource,
      hasPhone: Boolean(assessment.callbackPhone),
    });
    // Preferimos el número extraído por el clasificador.
    // Usamos el respaldo solo cuando identifica un único número.
    const aiPhone =
      typeof assessment.callbackPhone === "string"
        ? assessment.callbackPhone.trim()
        : "";

    const extractedPhone = this.extractCallbackPhone(transcript);

    const candidatePhone = aiPhone || extractedPhone || "";

    const safePhone = /^\+?[0-9().\-\s]{7,30}$/.test(candidatePhone)
      ? candidatePhone.slice(0, 25)
      : null;

    // Un número aportado por el llamante se marca como PROVIDED.
    // Nunca asignamos CALLER_ID sin verificar el número de origen.
    const callbackPhoneSource =
      safePhone &&
      (assessment.callbackPhoneSource === "CALLER_ID" ||
        assessment.callbackPhoneSource === "PROVIDED")
        ? assessment.callbackPhoneSource
        : safePhone
          ? "PROVIDED"
          : null;

    // Solo consideramos confirmado un número que el clasificador
    // extrajo y cuya confirmación reconoció explícitamente.
    // La extracción mediante regex nunca confirma el número.
    const callbackPhoneConfirmed = Boolean(
      safePhone &&
      callbackPhoneSource &&
      assessment.callbackPhoneConfirmed === true,
    );
    console.log("CALLBACK DB DEBUG:", {
      hasPhone: Boolean(safePhone),
      source: callbackPhoneSource,
      assessmentConfirmed: assessment.callbackPhoneConfirmed,
      finalConfirmed: callbackPhoneConfirmed,
    });
    await this.db.query(
      `UPDATE calls SET
        transcript_original = ?,
        transcript_language = ?,
        reason_text = ?,
        category = ?,
        priority = ?,
        decision = ?,
        ai_summary = ?,
        classification_source = ?,
        detected_language = ?,
        classification_confidence = ?,
        caller_name = COALESCE(?, caller_name),
        caller_organization = COALESCE(?, caller_organization),
        callback_requested = COALESCE(?, callback_requested),
        callback_phone = COALESCE(?, callback_phone),
        callback_phone_source = COALESCE(?, callback_phone_source),
        callback_phone_confirmed = CASE
          WHEN ? IS NOT NULL THEN ?
          ELSE callback_phone_confirmed
        END
      WHERE call_control_id = ?`,
      [
        transcript.slice(0, 6000),
        lang,
        transcript.slice(0, 3000),
        assessment.category,
        assessment.priority,
        assessment.decision,
        assessment.summary,
        assessment.source,
        lang,
        assessment.confidence,
        assessment.callerName ?? null,
        assessment.organization ?? null,
        assessment.callbackRequested ?? null,
        safePhone,
        callbackPhoneSource,
        safePhone,
        callbackPhoneConfirmed ? 1 : 0,
        id,
      ],
    );
  }

  private extractCallbackPhone(transcript: string): string | null {
    const matches = [
      ...transcript.matchAll(
        /(?:^|[^\d])(?:\+?1[\s().-]*)?(\d{3})[\s().-]*(\d{3})[\s().-]*(\d{4})(?!\d)/g,
      ),
    ];

    // No adivinar cuando aparecen varios números.
    if (matches.length !== 1) {
      return null;
    }

    const [, area, prefix, line] = matches[0];

    return `+1${area}${prefix}${line}`;
  }

  async recordTranscription(
    id: string,
    transcript: string,
    language: string,
    assessment: {
      category: string;
      priority: string;
      decision: string;
      summary: string;
      source: string;
      language: string;
      confidence: number;
    },
  ) {
    await this.db.query(
      `UPDATE calls SET transcript_original=?,transcript_language=?,reason_text=?,category=?,priority=?,decision=?,ai_summary=?,classification_source=?,detected_language=?,classification_confidence=? WHERE call_control_id=?`,
      [
        transcript.slice(0, 6000),
        language,
        transcript.slice(0, 3000),
        assessment.category,
        assessment.priority,
        assessment.decision,
        assessment.summary,
        assessment.source,
        assessment.language,
        assessment.confidence,
        id,
      ],
    );
  }
  async recordEarlyRejection(
    id: string,
    transcript: string,
    language: "es" | "en",
    category: "SALES" | "SPAM",
    reason: string,
  ): Promise<void> {
    await this.db.query(
      `UPDATE calls SET
      transcript_original = ?,
      transcript_language = ?,
      reason_text = ?,
      category = ?,
      priority = 'LOW',
      decision = 'SPAM',
      ai_summary = ?,
      classification_source = 'RULES',
      detected_language = ?,
      classification_confidence = 0.95,
      callback_requested = 0,
      processing_phase = 'RELAY_DONE'
    WHERE call_control_id = ?
      AND processing_phase = 'RELAY'`,
      [
        transcript.slice(0, 6000),
        language,
        transcript.slice(0, 3000),
        category,
        reason.slice(0, 400),
        language,
        id,
      ],
    );
  }

  async listForUser(
    userId: number,
    params: {
      page?: string;
      pageSize?: string;
      search?: string;
      category?: string;
      priority?: string;
      decision?: string;
    },
  ) {
    const parseNumber = (value: string | undefined, fallback: number) => {
      if (value === undefined || !/^\d+$/.test(value)) return fallback;
      const result = Number(value);
      return Number.isSafeInteger(result) ? result : fallback;
    };

    const page = Math.max(1, parseNumber(params.page, 1));
    const pageSize = [10, 20, 50, 100].includes(
      parseNumber(params.pageSize, 10),
    )
      ? parseNumber(params.pageSize, 10)
      : 10;

    const accountId = await this.accountForUser(userId);

    const filters = ["c.account_id = ?"];
    const values: Array<string | number> = [accountId];

    const search = (params.search || "").trim().slice(0, 120);

    if (search) {
      const escaped = search.replace(/[\\%_]/g, "\\$&");
      const pattern = `%${escaped}%`;

      filters.push(`(
      c.caller_name LIKE ? OR
      c.from_e164 LIKE ? OR
      c.caller_organization LIKE ? OR
      c.ai_summary LIKE ?
    )`);

      values.push(pattern, pattern, pattern, pattern);
    }

    const categories = [
      "JOB",
      "SCHOOL",
      "HEALTH",
      "PERSONAL",
      "BUSINESS",
      "SALES",
      "SPAM",
      "UNKNOWN",
    ];

    const priorities = ["HIGH", "NORMAL", "LOW"];
    const decisions = [
      "KNOWN",
      "UNKNOWN",
      "BLOCKED",
      "URGENT",
      "NORMAL",
      "SPAM",
    ];

    const category = params.category?.toUpperCase();
    const priority = params.priority?.toUpperCase();
    const decision = params.decision?.toUpperCase();

    if (category && category !== "ALL" && categories.includes(category)) {
      filters.push("c.category = ?");
      values.push(category);
    }

    if (priority && priority !== "ALL" && priorities.includes(priority)) {
      filters.push("c.priority = ?");
      values.push(priority);
    }

    if (decision && decision !== "ALL" && decisions.includes(decision)) {
      filters.push("c.decision = ?");
      values.push(decision);
    }

    const where = filters.join(" AND ");

    const countRows: Array<{ total: number }> = await this.db.query(
      `SELECT COUNT(*) AS total
     FROM calls c
     WHERE ${where}`,
      values,
    );

    const totalItems = Number(countRows[0]?.total || 0);
    const totalPages = Math.max(1, Math.ceil(totalItems / pageSize));
    const currentPage = Math.min(page, totalPages);
    const offset = (currentPage - 1) * pageSize;

    const items = await this.db.query(
      `SELECT
       c.id,
       c.from_e164 AS phone,
       c.to_e164 AS calledNumber,
       c.caller_name AS callerName,
       c.caller_organization AS organization,
       c.category,
       c.priority,
       c.decision,
       c.status,
       c.started_at AS startedAt,
       c.ended_at AS endedAt,
       TIMESTAMPDIFF(
         SECOND,
         c.started_at,
         COALESCE(c.ended_at, NOW())
       ) AS durationSeconds,
       c.ai_summary AS summary,
       c.callback_requested AS callbackRequested
     FROM calls c
     WHERE ${where}
     ORDER BY c.started_at DESC, c.id DESC
     LIMIT ? OFFSET ?`,
      [...values, pageSize, offset],
    );

    return {
      items,
      pagination: {
        page: currentPage,
        pageSize,
        totalItems,
        totalPages,
      },
    };
  }

  async findForUser(userId: number, callId: number) {
    const accountId = await this.accountForUser(userId);
    const rows: any[] = await this.db.query(
      `SELECT
       c.id,
       c.call_control_id AS callControlId,
       c.from_e164 AS phone,
       c.to_e164 AS calledNumber,
       c.caller_name AS callerName,
       c.caller_organization AS organization,
       c.category,
       c.priority,
       c.decision,
       c.status,
       c.started_at AS startedAt,
       c.ended_at AS endedAt,
       TIMESTAMPDIFF(
         SECOND,
         c.started_at,
         COALESCE(c.ended_at, NOW())
       ) AS durationSeconds,
       c.ai_summary AS summary,
       c.reason_text AS reason,
       c.transcript_original AS transcript,
       c.transcript_language AS transcriptLanguage,
       c.classification_source AS classificationSource,
       c.callback_requested AS callbackRequested,
       c.callback_phone AS callbackPhone,
       c.callback_phone_confirmed AS callbackConfirmed,
       c.callback_phone_source AS callbackPhoneSource
     FROM calls c
     WHERE c.id = ? AND c.account_id = ?
     LIMIT 1`,
      [callId, accountId],
    );

    if (!rows.length) {
      return null;
    }

    const call = rows[0];

    return {
      ...call,
      callbackRequested:
        call.callbackRequested === null
          ? null
          : Boolean(call.callbackRequested),
      callbackConfirmed: Boolean(call.callbackConfirmed),
    };
  }

  async statsForUser(userId: number, period: string = "30d") {
    const accountId = await this.accountForUser(userId);
    const allowedPeriods = ["today", "7d", "30d", "all"];

    const selectedPeriod = allowedPeriods.includes(period) ? period : "30d";

    let dateFilter = "";

    switch (selectedPeriod) {
      case "today":
        dateFilter = "AND c.started_at >= CURDATE()";
        break;
      case "7d":
        dateFilter = "AND c.started_at >= NOW() - INTERVAL 7 DAY";
        break;
      case "30d":
        dateFilter = "AND c.started_at >= NOW() - INTERVAL 30 DAY";
        break;
    }

    const baseWhere = `c.account_id = ? ${dateFilter}`;

    const totals: Array<{
      totalCalls: string | number;
      highPriority: string | number;
      spamBlocked: string | number;
      callbacks: string | number;
    }> = await this.db.query(
      `SELECT
       COUNT(*) AS totalCalls,

       COALESCE(SUM(
         CASE WHEN c.priority = 'HIGH' THEN 1 ELSE 0 END
       ), 0) AS highPriority,

       COALESCE(SUM(
         CASE
           WHEN c.decision IN ('SPAM', 'BLOCKED') THEN 1
           ELSE 0
         END
       ), 0) AS spamBlocked,

       COALESCE(SUM(
         CASE WHEN c.callback_requested = 1 THEN 1 ELSE 0 END
       ), 0) AS callbacks

     FROM calls c
     WHERE ${baseWhere}`,
      [accountId],
    );

    const categoryRows: Array<{
      category: string;
      count: string | number;
    }> = await this.db.query(
      `SELECT
       COALESCE(NULLIF(c.category, ''), 'UNKNOWN') AS category,
       COUNT(*) AS count
     FROM calls c
     WHERE ${baseWhere}
     GROUP BY COALESCE(NULLIF(c.category, ''), 'UNKNOWN')
     ORDER BY count DESC, category ASC`,
      [userId],
    );

    const recentCalls = await this.db.query(
      `SELECT
       c.id,
       c.from_e164 AS phone,
       c.caller_name AS callerName,
       c.caller_organization AS organization,
       c.category,
       c.priority,
       c.decision,
       c.started_at AS startedAt,
       c.ai_summary AS summary
     FROM calls c
     WHERE ${baseWhere}
     ORDER BY c.started_at DESC, c.id DESC
     LIMIT 5`,
      [userId],
    );

    const totalCalls = Number(totals[0]?.totalCalls ?? 0);

    const categories = categoryRows.map((row) => {
      const count = Number(row.count);

      return {
        name: row.category,
        count,
        percentage: totalCalls ? Math.round((count / totalCalls) * 100) : 0,
      };
    });

    return {
      period: selectedPeriod,
      stats: {
        totalCalls,
        highPriority: Number(totals[0]?.highPriority ?? 0),
        spamBlocked: Number(totals[0]?.spamBlocked ?? 0),
        callbacks: Number(totals[0]?.callbacks ?? 0),
      },
      categories,
      recentCalls,
    };
  }

  async resolveIncomingAccount(calledNumber: string): Promise<{
    accountId: number;
    userId: number;
    phoneNumberId: number;
  } | null> {
    if (
      typeof calledNumber !== "string" ||
      !/^\+[1-9]\d{7,14}$/.test(calledNumber.trim())
    ) {
      return null;
    }

    const rows: Array<{
      phone_number_id: number | string;
      account_id: number | string;
      user_id: number | string;
    }> = await this.db.query(
      `SELECT
       pn.id AS phone_number_id,
       pn.account_id,
       pn.user_id
     FROM phone_numbers pn
     INNER JOIN accounts a
       ON a.id = pn.account_id
     INNER JOIN users u
       ON u.id = pn.user_id
      AND u.account_id = pn.account_id
     
      WHERE pn.telnyx_e164 = ?
        AND pn.active = 1
        AND pn.admin_locked = 0
        AND a.status = 'ACTIVE'
        AND (
          (
            a.admin_locked = 0
            AND a.admin_lock_mode = 'NONE'
          )
          OR
          (
            a.admin_locked = 1
            AND a.admin_lock_mode = 'PURCHASES'
          )
        )
        AND u.active = 1
        AND u.role IN ('ACCOUNT_ADMIN', 'ACCOUNT_USER')
      LIMIT 2`,
      [calledNumber.trim(), calledNumber.trim()],
    );

    if (rows.length !== 1) {
      return null;
    }

    return {
      accountId: Number(rows[0].account_id),
      userId: Number(rows[0].user_id),
      phoneNumberId: Number(rows[0].phone_number_id),
    };
  }

  async accountForUser(userId: number): Promise<number> {
    const rows: Array<{
      account_id: string | number | null;
    }> = await this.db.query(
      `SELECT u.account_id
     FROM users u
     INNER JOIN accounts a ON a.id = u.account_id
     WHERE u.id = ?
       AND u.active = 1
       AND u.role IN ('ACCOUNT_ADMIN', 'ACCOUNT_USER')
       AND a.status = 'ACTIVE'
     LIMIT 1`,
      [userId],
    );

    const accountId = Number(rows[0]?.account_id);

    if (!Number.isSafeInteger(accountId) || accountId <= 0) {
      throw new ForbiddenException("No active customer account assigned");
    }

    return accountId;
  }

  async saveAgentSettingsSnapshot(
    callId: string,
    settings: AccountSettings,
  ): Promise<void> {
    await this.db.query(
      `UPDATE calls
     SET agent_settings_snapshot = ?
     WHERE call_control_id = ?
       AND agent_settings_snapshot IS NULL`,
      [JSON.stringify(settings), callId],
    );
  }

  async agentSettingsForCall(callId: string): Promise<AccountSettings | null> {
    const rows: Array<{
      agent_settings_snapshot: string | AccountSettings | null;
    }> = await this.db.query(
      `SELECT agent_settings_snapshot
     FROM calls
     WHERE call_control_id = ?
     LIMIT 1`,
      [callId],
    );

    const value = rows[0]?.agent_settings_snapshot;

    if (!value) return null;

    return typeof value === "string"
      ? (JSON.parse(value) as AccountSettings)
      : value;
  }
}
