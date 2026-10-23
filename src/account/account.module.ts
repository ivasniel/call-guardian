
import { Module } from '@nestjs/common';

import { AuthModule } from '../auth/auth.module';

import { AccountSettingsController } from './account-settings.controller';
import { AccountSettingsService } from './account-settings.service';

import { AccountPhonesController } from './account-phones.controller';
import { AccountPhonesService } from './account-phones.service';
import { AccountAccessPolicyService } from './account-access-policy.service';

@Module({
  imports: [AuthModule],
  controllers: [
    AccountSettingsController,
    AccountPhonesController,
  ],
  providers: [
    AccountSettingsService,
    AccountPhonesService,
    AccountAccessPolicyService,
  ],
  exports: [
    AccountSettingsService,
    AccountPhonesService,
    AccountAccessPolicyService,
  ],
})
export class AccountModule {}
