import { Body, Controller, Get, Post, Query, Res } from '@nestjs/common';
import type { Response } from 'express';
import { CapturePaypalOrderDto } from './dto/capture-paypal-order.dto';
import { CreatePaypalOrderDto } from './dto/create-paypal-order.dto';
import { PaypalService } from './paypal.service';

@Controller('paypal')
export class PaypalController {
  constructor(private readonly paypalService: PaypalService) {}

  @Post('create-order')
  createOrder(@Body() createPaypalOrderDto: CreatePaypalOrderDto) {
    return this.paypalService.createOrder(createPaypalOrderDto.orderId);
  }

  @Post('capture-order')
  captureOrder(@Body() capturePaypalOrderDto: CapturePaypalOrderDto) {
    return this.paypalService.captureOrder(
      capturePaypalOrderDto.orderId,
      capturePaypalOrderDto.paypalOrderId,
    );
  }

  @Get('return')
  async handleReturn(
    @Query('token') token: string,
    @Res() response: Response,
  ) {
    const result = await this.paypalService.handleReturn(token);
    return response.status(result.statusCode).type('html').send(result.html);
  }

  @Get('cancel')
  handleCancel(@Res() response: Response) {
    const result = this.paypalService.handleCancel();
    return response.status(result.statusCode).type('html').send(result.html);
  }
}
