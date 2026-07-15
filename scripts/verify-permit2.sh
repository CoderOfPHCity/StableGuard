#!/usr/bin/env bash
# Verifies Permit2 has code at the configured address on X Layer testnet
# before you deploy StableGuardRouter against it. Same idea as
# verify-pool-manager.sh — don't trust a commonly-cited address blind.

set -euo pipefail

ENV_FILE="$(dirname "$0")/../contracts/.env"

if [ ! -f "$ENV_FILE" ]; then
  echo "Missing $ENV_FILE — copy contracts/.env.example to contracts/.env first."
  exit 1
fi

# shellcheck disable=SC1090
export $(grep -v '^#' "$ENV_FILE" | grep -v '^$' | xargs)

if [ -z "${RPC_URL:-}" ] || [ -z "${PERMIT2_ADDRESS:-}" ]; then
  echo "RPC_URL or PERMIT2_ADDRESS not set in $ENV_FILE"
  exit 1
fi

echo "Checking for code at $PERMIT2_ADDRESS on $RPC_URL ..."
CODE=$(cast code "$PERMIT2_ADDRESS" --rpc-url "$RPC_URL")

if [ "$CODE" == "0x" ]; then
  echo ""
  echo "❌ NO CODE at this address on X Layer testnet. Permit2 has not been"
  echo "   deployed to this chain at its usual deterministic address (or"
  echo "   this RPC/chain is wrong). Do not deploy StableGuardRouter yet."
  echo ""
  echo "   Next steps:"
  echo "   1. Check https://docs.uniswap.org/contracts/permit2/deployments"
  echo "   2. If Permit2 genuinely isn't on X Layer testnet, you have two"
  echo "      options: skip the router/Permit2 flow for this hackathon and"
  echo "      have agents call approve() directly before swapping, or"
  echo "      deploy your own Permit2 instance (it's permissionless and"
  echo "      open source: https://github.com/Uniswap/permit2)."
  exit 1
else
  echo "✅ Code found (${#CODE} hex chars) at the Permit2 address."
fi
