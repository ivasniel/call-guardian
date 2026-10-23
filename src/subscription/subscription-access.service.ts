
import {
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { DataSource } from 'typeorm';
import { AccountAccessPolicyService } from '../account/account-access-policy.service';

interface SubscriptionRow {
  id: string | number;
  source: 'PAID' | 'ADMIN_COURTESY';
  status: string;
  max_numbers: string | number;
  max_users: string | number;
  included_calls: string | number;
  included_minutes: string | number;
  allow_additional_numbers: number | boolean;
  starts_at: Date | string;
  ends_at: Date | string;
}

@Injectable()
export class SubscriptionAccessService {
  constructor(
    private readonly db: DataSource,
    private readonly accountPolicy: AccountAccessPolicyService,
  ) {}

  async assertCanAddNumber(accountId: number) {
    if (!Number.isSafeInteger(accountId) || accountId <= 0) {
      throw new ForbiddenException('Invalid account');
    }

    // Existing administrative restrictions take precedence.
    await this.accountPolicy.assertCanPurchaseNumber(accountId);

    const accounts = await this.db.query(
      `SELECT id, account_type
       FROM accounts
       WHERE id = ?
       LIMIT 1`,
      [accountId],
    );

    if (!accounts.length) {
      throw new NotFoundException('Account not found');
    }

    const subscriptions: SubscriptionRow[] = await this.db.query(
      `SELECT
         id,
         source,
         status,
         max_numbers,
         max_users,
         included_calls,
         included_minutes,
         allow_additional_numbers,
         starts_at,
         ends_at
       FROM account_subscriptions
       WHERE account_id = ?
         AND status = 'ACTIVE'
         AND starts_at <= UTC_TIMESTAMP()
         AND ends_at > UTC_TIMESTAMP()
       ORDER BY id DESC
       LIMIT 2`,
      [accountId],
    );

    if (subscriptions.length === 0) {
      throw new ForbiddenException(
        'An active subscription is required',
      );
    }

    if (subscriptions.length > 1) {
      throw new ConflictException(
        'Multiple active subscriptions detected',
      );
    }

    const subscription = subscriptions[0];

    if (
      subscription.source !== 'PAID' &&
      subscription.source !== 'ADMIN_COURTESY'
    ) {
      throw new ForbiddenException(
        'Unsupported subscription source',
      );
    }

    // Courtesy grants are valid authorization without a payment.
    // PAID subscriptions must only be activated by trusted billing
    // verification; that workflow is not implemented yet.
    const maxNumbers = Number(subscription.max_numbers);

    if (!Number.isSafeInteger(maxNumbers) || maxNumbers < 1) {
      throw new ForbiddenException('Invalid subscription limits');
    }

    const counts = await this.db.query(
      `SELECT COUNT(*) AS total
       FROM phone_numbers
       WHERE account_id = ?`,
      [accountId],
    );

    const currentNumbers = Number(counts[0].total);

    if (
      !Number.isSafeInteger(currentNumbers) ||
      currentNumbers < 0
    ) {
      throw new ForbiddenException('Invalid number count');
    }

    if (accounts[0].account_type === 'PERSONAL') {
      if (currentNumbers >= 1) {
        throw new ForbiddenException(
          'Personal accounts support only one number',
        );
      }
    }

    if (currentNumbers >= maxNumbers) {
      throw new ForbiddenException(
        'Phone number limit reached',
      );
    }

    return {
      allowed: true,
      accountId,
      subscriptionId: Number(subscription.id),
      source: subscription.source,
      maxNumbers,
      currentNumbers,
      remainingNumbers: maxNumbers - currentNumbers,
      requiresRealPurchaseApproval: true,
    };
  }
}
