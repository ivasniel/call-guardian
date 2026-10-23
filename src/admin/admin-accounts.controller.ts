import {
  Body,
  Controller,
  Get,
  Param,
  ParseIntPipe,
  Post,
  Put,
  Query,
  Req,
  UseGuards,
} from "@nestjs/common";

import type { AuthenticatedRequest } from "../auth/jwt-auth.guard";

import { JwtAuthGuard } from "../auth/jwt-auth.guard";
import { SuperAdminGuard } from "../auth/super-admin.guard";
import { AdminAccountsService } from "./admin-accounts.service";

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
    @Query("accountType") accountType?: string,
  ) {
    return this.accounts.list({
      page,
      pageSize,
      search,
      status,
      accountType,
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
      accountType?: "BUSINESS" | "PERSONAL";
    },
  ) {
    return this.accounts.create(body);
  }

  @Put(":id/lock")
  lockAccount(
    @Param("id", ParseIntPipe) accountId: number,
    @Req() request: AuthenticatedRequest,
    @Body()
    body: {
      mode: "PURCHASES" | "SERVICE" | "FULL";
      reason: string;
    },
  ) {
    return this.accounts.lockAccount(accountId, request.user.id, body);
  }

  @Put(":id/unlock")
  unlockAccount(
    @Param("id", ParseIntPipe) accountId: number,
    @Req() request: AuthenticatedRequest,
    @Body() body: { reason: string },
  ) {
    return this.accounts.unlockAccount(
      accountId,
      request.user.id,
      body?.reason,
    );
  }
}
