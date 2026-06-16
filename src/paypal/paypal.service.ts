import {
  BadGatewayException,
  Injectable,
  InternalServerErrorException,
} from '@nestjs/common';
import { PaymentsService } from '../payments/payments.service';

type PaypalCreateOrderResponse = {
  id: string;
  status: string;
  links?: Array<{ href: string; rel: string; method: string }>;
};

type PaypalCaptureOrderResponse = {
  id: string;
  status: string;
  purchase_units?: Array<{
    reference_id?: string;
    payments?: {
      captures?: Array<{
        id: string;
        status: string;
      }>;
    };
  }>;
};

type PaypalOrderDetailsResponse = {
  id: string;
  status: string;
  purchase_units?: Array<{
    reference_id?: string;
    payments?: {
      captures?: Array<{
        id: string;
        status: string;
      }>;
    };
  }>;
};

@Injectable()
export class PaypalService {
  private readonly baseUrl =
    process.env.PAYPAL_BASE_URL ?? 'https://api-m.sandbox.paypal.com';

  private readonly clientId = process.env.PAYPAL_CLIENT_ID;
  private readonly clientSecret = process.env.PAYPAL_CLIENT_SECRET;
  private readonly returnUrl =
    process.env.PAYPAL_RETURN_URL ?? 'http://localhost:3000/paypal/return';
  private readonly cancelUrl =
    process.env.PAYPAL_CANCEL_URL ?? 'http://localhost:3000/paypal/cancel';

  constructor(private readonly paymentsService: PaymentsService) {}

  private renderHtmlPage(
    title: string,
    message: string,
    details?: string,
  ) {
    return `<!doctype html>
<html lang="es">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>${title}</title>
    <style>
      body {
        margin: 0;
        font-family: Arial, sans-serif;
        background: #f6faf8;
        color: #1f2937;
        display: grid;
        place-items: center;
        min-height: 100vh;
      }
      .card {
        width: min(92vw, 520px);
        background: #ffffff;
        border: 1px solid #d7e6df;
        border-radius: 20px;
        padding: 28px;
        box-shadow: 0 18px 40px rgba(0, 0, 0, 0.08);
        text-align: center;
      }
      h1 {
        margin: 0 0 12px;
        color: #2f5d50;
        font-size: 30px;
      }
      p {
        margin: 0;
        line-height: 1.6;
      }
      .details {
        margin-top: 14px;
        color: #4b5563;
        font-size: 14px;
      }
    </style>
  </head>
  <body>
    <main class="card">
      <h1>${title}</h1>
      <p>${message}</p>
      ${details ? `<p class="details">${details}</p>` : ''}
    </main>
  </body>
</html>`;
  }

  private assertCredentials() {
    if (!this.clientId || !this.clientSecret) {
      throw new InternalServerErrorException(
        'PayPal credentials are not configured',
      );
    }
  }

