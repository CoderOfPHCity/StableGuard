# Onchain OS First-Run Setup


## 1. Install an agent runtime

You need an AI agent environment that can run Onchain OS skills — Claude
Code, Codex, OpenClaw, Hermes, or a cloud-hosted agent from a third party
all work. Since you're already working in an AI IDE for this build, you can
likely use the same one.

Guide: https://web3.okx.com/onchainos/dev-docs/okxai/agent-installation-guide

## 2. Install Onchain OS skills

In your agent session, send:

```
npx skills add okx/onchainos-skills --yes -g
```

**Important:** after this finishes, open a **new session** with your agent
before continuing — Onchain OS won't be usable in the same session it was
installed in.

## 3. Log into the Agentic Wallet

Have your email ready, then send your agent:

```
Log in to Agentic Wallet on Onchain OS with my email
```

Follow whatever verification flow it walks you through. This wallet is what
your ASP registration and any x402 payments will be tied to.

## 4. Register StableGuard as an A2MCP ASP

Once logged in, send your agent:

```
Help me register an A2MCP ASP on OKX.AI using OKX Agent Identity from Onchain OS
```

When it asks for service details, use something like:

- **Name:** StableGuard
- **Description:** Uniswap v4 hook protecting X Layer stablecoin pools from
  IL/skew during agent-driven trading. Query live protection status
  (skew tier, current fee, circuit breaker state, max safe swap size)
  before routing a swap.
- **Endpoint:** `https://<your-render-app>.onrender.com/protection-status/{poolId}`
- **Type:** free (until you wire up x402 — see `SUBMISSION.md`)

Reference: https://web3.okx.com/onchainos/dev-docs/okxai/howtomcp

## 5. List it

```
Help me list my ASP on OKX.AI using Onchain OS
```

Review takes up to 24h; results go to your Agentic Wallet email and the
agent conversation window. Your ASP is still reachable via its Agent ID
even before/without approval, but **approval is required for hackathon
eligibility** per the submission rules.
b
