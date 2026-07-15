import { Controller, Get, Query, HttpException, HttpStatus } from '@nestjs/common';
import { randomBytes } from 'crypto';

/// Returns the EIP-712 typed data an agent needs to sign to authorize
/// StableGuardRouter to pull tokens via Permit2's SignatureTransfer flow —
/// no separate on-chain approve() transaction needed, mirroring the
/// Trade API's Permit2 approval pattern.
///
/// ⚠️ This builds the standard Permit2 ISignatureTransfer.PermitTransferFrom
/// typed-data shape from general Permit2 usage patterns — it has not been
/// signature-tested against a live Permit2 contract on X Layer yet. If a
/// signed payload gets rejected on-chain, cross-check the type structure
/// against Permit2's PermitHash.sol in the installed lib.
@Controller('permit2')
export class Permit2Controller {
  @Get('typed-data')
  getTypedData(
    @Query('token') token: string,
    @Query('amount') amount: string,
    @Query('deadlineSeconds') deadlineSeconds?: string,
  ) {
    const permit2Address = process.env.PERMIT2_ADDRESS;
    const routerAddress = process.env.ROUTER_ADDRESS;
    const chainId = process.env.CHAIN_ID ? Number(process.env.CHAIN_ID) : 195;

    if (!permit2Address || !routerAddress) {
      throw new HttpException(
        {
          error: 'not_configured',
          message: 'PERMIT2_ADDRESS / ROUTER_ADDRESS not set in api/.env — deploy the router first.',
        },
        HttpStatus.SERVICE_UNAVAILABLE,
      );
    }
    if (!token || !amount) {
      throw new HttpException(
        { error: 'invalid_request', message: 'token and amount query params are required' },
        HttpStatus.BAD_REQUEST,
      );
    }

    const nonce = BigInt('0x' + randomBytes(32).toString('hex')).toString();
    const ttl = deadlineSeconds ? Number(deadlineSeconds) : 600; // 10 min default
    const deadline = Math.floor(Date.now() / 1000) + ttl;

    return {
      domain: {
        name: 'Permit2',
        chainId,
        verifyingContract: permit2Address,
      },
      types: {
        PermitTransferFrom: [
          { name: 'permitted', type: 'TokenPermissions' },
          { name: 'spender', type: 'address' },
          { name: 'nonce', type: 'uint256' },
          { name: 'deadline', type: 'uint256' },
        ],
        TokenPermissions: [
          { name: 'token', type: 'address' },
          { name: 'amount', type: 'uint256' },
        ],
      },
      values: {
        permitted: { token, amount },
        spender: routerAddress,
        nonce,
        deadline,
      },
      // After signing, submit `signature` alongside this `values` object as
      // the ISignatureTransfer.PermitTransferFrom struct + signature to
      // StableGuardRouter.swapWithPermit2 on-chain.
    };
  }
}
