
import {
  BadRequestException,
  ForbiddenException,
  Injectable,
} from '@nestjs/common';
import { DataSource } from 'typeorm';

type Language = 'auto' | 'en' | 'es';

export interface AccountSettings {
  accountId: number;
  agentEnabled: boolean;
  language: Language;
  greetingEn: string;
  greetingEs: string;
  maxFollowups: number;
  earlySpamScreening: boolean;
  callbackVerification: boolean;
}

export type UpdateAccountSettings = Partial<
  Omit<AccountSettings, 'accountId'>
>;

@Injectable()
export class AccountSettingsService {
  constructor(private readonly db: DataSource) {}

  private async resolveUser(userId: number) {
    if (!Number.isSafeInteger(userId) || userId <= 0) {
      throw new ForbiddenException('Invalid account');
    }

    const rows: Array<{
      account_id: number | string;
      role: string;
    }> = await this.db.query(
      `SELECT u.account_id, u.role
       FROM users u
       INNER JOIN accounts a ON a.id = u.account_id
       WHERE u.id = ?
         AND u.active = 1
         AND a.status = 'ACTIVE'
         AND u.role IN ('ACCOUNT_ADMIN', 'ACCOUNT_USER')
       LIMIT 1`,
      [userId],
    );

    if (!rows.length) {
      throw new ForbiddenException(
        'No active customer account assigned',
      );
    }

    return {
      accountId: Number(rows[0].account_id),
      role: rows[0].role,
    };
  }

  private async read(accountId: number): Promise<AccountSettings> {
    const rows: any[] = await this.db.query(
      `SELECT
         account_id,
         agent_enabled,
         language,
         greeting_en,
         greeting_es,
         max_followups,
         early_spam_screening,
         callback_verification
       FROM account_settings
       WHERE account_id = ?
       LIMIT 1`,
      [accountId],
    );

    if (!rows.length) {
      throw new ForbiddenException(
        'Account settings not initialized',
      );
    }

    const row = rows[0];

    return {
      accountId: Number(row.account_id),
      agentEnabled: Boolean(row.agent_enabled),
      language: row.language,
      greetingEn: row.greeting_en,
      greetingEs: row.greeting_es,
      maxFollowups: Number(row.max_followups),
      earlySpamScreening: Boolean(row.early_spam_screening),
      callbackVerification: Boolean(row.callback_verification),
    };
  }

  async getForUser(userId: number): Promise<AccountSettings> {
    const user = await this.resolveUser(userId);
    return this.read(user.accountId);
  }

  async updateForUser(
    userId: number,
    changes: UpdateAccountSettings,
  ): Promise<AccountSettings> {
    const user = await this.resolveUser(userId);

    if (user.role !== 'ACCOUNT_ADMIN') {
      throw new ForbiddenException(
        'Account Admin access required',
      );
    }

    if (
      !changes ||
      typeof changes !== 'object' ||
      Array.isArray(changes)
    ) {
      throw new BadRequestException('Invalid settings');
    }

    const allowed = [
      'agentEnabled',
      'language',
      'greetingEn',
      'greetingEs',
      'maxFollowups',
      'earlySpamScreening',
      'callbackVerification',
    ];

    const keys = Object.keys(changes);

    if (keys.some(key => !allowed.includes(key))) {
      throw new BadRequestException('Unknown settings field');
    }

    for (const key of [
      'agentEnabled',
      'earlySpamScreening',
      'callbackVerification',
    ] as const) {
      if (
        changes[key] !== undefined &&
        typeof changes[key] !== 'boolean'
      ) {
        throw new BadRequestException(`${key} must be boolean`);
      }
    }

    if (
      changes.language !== undefined &&
      !['auto', 'en', 'es'].includes(changes.language)
    ) {
      throw new BadRequestException('Invalid language');
    }

    for (const key of ['greetingEn', 'greetingEs'] as const) {
      const value = changes[key];

      if (
        value !== undefined &&
        (typeof value !== 'string' ||
          !value.trim() ||
          value.length > 500)
      ) {
        throw new BadRequestException(`Invalid ${key}`);
      }
    }

    if (
      changes.maxFollowups !== undefined &&
      (!Number.isInteger(changes.maxFollowups) ||
        changes.maxFollowups < 1 ||
        changes.maxFollowups > 15)
    ) {
      throw new BadRequestException(
        'Max followups must be between 1 and 15',
      );
    }

    const current = await this.read(user.accountId);
    const updated = { ...current, ...changes };

    await this.db.query(
      `UPDATE account_settings
       SET
         agent_enabled = ?,
         language = ?,
         greeting_en = ?,
         greeting_es = ?,
         max_followups = ?,
         early_spam_screening = ?,
         callback_verification = ?
       WHERE account_id = ?`,
      [
        updated.agentEnabled ? 1 : 0,
        updated.language,
        updated.greetingEn.trim(),
        updated.greetingEs.trim(),
        updated.maxFollowups,
        updated.earlySpamScreening ? 1 : 0,
        updated.callbackVerification ? 1 : 0,
        user.accountId,
      ],
    );

    return this.read(user.accountId);
  }
  async getForAccount(accountId: number): Promise<AccountSettings> {
  if (!Number.isSafeInteger(accountId) || accountId <= 0) {
    throw new ForbiddenException('Invalid account');
  }

  return this.read(accountId);
}
}
