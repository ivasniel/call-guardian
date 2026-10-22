import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import { DataSource } from "typeorm";

const DEFAULT_CATEGORIES = {
  JOB: true,
  SCHOOL: true,
  HEALTH: true,
  PERSONAL: true,
  BUSINESS: true,
  SALES: false,
  SPAM: false,
  UNKNOWN: true,
};

type Category = keyof typeof DEFAULT_CATEGORIES;
type CategorySettings = Record<Category, boolean>;
type PriorityFilter = "ALL" | "HIGH";

export interface NotificationPreferences {
  enabled: boolean;
  whatsappEnabled: boolean;
  emailEnabled: boolean;
  whatsappNumber: string | null;
  emailAddress: string | null;
  priorityFilter: PriorityFilter;
  categories: CategorySettings;
}

@Injectable()
export class NotificationsService {
  constructor(private readonly db: DataSource) {}

  private defaults(): NotificationPreferences {
    return {
      enabled: false,
      whatsappEnabled: false,
      emailEnabled: false,
      whatsappNumber: null,
      emailAddress: null,
      priorityFilter: "ALL",
      categories: { ...DEFAULT_CATEGORIES },
    };
  }

  async getPreferences(userId: number): Promise<NotificationPreferences> {
    const user = await this.requireActiveCustomer(userId);

    const defaults = this.defaults();
    defaults.whatsappNumber = user.phone;

    await this.db.query(
      `INSERT IGNORE INTO notification_preferences
       (user_id, enabled, whatsapp_enabled, email_enabled,
        whatsapp_number, priority_filter, categories)
       VALUES (?, 0, 0, 0, ?, 'ALL', ?)`,
      [userId, defaults.whatsappNumber, JSON.stringify(defaults.categories)],
    );

    const rows: any[] = await this.db.query(
      "SELECT * FROM notification_preferences WHERE user_id = ? LIMIT 1",
      [userId],
    );

    const row = rows[0];

    const rawCategories =
      typeof row.categories === "string"
        ? JSON.parse(row.categories)
        : row.categories;

    return {
      enabled: Boolean(row.enabled),
      whatsappEnabled: Boolean(row.whatsapp_enabled),
      emailEnabled: Boolean(row.email_enabled),
      whatsappNumber: row.whatsapp_number,
      emailAddress: user.emailAddress,
      priorityFilter: row.priority_filter,
      categories: {
        ...DEFAULT_CATEGORIES,
        ...(rawCategories || {}),
      },
    };
  }

  async updatePreferences(
    userId: number,
    changes: Partial<NotificationPreferences>,
  ): Promise<NotificationPreferences> {
    if (!changes || typeof changes !== "object" || Array.isArray(changes)) {
      throw new BadRequestException("Invalid preferences");
    }

    const allowedKeys = [
      "enabled",
      "whatsappEnabled",
      "emailEnabled",
      "whatsappNumber",
      "priorityFilter",
      "categories",
    ];

    if (Object.keys(changes).some((key) => !allowedKeys.includes(key))) {
      throw new BadRequestException("Unknown preference field");
    }

    const current = await this.getPreferences(userId);

    for (const key of ["enabled", "whatsappEnabled", "emailEnabled"] as const) {
      if (changes[key] !== undefined && typeof changes[key] !== "boolean") {
        throw new BadRequestException(`${key} must be boolean`);
      }
    }

    if (
      changes.priorityFilter !== undefined &&
      changes.priorityFilter !== "ALL" &&
      changes.priorityFilter !== "HIGH"
    ) {
      throw new BadRequestException("Invalid priority filter");
    }

    if (changes.whatsappNumber !== undefined) {
      const number = changes.whatsappNumber;

      if (
        number !== null &&
        (typeof number !== "string" || !/^\+[1-9]\d{7,14}$/.test(number))
      ) {
        throw new BadRequestException("WhatsApp number must use E.164 format");
      }
    }

    if (changes.categories !== undefined) {
      const categories = changes.categories;

      if (
        !categories ||
        typeof categories !== "object" ||
        Array.isArray(categories)
      ) {
        throw new BadRequestException("Invalid categories");
      }

      for (const [key, value] of Object.entries(categories)) {
        if (!(key in DEFAULT_CATEGORIES) || typeof value !== "boolean") {
          throw new BadRequestException(`Invalid category: ${key}`);
        }
      }
    }

    const updated: NotificationPreferences = {
      ...current,
      ...changes,
      categories: {
        ...current.categories,
        ...(changes.categories || {}),
      },
    };

    await this.db.query(
      `UPDATE notification_preferences SET
         enabled = ?,
         whatsapp_enabled = ?,
         email_enabled = ?,
         whatsapp_number = ?,
         priority_filter = ?,
         categories = ?
       WHERE user_id = ?`,
      [
        updated.enabled ? 1 : 0,
        updated.whatsappEnabled ? 1 : 0,
        updated.emailEnabled ? 1 : 0,
        updated.whatsappNumber,
        updated.priorityFilter,
        JSON.stringify(updated.categories),
        userId,
      ],
    );

    return this.getPreferences(userId);
  }

  private async requireActiveCustomer(userId: number): Promise<{
    id: number;
    accountId: number;
    phone: string | null;
    emailAddress: string | null;
  }> {
    if (!Number.isSafeInteger(userId) || userId <= 0) {
      throw new BadRequestException("Invalid user ID");
    }

    const rows: Array<{
      id: string | number;
      account_id: string | number | null;
      phone_e164: string | null;
      email: string | null;
    }> = await this.db.query(
      `
    SELECT
      u.id,
      u.account_id,
      u.phone_e164,
      u.email
    FROM users u
    INNER JOIN accounts a
      ON a.id = u.account_id
    WHERE u.id = ?
      AND u.active = 1
      AND u.role IN ('ACCOUNT_ADMIN', 'ACCOUNT_USER')
      AND a.status = 'ACTIVE'
    LIMIT 1
    `,
      [userId],
    );

    if (!rows.length) {
      throw new ForbiddenException("No active customer account assigned");
    }

    return {
      id: Number(rows[0].id),
      accountId: Number(rows[0].account_id),
      phone: rows[0].phone_e164,
      emailAddress: rows[0].email,
    };
  }
}
