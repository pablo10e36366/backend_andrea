import {
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import * as crypto from 'crypto';
import * as path from 'path';
import { AccessService } from '../access/access.service';
import { ProductsService } from '../products/products.service';

type DownloadTokenPayload = {
  email: string;
  slug: string;
  exp: number;
};

@Injectable()
export class DownloadsService {
  private readonly privateRoot = path.resolve(process.cwd(), 'protected-files');
  private readonly downloadSecret =
    process.env.DOWNLOAD_TOKEN_SECRET ?? 'replace-this-secret';
  private readonly tokenTtlMs = 1000 * 60 * 10;
  private readonly backendUrl =
    process.env.BACKEND_URL ?? 'http://localhost:3000';

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
    const data = Buffer.from(JSON.stringify(payload), 'utf8').toString(
      'base64url',
    );
    const signature = crypto
      .createHmac('sha256', this.downloadSecret)
      .update(data)
      .digest('base64url');

    return `${data}.${signature}`;
  }

  private parseToken(token: string) {
    const [data, signature] = token.split('.');

    if (!data || !signature) {
      throw new ForbiddenException('Invalid download token');
    }

    const expectedSignature = crypto
      .createHmac('sha256', this.downloadSecret)
      .update(data)
      .digest('base64url');

    if (signature !== expectedSignature) {
      throw new ForbiddenException('Invalid download token');
    }

    const payload = JSON.parse(
      Buffer.from(data, 'base64url').toString('utf8'),
    ) as DownloadTokenPayload;

    if (Date.now() > payload.exp) {
      throw new ForbiddenException('Download token expired');
    }

    return payload;
  }

  async createDownloadLinks(email: string, slug: string) {
    await this.productsService.findOneBySlug(slug);

    const access = await this.accessService.check(email, slug);

    if (!access.hasAccess) {
      throw new ForbiddenException('User does not have access to this file');
    }

    const filePath = this.getFilePathBySlug(slug);

    if (!filePath) {
      throw new NotFoundException('Protected file not configured');
    }

    const token = this.signPayload({
      email,
      slug,
      exp: Date.now() + this.tokenTtlMs,
    });

    return {
      viewUrl: `${this.backendUrl}/downloads/file?token=${encodeURIComponent(token)}`,
      downloadUrl: `${this.backendUrl}/downloads/file?token=${encodeURIComponent(token)}&download=1`,
      expiresInMinutes: 10,
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
