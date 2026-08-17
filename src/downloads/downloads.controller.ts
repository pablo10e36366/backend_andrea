import { Body, Controller, Post, Query, Res } from '@nestjs/common';
import type { Response } from 'express';
import { AccessTokenDto } from './dto/access-token.dto';
import { DownloadsService } from './downloads.service';

@Controller('downloads')
export class DownloadsController {
  constructor(private readonly downloadsService: DownloadsService) {}

  @Post('verify')
  verifyAccess(@Body() accessTokenDto: AccessTokenDto) {
    return this.downloadsService.verifyAccessToken(accessTokenDto.token);
  }

  @Post('file')
  async getFile(
    @Body() accessTokenDto: AccessTokenDto,
    @Query('download') download: string,
    @Res() response: Response,
  ) {
    const file = await this.downloadsService.resolveFile(accessTokenDto.token);

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
