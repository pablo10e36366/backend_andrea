import { Module } from '@nestjs/common';
import { DownloadsModule } from '../downloads/downloads.module';
import { EmailService } from './email.service';

@Module({
  imports: [DownloadsModule],
  providers: [EmailService],
  exports: [EmailService],
})
export class EmailModule {}
