import {
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { ConfirmPaymentDto } from './dto/confirm-payment.dto';
import { CreatePaymentDto } from './dto/create-payment.dto';

@Injectable()
export class PaymentsService {
  constructor(private readonly prisma: PrismaService) {}

  async findOrderWithPayment(orderId: string) {
    const order = await this.prisma.order.findUnique({
      where: { id: orderId },
      include: {
        payment: true,
        user: true,
        product: true,
      },
    });

    if (!order) {
      throw new NotFoundException('Order not found');
    }

    return order;
  }

  async create(createPaymentDto: CreatePaymentDto) {
    const order = await this.findOrderWithPayment(createPaymentDto.orderId);

    if (order.payment) {
      throw new ConflictException('Payment already exists for this order');
    }

    return this.prisma.payment.create({
      data: {
        orderId: order.id,
        provider: createPaymentDto.provider,
        providerRef: createPaymentDto.providerRef,
        status: createPaymentDto.status ?? 'pending',
      },
      include: {
        order: {
          include: {
            user: true,
            product: true,
          },
        },
      },
    });
  }

  async ensurePendingPayment(
    orderId: string,
    provider: string,
    providerRef?: string,
  ) {
    const order = await this.findOrderWithPayment(orderId);

    if (order.payment) {
      return this.prisma.payment.update({
        where: { orderId },
        data: {
          provider,
          providerRef: providerRef ?? order.payment.providerRef,
          status: order.payment.status === 'paid' ? 'paid' : 'pending',
        },
      });
    }

    return this.prisma.payment.create({
      data: {
        orderId,
        provider,
        providerRef,
        status: 'pending',
      },
    });
  }

  async confirm(orderId: string, confirmPaymentDto: ConfirmPaymentDto) {
    const payment = await this.prisma.payment.findUnique({
      where: { orderId },
      include: {
        order: true,
      },
    });

    if (!payment) {
      throw new NotFoundException('Payment not found for this order');
    }

    return this.prisma.$transaction(async (tx) => {
      const updatedPayment = await tx.payment.update({
        where: { orderId },
        data: {
          status: 'paid',
          paidAt: new Date(),
          providerRef: confirmPaymentDto.providerRef ?? payment.providerRef,
        },
      });

      const updatedOrder = await tx.order.update({
        where: { id: orderId },
        data: {
          status: 'paid',
        },
      });

      const access = await tx.userProductAccess.upsert({
        where: {
          userId_productId: {
            userId: payment.order.userId,
            productId: payment.order.productId,
          },
        },
        update: {},
        create: {
          userId: payment.order.userId,
          productId: payment.order.productId,
        },
      });

      return {
        payment: updatedPayment,
        order: updatedOrder,
        access,
      };
    });
  }

  async findAll() {
    return this.prisma.payment.findMany({
      include: {
        order: {
          include: {
            user: true,
            product: true,
          },
        },
      },
      orderBy: { createdAt: 'desc' },
    });
  }
}
