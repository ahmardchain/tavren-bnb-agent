import { registrationDocument } from "@/lib/agent-discovery";
export function GET(_request?: Request) { return Response.json(registrationDocument(), { headers: { "Cache-Control": "public, max-age=60" } }); }
