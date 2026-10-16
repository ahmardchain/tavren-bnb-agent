import { createPublicClient, fallback, http, parseAbi, getAddress, isAddress, encodeFunctionData, type Address } from "viem";
import { bscTestnet } from "viem/chains";
import { WAD, makePlan, type Policy, type Snapshot, type Market } from "./risk.ts";

// Official Venus deployment registry, verified 15 October 2026:
// https://docs-v4.venus.io/deployed-contracts/markets.md#bnb-chain-testnet-test-only
export const COMPTROLLER = "0x94d1820b2D1c7c7452A163983Dc888CEC546b77D" as const;
export const VBNB = "0x2E7222e51c0f6e98610A1543Aa3836E092CDe62c" as const;
const comptrollerAbi = parseAbi([
  "function getAssetsIn(address) view returns (address[])",
  "function getAccountLiquidity(address) view returns (uint256,uint256,uint256)",
  "function oracle() view returns (address)",
  "function mintedVAIs(address) view returns (uint256)",
  "function markets(address) view returns (bool,uint256,bool)",
]);
export const tokenAbi = parseAbi([
  "function underlying() view returns (address)", "function decimals() view returns (uint8)",
  "function symbol() view returns (string)", "function balanceOf(address) view returns (uint256)",
  "function allowance(address,address) view returns (uint256)",
  "function approve(address,uint256) returns (bool)",
  "function getAccountSnapshot(address) view returns (uint256,uint256,uint256,uint256)",
  "function repayBorrow(uint256) returns (uint256)",
]);
export const nativeRepayAbi = parseAbi(["function repayBorrow() payable"]);
const oracleAbi = parseAbi(["function getUnderlyingPrice(address) view returns (uint256)"]);

export function publicClient() {
  const override = process.env.BSC_TESTNET_RPC_URL;
  if (override && !override.startsWith("https://")) throw new Error("RPC must use HTTPS.");
  return createPublicClient({ chain: bscTestnet, transport: fallback([
    http(override || "https://bsc-testnet-rpc.publicnode.com", { timeout: 12_000, retryCount: 0 }),
    http(bscTestnet.rpcUrls.default.http[0], { timeout: 12_000, retryCount: 0 }),
  ], { rank: false, retryCount: 0 }) });
}

