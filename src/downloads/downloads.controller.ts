import {
  Body,
  Controller,
  Get,
  Post,
  Query,
  Res,
} from '@nestjs/common';
import type { Response } from 'express';
import { RequestDownloadDto } from './dto/request-download.dto';
import { DownloadsService } from './downloads.service';

@Controller('downloads')
export class DownloadsController {
  constructor(private readonly downloadsService: DownloadsService) {}

  @Post('request')
  requestDownload(@Body() requestDownloadDto: RequestDownloadDto) {
    return this.downloadsService.createDownloadLinks(
      requestDownloadDto.email,
      requestDownloadDto.slug,
    );
  }

  @Get('file')
  async getFile(
    @Query('token') token: string,
    @Query('download') download: string,
    @Res() response: Response,
  ) {
    const file = await this.downloadsService.resolveFile(token);

    response.setHeader('Content-Type', file.contentType);
    response.setHeader(
      'Content-Disposition',
      download === '1'
        ? `attachment; filename="${file.fileName}"`
        : `inline; filename="${file.fileName}"`,
    );

    return response.sendFile(file.filePath);
  }
}
