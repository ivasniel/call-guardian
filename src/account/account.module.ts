
import { Module } from '@nestjs/common';

import { AuthModule } from '../auth/auth.module';

import { AccountSettingsController } from './account-settings.controller';
import { AccountSettingsService } from './account-settings.service';

import { AccountPhonesController } from './account-phones.controller';
import { AccountPhonesService } from './account-phones.service';

@Module({
  imports: [AuthModule],
  controllers: [
    AccountSettingsController,
    AccountPhonesController,
  ],
  providers: [
    AccountSettingsService,
    AccountPhonesService,
  ],
  exports: [
    AccountSettingsService,
    AccountPhonesService,
  ],
})
export class AccountModule {}
