import { Module } from '@nestjs/common';
import { AccessModule } from './access/access.module';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { DownloadsModule } from './downloads/downloads.module';
import { OrdersModule } from './orders/orders.module';
import { PaymentsModule } from './payments/payments.module';
import { PaypalModule } from './paypal/paypal.module';
import { PrismaModule } from './prisma/prisma.module';
import { ProductsModule } from './products/products.module';
import { UsersModule } from './users/users.module';

@Module({
  imports: [
    PrismaModule,
    ProductsModule,
    UsersModule,
    OrdersModule,
    PaymentsModule,
    AccessModule,
    DownloadsModule,
    PaypalModule,
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
