import { CAMPAIGN_OWNER, CAMPAIGN_CHAIN_ID, REGISTRATION_STATUS, registrationUrl } from "@/lib/campaign";
export function GET() {
  return Response.json({ intendedOwner: CAMPAIGN_OWNER, chainId: CAMPAIGN_CHAIN_ID, registrationStatus: REGISTRATION_STATUS, registryId: null, registrationUrl: registrationUrl() }, { headers: { "Cache-Control": "no-store" } });
}
