# StableGuard
```

Note on Testnet Choice
Due to time constraints and persistent difficulties in obtaining testnet tokens for Xlayer (despite repeated efforts to contact the team), we have deployed StableGuard on Arc Testnet for this demo. The Xlayer deployment remains under active development, and StableGuard is designed as a multichain CCTP agent—once Xlayer is fully accessible, we will extend the deployment to include it alongside other chains.

```
**Uniswap v4 Hook LP-Protection ASP — built for the OKX.AI Genesis Hackathon**

StableGuard protects uniswap pools from impermanent loss and inventory skew during agent-driven, yield-seeking trading. The dynamic fee curve is the product: fees stay low while the pool is calm, and rise automatically as the hook actively defends it. A circuit breaker blocks trades that would push the pool past a safe skew threshold. A lightweight off-chain API exposes this protection status so other agents can check a pool's live risk before routing a swap through it gated via x402 payment.

---

## Why

Agents increasingly compete for yield across stablecoin pools, and that trading pressure can quietly skew a pool's inventory and expose LPs to impermanent loss. StableGuard makes that risk visible and priced in real time, rather than something LPs only discover after the fact.

## Solution

A Uniswap v4 hook on X Layer that:

1. Tracks pool skew live, on-chain, per swap.
2. Moves the swap fee through three tiers as skew rises — calm, elevated, defensive — so the cost of trading against the pool's balance scales automatically with the risk that trade adds.
3. Hard-blocks trades that would push skew past a safety threshold, via a circuit breaker.
4. Exposes all of this through a stateless off-chain API, so agents can check a pool's live protection status *before* they submit a swap — not just discover the cost after the fact.
5. Lets agents swap in without a separate on-chain approval step, via a Permit2-based router — matching the gasless-approval pattern the Uniswap Trade API itself uses.

The dynamic fee curve is the product: low fee when calm, higher fee when the hook is actively defending the pool.

## How it works

1. **Skew tracking** — the hook maintains a rolling, decayed skew value per pool, updated on every swap.
2. **Dynamic fee tiers** — the fee automatically moves between three tiers based on current skew:
   - **Calm** — 0.01%
   - **Elevated** — 0.05%
   - **Defensive** — 0.30%
3. **Circuit breaker** — a trade projected to push skew past a hard threshold is reverted before it executes.
4. **Protection status API** — agents call `GET /protection-status/:poolId` to see the current skew, fee tier, whether the circuit breaker is armed, and the maximum additional skew that's still safe — before they submit a swap.

## Architecture

| Component | Role | Stack |
|---|---|---|
| `StableGuardHook.sol` | `beforeSwap` (fee tiering + circuit breaker), `afterSwap` (skew commit) | Solidity, Foundry, Uniswap v4 |
| `MockUSD.sol` | Two mintable ERC20s standing in for USDC/USDT on testnet | Solidity |
| ASP API | Stateless service exposing live protection status | NestJS, ethers.js |
| Deployment | X Layer (contracts) + Render (API) | Foundry, Docker |


| Component | Address / Link | Description |
|-----------|---------------|-------------|
| **StableGuard Hook** | [`0x0B46218C3FA54CC0f1E058016bc4a1f51DCB40C0`](https://testnet.arcscan.app/address/0x0B46218C3FA54CC0f1E058016bc4a1f51DCB40C0) | Core hook contract implementing the StableGuard logic |
| **PoolManager** | [`0x74efFA1DfA6582e835917cDA5c4932a5dd0e5295`](https://testnet.arcscan.app/address/0x74efFA1DfA6582e835917cDA5c4932a5dd0e5295) | Uniswap V4 PoolManager instance managing the pool |
| **MOCK_USDX** | [`0xfE99b51a3D62363e2C55cc229351997d4771e08a`](https://testnet.arcscan.app/address/0xfE99b51a3D62363e2C55cc229351997d4771e08a) | Mock USDX token contract |
| **MOCK_USDY** | [`0xCD4C3F60FcdeAB580b74A366c31e449716e20Cc9`](https://testnet.arcscan.app/address/0xCD4C3F60FcdeAB580b74A366c31e449716e20Cc9) | Mock USDY token contract |
| **Pool ID** | `0xb6734893c2e5094909ae79428a84e29be959cf7008f30dc4620073b3c5924d91` | Unique identifier for the deployed pool |
| **Web Interface** | [stableguard-r2fz.onrender.com](https://stableguard-r2fz.onrender.com) | Frontend application for interacting with StableGuard |




## API Endpoints

Base URL: `https://stableguard-r2fz.onrender.com`

| Method | Endpoint | Description | Auth |
|--------|----------|-------------|------|
| `GET` | `/health` | Service health check | None |
| `GET` | `/protection-status` | Protection status for the default demo pool (or specify `?poolId=...`) | None |
| `GET` | `/protection-status/:poolId` | Protection status for a specific pool | None |
| `POST` | `/simulate-trade` | Simulate a swap (body: `{ poolId?, amountSpecified, zeroForOne }`) | x402‑gated if `PAID_MODE=true` |

### Example Requests

```bash
# Health check
curl https://stableguard-r2fz.onrender.com/health

# Default pool status
curl https://stableguard-r2fz.onrender.com/protection-status

# Specific pool by path
curl https://stableguard-r2fz.onrender.com/protection-status/0xb6734893c2e5094909ae79428a84e29be959cf7008f30dc4620073b3c5924d91
```

### Example Responses

**Health check:**
```json
{"status":"ok","service":"stableguard-asp"}
```

**Protection status (pool):**
```json
{
  "poolId": "0xb6734893c2e5094909ae79428a84e29be959cf7008f30dc4620073b3c5924d91",
  "netSkew": "0",
  "tier": "calm",
  "currentFeeBps": 1,
  "circuitBreakerArmed": false,
  "maxSafeAdditionalSkew": "300000000000000000",
  "recommendation": "SAFE_TO_SWAP",
  "fetchedAtBlock": 51903459,
  "staleAfterSeconds": 12
}
```

**Specific Pool**
```json
{
   "poolId":"0xb6734893c2e5094909ae79428a84e29be959cf7008f30dc4620073b3c5924d91","netSkew":"0","tier":"calm","currentFeeBps":1,"circuitBreakerArmed":false,"maxSafeAdditionalSkew":"300000000000000000","recommendation":"SAFE_TO_SWAP","fetchedAtBlock":51905007,"staleAfterSeconds":12
   }
```


## Known simplifications

- The circuit breaker currently **reverts** oversized trades rather than partially filling them in-hook. The API's `maxSafeAdditionalSkew` field lets agents size trades safely in advance; true in-hook partial-fill is the natural next iteration.
- Skew is tracked with a simplified magnitude/direction proxy rather than exact post-trade reserve math — sufficient for tiering and the breaker, tightenable later with direct pool state reads.

## Status

Built and submitted for the **OKX.AI Genesis Hackathon**  as a free Agent-to-MCP (A2MCP) service — payment SDK with x402 under develeopment.

## License

MIT