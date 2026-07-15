#!/usr/bin/env bash
# Verifies that a Uniswap v4 PoolManager actually has code deployed at the
# address in contracts/.env, on the RPC in contracts/.env, BEFORE you spend
# any time deploying against it. Requires `cast` (ships with Foundry).
#
# Usage: run from repo root after `cp contracts/.env.example contracts/.env`
# and filling in RPC_URL + POOL_MANAGER_ADDRESS.

set -euo pipefail

ENV_FILE="$(dirname "$0")/../contracts/.env"

if [ ! -f "$ENV_FILE" ]; then
  echo "Missing $ENV_FILE — copy contracts/.env.example to contracts/.env first."
  exit 1
fi

# shellcheck disable=SC1090
export $(grep -v '^#' "$ENV_FILE" | grep -v '^$' | xargs)

if [ -z "${RPC_URL:-}" ] || [ -z "${POOL_MANAGER_ADDRESS:-}" ]; then
  echo "RPC_URL or POOL_MANAGER_ADDRESS not set in $ENV_FILE"
  exit 1
fi

echo "Checking for code at $POOL_MANAGER_ADDRESS on $RPC_URL ..."
CODE=$(cast code "$POOL_MANAGER_ADDRESS" --rpc-url "$RPC_URL")

if [ "$CODE" == "0x" ]; then
  echo ""
  echo "❌ NO CODE at this address on this RPC. This is NOT a valid v4 PoolManager"
  echo "   for this chain. Do not deploy against it."
  echo ""
  echo "   Next steps:"
  echo "   1. Check https://docs.uniswap.org/contracts/v4/deployments for the"
  echo "      current X Layer entry (docs have been inconsistent — verify"
  echo "      directly, don't trust a cached page)."
  echo "   2. Check Uniswap's v4-core GitHub repo deployment artifacts for"
  echo "      chain ID 195 (X Layer testnet)."
  echo "   3. Ask in the X Layer / Uniswap Discord dev channels — hackathon"
  echo "      organizers usually pin the correct testnet addresses."
  exit 1
else
  echo "✅ Code found (${#CODE} hex chars). This address has a deployed"
  echo "   contract — confirm it's specifically the v4 PoolManager (not just"
  echo "   any contract) by checking a couple of known PoolManager functions"
  echo "   respond correctly, e.g.:"
  echo ""
  echo "   cast call $POOL_MANAGER_ADDRESS \"extsload(bytes32)\" 0x0 --rpc-url \$RPC_URL"
  echo ""
  echo "   If that reverts unexpectedly, this may be the wrong contract."
fi
