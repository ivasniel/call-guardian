import { Module } from "@nestjs/common";

import { AuthModule } from "../auth/auth.module";
import { SuperAdminGuard } from "../auth/super-admin.guard";
import { AdminAccountsController } from "./admin-accounts.controller";
import { AdminAccountsService } from "./admin-accounts.service";
import { AdminCourtesyController } from "./admin-courtesy.controller";
import { AdminCourtesyService } from "./admin-courtesy.service";
import { SubscriptionModule } from "../subscription/subscription.module";
import { AdminSubscriptionController } from "./admin-subscription.controller";
import { AdminPhoneSearchController } from "./admin-phone-search.controller";
import { TelnyxNumbersService } from "../telnyx/telnyx-numbers.service";

@Module({
  imports: [AuthModule, SubscriptionModule],
  controllers: [
    AdminAccountsController,
    AdminPhoneSearchController,
    AdminCourtesyController,
    AdminSubscriptionController,
  ],
  providers: [
    SuperAdminGuard,
    AdminAccountsService,
    AdminCourtesyService,
    TelnyxNumbersService,
  ],
})
export class AdminModule {}
