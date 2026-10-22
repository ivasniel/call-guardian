
import { Injectable } from '@nestjs/common';
import { DataSource } from 'typeorm';

export interface ContactMatch {
  id: number;
  display_name: string;
  classification: 'TRUSTED' | 'NORMAL' | 'BLOCKED';
  priority: number;
}

@Injectable()
export class ContactsService {
  constructor(private readonly db: DataSource) {}

  // Compatibility method. Incoming calls now resolve the
  // account using CallsService.resolveIncomingAccount().
  async resolveDestination(dialed: string): Promise<number | null> {
    const rows: Array<{ user_id: string | number }> =
      await this.db.query(
        `SELECT pn.user_id
         FROM phone_numbers pn
         INNER JOIN accounts a
           ON a.id = pn.account_id
         INNER JOIN users u
           ON u.id = pn.user_id
          AND u.account_id = pn.account_id
         WHERE pn.telnyx_e164 = ?
           AND pn.active = 1
           AND a.status = 'ACTIVE'
           AND u.active = 1
         LIMIT 2`,
        [dialed],
      );

    return rows.length === 1
      ? Number(rows[0].user_id)
      : null;
  }

  // Look up contacts belonging to the customer account.
  async find(
    accountId: number,
    from: string,
  ): Promise<ContactMatch | null> {
    const rows: ContactMatch[] = await this.db.query(
      `SELECT
         id,
         display_name,
         classification,
         priority
       FROM contacts
       WHERE account_id = ?
         AND phone_e164 = ?
       LIMIT 1`,
      [accountId, from],
    );

    return rows[0] ?? null;
  }
}
