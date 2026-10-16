# Tavren operator

This Node 24 service adds a priced ERC-8183 monitoring endpoint and a separate, explicitly enabled repayment command. The conversational eve agent still has no signing tool. The operator is not connected or running merely because its code builds.

## Configure locally

Copy `agent-runtime/.env.example` to ignored `.env` in `agent-runtime`, or set the equivalent secrets in your own Node host. Choose the trigger, target, per-action USD cap, daily USD cap, allowed Venus market addresses, per-transaction tBNB fee cap, service price and daily job limit. Nothing in chat sets these permissions.

The account is pinned to the campaign wallet in `lib/campaign.ts`, and writes are pinned to chain 97. Configure an existing encrypted BNB SDK keystore for that account and its password locally. This runner does not create wallets, import keys or expose a signing API. An existing browser wallet remains usable through the separate website's user-signed repayment flow.

`AI_GATEWAY_API_KEY` is required for the priced service's model explanation. The model is `openai/gpt-6-luna-fast`, matching the eve agent. Store the credential in the host's secrets or ignored local environment. The payment token is read from the pinned Commerce deployment; check its address and decimals before setting `TAVREN_SERVICE_PRICE_RAW`. Prices are atomic token units, not USD strings.

From `agent-runtime`:

```bash
pnpm install --frozen-lockfile
pnpm operator:check
```

The check reports configuration presence and sends no transactions. Keep both enable flags false until you have reviewed the chosen policy and connected your own signer.

## Run one bounded repayment

Set `TAVREN_EXECUTION_ENABLED=true` only after configuring the policy, then run:

```bash
pnpm operator:repay
```

This inspects the campaign wallet's actual entered Venus Core markets. A healthy or debt-free position does nothing. A below-trigger position may repay one allowed market within the per-action and daily caps. It never borrows, withdraws, transfers to a customer or consumes caller-supplied calldata. It simulates each intent and requires a successful receipt with a matching `RepayBorrow` event. Price increases or a changed plan cancel execution.

The signer also caps each transaction's gas fee. Daily repayment caps cover the loan principal, not gas. ERC-20 approvals can precede repayment; a cancelled or interrupted run may leave an exact allowance that needs inspection or revocation.

The write-ahead journal reserves the budget before signing. Uncertain outcomes stay blocked, even after a restart or UTC day change. Review transaction receipts, allowances and actual balances before reconciling the journal. Never delete a process lock while that process is running, or clear a pending record merely to retry it.

## Serve marketplace monitoring jobs

Set `TAVREN_SERVICE_ENABLED=true`, then run:

```bash
pnpm operator:serve
```

Use a long-running Node host with a persistent volume mounted at `TAVREN_STATE_DIR`. Put the service behind HTTPS at `TAVREN_PUBLIC_URL`; the default local listener is `127.0.0.1:3001`. This disk-based runner is not a stateless serverless handler. Retain the volume across deployments and run one instance against it.

The service exposes:

| Route | Purpose |
| --- | --- |
| `GET /health` | Operator configuration and identity |
| `GET /.well-known/agent-card.json` | A2A card, fixed terms, token, price and daily capacity |
| `POST /api/agent` | A2A `message/send` negotiation and funded-job notifications |
| `GET /job/:jobId/response` | Exact committed manifest after a confirmed submission |

The signed task is exactly `monitor-venus:<wallet-address>`. Copy the service terms from the card. The service rejects execution instructions, extra terms, external context URLs and buyer-supplied policies. The BNB SDK signs a quote bound to chain 97 and the pinned Commerce contract. No report or model call starts until the SDK verifies the onchain provider, funded status, payment token, budget and signed quote. An independently readable dispute window is also required.

The worker reads an observed position, creates the deterministic risk plan, asks the model for a short explanation with no tools, persists the deliverable and submits its canonical manifest hash. The daily job limit bounds model calls and submissions. Concurrent accepted quotes may fill that capacity, so operators must monitor queued funded work and its deadlines. A submission is not a completed hire; settlement and campaign eligibility need separate onchain verification.

Jobs do not move customer lending funds. The repayment command is separate and can act only on the configured campaign wallet. Escrow submission transactions must not be counted as Venus lending actions for the campaign.

## What still needs a live check

The local and CI tests exercise spending boundaries, persistence, concurrency, signed quote recovery and failed-job paths without sending transactions. They do not establish live model access, funded jobs, public availability, wallet signing, settlement, ERC-8004 ownership or marketplace acceptance. Complete those checks with the operator's own connections before publishing an active listing.
