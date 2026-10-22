
import {
  Controller,
  Get,
  Req,
  UseGuards,
} from '@nestjs/common';

import {
  AuthenticatedRequest,
  JwtAuthGuard,
} from '../auth/jwt-auth.guard';

import { AccountPhonesService } from './account-phones.service';

@Controller('account/phones')
@UseGuards(JwtAuthGuard)
export class AccountPhonesController {
  constructor(
    private readonly phones: AccountPhonesService,
  ) {}

  @Get()
  list(@Req() request: AuthenticatedRequest) {
    return this.phones.listForUser(request.user.id);
  }
}
