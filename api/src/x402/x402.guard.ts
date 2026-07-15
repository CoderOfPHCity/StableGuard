import { CanActivate, ExecutionContext, Injectable, HttpException, HttpStatus } from '@nestjs/common';
import { Request } from 'express';

/// Gates paid A2MCP endpoints per the x402 protocol shape OKX's A2MCP spec
/// expects. This is a structural implementation, not a full one — OKX Payment SDK isn't installed yet, so actual payment
/// *verification* (steps 2-3 below) is a TODO, clearly marked. What's real:
///
///   1. If PAID_MODE=false (default), this guard is a no-op — the endpoint
///      stays free, which is a fully valid A2MCP service type on its own.
///   2. If PAID_MODE=true and no X-PAYMENT header is present, returns a
///      proper HTTP 402 with the payment requirements the caller needs to
///      satisfy — the standard x402 flow (client sees 402, pays, retries
///      with the header).
///   3. If PAID_MODE=true and a X-PAYMENT header IS present, this currently
///      only checks that it's non-empty — TODO once the OKX Payment SDK is
///      installed: call its verify/settle function here
@Injectable()
export class X402Guard implements CanActivate {
  canActivate(context: ExecutionContext): boolean {
    if (process.env.PAID_MODE !== 'true') return true;

    const req = context.switchToHttp().getRequest<Request>();
    const paymentHeader = req.headers['x-payment'];

    if (!paymentHeader) {
      throw new HttpException(
        {
          error: 'payment_required',
          message: 'This endpoint requires x402 payment.',
          details: {
            price: process.env.X402_PRICE_USDC ?? '0.001',
            currency: 'USDC',
            merchantId: process.env.X402_MERCHANT_ID ?? null,
            payTo: 'X-PAYMENT header — see x402 protocol spec',
          },
        },
        HttpStatus.PAYMENT_REQUIRED,
      );
    }

    // --- TODO: real verification via OKX Payment SDK ---------------------
    // -----------------------------------------------------------------------

    return true;
  }
}
