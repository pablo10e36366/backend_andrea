import { Module } from '@nestjs/common';
import { AccessModule } from '../access/access.module';
import { ProductsModule } from '../products/products.module';
import { DownloadsController } from './downloads.controller';
import { DownloadsService } from './downloads.service';

@Module({
  imports: [AccessModule, ProductsModule],
  controllers: [DownloadsController],
  providers: [DownloadsService],
})
export class DownloadsModule {}
