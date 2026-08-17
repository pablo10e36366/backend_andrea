import {
  ForbiddenException,
  Injectable,
  InternalServerErrorException,
  NotFoundException,
} from '@nestjs/common';
import * as crypto from 'crypto';
import { promises as fs } from 'fs';
import * as path from 'path';
import { AccessService } from '../access/access.service';
import { ProductsService } from '../products/products.service';

type DownloadTokenPayload = {
  purpose: 'workbook-access';
  email: string;
  slug: string;
  exp: number;
};

@Injectable()
export class DownloadsService {
  private readonly privateRoot = path.resolve(process.cwd(), 'protected-files');
  private readonly tokenTtlMs = 1000 * 60 * 60 * 24 * 7;
  private readonly frontendUrl =
    process.env.FRONTEND_URL ?? 'http://localhost:5173';

  constructor(
    private readonly accessService: AccessService,
    private readonly productsService: ProductsService,
  ) {}

  private getFilePathBySlug(slug: string) {
    const fileMap: Record<string, string> = {
      'guia-para-el-estres': path.join(
        this.privateRoot,
        'pdfs',
        'ansiedad-como-controlar-tu-mente-en-minutos.pdf',
      ),
    };

    return fileMap[slug];
  }

  private signPayload(payload: DownloadTokenPayload) {
    const downloadSecret = this.getDownloadSecret();
    const data = Buffer.from(JSON.stringify(payload), 'utf8').toString(
      'base64url',
    );
    const signature = crypto
      .createHmac('sha256', downloadSecret)
      .update(data)
      .digest('base64url');

    return `${data}.${signature}`;
  }

  private parseToken(token: string) {
    const downloadSecret = this.getDownloadSecret();
    const [data, signature] = token.split('.');

    if (!data || !signature) {
      throw new ForbiddenException('Invalid download token');
    }

    const expectedSignature = crypto
      .createHmac('sha256', downloadSecret)
      .update(data)
      .digest('base64url');

    const actualBuffer = Buffer.from(signature);
    const expectedBuffer = Buffer.from(expectedSignature);

    if (
      actualBuffer.length !== expectedBuffer.length ||
      !crypto.timingSafeEqual(actualBuffer, expectedBuffer)
    ) {
      throw new ForbiddenException('Invalid download token');
    }

    let payload: DownloadTokenPayload;

    try {
      payload = JSON.parse(
        Buffer.from(data, 'base64url').toString('utf8'),
      ) as DownloadTokenPayload;
    } catch {
      throw new ForbiddenException('Invalid download token');
    }

    if (
      payload.purpose !== 'workbook-access' ||
      typeof payload.email !== 'string' ||
      typeof payload.slug !== 'string' ||
      typeof payload.exp !== 'number'
    ) {
      throw new ForbiddenException('Invalid download token');
    }

    if (Date.now() > payload.exp) {
      throw new ForbiddenException('Download token expired');
    }

    return payload;
  }

  private getDownloadSecret() {
    const secret = process.env.DOWNLOAD_TOKEN_SECRET;

    if (!secret || secret.length < 32) {
      throw new InternalServerErrorException(
        'DOWNLOAD_TOKEN_SECRET must contain at least 32 characters',
      );
    }

    return secret;
  }

  async createPrivateAccessLink(email: string, slug: string) {
    await this.productsService.findOneBySlug(slug);

    const access = await this.accessService.check(email, slug);

    if (!access.hasAccess) {
      throw new ForbiddenException('User does not have access to this file');
    }

    const filePath = this.getFilePathBySlug(slug);

    if (!filePath) {
      throw new NotFoundException('Protected file not configured');
    }

    const expiresAt = Date.now() + this.tokenTtlMs;
    const token = this.signPayload({
      purpose: 'workbook-access',
      email,
      slug,
      exp: expiresAt,
    });

    return {
      accessUrl: `${this.frontendUrl}/#/workbooks/${slug}?access=${encodeURIComponent(token)}`,
      expiresAt: new Date(expiresAt),
    };
  }

  async verifyAccessToken(token: string) {
    const payload = this.parseToken(token);
    const access = await this.accessService.check(payload.email, payload.slug);

    if (!access.hasAccess) {
      throw new ForbiddenException('Access revoked for this file');
    }

    return {
      hasAccess: true,
      slug: payload.slug,
      expiresAt: new Date(payload.exp).toISOString(),
    };
  }

  async getEmailAttachment(slug: string) {
    await this.productsService.findOneBySlug(slug);

    const filePath = this.getFilePathBySlug(slug);

    if (!filePath) {
      throw new NotFoundException('Protected file not configured');
    }

    return {
      content: await fs.readFile(filePath),
      filename:
        slug === 'guia-para-el-estres'
          ? 'guia-para-la-ansiedad.pdf'
          : `${slug}.pdf`,
    };
  }

  async resolveFile(token: string) {
    const payload = this.parseToken(token);
    const access = await this.accessService.check(payload.email, payload.slug);

    if (!access.hasAccess) {
      throw new ForbiddenException('Access revoked for this file');
    }

    const product = await this.productsService.findOneBySlug(payload.slug);
    const filePath = this.getFilePathBySlug(payload.slug);

    if (!filePath) {
      throw new NotFoundException('Protected file not configured');
    }

    return {
      filePath,
      fileName: `${product.slug}.pdf`,
      contentType: 'application/pdf',
    };
  }
}
