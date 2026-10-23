
import {
  Controller,
  Get,
  Param,
  ParseIntPipe,
  UseGuards,
} from '@nestjs/common';

import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { SuperAdminGuard } from '../auth/super-admin.guard';
import { SubscriptionAccessService } from '../subscription/subscription-access.service';

@Controller('admin/accounts')
@UseGuards(JwtAuthGuard, SuperAdminGuard)
export class AdminSubscriptionController {
  constructor(
    private readonly subscriptions: SubscriptionAccessService,
  ) {}

  @Get(':id/number-eligibility')
  numberEligibility(
    @Param('id', ParseIntPipe) accountId: number,
  ) {
    return this.subscriptions.assertCanAddNumber(accountId);
  }
}
