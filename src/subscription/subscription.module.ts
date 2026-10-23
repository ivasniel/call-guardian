
import { Module } from '@nestjs/common';
import { AccountModule } from '../account/account.module';
import { SubscriptionAccessService } from './subscription-access.service';

@Module({
  imports: [AccountModule],
  providers: [SubscriptionAccessService],
  exports: [SubscriptionAccessService],
})
export class SubscriptionModule {}
