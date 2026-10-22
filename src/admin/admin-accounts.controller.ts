import { Controller, Get, Query, UseGuards } from "@nestjs/common";

import { JwtAuthGuard } from "../auth/jwt-auth.guard";
import { SuperAdminGuard } from "../auth/super-admin.guard";
import { AdminAccountsService } from "./admin-accounts.service";
import { Body, Post } from "@nestjs/common";

@Controller("admin/accounts")
@UseGuards(JwtAuthGuard, SuperAdminGuard)
export class AdminAccountsController {
  constructor(private readonly accounts: AdminAccountsService) {}

  @Get()
  list(
    @Query("page") page?: string,
    @Query("pageSize") pageSize?: string,
    @Query("search") search?: string,
    @Query("status") status?: string,
  ) {
    return this.accounts.list({
      page,
      pageSize,
      search,
      status,
    });
  }
  @Post()
  create(
    @Body()
    body: {
      name: string;
      ownerName: string;
      ownerEmail: string;
      ownerPhone: string;
      password: string;
    },
  ) {
    return this.accounts.create(body);
  }
}
