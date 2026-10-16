# agent-runtime

This is an [eve](https://eve.dev) agent bootstrapped with [`eve init`](https://eve.dev/docs/reference/cli#eve-init).

## Getting started

First, run the development server:

```bash
eve dev
```

The development TUI opens an interactive session where you can send messages to your agent.

Start by editing `agent/instructions.md` to define the agent's identity, purpose, tone, and response guidelines. Configure its model and runtime behavior in `agent/agent.ts`.

Add capabilities under `agent/`, including tools, connections, channels, skills, subagents, and schedules. eve reloads your changes as you work.

## Learn more

To learn more about eve, explore these resources:

- [eve documentation](https://eve.dev/docs) — learn about eve's features and authoring APIs.
- [Build an Agent tutorial](https://eve.dev/docs/tutorial/first-agent) — build and deploy an agent step by step.
- [eve on GitHub](https://github.com/vercel/eve) — view the source and contribute.

## Deploy on Vercel

Deploy your agent to [Vercel](https://vercel.com) from the project root:

```bash
eve deploy
```

`eve deploy` links a Vercel project if needed and deploys the agent to production. See the [eve deployment documentation](https://eve.dev/docs/guides/deployment/vercel) for authentication, environment variables, and deployment options.

## Protected Tavren API

`GET /eve/v1/health` is public. Agent inspection and sessions require either
the existing Vercel OIDC authentication or HTTP Basic operator access with
username `tavren` and `TAVREN_AGENT_PASSWORD` from the host's Secret settings.
An absent or incorrect password grants no operator access. The password is
separate from `AI_GATEWAY_API_KEY`; never send the Gateway key to API callers.
Keep operator credentials on trusted servers, outside browser code and source.

This deployment runs the eve AI runtime. The persistent Node payment and
repayment operator remains separately configured and disabled by default.

The agent and monitoring reports share `alibaba/qwen3.7-flash` from
`agent/lib/model.ts`, selected from AI Gateway's free-credit eligible catalog.
Usage consumes the account's free credits and remains subject to rate limits.
