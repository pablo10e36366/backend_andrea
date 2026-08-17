import { Injectable, InternalServerErrorException } from '@nestjs/common';
import { Resend } from 'resend';
import { DownloadsService } from '../downloads/downloads.service';

type SendWorkbookEmailInput = {
  orderId: string;
  email: string;
  customerName?: string | null;
  productSlug: string;
  productTitle: string;
};

@Injectable()
export class EmailService {
  private readonly apiKey = process.env.RESEND_API_KEY;
  private readonly fromEmail =
    process.env.RESEND_FROM_EMAIL ??
    'Andrea Arias <guias@psicologaandrearias.com>';

  constructor(private readonly downloadsService: DownloadsService) {}

  private escapeHtml(value: string) {
    return value
      .replaceAll('&', '&amp;')
      .replaceAll('<', '&lt;')
      .replaceAll('>', '&gt;')
      .replaceAll('"', '&quot;')
      .replaceAll("'", '&#039;');
  }

  async sendWorkbookPurchase(input: SendWorkbookEmailInput) {
    if (!this.apiKey) {
      throw new InternalServerErrorException(
        'RESEND_API_KEY is not configured',
      );
    }

    const attachment = await this.downloadsService.getEmailAttachment(
      input.productSlug,
    );
    const privateAccess = await this.downloadsService.createPrivateAccessLink(
      input.email,
      input.productSlug,
    );
    const resend = new Resend(this.apiKey);
    const customerName = this.escapeHtml(input.customerName?.trim() || 'Hola');
    const productTitle = this.escapeHtml(input.productTitle);

    const { data, error } = await resend.emails.send(
      {
        from: this.fromEmail,
        to: [input.email],
        subject: `Tu workbook: ${input.productTitle}`,
        html: `
          <div style="font-family:Arial,sans-serif;color:#1f2937;line-height:1.6;max-width:620px;margin:auto">
            <h1 style="color:#2f5d50;font-size:26px">Compra confirmada</h1>
            <p>${customerName}, gracias por tu compra.</p>
            <p>Adjuntamos tu workbook <strong>${productTitle}</strong> en formato PDF.</p>
            <p>También puedes abrirlo desde este enlace privado, disponible durante 7 días:</p>
            <p style="margin:24px 0">
              <a href="${privateAccess.accessUrl}" style="display:inline-block;background:#2f5d50;color:#ffffff;text-decoration:none;padding:12px 20px;border-radius:999px;font-weight:700">Abrir workbook de forma segura</a>
            </p>
            <p style="color:#6b7280;font-size:13px">Este enlace es personal. No lo compartas con otras personas.</p>
            <p>Guarda este correo para que puedas consultar el material cuando lo necesites.</p>
            <p style="color:#6b7280;font-size:13px">Si no encuentras este mensaje en tu bandeja principal, revisa las carpetas de spam o correo no deseado.</p>
          </div>
        `,
        attachments: [
          {
            content: attachment.content,
            filename: attachment.filename,
          },
        ],
      },
      {
        idempotencyKey: `workbook-purchase/${input.orderId}`,
      },
    );

    if (error) {
      throw new InternalServerErrorException(
        `Resend could not send the workbook: ${error.message}`,
      );
    }

    return data;
  }
}
