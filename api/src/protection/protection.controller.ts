import { Controller, Get, Post, Body, Param, Query, HttpException, HttpStatus, UseGuards } from '@nestjs/common';
import { OnchainService } from '../onchain/onchain.service';
import { X402Guard } from '../x402/x402.guard';

interface SimulateTradeBody {
  poolId?: string;
  amountSpecified: string;
  zeroForOne: boolean;
}

/// StableGuard's A2MCP endpoint. OKX.AI A2MCP services must be either:
///   (a) free — just return the result, or
///   (b) x402-paid.
/// This ships as (a). See docs/SUBMISSION.md for the x402 upgrade path once
/// the OKX Payment SDK is installed — flip PAID_MODE=true in api/.env and
/// wire the guard noted inline below.
@Controller()
export class ProtectionController {
  constructor(private readonly onchain: OnchainService) {}

  @Get('health')
  health() {
    return { status: 'ok', service: 'stableguard-asp' };
  }

  @Get('protection-status/:poolId')
  async getStatus(@Param('poolId') poolId: string) {
    // --- x402 gate placeholder -------------------------------------------------
    // if (process.env.PAID_MODE === 'true') {
    //   // Verify payment via OKX Payment SDK / x402 headers here before
    //   // proceeding. Until PAID_MODE is enabled this endpoint is free,
    //   // which is a fully valid OKX.AI A2MCP service type.
    // }
    // -----------------------------------------------------------------------

    try {
      return await this.onchain.getProtectionStatus(poolId);
    } catch (err: any) {
      throw new HttpException(
        {
          error: 'protection_status_unavailable',
          message: err.message,
          details: { poolId },
        },
        HttpStatus.SERVICE_UNAVAILABLE,
      );
    }
  }

  // Convenience default so agents can hit /protection-status without a
  // poolId and get the single deployed demo pool's status.
  @Get('protection-status')
  async getDefaultStatus(@Query('poolId') poolId?: string) {
    try {
      return await this.onchain.getProtectionStatus(poolId || undefined);
    } catch (err: any) {
      throw new HttpException(
        {
          error: 'protection_status_unavailable',
          message: err.message,
          details: { poolId: poolId ?? null },
        },
        HttpStatus.SERVICE_UNAVAILABLE,
      );
    }
  }

  /// PAID endpoint (x402-gated when PAID_MODE=true; free/no-op when false —
  /// see api/src/x402/x402.guard.ts). This is the "heavier action" side of
  /// the free-quote/paid-action split: /protection-status is a cheap shared
  /// read, this is a per-proposed-trade projection.
  @Post('simulate-trade')
  @UseGuards(X402Guard)
  async simulateTrade(@Body() body: SimulateTradeBody) {
    if (body.amountSpecified === undefined || body.zeroForOne === undefined) {
      throw new HttpException(
        { error: 'invalid_request', message: 'amountSpecified and zeroForOne are required', details: body },
        HttpStatus.BAD_REQUEST,
      );
    }
    try {
      return await this.onchain.simulateSwap(body.poolId, body.amountSpecified, body.zeroForOne);
    } catch (err: any) {
      throw new HttpException(
        { error: 'simulation_unavailable', message: err.message, details: { poolId: body.poolId ?? null } },
        HttpStatus.SERVICE_UNAVAILABLE,
      );
    }
  }
}
