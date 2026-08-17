import { Module } from '@nestjs/common';
import { EmailModule } from '../email/email.module';
import { PaymentsModule } from '../payments/payments.module';
import { PaypalController } from './paypal.controller';
import { PaypalService } from './paypal.service';

@Module({
  imports: [PaymentsModule, EmailModule],
  controllers: [PaypalController],
  providers: [PaypalService],
})
export class PaypalModule {}
