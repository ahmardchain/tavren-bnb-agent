import { publicClient, COMPTROLLER } from "@/lib/venus";
export async function GET() {
  try {
    const client = publicClient();
    const [chainId, block, code] = await Promise.all([client.getChainId(), client.getBlock(), client.getCode({ address: COMPTROLLER })]);
    if (chainId !== 97 || !code || code === "0x" || Math.abs(Date.now() - Number(block.timestamp) * 1000) > 90_000) throw new Error("Chain not ready");
    return Response.json({ status: "ready", chainId, block: block.number.toString(), observedAt: Number(block.timestamp) * 1000, mode: "monitor-and-prepare", registered: false, escrow: "not-configured" }, { headers: { "Cache-Control": "no-store" } });
  } catch { return Response.json({ status: "provider-unavailable", chainId: 97, registered: false }, { status: 503 }); }
}
