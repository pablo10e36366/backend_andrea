import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { UsersService } from '../users/users.service';
import { CreateOrderDto } from './dto/create-order.dto';

@Injectable()
export class OrdersService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly usersService: UsersService,
  ) {}

  async create(createOrderDto: CreateOrderDto) {
    const user = await this.usersService.findOrCreateByEmail(
      createOrderDto.email,
      createOrderDto.customerName,
    );

    const product = await this.prisma.product.findUnique({
      where: { id: createOrderDto.productId },
    });

    if (!product || !product.isActive) {
      throw new NotFoundException('Product not found');
    }

    return this.prisma.order.create({
      data: {
        userId: user.id,
        productId: product.id,
        status: createOrderDto.status,
        amount: createOrderDto.amount,
        currency: createOrderDto.currency ?? 'USD',
      },
      include: {
        user: true,
        product: true,
      },
    });
  }

  async findAll() {
    return this.prisma.order.findMany({
      include: {
        user: true,
        product: true,
        payment: true,
      },
      orderBy: { createdAt: 'desc' },
    });
  }
}
