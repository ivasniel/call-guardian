import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import { DataSource } from "typeorm";

export interface GrantCourtesyInput {
  durationDays: number;
  maxUsers?: number;
  maxNumbers?: number;
  includedCalls?: number;
  includedMinutes?: number;
  allowAdditionalNumbers?: boolean;
  reason: string;
}

@Injectable()
export class AdminCourtesyService {
  constructor(private readonly db: DataSource) {}

  async grant(accountId: number, adminId: number, input: GrantCourtesyInput) {
    if (!Number.isSafeInteger(accountId) || accountId <= 0) {
      throw new BadRequestException("Invalid account ID");
    }

    if (!Number.isSafeInteger(adminId) || adminId <= 0) {
      throw new ForbiddenException("Invalid administrator");
    }

    if (!input || typeof input !== "object" || Array.isArray(input)) {
      throw new BadRequestException("Invalid courtesy plan");
    }

    const reason = typeof input.reason === "string" ? input.reason.trim() : "";

    if (!reason || reason.length > 500) {
      throw new BadRequestException(
        "A reason between 1 and 500 characters is required",
      );
    }

    if (
      !Number.isInteger(input.durationDays) ||
      input.durationDays < 1 ||
      input.durationDays > 365
    ) {
      throw new BadRequestException("Duration must be between 1 and 365 days");
    }

    const optionalNumber = (
      value: number | undefined,
      name: string,
      min: number,
    ) => {
      if (value === undefined) return;

      if (!Number.isSafeInteger(value) || value < min || value > 1000000) {
        throw new BadRequestException(`Invalid ${name}`);
      }
    };

    optionalNumber(input.maxUsers, "maxUsers", 1);
    optionalNumber(input.maxNumbers, "maxNumbers", 1);
    optionalNumber(input.includedCalls, "includedCalls", 0);
    optionalNumber(input.includedMinutes, "includedMinutes", 0);

    if (
      input.allowAdditionalNumbers !== undefined &&
      typeof input.allowAdditionalNumbers !== "boolean"
    ) {
      throw new BadRequestException("allowAdditionalNumbers must be boolean");
    }

    const runner = this.db.createQueryRunner();
    await runner.connect();

    try {
      await runner.startTransaction();

      // Verify that the actor is currently an active Super Admin.
      const admins = await runner.query(
        `SELECT id
         FROM users
         WHERE id = ?
           AND role = 'SUPER_ADMIN'
           AND active = 1
         LIMIT 1`,
        [adminId],
      );

      if (!admins.length) {
        throw new ForbiddenException("Super Admin access required");
      }

      // Serialize subscription changes for this account.
      const accounts = await runner.query(
        `SELECT
           id,
           name,
           account_type,
           status,
           admin_locked,
           admin_lock_mode
         FROM accounts
         WHERE id = ?
         FOR UPDATE`,
        [accountId],
      );

      if (!accounts.length) {
        throw new NotFoundException("Account not found");
      }

      const account = accounts[0];

      if (
        account.status !== "ACTIVE" ||
        Boolean(account.admin_locked) ||
        account.admin_lock_mode !== "NONE"
      ) {
        throw new ForbiddenException(
          "Account is not eligible for a courtesy plan",
        );
      }

      // An account may not have two simultaneously usable subscriptions.
      const existing = await runner.query(
        `SELECT id
         FROM account_subscriptions
         WHERE account_id = ?
           AND status = 'ACTIVE'
           AND starts_at <= UTC_TIMESTAMP()
           AND ends_at > UTC_TIMESTAMP()
         LIMIT 1`,
        [accountId],
      );

      if (existing.length) {
        throw new ConflictException(
          "Account already has an active subscription",
        );
      }

      const plans = await runner.query(
        `SELECT *
         FROM plans
         WHERE code = 'COURTESY'
           AND plan_type = 'COURTESY'
           AND active = 1
         LIMIT 1`,
      );

      if (!plans.length) {
        throw new NotFoundException("Courtesy plan is not configured");
      }

      const plan = plans[0];

      const maxUsers = input.maxUsers ?? Number(plan.max_users);

      const maxNumbers = input.maxNumbers ?? Number(plan.max_numbers);

      const includedCalls = input.includedCalls ?? Number(plan.included_calls);

      const includedMinutes =
        input.includedMinutes ?? Number(plan.included_minutes);

      const allowAdditionalNumbers =
        input.allowAdditionalNumbers ?? Boolean(plan.allow_additional_numbers);

      if (
        account.account_type === "PERSONAL" &&
        (maxUsers !== 1 || maxNumbers !== 1 || allowAdditionalNumbers)
      ) {
        throw new BadRequestException(
          "Personal accounts are limited to one user and one number",
        );
      }

      // Do not grant a plan smaller than current resource ownership.
      const usage = await runner.query(
        `SELECT
           (SELECT COUNT(*)
            FROM users
            WHERE account_id = ?
              AND active = 1) AS currentUsers,

           (SELECT COUNT(*)
            FROM phone_numbers
            WHERE account_id = ?) AS currentNumbers`,
        [accountId, accountId],
      );

      if (
        Number(usage[0].currentUsers) > maxUsers ||
        Number(usage[0].currentNumbers) > maxNumbers
      ) {
        throw new BadRequestException(
          "Plan limits are below the account current resources",
        );
      }

      const result = await runner.query(
        `INSERT INTO account_subscriptions (
           account_id,
           plan_id,
           source,
           status,
           starts_at,
           ends_at,
           max_users,
           max_numbers,
           included_calls,
           included_minutes,
           allow_additional_numbers,
           granted_by,
           grant_reason
         )
         VALUES (
           ?, ?,
           'ADMIN_COURTESY',
           'ACTIVE',
           UTC_TIMESTAMP(),
           DATE_ADD(UTC_TIMESTAMP(), INTERVAL ? DAY),
           ?, ?, ?, ?, ?, ?, ?
         )`,
        [
          accountId,
          Number(plan.id),
          input.durationDays,
          maxUsers,
          maxNumbers,
          includedCalls,
          includedMinutes,
          allowAdditionalNumbers ? 1 : 0,
          adminId,
          reason,
        ],
      );

      const subscriptionId = Number(result.insertId);

      await runner.commitTransaction();

      return {
        subscriptionId,
        accountId,
        accountName: account.name,
        plan: "COURTESY",
        source: "ADMIN_COURTESY",
        status: "ACTIVE",
        durationDays: input.durationDays,
        maxUsers,
        maxNumbers,
        includedCalls,
        includedMinutes,
        allowAdditionalNumbers,
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

  async getSubscription(accountId: number) {
    this.validateId(accountId);

    const rows = await this.db.query(
      `SELECT
         s.*,
         p.code AS plan_code,
         p.name AS plan_name,
         a.name AS account_name,
         CASE
            WHEN s.status = 'ACTIVE'
            AND s.starts_at <= UTC_TIMESTAMP()
            AND s.ends_at > UTC_TIMESTAMP()
            THEN 1
            ELSE 0
            END AS currently_active
       FROM account_subscriptions s
       JOIN plans p ON p.id = s.plan_id
       JOIN accounts a ON a.id = s.account_id
       WHERE s.account_id = ?
       ORDER BY
         (s.status = 'ACTIVE'
           AND s.starts_at <= UTC_TIMESTAMP()
           AND s.ends_at > UTC_TIMESTAMP()) DESC,
         s.id DESC
       LIMIT 1`,
      [accountId],
    );

    if (!rows.length) {
      return { accountId, subscription: null };
    }

    const subscription = rows[0];

    return {
    accountId,
    subscription: {
        ...subscription,
        currentlyActive: Number(subscription.currently_active) === 1,
    },
    };
  }

  async extend(
    accountId: number,
    adminId: number,
    input: { additionalDays: number; reason: string },
  ) {
    if (
      !input ||
      !Number.isSafeInteger(input.additionalDays) ||
      input.additionalDays < 1 ||
      input.additionalDays > 365
    ) {
      throw new BadRequestException("additionalDays must be between 1 and 365");
    }

    return this.modifyCourtesy(
      accountId,
      adminId,
      "EXTEND",
      input.reason,
      async (runner, current) => {
        await runner.query(
          `UPDATE account_subscriptions
           SET ends_at = DATE_ADD(ends_at, INTERVAL ? DAY)
           WHERE id = ?`,
          [input.additionalDays, current.id],
        );
      },
    );
  }

  async updateLimits(
    accountId: number,
    adminId: number,
    input: {
      maxUsers: number;
      maxNumbers: number;
      includedCalls: number;
      includedMinutes: number;
      allowAdditionalNumbers: boolean;
      reason: string;
    },
  ) {
    if (
      !input ||
      !Number.isSafeInteger(input.maxUsers) ||
      input.maxUsers < 1 ||
      !Number.isSafeInteger(input.maxNumbers) ||
      input.maxNumbers < 1 ||
      !Number.isSafeInteger(input.includedCalls) ||
      input.includedCalls < 0 ||
      !Number.isSafeInteger(input.includedMinutes) ||
      input.includedMinutes < 0 ||
      typeof input.allowAdditionalNumbers !== "boolean"
    ) {
      throw new BadRequestException("Invalid plan limits");
    }

    const maxAllowed = 1000000;

    if (
      input.maxUsers > maxAllowed ||
      input.maxNumbers > maxAllowed ||
      input.includedCalls > maxAllowed ||
      input.includedMinutes > maxAllowed
    ) {
      throw new BadRequestException("Plan limit is too large");
    }

    return this.modifyCourtesy(
      accountId,
      adminId,
      "UPDATE_LIMITS",
      input.reason,
      async (runner) => {
        const accounts = await runner.query(
          `SELECT account_type
           FROM accounts
           WHERE id = ?`,
          [accountId],
        );

        if (
          accounts[0].account_type === "PERSONAL" &&
          (input.maxUsers !== 1 ||
            input.maxNumbers !== 1 ||
            input.allowAdditionalNumbers)
        ) {
          throw new BadRequestException(
            "Personal accounts support one user and one number",
          );
        }

        const counts = await runner.query(
          `SELECT
             (SELECT COUNT(*)
              FROM users
              WHERE account_id = ?
                AND active = 1) AS users_count,
             (SELECT COUNT(*)
              FROM phone_numbers
              WHERE account_id = ?) AS numbers_count`,
          [accountId, accountId],
        );

        if (
          Number(counts[0].users_count) > input.maxUsers ||
          Number(counts[0].numbers_count) > input.maxNumbers
        ) {
          throw new BadRequestException(
            "New limits are below current account resources",
          );
        }

        await runner.query(
          `UPDATE account_subscriptions
           SET max_users = ?,
               max_numbers = ?,
               included_calls = ?,
               included_minutes = ?,
               allow_additional_numbers = ?
           WHERE id = ?`,
          [
            input.maxUsers,
            input.maxNumbers,
            input.includedCalls,
            input.includedMinutes,
            input.allowAdditionalNumbers ? 1 : 0,
            runner.data.subscriptionId,
          ],
        );
      },
    );
  }

  async revoke(accountId: number, adminId: number, input: { reason: string }) {
    return this.modifyCourtesy(
      accountId,
      adminId,
      "REVOKE",
      input?.reason,
      async (runner, current) => {
        await runner.query(
          `UPDATE account_subscriptions
           SET status = 'CANCELED',
               canceled_at = UTC_TIMESTAMP()
           WHERE id = ?`,
          [current.id],
        );
      },
    );
  }

  private validateId(id: number) {
    if (!Number.isSafeInteger(id) || id <= 0) {
      throw new BadRequestException("Invalid ID");
    }
  }

  private async modifyCourtesy(
    accountId: number,
    adminId: number,
    action: "EXTEND" | "UPDATE_LIMITS" | "REVOKE",
    reasonInput: unknown,
    apply: (
      runner: import("typeorm").QueryRunner,
      current: any,
    ) => Promise<void>,
  ) {
    this.validateId(accountId);
    this.validateId(adminId);

    const reason = typeof reasonInput === "string" ? reasonInput.trim() : "";

    if (!reason || reason.length > 500) {
      throw new BadRequestException(
        "A reason between 1 and 500 characters is required",
      );
    }

    const runner = this.db.createQueryRunner();
    await runner.connect();

    try {
      await runner.startTransaction();

      const admins = await runner.query(
        `SELECT id FROM users
         WHERE id = ?
           AND role = 'SUPER_ADMIN'
           AND active = 1
         LIMIT 1`,
        [adminId],
      );

      if (!admins.length) {
        throw new ForbiddenException("Super Admin access required");
      }

      // Same account-row lock used by grant().
      // This serializes courtesy changes for this account.
      const accounts = await runner.query(
        `SELECT id FROM accounts
         WHERE id = ?
         FOR UPDATE`,
        [accountId],
      );

      if (!accounts.length) {
        throw new NotFoundException("Account not found");
      }

      const subscriptions = await runner.query(
        `SELECT *
         FROM account_subscriptions
         WHERE account_id = ?
           AND source = 'ADMIN_COURTESY'
           AND status = 'ACTIVE'
           AND starts_at <= UTC_TIMESTAMP()
           AND ends_at > UTC_TIMESTAMP()
         ORDER BY id DESC
         LIMIT 1
         FOR UPDATE`,
        [accountId],
      );

      if (!subscriptions.length) {
        throw new NotFoundException("No active courtesy subscription found");
      }

      const current = subscriptions[0];
      runner.data.subscriptionId = current.id;

      await apply(runner, current);

      const updatedRows = await runner.query(
        `SELECT *
         FROM account_subscriptions
         WHERE id = ?`,
        [current.id],
      );

      const updated = updatedRows[0];

      await runner.query(
        `INSERT INTO courtesy_audit_logs (
           subscription_id,
           actor_user_id,
           action,
           previous_state,
           new_state,
           reason
         )
         VALUES (?, ?, ?, ?, ?, ?)`,
        [
          current.id,
          adminId,
          action,
          JSON.stringify(current),
          JSON.stringify(updated),
          reason,
        ],
      );

      await runner.commitTransaction();

      return {
        success: true,
        action,
        accountId,
        subscription: updated,
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
