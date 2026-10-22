
import {
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { DataSource } from 'typeorm';
import * as bcrypt from 'bcryptjs';

interface AuthUser {
  id: number;
  name: string;
  email: string;
  password_hash: string;
}

@Injectable()
export class AuthService {
  constructor(
    private readonly db: DataSource,
    private readonly jwtService: JwtService,
  ) {}

  async login(email: string, password: string) {
    const invalidCredentials = () =>
      new UnauthorizedException('Invalid email or password');

    if (
      typeof email !== 'string' ||
      typeof password !== 'string' ||
      !email.trim() ||
      !password
    ) {
      throw invalidCredentials();
    }

    const rows: AuthUser[] = await this.db.query(
      `SELECT id, name, email, password_hash
       FROM users
       WHERE email = ?
       LIMIT 1`,
      [email.trim().toLowerCase()],
    );

    const user = rows[0];

    if (!user?.password_hash) {
      throw invalidCredentials();
    }

    const valid = await bcrypt.compare(
      password,
      user.password_hash,
    );

    if (!valid) {
      throw invalidCredentials();
    }

    const accessToken = await this.jwtService.signAsync({
      sub: String(user.id),
    });

    return {
      accessToken,
      tokenType: 'Bearer',
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
      },
    };
  }

  async getProfile(userId: number) {
    const rows: Array<{
      id: number;
      name: string;
      email: string;
    }> = await this.db.query(
      `SELECT id, name, email
       FROM users
       WHERE id = ?
       LIMIT 1`,
      [userId],
    );

    if (!rows.length) {
      throw new UnauthorizedException('User not found');
    }

    return rows[0];
  }

async me(userId: number) {
  const rows: Array<{
    id: string;
    name: string;
    email: string;
    role: string;
    account_id: string | null;
    active: number;
  }> = await this.db.query(
    `SELECT
       id,
       name,
       email,
       role,
       account_id,
       active
     FROM users
     WHERE id = ?
     LIMIT 1`,
    [userId],
  );

  const user = rows[0];

  if (!user || !Boolean(user.active)) {
    throw new UnauthorizedException('User not found or inactive');
  }

  return {
    id: Number(user.id),
    name: user.name,
    email: user.email,
    role: user.role,
    accountId:
      user.account_id === null
        ? null
        : Number(user.account_id),
    active: Boolean(user.active),
  };
}

}
