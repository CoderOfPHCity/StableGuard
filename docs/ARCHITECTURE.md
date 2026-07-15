# StableGuard — Architecture
```

Note on Testnet Choice
Due to time constraints and persistent difficulties in obtaining testnet tokens for Xlayer (despite repeated efforts to contact the team), we have deployed StableGuard on Arc Testnet for this demo. The Xlayer deployment remains under active development, and StableGuard is designed as a multichain CCTP agent—once Xlayer is fully accessible, we will extend the deployment to include it alongside other chains.

```

## Problem

Uniswap is now live on X Layer as the preferred DEX across the Protocol, Web App, Wallet, and Trading API, with core stablecoin markets (USDG and others) available from launch. As agents increasingly compete for yield across these pools, their trading pressure quietly skews pool inventory and exposes LPs to impermanent loss — a cost LPs typically only discover after the fact, with no live signal telling them (or the agents trading against them) that a pool is under strain.

Skew (not price volatility) is the relevant risk signal,where agent-driven yield-seeking trades are the dominant source of that skew rather than opportunistic arbitrage.

## Solution

A Uniswap v4 hook on X Layer that:

1. Tracks pool skew live, on-chain, per swap.
2. Moves the swap fee through three tiers as skew rises — calm, elevated, defensive — so the cost of trading against the pool's balance scales automatically with the risk that trade adds.
3. Hard-blocks trades that would push skew past a safety threshold, via a circuit breaker.
4. Exposes all of this through a stateless off-chain API, so agents can check a pool's live protection status *before* they submit a swap — not just discover the cost after the fact.
5. Lets agents swap in without a separate on-chain approval step, via a Permit2-based router — matching the gasless-approval pattern the Uniswap Trade API itself uses.

The dynamic fee curve is the product: low fee when calm, higher fee when the hook is actively defending the pool.

## Components

| Component | Role | Location |
|---|---|---|
| `StableGuardHook.sol` | `beforeSwap` (fee tiering + circuit breaker), `afterSwap` (skew commit), `simulateSwap` (per-trade projection) | `contracts/src/` |
| `StableGuardRouter.sol` | Permit2-gated swap entry point — pulls input token via signature instead of approve() | `contracts/src/` |
| `MockUSD.sol` | Two mintable ERC20s standing in for USDC/USDT on testnet | `contracts/src/mocks/` |
| Skew tracker | On-chain rolling signed skew per pool, linear-decayed per block | in-hook storage |
| Dynamic fee curve | 3 tiers: calm (0.01%), elevated (0.05%), defensive (0.30%) | in-hook, owner-tunable |
| Circuit breaker | Reverts swaps projected to push `|skew|` past `hardCapThreshold` | in-hook |
| ASP API — free | `GET /protection-status/:poolId` — cheap shared read | `api/src/protection/` |
| ASP API — paid | `POST /simulate-trade` — per-proposed-trade projection, x402-gated | `api/src/protection/`, `api/src/x402/` |
| Permit2 helper | `GET /permit2/typed-data` — builds the signature payload agents sign to swap via the router | `api/src/permit2/` |
| Deployment | Render (Docker), no database — state read live from chain each request | `api/render.yaml` |

Free endpoints just return a result; paid ones must be x402-compliant

- **`/protection-status/:poolId` — always free.** A cheap, shared, cacheable read. Charging for this would work against adoption for no real reason — the whole point is agents check it before every swap.
- **`/simulate-trade` — the paid tier, gated by `X402Guard`.** A per-proposed-trade projection (specific amount + direction), which is the "heavier action" side of the split. Gated by `PAID_MODE` — defaults to `false` (free, fully valid for OKX.AI listing on its own) until the OKX Payment SDK is installed, at which point flipping `PAID_MODE=true` enforces payment. See `api/src/x402/x402.guard.ts` for exactly what's real vs. TODO.

## Flow — checking protection status (free)

1. Agent wants to swap in the StableGuard-protected pool.
2. Agent calls `GET /protection-status/{poolId}` — returns `netSkew`, `tier`, `currentFeeBps`, `circuitBreakerArmed`, `maxSafeAdditionalSkew`, `recommendation` (`SAFE_TO_SWAP` / `THROTTLE_RECOMMENDED` / `BLOCKED` — Trade-API-style routing field), and `staleAfterSeconds`.
3. (Optional, paid) Agent calls `POST /simulate-trade` with a specific `{amountSpecified, zeroForOne}` for a precise pre-trade projection rather than the general pool state.

## Flow — swapping via the Permit2 router (gasless approval)

1. Agent calls `GET /permit2/typed-data?token=...&amount=...` — gets back the EIP-712 payload to sign.
2. Agent signs it with their wallet (no on-chain transaction yet).
3. Agent calls `StableGuardRouter.swapWithPermit2(key, params, permit, signature)` on-chain — this pulls the input token via the signature (no separate `approve()` tx), then executes the swap through the hook, which applies the same fee-tiering + circuit-breaker logic as any other swap into the pool.

## Flow — swapping directly through the pool (no router)

StableGuard is a hook, not a mandatory router — agents can also swap through any standard v4-compatible router/interface as long as it targets the hook's pool. `beforeSwap`/`afterSwap` apply identically either way; the router above is a convenience for gasless approval, not a requirement.

## Known simplifications (documented, not hidden)

- **Circuit breaker is revert-based, not in-hook partial-fill.** True partial-fill throttling requires adjusting the returned `BeforeSwapDelta` to clamp `amountSpecified`, with different accounting for exact-in vs. exact-out swaps. StableGuard ships the simpler "advisory max-safe-size + hard revert" version; tightening this is the natural v2 extension.
- **Skew tracking uses a simplified magnitude+direction proxy** rather than exact post-trade reserve math. Good enough for tiering and the breaker; tightenable with `StateLibrary` reads.
- **`StableGuardRouter`'s settlement logic (`_settleDelta`) is the most version-sensitive file in the repo** — it has not been run against a live pool yet. `CurrencySettler`'s exact location/signature moves between v4-core releases; confirm it resolves and add a swap test before trusting this beyond a testnet demo.
- **PoolManager and Permit2 addresses on X Layer testnet are unverified** as of this writing. `scripts/verify-pool-manager.sh` and `scripts/verify-permit2.sh` check both before you deploy anything real against them.
- **x402 payment verification is a structural placeholder**, not real enforcement, until the OKX Payment SDK is installed — see the TODO in `x402.guard.ts`. `/protection-status` works either way since it's free regardless.



