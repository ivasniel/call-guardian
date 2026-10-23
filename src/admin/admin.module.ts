
import { Module } from '@nestjs/common';

import { AuthModule } from '../auth/auth.module';
import { SuperAdminGuard } from '../auth/super-admin.guard';
import { AdminAccountsController } from './admin-accounts.controller';
import { AdminAccountsService } from './admin-accounts.service';
import { AdminCourtesyController } from './admin-courtesy.controller';
import { AdminCourtesyService } from './admin-courtesy.service';
import { SubscriptionModule } from '../subscription/subscription.module';
import { AdminSubscriptionController } from './admin-subscription.controller';

@Module({
  imports: [AuthModule, SubscriptionModule],
  controllers: [AdminAccountsController, AdminCourtesyController, AdminSubscriptionController],
  providers: [
    SuperAdminGuard,
    AdminAccountsService,
    AdminCourtesyService,
  ],
})
export class AdminModule {}
