import {
  Controller,
  Get,
  Param,
  ParseIntPipe,
  Query,
  UseGuards,
} from "@nestjs/common";

import { JwtAuthGuard } from "../auth/jwt-auth.guard";
import { SuperAdminGuard } from "../auth/super-admin.guard";

import { SubscriptionAccessService } from "../subscription/subscription-access.service";
import { TelnyxNumbersService } from "../telnyx/telnyx-numbers.service";

@Controller("admin/accounts")
@UseGuards(JwtAuthGuard, SuperAdminGuard)
export class AdminPhoneSearchController {
  constructor(
    private readonly subscriptions: SubscriptionAccessService,
    private readonly telnyxNumbers: TelnyxNumbersService,
  ) {}

  @Get(":id/available-numbers")
  async search(
    @Param("id", ParseIntPipe) accountId: number,
    @Query("areaCode") areaCode?: string,
    @Query("state") state?: string,
    @Query("city") city?: string,
    @Query("bestEffort") bestEffort?: string,
  ) {
    const eligibility = await this.subscriptions.assertCanAddNumber(accountId);

    const result = await this.telnyxNumbers.searchAvailableNumbers({
      areaCode,
      state,
      city,
      bestEffort: bestEffort === "true",
      limit: 10,
    });

    return {
      accountId,
      eligibility,
      ...result,
    };
  }
}
