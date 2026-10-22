import {
  BadRequestException,
  Injectable,
  HttpException,
  HttpStatus,
} from "@nestjs/common";
import { DataSource } from "typeorm";
import { createHash, randomBytes } from "node:crypto";
import { EmailService } from "./email.service";

@Injectable()
export class EmailVerificationService {
  constructor(
    private readonly db: DataSource,
    private readonly email: EmailService,
  ) {}

  private hash(token: string): string {
    return createHash("sha256").update(token).digest("hex");
  }

  async send(userId: number): Promise<{ message: string }> {
    const users: Array<{
      id: number;
      email: string | null;
      email_verified_at: Date | null;
    }> = await this.db.query(
      `SELECT id, email, email_verified_at
       FROM users WHERE id = ? LIMIT 1`,
      [userId],
    );

    const user = users[0];

    if (!user?.email) {
      throw new BadRequestException("Configure your email address first");
    }

    if (user.email_verified_at) {
      return { message: "Email already verified" };
    }

    const recent: Array<{ total: number }> = await this.db.query(
      `SELECT COUNT(*) AS total
       FROM email_verification_tokens
       WHERE user_id = ?
         AND created_at >= NOW() - INTERVAL 1 HOUR`,
      [userId],
    );

    if (Number(recent[0]?.total || 0) >= 3) {
      throw new HttpException(
        "Too many verification requests. Try again later.",
        HttpStatus.TOO_MANY_REQUESTS,
      );
    }

    const token = randomBytes(32).toString("hex");
    const tokenHash = this.hash(token);

    await this.db.query(
      `INSERT INTO email_verification_tokens
       (user_id, token_hash, expires_at)
       VALUES (?, ?, DATE_ADD(NOW(), INTERVAL 30 MINUTE))`,
      [userId, tokenHash],
    );

    await this.email.sendVerification(user.email, token);

    return {
      message: "Verification email sent",
    };
  }

  async verify(token: string): Promise<{ verified: boolean }> {
    if (typeof token !== "string" || !/^[a-f0-9]{64}$/.test(token)) {
      throw new BadRequestException("Invalid verification token");
    }

    const result: any = await this.db.query(
      `UPDATE email_verification_tokens evt
       INNER JOIN users u ON u.id = evt.user_id
       SET
         evt.used_at = NOW(),
         u.email_verified_at = NOW()
       WHERE evt.token_hash = ?
         AND evt.used_at IS NULL
         AND evt.expires_at > NOW()
         AND u.email_verified_at IS NULL`,
      [this.hash(token)],
    );

    if (result.affectedRows === 0) {
      throw new BadRequestException("Verification link is invalid or expired");
    }

    return { verified: true };
  }
}
