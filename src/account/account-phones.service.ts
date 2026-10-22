
import {
  BadRequestException,
  ForbiddenException,
  Injectable,
} from '@nestjs/common';
import { DataSource } from 'typeorm';

export interface AccountPhone {
  id: number;
  number: string;
  active: boolean;
  isPrimary: boolean;
}

@Injectable()
export class AccountPhonesService {
  constructor(private readonly db: DataSource) {}

  async listForUser(userId: number): Promise<AccountPhone[]> {
    if (!Number.isSafeInteger(userId) || userId <= 0) {
      throw new BadRequestException('Invalid user ID');
    }

    const users: Array<{
      account_id: number | string;
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

    if (!users.length) {
      throw new ForbiddenException(
        'No active customer account assigned',
      );
    }

    const accountId = Number(users[0].account_id);

    const rows: Array<{
      id: number | string;
      telnyx_e164: string;
      active: number | boolean;
    }> = await this.db.query(
      `SELECT
         pn.id,
         pn.telnyx_e164,
         pn.active
       FROM phone_numbers pn
       INNER JOIN users owner
         ON owner.id = pn.user_id
        AND owner.account_id = pn.account_id
       WHERE pn.account_id = ?
       ORDER BY pn.id ASC`,
      [accountId],
    );

    return rows.map((row, index) => ({
      id: Number(row.id),
      number: row.telnyx_e164,
      active: Boolean(row.active),
      isPrimary: index === 0,
    }));
  }
}
