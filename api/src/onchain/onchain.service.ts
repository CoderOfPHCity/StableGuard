import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { ethers } from 'ethers';

// Minimal ABI — just the read functions the API needs. Keep this in sync
// with StableGuardHook.sol.
const HOOK_ABI = [
  'function getProtectionStatus(bytes32 poolId) view returns (int256 netSkew, uint8 tier, uint24 currentFee, bool circuitBreakerArmed, int256 maxSafeAdditionalSkew)',
  'function simulateSwap(bytes32 poolId, int256 amountSpecified, bool zeroForOne) view returns (int256 projectedSkew, uint8 projectedTier, uint24 projectedFee, bool wouldTripCircuitBreaker)',
];

const TIER_NAMES = ['calm', 'elevated', 'defensive'];

// Trade-API-style routing field: agents branch on this one field instead of
// interpreting raw skew/threshold numbers themselves.
export type Recommendation = 'SAFE_TO_SWAP' | 'THROTTLE_RECOMMENDED' | 'BLOCKED';

// How long a protection-status read should be trusted before the caller
// should re-fetch. Mirrors the Trade API's "refresh quotes older than 30s"
// guidance — skew can move every block, so we key this off average X Layer
// block time rather than copying Uniswap's number verbatim.
const STALE_AFTER_SECONDS = 12;

export interface ProtectionStatus {
  poolId: string;
  netSkew: string;
  tier: string;
  currentFeeBps: number;
  circuitBreakerArmed: boolean;
  maxSafeAdditionalSkew: string;
  recommendation: Recommendation;
  fetchedAtBlock: number;
  staleAfterSeconds: number;
}

export interface SimulationResult {
  poolId: string;
  amountSpecified: string;
  zeroForOne: boolean;
  projectedSkew: string;
  projectedTier: string;
  projectedFeeBps: number;
  wouldTripCircuitBreaker: boolean;
  recommendation: Recommendation;
}

@Injectable()
export class OnchainService implements OnModuleInit {
  private readonly logger = new Logger(OnchainService.name);
  private provider!: ethers.JsonRpcProvider;
  private hook!: ethers.Contract;
  private poolId!: string;

  onModuleInit() {
    const rpcUrl = process.env.RPC_URL;
    const hookAddress = process.env.HOOK_ADDRESS;
    const poolId = process.env.POOL_ID;

    if (!rpcUrl || !hookAddress || !poolId) {
      this.logger.warn(
        'RPC_URL / HOOK_ADDRESS / POOL_ID not fully set — /protection-status will return an error until contracts/.env values are deployed and copied into api/.env.',
      );
      return;
    }

    this.provider = new ethers.JsonRpcProvider(rpcUrl);
    this.hook = new ethers.Contract(hookAddress, HOOK_ABI, this.provider);
    this.poolId = poolId;
    this.logger.log(`Connected to StableGuardHook at ${hookAddress}`);
  }

  async getProtectionStatus(poolIdOverride?: string): Promise<ProtectionStatus> {
    if (!this.hook) {
      throw new Error(
        'On-chain connection not configured. Set RPC_URL, HOOK_ADDRESS, POOL_ID in api/.env and restart.',
      );
    }

    const poolId = poolIdOverride ?? this.poolId;
    const [netSkew, tier, currentFee, circuitBreakerArmed, maxSafeAdditionalSkew] =
      await this.hook.getProtectionStatus(poolId);
    const block = await this.provider.getBlockNumber();

    const tierName = TIER_NAMES[Number(tier)] ?? 'unknown';
    const recommendation: Recommendation = circuitBreakerArmed
      ? 'BLOCKED'
      : tierName === 'defensive'
        ? 'THROTTLE_RECOMMENDED'
        : 'SAFE_TO_SWAP';

    return {
      poolId,
      netSkew: netSkew.toString(),
      tier: tierName,
      currentFeeBps: Number(currentFee) / 100, // v4 fee units -> bps
      circuitBreakerArmed,
      maxSafeAdditionalSkew: maxSafeAdditionalSkew.toString(),
      recommendation,
      fetchedAtBlock: block,
      staleAfterSeconds: STALE_AFTER_SECONDS,
    };
  }

  /// Backs the paid `/simulate-trade` endpoint. Heavier than
  /// getProtectionStatus in the sense that it's a per-proposed-trade
  /// projection rather than a shared cached-ish read — the natural line
  /// between "free quote" and "paid action" per the Trade API's
  /// quote/swap split.
  async simulateSwap(poolIdOverride: string | undefined, amountSpecified: string, zeroForOne: boolean): Promise<SimulationResult> {
    if (!this.hook) {
      throw new Error(
        'On-chain connection not configured. Set RPC_URL, HOOK_ADDRESS, POOL_ID in api/.env and restart.',
      );
    }
    const poolId = poolIdOverride ?? this.poolId;
    const [projectedSkew, projectedTier, projectedFee, wouldTripCircuitBreaker] = await this.hook.simulateSwap(
      poolId,
      amountSpecified,
      zeroForOne,
    );

    const tierName = TIER_NAMES[Number(projectedTier)] ?? 'unknown';
    const recommendation: Recommendation = wouldTripCircuitBreaker
      ? 'BLOCKED'
      : tierName === 'defensive'
        ? 'THROTTLE_RECOMMENDED'
        : 'SAFE_TO_SWAP';

    return {
      poolId,
      amountSpecified,
      zeroForOne,
      projectedSkew: projectedSkew.toString(),
      projectedTier: tierName,
      projectedFeeBps: Number(projectedFee) / 100,
      wouldTripCircuitBreaker,
      recommendation,
    };
  }
}
