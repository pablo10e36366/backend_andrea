import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class AccessService {
  constructor(private readonly prisma: PrismaService) {}

  async check(email: string, slug: string) {
    const user = await this.prisma.user.findUnique({
      where: { email },
    });

    const product = await this.prisma.product.findUnique({
      where: { slug },
    });

    if (!user || !product) {
      return {
        hasAccess: false,
      };
    }

    const access = await this.prisma.userProductAccess.findUnique({
      where: {
        userId_productId: {
          userId: user.id,
          productId: product.id,
        },
      },
    });

    return {
      hasAccess: Boolean(access),
      userId: user.id,
      productId: product.id,
      grantedAt: access?.grantedAt ?? null,
    };
  }
}
