# OKX.AI Genesis Hackathon — StableGuard Submission Checklist

## Step 1 — Build (this repo)

- [ ] `forge build` + `forge test` pass in `contracts/`
- [ ] `scripts/verify-pool-manager.sh` confirms real PoolManager bytecode
      before you deploy anything against it
- [ ] `DeployMockTokens.s.sol` run, addresses saved to `contracts/.env`
- [ ] `DeployHook.s.sol` run, `HOOK_ADDRESS` + `POOL_ID` saved to both
      `contracts/.env` and `api/.env`
- [ ] `scripts/verify-permit2.sh` confirms Permit2 bytecode before deploying the router
- [ ] `DeployRouter.s.sol` run, `ROUTER_ADDRESS` saved to both `contracts/.env` and `api/.env`
- [ ] API runs locally (`npm run start:dev` in `api/`) and all three endpoints
      respond: `GET /protection-status/:poolId`, `POST /simulate-trade`,
      `GET /permit2/typed-data`
- [ ] API deployed to Render, publicly reachable over HTTPS
- [ ] (Optional) contract verified on OKLink:
      `forge verify-contract <HOOK_ADDRESS> src/StableGuardHook.sol:StableGuardHook --verifier oklink --chain-id 195`

## Step 2 — List on OKX.AI

Follow `ONCHAINOS_SETUP.md` steps 1–5. Must pass OKX AI's internal review
and go live — **an unapproved listing invalidates the hackathon
submission**, so don't leave this to the last day.

### Upgrading to a paid x402 endpoint (optional, post-MVP)

You don't have the OKX Payment SDK yet, and the free-tier endpoint is fully
valid for listing. If you want to add pay-per-call later:

1. Install the OKX Payment SDK.
2. Set `PAID_MODE=true` and `X402_MERCHANT_ID` / `X402_PRICE_USDC` in
   `api/.env`.
3. Uncomment and implement the x402 gate in
   `api/src/protection/protection.controller.ts` (marked with a comment
   block) — it should verify the x402 payment header before calling
   `onchain.getProtectionStatus`.
4. Re-register the service as paid via your agent, or update the existing
   A2MCP listing.

## Step 3 — Post on X with #OKXAI

Requirements: introduce the ASP, explain the use case, include a demo or
walkthrough ≤90 seconds.

Suggested structure for the post:

1. One line: what StableGuard does (Uniswap v4 hook, defends stablecoin
   pools from IL/skew, fee curve scales with live risk).
2. One line: why it matters for agents (agents can query protection status
   before routing swaps — no more blind trades into a skewed pool).
3. Demo clip: screen-record hitting `/protection-status/:poolId` showing
   the fee tier and skew changing as you simulate swaps of increasing size
   on testnet, plus the circuit breaker refusing an oversized trade.
4. Link to the ASP listing + link to this repo (or a public one you push
   this to).

## Step 4 — Submit the Google form

Before **Jul 17, 23:59 UTC**. Needs: ASP details + link to your X post.

## Timeline sanity check

| Day | Task |
|---|---|
| 1 | Contracts: mock tokens, hook, tests, testnet deploy, PoolManager verification |
| 2 | API build + local testing against deployed hook |
| 3 | Render deploy, Onchain OS install + Agentic Wallet login, A2MCP registration |
| 4 | ASP listing review buffer (up to 24h) — use this day for demo recording |
| 5 | Fix anything review flagged, finalize demo video |
| 6 | X post with #OKXAI, Google form submission, buffer for anything broken |
