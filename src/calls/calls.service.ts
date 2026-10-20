import { Injectable } from '@nestjs/common';
import { DataSource } from 'typeorm';
import type { Assessment } from '../ai/classification.service';

@Injectable()
export class CallsService {
  constructor(private readonly db: DataSource) {}

  async uniqueEvent(id: string, type: string): Promise<boolean> {
    const result: any = await this.db.query(
      'INSERT IGNORE INTO webhook_events (event_id,event_type) VALUES (?,?)',
      [id, type],
    );
    return result.affectedRows > 0;
  }

  async create(userId: number, controlId: string, from: string, to: string, contactId: number | null, decision: string) {
    await this.db.query(
      'INSERT IGNORE INTO calls (user_id,call_control_id,from_e164,to_e164,contact_id,decision) VALUES (?,?,?,?,?,?)',
      [userId, controlId, from, to, contactId, decision],
    );
  }

  async stateIfActive(id: string, status: string) {
    await this.db.query("UPDATE calls SET status=? WHERE call_control_id=? AND status NOT IN ('HUNG_UP','ERROR')", [status, id]);
  }

  async decision(id: string): Promise<string> {
    const r: any[] = await this.db.query('SELECT decision FROM calls WHERE call_control_id=? LIMIT 1', [id]);
    return r[0]?.decision ?? 'UNKNOWN';
  }

  async phase(id: string): Promise<string> {
    const r: any[] = await this.db.query('SELECT processing_phase FROM calls WHERE call_control_id=? LIMIT 1', [id]);
    return r[0]?.processing_phase ?? '';
  }

  async setPhase(id: string, phase: string) {
    await this.db.query('UPDATE calls SET processing_phase=? WHERE call_control_id=?', [phase, id]);
  }

  async isEnded(id: string): Promise<boolean> {
    const r: any[] = await this.db.query('SELECT status FROM calls WHERE call_control_id=? LIMIT 1', [id]);
    return r[0]?.status === 'HUNG_UP';
  }

  async callerContext(id: string): Promise<any> {
    const r: any[] = await this.db.query('SELECT contact_id,decision FROM calls WHERE call_control_id=? LIMIT 1', [id]);
    return r[0] ?? null;
  }

  /** Caller ID is a routing hint, not proof that the number can receive callbacks. */
  async callerPhone(id: string): Promise<string | null> {
    const rows: any[] = await this.db.query(
      'SELECT from_e164 FROM calls WHERE call_control_id=? LIMIT 1',
      [id],
    );
    const value = rows[0]?.from_e164;
    return typeof value === 'string' && value.trim() ? value.trim() : null;
  }

  async end(id: string) {
    await this.db.query("UPDATE calls SET status='HUNG_UP',ended_at=COALESCE(ended_at,CURRENT_TIMESTAMP) WHERE call_control_id=?", [id]);
  }

  async queueRecording(recordingId: string, callId: string, url: string, turn: number) {
    await this.db.query(
      "INSERT IGNORE INTO recording_jobs (recording_id,call_control_id,recording_url,turn_number,status) VALUES (?,?,?,?,'QUEUED')",
      [recordingId, callId, url, turn],
    );
  }

  async transcriptLanguage(id: string): Promise<string> {
    const rows: any[] = await this.db.query('SELECT transcript_language FROM calls WHERE call_control_id=? LIMIT 1', [id]);
    return String(rows[0]?.transcript_language || 'unknown');
  }

  async previousTranscript(id: string): Promise<string> {
    const rows: any[] = await this.db.query('SELECT transcript_original FROM calls WHERE call_control_id=? LIMIT 1', [id]);
    return String(rows[0]?.transcript_original || '');
  }

  async recordRelayTranscript(
    id: string,
    transcript: string,
    lang: string,
    assessment: Assessment,
  ): Promise<void> {
    // Preferimos el número extraído por el clasificador.
    // Usamos el respaldo solo cuando identifica un único número.
    const aiPhone =
      typeof assessment.callbackPhone === 'string'
        ? assessment.callbackPhone.trim()
        : '';

    const extractedPhone = this.extractCallbackPhone(transcript);

    const candidatePhone = aiPhone || extractedPhone || '';

    const safePhone =
      /^\+?[0-9().\-\s]{7,30}$/.test(candidatePhone)
        ? candidatePhone.slice(0, 25)
        : null;

    // Un número aportado por el llamante se marca como PROVIDED.
    // Nunca asignamos CALLER_ID sin verificar el número de origen.
    const callbackPhoneSource = safePhone
      ? 'PROVIDED'
      : null;

    // Solo consideramos confirmado un número que el clasificador
    // extrajo y cuya confirmación reconoció explícitamente.
    // La extracción mediante regex nunca confirma el número.
    const callbackPhoneConfirmed = Boolean(
      safePhone &&
      aiPhone &&
      assessment.callbackPhoneSource === 'PROVIDED' &&
      assessment.callbackPhoneConfirmed === true
    );

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
      /(?:^|[^\d])(?:\+?1[\s().-]*)?(\d{3})[\s().-]*(\d{3})[\s().-]*(\d{4})(?!\d)/g
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
    assessment: { category: string; priority: string; decision: string; summary: string; source: string; language: string; confidence: number },
  ) {
    await this.db.query(
      `UPDATE calls SET transcript_original=?,transcript_language=?,reason_text=?,category=?,priority=?,decision=?,ai_summary=?,classification_source=?,detected_language=?,classification_confidence=? WHERE call_control_id=?`,
      [transcript.slice(0, 6000), language, transcript.slice(0, 3000), assessment.category, assessment.priority, assessment.decision, assessment.summary, assessment.source, assessment.language, assessment.confidence, id],
    );
  }
}
