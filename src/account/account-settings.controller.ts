
import {
  Body,
  Controller,
  Get,
  Put,
  Req,
  UseGuards,
} from '@nestjs/common';

import {
  AuthenticatedRequest,
  JwtAuthGuard,
} from '../auth/jwt-auth.guard';

import {
  AccountSettingsService,
  UpdateAccountSettings,
} from './account-settings.service';

@Controller('account/settings')
@UseGuards(JwtAuthGuard)
export class AccountSettingsController {
  constructor(
    private readonly settings: AccountSettingsService,
  ) {}

  @Get()
  get(@Req() request: AuthenticatedRequest) {
    return this.settings.getForUser(request.user.id);
  }

  @Put()
  update(
    @Req() request: AuthenticatedRequest,
    @Body() changes: UpdateAccountSettings,
  ) {
    return this.settings.updateForUser(
      request.user.id,
      changes,
    );
  }
}
