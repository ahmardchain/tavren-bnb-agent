import { agentCard } from "@/lib/agent-discovery";
export function GET(_request?: Request) { return Response.json(agentCard(), { headers: { "Cache-Control": "public, max-age=60" } }); }
