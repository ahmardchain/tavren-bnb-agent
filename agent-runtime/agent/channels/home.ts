import { defineChannel, GET, POST } from "eve/channels";
import { agentCard, registrationDocument } from "../../../lib/agent-discovery.ts";
import { agentInfo, monitorMessage } from "../../../lib/agent-protocol.ts";
import { prepareRegistration, verifyRegistration } from "../../../lib/agent-registration.ts";
import { CAMPAIGN_OWNER, CAMPAIGN_CHAIN_ID, REGISTRATION_STATUS, REGISTRATION_EVIDENCE, registrationUrl } from "../../../lib/campaign.ts";
import { VERIFIED_IDENTITY } from "../../../lib/agent-identity.ts";
import { publicClient, COMPTROLLER } from "../../../lib/venus.ts";
import { errorResponse, jsonHeaders } from "../../../lib/api.ts";
import { agentIcon, registrationPage, registrationScript } from "../lib/registration-page.ts";

const metadataHeaders = { "Cache-Control": "public, max-age=60", "X-Content-Type-Options": "nosniff" };
const renderPage = async () => new Response(registrationPage, { headers: { ...jsonHeaders, "Content-Type": "text/html; charset=utf-8", "Content-Security-Policy": "default-src 'self'; style-src 'self' 'unsafe-inline'; script-src 'self'; object-src 'none'; base-uri 'none'; frame-ancestors 'none'", "Referrer-Policy": "no-referrer" } });
export default defineChannel({
  routes: [
    // eve 0.73's virtual handler IDs retain path extensions. Parameter routes
    // prevent the bundler from parsing JavaScript handlers as JSON files.
    GET("/.well-known/:document", async (_request, { params }) => {
      if (params.document === "agent-card.json") return Response.json(agentCard(), { headers: metadataHeaders });
      if (params.document === "agent-registration.json") return Response.json(registrationDocument(), { headers: metadataHeaders });
      return new Response("Not found", { status: 404 });
    }),
    GET("/metadata", async () => Response.json(registrationDocument(), { headers: metadataHeaders })),
    GET("/api/campaign", async () => Response.json({ intendedOwner: CAMPAIGN_OWNER, chainId: CAMPAIGN_CHAIN_ID, registrationStatus: REGISTRATION_STATUS, registrationEvidence: REGISTRATION_EVIDENCE, registryId: VERIFIED_IDENTITY.agentId, identityStatus: "verified", identityEvidence: VERIFIED_IDENTITY, registrationUrl: registrationUrl() }, { headers: { "Cache-Control": "no-store" } })),
    GET("/api/health", async () => {
      try {
        const client = publicClient();
        const [chainId, block, code] = await Promise.all([client.getChainId(), client.getBlock(), client.getCode({ address: COMPTROLLER })]);
        if (chainId !== 97 || !code || code === "0x" || Math.abs(Date.now() - Number(block.timestamp) * 1000) > 90_000) throw new Error("Chain not ready");
        return Response.json({ status: "ready", chainId, block: block.number.toString(), observedAt: Number(block.timestamp) * 1000, mode: "monitor-and-prepare", registered: true, registryId: VERIFIED_IDENTITY.agentId, escrow: "not-configured" }, { headers: { "Cache-Control": "no-store" } });
      } catch { return Response.json({ status: "provider-unavailable", chainId: 97, registered: true, registryId: VERIFIED_IDENTITY.agentId }, { status: 503 }); }
    }),
    GET("/api/agent", async () => agentInfo()), POST("/api/agent", monitorMessage),
    GET("/tavren.svg", async () => new Response(agentIcon, { headers: { ...metadataHeaders, "Content-Type": "image/svg+xml" } })),
    GET("/", renderPage), GET("/register", renderPage),
    GET("/register.js", async () => new Response(registrationScript, { headers: { ...jsonHeaders, "Content-Type": "application/javascript; charset=utf-8" } })),
    GET("/api/registration/prepare", async () => { try { return Response.json(await prepareRegistration(), { headers: jsonHeaders }); } catch (error) { return errorResponse(error); } }),
    GET("/api/registration/verify", async request => { try { return Response.json(await verifyRegistration(new URL(request.url).searchParams.get("hash") ?? ""), { headers: jsonHeaders }); } catch (error) { return errorResponse(error); } }),
  ],
});
