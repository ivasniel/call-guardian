import {
  BadRequestException,
  ConflictException,
  Injectable,
  InternalServerErrorException,
} from "@nestjs/common";

import { DataSource } from "typeorm";
import * as bcrypt from "bcryptjs";
import { randomBytes } from "node:crypto";
import { ForbiddenException, NotFoundException } from "@nestjs/common";

type AccountType = "BUSINESS" | "PERSONAL";

interface CreateAccountInput {
  name: string;
  ownerName: string;
  ownerEmail: string;
  ownerPhone: string;
  password: string;
  accountType?: AccountType;
}

interface ListAccountsQuery {
  page?: string;
  pageSize?: string;
  search?: string;
  status?: string;
  accountType?: string;
}

@Injectable()
export class AdminAccountsService {
  constructor(private readonly db: DataSource) {}

  async list(query: ListAccountsQuery) {
    const parsePositiveInt = (
      value: string | undefined,
      fallback: number,
    ): number => {
      if (!value || !/^[1-9]\d*$/.test(value)) {
        return fallback;
      }

      const number = Number(value);

      return Number.isSafeInteger(number) ? number : fallback;
    };

    const page = Math.min(parsePositiveInt(query.page, 1), 1000000);

    const requestedSize = parsePositiveInt(query.pageSize, 10);

    const pageSize = [10, 20, 50, 100].includes(requestedSize)
      ? requestedSize
      : 10;

    const filters: string[] = ["1 = 1"];
    const values: Array<string | number> = [];

    const search = (query.search || "").trim().slice(0, 120);

    if (search) {
      const escaped = search.replace(/[\\%_]/g, "\\$&");

      filters.push(`(a.name LIKE ? OR a.slug LIKE ?)`);

      values.push(`%${escaped}%`, `%${escaped}%`);
    }

    const status = query.status?.toUpperCase();

    if (status && ["ACTIVE", "SUSPENDED", "CANCELED"].includes(status)) {
      filters.push("a.status = ?");
      values.push(status);
    }

    const accountType = query.accountType?.toUpperCase();

    if (accountType && ["BUSINESS", "PERSONAL"].includes(accountType)) {
      filters.push("a.account_type = ?");
      values.push(accountType);
    }

    const where = filters.join(" AND ");

    const countRows: Array<{ total: number | string }> = await this.db.query(
      `SELECT COUNT(*) AS total
         FROM accounts a
         WHERE ${where}`,
      values,
    );

    const totalItems = Number(countRows[0]?.total ?? 0);

    const totalPages = Math.max(1, Math.ceil(totalItems / pageSize));

    const currentPage = Math.min(page, totalPages);

    const items = await this.db.query(
      `SELECT
         a.id,
         a.name,
         a.slug,
         a.account_type AS accountType,
         a.status,
         a.admin_locked AS adminLocked,
a.admin_lock_mode AS adminLockMode,
a.admin_lock_reason AS adminLockReason,
         a.created_at AS createdAt,
         a.updated_at AS updatedAt,

         (SELECT COUNT(*)
          FROM users u
          WHERE u.account_id = a.id) AS totalUsers,

         (SELECT COUNT(*)
          FROM phone_numbers pn
          WHERE pn.account_id = a.id) AS totalNumbers,

         (SELECT COUNT(*)
          FROM calls c
          WHERE c.account_id = a.id) AS totalCalls

       FROM accounts a
       WHERE ${where}
       ORDER BY a.created_at DESC, a.id DESC
       LIMIT ? OFFSET ?`,
      [...values, pageSize, (currentPage - 1) * pageSize],
    );

    return {
      items: items.map((item: any) => ({
        ...item,
        id: Number(item.id),
    adminLocked: Boolean(item.adminLocked),
        totalUsers: Number(item.totalUsers),
        totalNumbers: Number(item.totalNumbers),
        totalCalls: Number(item.totalCalls),
      })),
      pagination: {
        page: currentPage,
        pageSize,
        totalItems,
        totalPages,
      },
    };
  }

  async create(input: CreateAccountInput) {
    if (!input || typeof input !== "object" || Array.isArray(input)) {
      throw new BadRequestException("Invalid account information");
    }

    const accountType = input.accountType ?? "BUSINESS";

    if (accountType !== "BUSINESS" && accountType !== "PERSONAL") {
      throw new BadRequestException(
        "Account type must be BUSINESS or PERSONAL",
      );
    }

    const name = typeof input.name === "string" ? input.name.trim() : "";

    const ownerName =
      typeof input.ownerName === "string" ? input.ownerName.trim() : "";

    const email =
      typeof input.ownerEmail === "string"
        ? input.ownerEmail.trim().toLowerCase()
        : "";

    const phone =
      typeof input.ownerPhone === "string" ? input.ownerPhone.trim() : "";

    const password = input.password;

    if (!name || name.length > 180) {
      throw new BadRequestException(
        accountType === "PERSONAL"
          ? "Invalid account name"
          : "Invalid business name",
      );
    }

    if (!ownerName || ownerName.length > 255) {
      throw new BadRequestException("Invalid owner name");
    }

    if (
      !email ||
      email.length > 255 ||
      !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)
    ) {
      throw new BadRequestException("Invalid email address");
    }

