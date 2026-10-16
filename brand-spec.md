# Tavren — working identity

The first product is a Venus Core loan monitor and capped repayment planner on BSC testnet. Tavren is a working name, not a cleared trademark: research on 15 October 2026 found unrelated software agencies using it. Confirm a permanent identity before public promotion.

## Design read

Artifact: operational lending dashboard. Audience: borrowers inspecting their own loan. Greenfield. Visual language: printed financial instrument, warm technical paper. Variance 4, motion 3, density 7, asset dependence 2, brand fidelity 2. The main screen gives the current risk, the boundary behind it, and one next action. Mobile moves controls above the data rather than shrinking a desktop sidebar.

## Design decisions

- Material: warm paper and ink; no gradients, glow, or glass.
- Composition: compact header, oversized coverage figure, a proportional risk ruler, and a 2:1 analysis/control split.
- Palette: #f4f2ed paper, #ffffff surface, #222923 ink, #b86616 amber. Neutral and semantic variants derive from these.
- Typography: Georgia for the product wordmark and selected numeric emphasis; Helvetica Neue for compact operational text; monospace for onchain references. Installed system fonts avoid remote font requests.
- Spacing: 4px base; 8, 12, 16, 24, 32, 48px major intervals.
- Radius: 6px controls, 10px major panels. Thin neutral borders. Shadows only for dialogs.
- Motion: 160ms press/focus transitions, 300ms state changes; reduced-motion override.
- Assets: original typographic wordmark; Lucide icons already installed in the starter. No fabricated partners, activity, transactions, or claimed users.
- Theme: light by default, explicit dark-mode control.

## References and verification

Read Ahmard's current AGENTS(1).md and AGENTS(2).md, web-design-engineer and design-calibration guidance, and ui-polish. Inspected existing shadcn Button and other starter components before adding UI; checked Spectrum UI (https://ui.spectrumhq.in). Its animation-led marketing blocks do not improve this dense data workflow, so use existing components and restrained CSS motion.

Browser QA is unavailable in this managed session because control-browser is absent. Do not claim visual inspection or responsive browser acceptance. Use typechecking, semantic source review, build checks, and meaningful risk/API tests, and disclose that limit.
