
import {
  ForbiddenException,
  Injectable,
} from '@nestjs/common';

import { DataSource } from 'typeorm';

export type AccountAction =
  | 'PURCHASE'
  | 'SERVICE'
  | 'ACCOUNT_ACCESS';

interface AccountAccessRow {
  id: number | string;
  status: 'ACTIVE' | 'SUSPENDED' | 'CANCELED';
  admin_locked: number | boolean;
  admin_lock_mode:
    | 'NONE'
    | 'PURCHASES'
    | 'SERVICE'
    | 'FULL';
}

@Injectable()
export class AccountAccessPolicyService {
  constructor(private readonly db: DataSource) {}

  async assertAccountAllowed(
    accountId: number,
    action: AccountAction,
  ): Promise<void> {
    if (!Number.isSafeInteger(accountId) || accountId <= 0) {
      throw new ForbiddenException('Invalid account');
    }

    const rows: AccountAccessRow[] = await this.db.query(
      `SELECT
         id,
         status,
         admin_locked,
         admin_lock_mode
       FROM accounts
       WHERE id = ?
       LIMIT 1`,
      [accountId],
    );

    if (!rows.length) {
      throw new ForbiddenException('Account not found');
    }

    const account = rows[0];

    const locked = Boolean(account.admin_locked);
    const mode = account.admin_lock_mode;

    // Fail closed if lock fields are inconsistent.
    if (locked !== (mode !== 'NONE')) {
    throw new ForbiddenException(
        'Account requires administrative review',
    );
    }

    // FULL lock cannot be overridden by the customer.
    if (mode === 'FULL') {
      throw new ForbiddenException(
        'Account blocked by platform administrator',
      );
    }

    if (
      action === 'PURCHASE' &&
      (mode === 'PURCHASES' || mode === 'SERVICE')
    ) {
      throw new ForbiddenException(
        'Purchases disabled by platform administrator',
      );
    }

    if (
      action === 'SERVICE' &&
      mode === 'SERVICE'
    ) {
      throw new ForbiddenException(
        'Service disabled by platform administrator',
      );
    }

    // Account lifecycle restrictions.
    if (account.status === 'CANCELED') {
      throw new ForbiddenException(
        'Account has been canceled',
      );
    }

    if (
      account.status === 'SUSPENDED' &&
      action !== 'ACCOUNT_ACCESS'
    ) {
      throw new ForbiddenException(
        'Account is suspended',
      );
    }
  }

  async assertPhoneAllowed(
    phoneId: number,
    accountId: number,
  ): Promise<void> {
    await this.assertAccountAllowed(
      accountId,
      'SERVICE',
    );

    const rows: Array<{
      admin_locked: number | boolean;
      account_id: number | string | null;
      active: number | boolean;
    }> = await this.db.query(
      `SELECT
         admin_locked,
         account_id,
         active
       FROM phone_numbers
       WHERE id = ?
         AND account_id = ?
       LIMIT 1`,
      [phoneId, accountId],
    );

    if (!rows.length) {
      throw new ForbiddenException(
        'Phone number does not belong to this account',
      );
    }

    if (Boolean(rows[0].admin_locked)) {
      throw new ForbiddenException(
        'Phone number blocked by platform administrator',
      );
    }

    if (!Boolean(rows[0].active)) {
      throw new ForbiddenException(
        'Phone number is inactive',
      );
    }
  }

  async assertCanPurchaseNumber(
    accountId: number,
  ): Promise<void> {
    await this.assertAccountAllowed(
      accountId,
      'PURCHASE',
    );

    // Future checks:
    // - Subscription billing status
    // - Available balance
    // - Number quota
    // - Outstanding payments
    //
    // These are not implemented yet.
    // Do not treat this check alone as purchase authorization.
  }
}