export async function readPosition(input: string, client = publicClient()): Promise<Snapshot> {
  if (!isAddress(input, { strict: false }) || /^0x0{40}$/i.test(input)) throw new Error("Enter a valid, nonzero BNB wallet address.");
  const account = getAddress(input.toLowerCase());
  if (await client.getChainId() !== 97) throw new Error("RPC is connected to the wrong chain.");
  const block = await client.getBlock();
  const now = Date.now();
  if (now - Number(block.timestamp) * 1000 > 90_000 || Number(block.timestamp) * 1000 > now + 5_000) throw new Error("RPC returned a stale or invalid block.");
  const blockNumber = block.number;
  const [assets, liquidity, oracle, vai] = await Promise.all([
    client.readContract({ address: COMPTROLLER, abi: comptrollerAbi, functionName: "getAssetsIn", args: [account], blockNumber }),
    client.readContract({ address: COMPTROLLER, abi: comptrollerAbi, functionName: "getAccountLiquidity", args: [account], blockNumber }),
    client.readContract({ address: COMPTROLLER, abi: comptrollerAbi, functionName: "oracle", blockNumber }),
    client.readContract({ address: COMPTROLLER, abi: comptrollerAbi, functionName: "mintedVAIs", args: [account], blockNumber }),
  ]);
  if (liquidity[0] !== 0n) throw new Error(`Venus rejected the liquidity read (code ${liquidity[0]}).`);
  if (vai > 0n) throw new Error("VAI debt is not supported in this first version. Use Venus to inspect this position.");
  if (assets.length > 16) throw new Error("More than 16 entered markets: manual review required.");
  const markets = await Promise.all(assets.map(async (address): Promise<Market | null> => {
    const [snapshot, price, listing] = await Promise.all([
      client.readContract({ address, abi: tokenAbi, functionName: "getAccountSnapshot", args: [account], blockNumber }),
      client.readContract({ address: oracle, abi: oracleAbi, functionName: "getUnderlyingPrice", args: [address], blockNumber }),
      client.readContract({ address: COMPTROLLER, abi: comptrollerAbi, functionName: "markets", args: [address], blockNumber }),
    ]);
    if (snapshot[0] !== 0n) throw new Error("A market returned an invalid account snapshot.");
    const borrow = snapshot[2];
    if (borrow === 0n) return null;
    if (!listing[0] || price <= 0n) throw new Error("An active debt market is unlisted or has no oracle price.");
    const native = address.toLowerCase() === VBNB.toLowerCase();
    const underlying = native ? null : await client.readContract({ address, abi: tokenAbi, functionName: "underlying", blockNumber });
    const [decimals, symbol, balance, allowance] = underlying ? await Promise.all([
      client.readContract({ address: underlying, abi: tokenAbi, functionName: "decimals", blockNumber }),
      client.readContract({ address: underlying, abi: tokenAbi, functionName: "symbol", blockNumber }),
      client.readContract({ address: underlying, abi: tokenAbi, functionName: "balanceOf", args: [account], blockNumber }),
      client.readContract({ address: underlying, abi: tokenAbi, functionName: "allowance", args: [account, address], blockNumber }),
    ]) : [18, "BNB", await client.getBalance({ address: account, blockNumber }), 0n] as const;
    if (decimals > 36) throw new Error("Unsupported token precision.");
    return { address, symbol, underlying, decimals, borrowRaw: borrow.toString(), price: price.toString(), debtUsd: (borrow * price / WAD).toString(), walletRaw: balance.toString(), allowanceRaw: allowance.toString() };
  }));
  const debts = markets.filter((m): m is Market => m !== null);
  const debt = debts.reduce((sum, m) => sum + BigInt(m.debtUsd), 0n);
  const capacity = debt + liquidity[1] - liquidity[2];
  if (capacity < 0n) throw new Error("Inconsistent Venus liquidity and debt accounting.");
  return { source: "live", chainId: 97, account, block: blockNumber.toString(), observedAt: Number(block.timestamp) * 1000, liquidityUsd: liquidity[1].toString(), shortfallUsd: liquidity[2].toString(), debtUsd: debt.toString(), capacityUsd: capacity.toString(), markets: debts };
}

export type PreparedTransaction = { kind: "reset" | "approve" | "repay"; to: Address; data: `0x${string}`; value: string };
export async function prepareRepayment(account: string, policy: Policy) {
  // Re-read on the server; never accept caller-supplied balances or calldata.
  const snapshot = await readPosition(account);
  const plan = makePlan(snapshot, policy);
  const transactions: PreparedTransaction[] = [];
  if (plan.action === "REPAY" && plan.market) {
    const { market } = plan;
    const amount = BigInt(plan.amountRaw);
    if (market.underlying && BigInt(market.allowanceRaw) < amount) {
      if (BigInt(market.allowanceRaw) > 0n) transactions.push({ kind: "reset", to: market.underlying, data: encodeFunctionData({ abi: tokenAbi, functionName: "approve", args: [market.address, 0n] }), value: "0" });
      transactions.push({ kind: "approve", to: market.underlying, data: encodeFunctionData({ abi: tokenAbi, functionName: "approve", args: [market.address, amount] }), value: "0" });
    }
    transactions.push({ kind: "repay", to: market.address, data: market.underlying ? encodeFunctionData({ abi: tokenAbi, functionName: "repayBorrow", args: [amount] }) : encodeFunctionData({ abi: nativeRepayAbi, functionName: "repayBorrow" }), value: market.underlying ? "0" : amount.toString() });
  }
  return { snapshot, plan, transactions, expiresAt: Date.now() + 60_000, chainId: 97 as const };
}
