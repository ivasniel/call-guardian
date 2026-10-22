
import { Injectable } from '@nestjs/common';
import { DataSource } from 'typeorm';
import {
  BadRequestException,
  ConflictException,
  InternalServerErrorException,
} from '@nestjs/common';

import * as bcrypt from 'bcryptjs';
import { randomBytes } from 'node:crypto';

@Injectable()
export class AdminAccountsService {
  constructor(private readonly db: DataSource) {}

  async list(query: {
    page?: string;
    pageSize?: string;
    search?: string;
    status?: string;
  }) {
    const parsePositiveInt = (
      value: string | undefined,
      fallback: number,
    ): number => {
      if (!value || !/^[1-9]\d*$/.test(value)) return fallback;

      const number = Number(value);
      return Number.isSafeInteger(number) ? number : fallback;
    };

    const page = Math.min(
      parsePositiveInt(query.page, 1),
      1000000,
    );

    const requestedSize = parsePositiveInt(query.pageSize, 10);
    const pageSize = [10, 20, 50, 100].includes(requestedSize)
      ? requestedSize
      : 10;

    const filters: string[] = ['1 = 1'];
    const values: Array<string | number> = [];

    const search = (query.search || '').trim().slice(0, 120);

    if (search) {
      const escaped = search.replace(/[\\%_]/g, '\\$&');
      filters.push(
        `(a.name LIKE ? OR a.slug LIKE ?)`,
      );
      values.push(`%${escaped}%`, `%${escaped}%`);
    }

    const status = query.status?.toUpperCase();

    if (
      status &&
      ['ACTIVE', 'SUSPENDED', 'CANCELED'].includes(status)
    ) {
      filters.push('a.status = ?');
      values.push(status);
    }

    const where = filters.join(' AND ');

    const countRows: Array<{ total: number }> =
      await this.db.query(
        `SELECT COUNT(*) AS total
         FROM accounts a
         WHERE ${where}`,
        values,
      );

    const totalItems = Number(countRows[0]?.total ?? 0);
    const totalPages = Math.max(
      1,
      Math.ceil(totalItems / pageSize),
    );
    const currentPage = Math.min(page, totalPages);

    const items = await this.db.query(
      `SELECT
         a.id,
         a.name,
         a.slug,
         a.status,
         a.created_at AS createdAt,
         a.updated_at AS updatedAt,

         (SELECT COUNT(*)
          FROM users u
          WHERE u.account_id = a.id) AS totalUsers,

         (SELECT COUNT(*)
          FROM phone_numbers pn
          WHERE pn.account_id = a.id) AS totalNumbers,

         (SELECT COUNT(*)
          FROM calls c
          WHERE c.account_id = a.id) AS totalCalls

       FROM accounts a
       WHERE ${where}
       ORDER BY a.created_at DESC, a.id DESC
       LIMIT ? OFFSET ?`,
      [
        ...values,
        pageSize,
        (currentPage - 1) * pageSize,
      ],
    );

    return {
      items: items.map((item: any) => ({
        ...item,
        totalUsers: Number(item.totalUsers),
        totalNumbers: Number(item.totalNumbers),
        totalCalls: Number(item.totalCalls),
      })),
      pagination: {
        page: currentPage,
        pageSize,
        totalItems,
        totalPages,
      },
    };
  }

async create(input: {
  name: string;
  ownerName: string;
  ownerEmail: string;
  ownerPhone: string;
  password: string;
}) {
  const name = input.name?.trim();
  const ownerName = input.ownerName?.trim();
  const email = input.ownerEmail?.trim().toLowerCase();
  const phone = input.ownerPhone?.trim();
  const password = input.password;

  if (!name || name.length > 180) {
    throw new BadRequestException('Invalid business name');
  }

  if (!ownerName || ownerName.length > 255) {
    throw new BadRequestException('Invalid owner name');
  }

  if (
    !email ||
    email.length > 255 ||
    !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)
  ) {
    throw new BadRequestException('Invalid email address');
  }

  if (!phone || !/^\+[1-9]\d{7,14}$/.test(phone)) {
    throw new BadRequestException(
      'Phone must use E.164 format',
    );
  }

  if (
    typeof password !== 'string' ||
    password.length < 12 ||
    Buffer.byteLength(password, 'utf8') > 72
  ) {
    throw new BadRequestException(
      'Password must contain 12 to 72 bytes',
    );
  }

  const baseSlug =
    name
      .toLowerCase()
      .normalize('NFKD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-|-$/g, '')
      .slice(0, 90) || 'client';

  const slug = `${baseSlug}-${randomBytes(5).toString('hex')}`;
  const passwordHash = await bcrypt.hash(password, 12);

  const runner = this.db.createQueryRunner();
  await runner.connect();
  await runner.startTransaction();

  try {
    const existing: Array<{ id: number }> =
      await runner.query(
        `SELECT id FROM users WHERE email = ? LIMIT 1`,
        [email],
      );

    if (existing.length) {
      throw new ConflictException(
        'Email address is already registered',
      );
    }

    const accountResult = await runner.query(
      `INSERT INTO accounts (name, slug, status)
       VALUES (?, ?, 'ACTIVE')`,
      [name, slug],
    );

    const accountId = Number(accountResult.insertId);

    const userResult = await runner.query(
      `INSERT INTO users (
         account_id,
         role,
         active,
         name,
         email,
         phone_e164,
         password_hash
       )
       VALUES (?, 'ACCOUNT_ADMIN', 1, ?, ?, ?, ?)`,
      [
        accountId,
        ownerName,
        email,
        phone,
        passwordHash,
      ],
    );

    const ownerId = Number(userResult.insertId);

    await runner.commitTransaction();

    return {
      id: accountId,
      name,
      slug,
      status: 'ACTIVE',
      owner: {
        id: ownerId,
        name: ownerName,
        email,
        phone,
      },
    };
  } catch (error) {
    await runner.rollbackTransaction();

    if (
      error instanceof BadRequestException ||
      error instanceof ConflictException
    ) {
      throw error;
    }

    if ((error as { code?: string })?.code === 'ER_DUP_ENTRY') {
      throw new ConflictException(
        'Email or account identifier already exists',
      );
    }

    throw new InternalServerErrorException(
      'Could not create customer account',
    );
  } finally {
    await runner.release();
  }
}

}