    if (!phone || !/^\+[1-9]\d{7,14}$/.test(phone)) {
      throw new BadRequestException("Phone must use E.164 format");
    }

    if (
      typeof password !== "string" ||
      password.length < 12 ||
      Buffer.byteLength(password, "utf8") > 72
    ) {
      throw new BadRequestException("Password must contain 12 to 72 bytes");
    }

    const baseSlug =
      name
        .toLowerCase()
        .normalize("NFKD")
        .replace(/[\u0300-\u036f]/g, "")
        .replace(/[^a-z0-9]+/g, "-")
        .replace(/^-|-$/g, "")
        .slice(0, 90) || "client";

    const slug = `${baseSlug}-${randomBytes(5).toString("hex")}`;

    const passwordHash = await bcrypt.hash(password, 12);

    const runner = this.db.createQueryRunner();

    await runner.connect();

    try {
      await runner.startTransaction();

      const existing: Array<{ id: number }> = await runner.query(
        `SELECT id
           FROM users
           WHERE email = ?
           LIMIT 1`,
        [email],
      );

      if (existing.length) {
        throw new ConflictException("Email address is already registered");
      }

      const accountResult = await runner.query(
        `INSERT INTO accounts (
           name,
           account_type,
           slug,
           status
         )
         VALUES (?, ?, ?, 'ACTIVE')`,
        [name, accountType, slug],
      );

      const accountId = Number(accountResult.insertId);

      // Create the settings row in the same transaction.
      // Column defaults are defined in migrate-v0.15.sql.
      await runner.query(
        `INSERT INTO account_settings (account_id)
         VALUES (?)`,
        [accountId],
      );

      const userResult = await runner.query(
        `INSERT INTO users (
           account_id,
           role,
           active,
           name,
           email,
           phone_e164,
           password_hash
         )
         VALUES (?, 'ACCOUNT_ADMIN', 1, ?, ?, ?, ?)`,
        [accountId, ownerName, email, phone, passwordHash],
      );

      const ownerId = Number(userResult.insertId);

      await runner.commitTransaction();

      return {
        id: accountId,
        name,
        accountType,
        slug,
        status: "ACTIVE",
        owner: {
          id: ownerId,
          name: ownerName,
          email,
          phone,
        },
      };
    } catch (error) {
      if (runner.isTransactionActive) {
        await runner.rollbackTransaction();
      }

      if (
        error instanceof BadRequestException ||
        error instanceof ConflictException
      ) {
        throw error;
      }

      if ((error as { code?: string })?.code === "ER_DUP_ENTRY") {
        throw new ConflictException(
          "Email or account identifier already exists",
        );
      }

      throw new InternalServerErrorException(
        "Could not create customer account",
      );
    } finally {
      await runner.release();
    }
  }

  async lockAccount(
    accountId: number,
    actorUserId: number,
    input: {
      mode: "PURCHASES" | "SERVICE" | "FULL";
      reason: string;
    },
  ) {
    if (!Number.isSafeInteger(accountId) || accountId <= 0) {
      throw new BadRequestException("Invalid account ID");
    }

    if (!Number.isSafeInteger(actorUserId) || actorUserId <= 0) {
      throw new ForbiddenException("Invalid administrator");
    }

    if (!input || !["PURCHASES", "SERVICE", "FULL"].includes(input.mode)) {
      throw new BadRequestException("Invalid lock mode");
    }

    const reason = typeof input.reason === "string" ? input.reason.trim() : "";

    if (!reason || reason.length > 500) {
      throw new BadRequestException(
        "A reason of 1 to 500 characters is required",
      );
    }

    const runner = this.db.createQueryRunner();
    await runner.connect();

    try {
      await runner.startTransaction();

      const actors = await runner.query(
        `SELECT id
       FROM users
       WHERE id = ?
         AND role = 'SUPER_ADMIN'
         AND active = 1
       LIMIT 1`,
        [actorUserId],
      );

      if (!actors.length) {
        throw new ForbiddenException("Super Admin authorization required");
      }

      const rows = await runner.query(
        `SELECT
         id,
         name,
         admin_locked,
         admin_lock_mode,
         admin_lock_reason,
         admin_locked_at,
         admin_locked_by
       FROM accounts
       WHERE id = ?
       FOR UPDATE`,
        [accountId],
      );

      if (!rows.length) {
        throw new NotFoundException("Account not found");
      }

      const previous = rows[0];
      const wasLocked = Boolean(previous.admin_locked);

      await runner.query(
        `UPDATE accounts
       SET
         admin_locked = 1,
         admin_lock_mode = ?,
         admin_lock_reason = ?,
         admin_locked_at = NOW(),
         admin_locked_by = ?
       WHERE id = ?`,
        [input.mode, reason, actorUserId, accountId],
      );

      await runner.query(
        `INSERT INTO admin_audit_logs (
         actor_user_id,
         target_type,
         target_id,
         action,
         previous_state,
         new_state,
         reason
       )
       VALUES (?, 'ACCOUNT', ?, ?, ?, ?, ?)`,
        [
          actorUserId,
          accountId,
          wasLocked ? "CHANGE_LOCK" : "LOCK",
          JSON.stringify({
            locked: wasLocked,
            mode: previous.admin_lock_mode,
            reason: previous.admin_lock_reason,
            lockedAt: previous.admin_locked_at,
            lockedBy: previous.admin_locked_by,
          }),
          JSON.stringify({
            locked: true,
            mode: input.mode,
            reason,
            lockedBy: actorUserId,
          }),
          reason,
        ],
      );

      await runner.commitTransaction();

      return {
        accountId,
        locked: true,
        mode: input.mode,
        reason,
      };
    } catch (error) {
      if (runner.isTransactionActive) {
        await runner.rollbackTransaction();
      }
      throw error;
    } finally {
      await runner.release();
    }
  }

  async unlockAccount(
    accountId: number,
    actorUserId: number,
    reasonInput: string,
  ) {
    if (!Number.isSafeInteger(accountId) || accountId <= 0) {
      throw new BadRequestException("Invalid account ID");
    }

    if (!Number.isSafeInteger(actorUserId) || actorUserId <= 0) {
      throw new ForbiddenException("Invalid administrator");
    }

    const reason = typeof reasonInput === "string" ? reasonInput.trim() : "";

    if (!reason || reason.length > 500) {
      throw new BadRequestException(
        "An unlock reason is required (1 to 500 characters)",
      );
    }

    const runner = this.db.createQueryRunner();
    await runner.connect();

    try {
      await runner.startTransaction();

      const actors = await runner.query(
        `SELECT id
       FROM users
       WHERE id = ?
         AND role = 'SUPER_ADMIN'
         AND active = 1
       LIMIT 1`,
        [actorUserId],
      );

      if (!actors.length) {
        throw new ForbiddenException("Super Admin authorization required");
      }

      const rows = await runner.query(
        `SELECT
         id,
         admin_locked,
         admin_lock_mode,
         admin_lock_reason,
         admin_locked_at,
         admin_locked_by
       FROM accounts
       WHERE id = ?
       FOR UPDATE`,
        [accountId],
      );

      if (!rows.length) {
        throw new NotFoundException("Account not found");
      }

      const previous = rows[0];

      if (
        !Boolean(previous.admin_locked) &&
        previous.admin_lock_mode === "NONE"
      ) {
        throw new BadRequestException("Account is not administratively locked");
      }

      await runner.query(
        `UPDATE accounts
       SET
         admin_locked = 0,
         admin_lock_mode = 'NONE',
         admin_lock_reason = NULL,
         admin_locked_at = NULL,
         admin_locked_by = NULL
       WHERE id = ?`,
        [accountId],
      );

      await runner.query(
        `INSERT INTO admin_audit_logs (
         actor_user_id,
         target_type,
         target_id,
         action,
         previous_state,
         new_state,
         reason
       )
       VALUES (?, 'ACCOUNT', ?, 'UNLOCK', ?, ?, ?)`,
        [
          actorUserId,
          accountId,
          JSON.stringify({
            locked: Boolean(previous.admin_locked),
            mode: previous.admin_lock_mode,
            reason: previous.admin_lock_reason,
            lockedAt: previous.admin_locked_at,
            lockedBy: previous.admin_locked_by,
          }),
          JSON.stringify({
            locked: false,
            mode: "NONE",
          }),
          reason,
        ],
      );

      await runner.commitTransaction();

      return {
        accountId,
        locked: false,
        mode: "NONE",
      };
    } catch (error) {
      if (runner.isTransactionActive) {
        await runner.rollbackTransaction();
      }
      throw error;
    } finally {
      await runner.release();
    }
  }
}
