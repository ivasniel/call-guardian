
import { Module } from '@nestjs/common';

import { AuthModule } from '../auth/auth.module';
import { AccountSettingsController } from './account-settings.controller';
import { AccountSettingsService } from './account-settings.service';

@Module({
  imports: [AuthModule],
  controllers: [AccountSettingsController],
  providers: [AccountSettingsService],
  exports: [AccountSettingsService],
})
export class AccountModule {}
