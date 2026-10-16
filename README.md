# Tavren — first build

A Venus Core loan monitor and bounded repayment planner for BNB Chain Set and Earn. Tavren is a working name; unrelated software agencies use it, so clear the permanent identity before promotion.

Preview: https://tavren-bnb.ahmardchain.chatgpt.site (initially owner-private).

## Implemented

- Reads actual BSC testnet chain ID, block, Core liquidity, entered markets, stored debt, oracle prices, token balances and allowances. Contract reads pin the same observed block.
- Uses bigint for exact token/price calculations, including six-decimal tokens. Rejects stale blocks, wrong chains, VAI debt, failed snapshots and missing oracle prices.
- Separates labelled sample stress scenarios from live evidence. Exports reports and refreshes every 60 seconds while the tab is open when enabled.
- Prepares one bounded repayment with exact approvals. Native repayments retain 0.003 tBNB for gas. The browser wallet must select chain 97 and the checked account, simulate, and sign each step. Success requires a confirmed receipt and a matching RepayBorrow event.
- Exposes a read-only A2A message/send endpoint and a discovery card. An eve harness has typed loan inspection and unsigned preparation tools; the language model has no signing tool.

## Current limits

This is an early build, not a qualified campaign entry. The intended campaign owner is `0x4Fc7C503265df9Ed4885042D8F711199E0eF5fB9` on chain 97. The owner confirmed official form submission on 16 October 2026; this is not organizer verification. No ERC-8004 identity, listing, independent hires or connected operator signer has been supplied. The draft registration metadata deliberately reports active=false and an empty registrations array.

The website is private. Organizers and marketplaces will need a public endpoint before identity registration/listing. The separate eve harness and Node operator need an operator-owned model connection. The operator now implements signed ERC-8183 monitoring quotes, strict funded-job checks, persistent deliverables and submission, plus a separate disabled-by-default bounded repayment command. It requires a persistent Node host, configured limits and the operator's encrypted signer. Model calls, wallet signing and paid jobs were not executed during this build. See [operator setup](agent-runtime/operator/README.md).

Coverage uses the Core borrow limit and stored balances, not a guaranteed liquidation threshold. Scenario controls shock collateral capacity while holding debt/prices constant. Other pools and VAI need separate adapters. User repayments from the app must not be mislabelled as transactions by an autonomous agent wallet.

## Run

Node 24 is required for the conversational runtime and TypeScript tests.

```bash
pnpm install
pnpm dev
pnpm test
pnpm typecheck
pnpm build
```

In this managed environment retain the provided Sites install/build workflow. Do not remove its build integration or dependency release-age policy. Optional BSC_TESTNET_RPC_URL must use HTTPS; the runtime verifies chain 97 and block freshness.

```bash
cd agent-runtime
pnpm install
pnpm dev
```

Connect the model through eve setup or an operator-owned AI Gateway credential. Never put keys in chat or source. The harness imports the shared checked lending adapter from this repository.

## HTTP API

| Route | Role |
| --- | --- |
| GET /api/campaign | Intended campaign owner, pending status and prefilled form |
| GET /api/health | Live testnet readiness; 503 on failure |
| POST /api/position | Wallet and optional policy to observed snapshot and plan |
| POST /api/plan | Fresh server read to unsigned exact repayment calldata |
| GET /.well-known/agent-card.json | A2A discovery for monitor-venus |
| POST /api/agent | JSON-RPC message/send with data part containing wallet and optional policy |
| GET /agent.json | Inactive draft ERC-8004 metadata |

Policy: triggerBps=13500 means 1.35x, targetBps=16000 means 1.60x, maxRepayUsd is a decimal string. Prepared plans expire after 60 seconds.

## Campaign next steps

1. Campaign form submission was confirmed by the owner. Retain the confirmation and use the same wallet throughout.
2. Configure and validate an agent-owned testnet lending position and the operator's bounded signing runtime.
3. Connect and host the Node operator, then validate its signed negotiation, funded-job fulfillment, deliverable retrieval and submission on testnet. The website's read-only A2A endpoint remains separate from the priced operator endpoint.
4. Make the endpoint public, register ERC-8004 from the campaign wallet, list on a shortlisted marketplace, and publish registry ID and chain in a public GitHub repository.
5. Hire three different agents across two approved marketplaces. Attract three genuine completed hires from independent wallets, and perform five matching actions over three separate days. Do not fund customers or fabricate activity.

Deadline: 5 November 2026, 12:00 UTC / 13:00 Nigeria. Rewards are physical merchandise. Qualification is determined by the organizer.

## Validation

The GitHub workflow in `.github/workflows/ci.yml` runs the tests, typechecks and production builds for both the application and agent runtime on Node 24. It uses both committed lockfiles and requires no wallet or model credentials.

The application and operator have deterministic tests for risk math, adapters, APIs, spending limits, replay prevention, daily budgets, persistence, concurrency and signed quotes. CI runs tests, typechecks and builds for both projects. Optional native compression build scripts are explicitly disabled; they are not needed by the lending tools. A prior live read-only probe returned chain 97, block 137004919 and no debt for the non-user test address 0x0000000000000000000000000000000000000001. This read is not a campaign transaction.

Browser rendering, mobile wallet signing and paid-job behavior have not been verified. The supported control-browser skill is absent from this managed session, so no alternative browser was installed or used.

## Primary references, checked 15 October 2026

- [Official campaign](https://www.bnbchain.org/en/hackathons/smart-money-era-set-and-earn)
- [Venus deployment registry](https://docs-v4.venus.io/deployed-contracts/markets.md), BNB Testnet Core
- [BNB agent SDK](https://github.com/bnb-chain/bnbagent-sdk), architecture and TypeScript examples
- [Mandate listing guide](https://www.mandatemarkets.com/build)

Design decisions and name collision notes: brand-spec.md.
