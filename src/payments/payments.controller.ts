import { Body, Controller, Get, Param, Post } from '@nestjs/common';
import { ConfirmPaymentDto } from './dto/confirm-payment.dto';
import { CreatePaymentDto } from './dto/create-payment.dto';
import { PaymentsService } from './payments.service';

@Controller('payments')
export class PaymentsController {
  constructor(private readonly paymentsService: PaymentsService) {}

  @Post()
  create(@Body() createPaymentDto: CreatePaymentDto) {
    return this.paymentsService.create(createPaymentDto);
  }

  @Post(':orderId/confirm')
  confirm(
    @Param('orderId') orderId: string,
    @Body() confirmPaymentDto: ConfirmPaymentDto,
  ) {
    return this.paymentsService.confirm(orderId, confirmPaymentDto);
  }

  @Get()
  findAll() {
    return this.paymentsService.findAll();
  }
}