  private async getAccessToken() {
    this.assertCredentials();

    const auth = Buffer.from(
      `${this.clientId}:${this.clientSecret}`,
      'utf8',
    ).toString('base64');

    const response = await fetch(`${this.baseUrl}/v1/oauth2/token`, {
      method: 'POST',
      headers: {
        Authorization: `Basic ${auth}`,
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: 'grant_type=client_credentials',
    });

    if (!response.ok) {
      throw new BadGatewayException(
        await this.buildPaypalErrorMessage(
          response,
          'Failed to authenticate with PayPal',
        ),
      );
    }

    const data = (await response.json()) as { access_token: string };
    return data.access_token;
  }

  private async buildPaypalErrorMessage(
    response: Response,
    fallbackMessage: string,
  ) {
    try {
      const errorBody = (await response.json()) as {
        name?: string;
        message?: string;
        details?: Array<{ issue?: string; description?: string }>;
      };

      const detailText =
        errorBody.details
          ?.map((detail) => [detail.issue, detail.description].filter(Boolean).join(': '))
          .join(' | ') ?? '';

      return [
        fallbackMessage,
        errorBody.name,
        errorBody.message,
        detailText,
      ]
        .filter(Boolean)
        .join(' | ');
    } catch {
      const text = await response.text();
      return text ? `${fallbackMessage} | ${text}` : fallbackMessage;
    }
  }

  private async getOrderDetails(paypalOrderId: string) {
    const accessToken = await this.getAccessToken();

    const response = await fetch(
      `${this.baseUrl}/v2/checkout/orders/${paypalOrderId}`,
      {
        method: 'GET',
        headers: {
          Authorization: `Bearer ${accessToken}`,
          'Content-Type': 'application/json',
        },
      },
    );

    if (!response.ok) {
      throw new BadGatewayException(
        await this.buildPaypalErrorMessage(
          response,
          'Failed to fetch PayPal order details',
        ),
      );
    }

    return (await response.json()) as PaypalOrderDetailsResponse;
  }

  async createOrder(orderId: string) {
    const internalOrder = await this.paymentsService.findOrderWithPayment(
      orderId,
    );
    const accessToken = await this.getAccessToken();

    const response = await fetch(`${this.baseUrl}/v2/checkout/orders`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        intent: 'CAPTURE',
        payment_source: {
          paypal: {
            experience_context: {
              payment_method_preference: 'IMMEDIATE_PAYMENT_REQUIRED',
              brand_name: 'Andrea Psicologia',
              locale: 'es-ES',
              landing_page: 'LOGIN',
              shipping_preference: 'NO_SHIPPING',
              user_action: 'PAY_NOW',
              return_url: this.returnUrl,
              cancel_url: this.cancelUrl,
            },
          },
        },
        purchase_units: [
          {
            reference_id: internalOrder.id,
            description: internalOrder.product.title,
            amount: {
              currency_code: internalOrder.currency,
              value: internalOrder.amount.toFixed(2),
            },
          },
        ],
      }),
    });

    if (!response.ok) {
      throw new BadGatewayException(
        await this.buildPaypalErrorMessage(
          response,
          'Failed to create PayPal order',
        ),
      );
    }

    const paypalOrder =
      (await response.json()) as PaypalCreateOrderResponse;

    const approvalLink =
      paypalOrder.links?.find((link) => link.rel === 'approve')?.href ??
      paypalOrder.links?.find((link) => link.rel === 'payer-action')?.href ??
      `https://www.sandbox.paypal.com/checkoutnow?token=${paypalOrder.id}`;

    await this.paymentsService.ensurePendingPayment(
      internalOrder.id,
      'paypal',
      paypalOrder.id,
    );

    return {
      internalOrderId: internalOrder.id,
      paypalOrderId: paypalOrder.id,
      status: paypalOrder.status,
      approveLink: approvalLink,
      links: paypalOrder.links ?? [],
    };
  }

  async captureOrder(orderId: string, paypalOrderId: string) {
    await this.paymentsService.findOrderWithPayment(orderId);
    const accessToken = await this.getAccessToken();

    const response = await fetch(
      `${this.baseUrl}/v2/checkout/orders/${paypalOrderId}/capture`,
      {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${accessToken}`,
          'Content-Type': 'application/json',
        },
      },
    );

    if (!response.ok) {
      throw new BadGatewayException(
        await this.buildPaypalErrorMessage(
          response,
          'Failed to capture PayPal order',
        ),
      );
    }

    const captureResult =
      (await response.json()) as PaypalCaptureOrderResponse;

    const captureId =
      captureResult.purchase_units?.[0]?.payments?.captures?.[0]?.id ??
      paypalOrderId;

    const internalResult = await this.paymentsService.confirm(orderId, {
      providerRef: captureId,
    });

    return {
      paypal: captureResult,
      internal: internalResult,
    };
  }

  async handleReturn(paypalOrderId: string) {
    if (!paypalOrderId) {
      return {
        statusCode: 400,
        html: this.renderHtmlPage(
          'Pago no identificado',
          'PayPal no devolvio el token de la orden.',
          'Vuelve a intentar el proceso de compra.',
        ),
      };
    }

    try {
      const paypalOrder = await this.getOrderDetails(paypalOrderId);
      const internalOrderId = paypalOrder.purchase_units?.[0]?.reference_id;

      if (!internalOrderId) {
        return {
          statusCode: 400,
          html: this.renderHtmlPage(
            'Orden incompleta',
            'No se pudo relacionar la compra de PayPal con la orden interna.',
            `PayPal order: ${paypalOrderId}`,
          ),
        };
      }

      if (paypalOrder.status === 'COMPLETED') {
        const captureId =
          paypalOrder.purchase_units?.[0]?.payments?.captures?.[0]?.id ??
          paypalOrderId;

        await this.paymentsService.confirm(internalOrderId, {
          providerRef: captureId,
        });

        return {
          statusCode: 200,
          html: this.renderHtmlPage(
            'Pago confirmado',
            'Tu pago fue aprobado correctamente y el acceso ya fue desbloqueado.',
            `Orden interna: ${internalOrderId}`,
          ),
        };
      }

      const result = await this.captureOrder(internalOrderId, paypalOrderId);

      return {
        statusCode: 200,
        html: this.renderHtmlPage(
          'Pago confirmado',
          'Tu pago fue aprobado correctamente y el acceso ya fue desbloqueado.',
          `Orden interna: ${result.internal.order.id}`,
        ),
      };
    } catch (error) {
      const details =
        error instanceof Error ? error.message : 'No se pudo completar el pago.';

      return {
        statusCode: 500,
        html: this.renderHtmlPage(
          'No se pudo confirmar el pago',
          'PayPal regreso correctamente, pero el backend no logro cerrar la compra.',
          details,
        ),
      };
    }
  }

  handleCancel() {
    return {
      statusCode: 200,
      html: this.renderHtmlPage(
        'Pago cancelado',
        'La compra fue cancelada antes de completarse.',
        'Puedes volver a intentarlo cuando quieras.',
      ),
    };
  }
}
