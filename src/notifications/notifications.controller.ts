
import {
  Body,
  Controller,
  Get,
  Put,
  Req,
  UseGuards,
} from '@nestjs/common';

import { NotificationsService } from './notifications.service';
import {
  AuthenticatedRequest,
  JwtAuthGuard,
} from '../auth/jwt-auth.guard';

import type {
  NotificationPreferences,
} from './notifications.service';

@Controller('notifications')
@UseGuards(JwtAuthGuard)
export class NotificationsController {
  constructor(
    private readonly notifications: NotificationsService,
  ) {}

  @Get('preferences')
  getPreferences(
    @Req() request: AuthenticatedRequest,
  ) {
    return this.notifications.getPreferences(request.user.id);
  }

  @Put('preferences')
  updatePreferences(
    @Req() request: AuthenticatedRequest,
    @Body() changes: Partial<NotificationPreferences>,
  ) {
    return this.notifications.updatePreferences(
      request.user.id,
      changes,
    );
  }
}
