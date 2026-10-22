
import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { DataSource } from 'typeorm';
import { AuthenticatedRequest } from './jwt-auth.guard';

@Injectable()
export class SuperAdminGuard implements CanActivate {
  constructor(private readonly db: DataSource) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request =
      context.switchToHttp().getRequest<AuthenticatedRequest>();

    const userId = request.user?.id;

    if (!Number.isSafeInteger(userId) || userId <= 0) {
      throw new UnauthorizedException();
    }

    const rows: Array<{
      role: string;
      active: number;
    }> = await this.db.query(
      `SELECT role, active
       FROM users
       WHERE id = ?
       LIMIT 1`,
      [userId],
    );

    const user = rows[0];

    if (!user || !Boolean(user.active)) {
      throw new ForbiddenException('Account is inactive');
    }

    if (user.role !== 'SUPER_ADMIN') {
      throw new ForbiddenException(
        'Super Admin access required',
      );
    }

    return true;
  }
}
