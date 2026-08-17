import {
  ForbiddenException,
  InternalServerErrorException,
} from '@nestjs/common';
import { AccessService } from '../access/access.service';
import { ProductsService } from '../products/products.service';
import { DownloadsService } from './downloads.service';

describe('DownloadsService', () => {
  const originalSecret = process.env.DOWNLOAD_TOKEN_SECRET;
  const originalFrontendUrl = process.env.FRONTEND_URL;
  let accessService: { check: jest.Mock };
  let productsService: { findOneBySlug: jest.Mock };
  let service: DownloadsService;

  beforeEach(() => {
    process.env.DOWNLOAD_TOKEN_SECRET =
      'test-secret-with-at-least-32-characters';
    process.env.FRONTEND_URL = 'https://example.com';
    accessService = { check: jest.fn().mockResolvedValue({ hasAccess: true }) };
    productsService = {
      findOneBySlug: jest.fn().mockResolvedValue({ isActive: true }),
    };
    service = new DownloadsService(
      accessService as unknown as AccessService,
      productsService as unknown as ProductsService,
    );
  });

  afterAll(() => {
    if (originalSecret === undefined) {
      delete process.env.DOWNLOAD_TOKEN_SECRET;
    } else {
      process.env.DOWNLOAD_TOKEN_SECRET = originalSecret;
    }

    if (originalFrontendUrl === undefined) {
      delete process.env.FRONTEND_URL;
    } else {
      process.env.FRONTEND_URL = originalFrontendUrl;
    }
  });

  async function createToken() {
    const result = await service.createPrivateAccessLink(
      'buyer@example.com',
      'guia-para-el-estres',
    );

    return decodeURIComponent(result.accessUrl.split('?access=')[1]);
  }

  it('creates and verifies a private access token for a paid buyer', async () => {
    const token = await createToken();

    await expect(service.verifyAccessToken(token)).resolves.toMatchObject({
      hasAccess: true,
      slug: 'guia-para-el-estres',
    });
  });

  it('rejects a token whose signature was modified', async () => {
    const token = await createToken();
    const [data, signature] = token.split('.');
    const modifiedSignature = `${signature.slice(0, -1)}${signature.endsWith('a') ? 'b' : 'a'}`;

    await expect(
      service.verifyAccessToken(`${data}.${modifiedSignature}`),
    ).rejects.toBeInstanceOf(ForbiddenException);
  });

  it('rejects a valid token when database access was revoked', async () => {
    accessService.check
      .mockResolvedValueOnce({ hasAccess: true })
      .mockResolvedValueOnce({ hasAccess: false });
    const token = await createToken();

    await expect(service.verifyAccessToken(token)).rejects.toBeInstanceOf(
      ForbiddenException,
    );
  });

  it('refuses to create tokens without a strong server secret', async () => {
    process.env.DOWNLOAD_TOKEN_SECRET = 'short';

    await expect(createToken()).rejects.toBeInstanceOf(
      InternalServerErrorException,
    );
  });
});
