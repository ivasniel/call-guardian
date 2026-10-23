
import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';

import { JwtService } from '@nestjs/jwt';
import { DataSource } from 'typeorm';
import { Request } from 'express';

export interface AuthenticatedRequest extends Request {
  user: {
    id: number;
  };
}

interface AuthUserRow {
  id: number | string;
  role: 'SUPER_ADMIN' | 'ACCOUNT_ADMIN' | 'ACCOUNT_USER';
  active: number | boolean;
  account_id: number | string | null;
  account_status: 'ACTIVE' | 'SUSPENDED' | 'CANCELED' | null;
  admin_locked: number | boolean | null;
  admin_lock_mode: 'NONE' | 'PURCHASES' | 'SERVICE' | 'FULL' | null;
}

@Injectable()
export class JwtAuthGuard implements CanActivate {
  constructor(
    private readonly jwt: JwtService,
    private readonly db: DataSource,
  ) {}

  async canActivate(
    context: ExecutionContext,
  ): Promise<boolean> {
    const request =
      context.switchToHttp().getRequest<AuthenticatedRequest>();

    const authorization = request.headers.authorization;

    if (typeof authorization !== 'string') {
      throw new UnauthorizedException('Authorization required');
    }

    const match = /^Bearer\s+(.+)$/i.exec(authorization);

    if (!match) {
      throw new UnauthorizedException('Invalid authorization header');
    }

    let userId: number;

    // Only JWT errors should be converted to Unauthorized.
    try {
      const payload = await this.jwt.verifyAsync<{
        sub: string | number;
      }>(match[1]);

      userId = Number(payload.sub);

      if (!Number.isSafeInteger(userId) || userId <= 0) {
        throw new UnauthorizedException('Invalid token subject');
      }
    } catch {
      throw new UnauthorizedException('Invalid or expired token');
    }

    // Verify the current user and account state on every request.
    // This also prevents previously issued JWTs from bypassing a lock.
    const rows: AuthUserRow[] = await this.db.query(
      `SELECT
         u.id,
         u.role,
         u.active,
         u.account_id,
         a.status AS account_status,
         a.admin_locked,
         a.admin_lock_mode
       FROM users u
       LEFT JOIN accounts a ON a.id = u.account_id
       WHERE u.id = ?
       LIMIT 1`,
      [userId],
    );

    if (!rows.length || !Boolean(rows[0].active)) {
      throw new UnauthorizedException(
        'User account is inactive or unavailable',
      );
    }

    const user = rows[0];

    // Platform administrators are not customer accounts.
    if (user.role === 'SUPER_ADMIN') {
      if (user.account_id !== null) {
        throw new ForbiddenException(
          'Invalid platform administrator assignment',
        );
      }

      request.user = { id: userId };
      return true;
    }

    if (
      user.role !== 'ACCOUNT_ADMIN' &&
      user.role !== 'ACCOUNT_USER'
    ) {
      throw new ForbiddenException('Invalid user role');
    }

    if (
      user.account_id === null ||
      user.account_status === null
    ) {
      throw new ForbiddenException(
        'No customer account assigned',
      );
    }

    if (user.account_status === 'CANCELED') {
      throw new ForbiddenException('Account canceled');
    }

    const locked = Boolean(user.admin_locked);
    const mode = user.admin_lock_mode;

    // Block inconsistent administrative lock states.
    if (locked !== (mode !== 'NONE')) {
      throw new ForbiddenException(
        'Account requires administrative review',
      );
    }

    // Only FULL blocks general authenticated access.
    if (locked && mode === 'FULL') {
      throw new ForbiddenException(
        'Account blocked by platform administrator',
      );
    }

    // Keep normal read access for suspended accounts for now.
    // Purchase and service restrictions are checked separately.

    request.user = { id: userId };

    return true;
  }
}
