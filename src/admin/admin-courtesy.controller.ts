import {
  Body,
  Controller,
  Param,
  ParseIntPipe,
  Post,
  Req,
  UseGuards,
  Get,
  Put,
} from "@nestjs/common";

import { AuthenticatedRequest, JwtAuthGuard } from "../auth/jwt-auth.guard";

import { SuperAdminGuard } from "../auth/super-admin.guard";

import {
  AdminCourtesyService,
  GrantCourtesyInput,
} from "./admin-courtesy.service";

@Controller("admin/accounts")
@UseGuards(JwtAuthGuard, SuperAdminGuard)
export class AdminCourtesyController {
  constructor(private readonly courtesy: AdminCourtesyService) {}

  @Post(":id/courtesy")
  grant(
    @Param("id", ParseIntPipe) accountId: number,
    @Req() request: AuthenticatedRequest,
    @Body() body: GrantCourtesyInput,
  ) {
    return this.courtesy.grant(accountId, request.user.id, body);
  }

  @Get(":id/subscription")
  getSubscription(@Param("id", ParseIntPipe) accountId: number) {
    return this.courtesy.getSubscription(accountId);
  }

  @Put(":id/courtesy/extend")
  extend(
    @Param("id", ParseIntPipe) accountId: number,
    @Req() request: AuthenticatedRequest,
    @Body()
    body: {
      additionalDays: number;
      reason: string;
    },
  ) {
    return this.courtesy.extend(accountId, request.user.id, body);
  }

  @Put(":id/courtesy/limits")
  updateLimits(
    @Param("id", ParseIntPipe) accountId: number,
    @Req() request: AuthenticatedRequest,
    @Body()
    body: {
      maxUsers: number;
      maxNumbers: number;
      includedCalls: number;
      includedMinutes: number;
      allowAdditionalNumbers: boolean;
      reason: string;
    },
  ) {
    return this.courtesy.updateLimits(accountId, request.user.id, body);
  }

  @Put(":id/courtesy/revoke")
  revoke(
    @Param("id", ParseIntPipe) accountId: number,
    @Req() request: AuthenticatedRequest,
    @Body() body: { reason: string },
  ) {
    return this.courtesy.revoke(accountId, request.user.id, body);
  }
}
