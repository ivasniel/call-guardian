
import { Module } from '@nestjs/common';

import { AuthModule } from '../auth/auth.module';
import { SuperAdminGuard } from '../auth/super-admin.guard';
import { AdminAccountsController } from './admin-accounts.controller';
import { AdminAccountsService } from './admin-accounts.service';

@Module({
  imports: [AuthModule],
  controllers: [AdminAccountsController],
  providers: [
    SuperAdminGuard,
    AdminAccountsService,
  ],
})
export class AdminModule {}
