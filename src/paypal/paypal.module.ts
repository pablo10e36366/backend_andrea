import { Module } from '@nestjs/common';
import { PaymentsModule } from '../payments/payments.module';
import { PaypalController } from './paypal.controller';
import { PaypalService } from './paypal.service';

@Module({
  imports: [PaymentsModule],
  controllers: [PaypalController],
  providers: [PaypalService],
})
export class PaypalModule {}
