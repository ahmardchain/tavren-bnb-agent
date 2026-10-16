import { encodeFunctionData, parseAbi, parseEventLogs, type Hash } from "viem";
import { CAMPAIGN_OWNER, CAMPAIGN_CHAIN_ID } from "./campaign.ts";
import { AGENT_URI } from "./agent-discovery.ts";
import { publicClient } from "./venus.ts";

// Canonical deployment verified against bnb-chain/bnbagent-sdk and
// erc-8004/erc-8004-contracts on 2026-10-16.
export const IDENTITY_REGISTRY = "0x8004A818BFB912233c491871b3d84c89A494BD9e" as const;
export const identityAbi = parseAbi([
  "function register(string agentURI) returns (uint256 agentId)",
  "function balanceOf(address owner) view returns (uint256)",
  "function ownerOf(uint256 agentId) view returns (address)",
  "function tokenURI(uint256 agentId) view returns (string)",
  "event Registered(uint256 indexed agentId, string agentURI, address indexed owner)",
]);
export const registrationData = () => encodeFunctionData({ abi: identityAbi, functionName: "register", args: [AGENT_URI] });

async function assertRegistry(client: ReturnType<typeof publicClient>) {
  if (await client.getChainId() !== CAMPAIGN_CHAIN_ID) throw new Error("Registration requires BSC testnet, chain 97.");
  const block = await client.getBlock();
  const age = Date.now() - Number(block.timestamp) * 1000;
  if (age > 90_000 || age < -5000) throw new Error("The testnet provider returned a stale block. Retry shortly.");
  const code = await client.getCode({ address: IDENTITY_REGISTRY, blockNumber: block.number });
  if (!code || code === "0x") throw new Error("The verified identity registry is unavailable on this chain.");
  return block.number;
}

export async function prepareRegistration(client = publicClient()) {
  const blockNumber = await assertRegistry(client);
  const [owned, balance, nonce, pendingNonce, gasPrice] = await Promise.all([
    client.readContract({ address: IDENTITY_REGISTRY, abi: identityAbi, functionName: "balanceOf", args: [CAMPAIGN_OWNER], blockNumber }),
    client.getBalance({ address: CAMPAIGN_OWNER, blockNumber }),
    client.getTransactionCount({ address: CAMPAIGN_OWNER, blockTag: "latest" }),
    client.getTransactionCount({ address: CAMPAIGN_OWNER, blockTag: "pending" }),
    client.getGasPrice(),
  ]);
  if (owned > 0n) throw new Error("This campaign wallet already owns a registry identity. Verify the existing registration before creating another.");
  if (pendingNonce !== nonce) throw new Error("This campaign wallet has a pending transaction. Check its receipt before preparing a new registration.");
  await client.simulateContract({ account: CAMPAIGN_OWNER, address: IDENTITY_REGISTRY, abi: identityAbi, functionName: "register", args: [AGENT_URI], blockNumber });
  // A zero gas price permits estimation before funding a testnet wallet.
  // The wallet transaction below uses the current network gas price.
  const estimate = await client.estimateContractGas({ account: CAMPAIGN_OWNER, address: IDENTITY_REGISTRY, abi: identityAbi, functionName: "register", args: [AGENT_URI], gasPrice: 0n });
  const gas = (estimate * 120n + 99n) / 100n;
  if (gas <= 21_000n || gas > 1_000_000n || gasPrice <= 0n) throw new Error("Unexpected registration gas estimate. Review the testnet provider before signing.");
  const fee = gas * gasPrice;
  return { chainId: CAMPAIGN_CHAIN_ID, from: CAMPAIGN_OWNER, to: IDENTITY_REGISTRY, data: registrationData(), value: "0x0", gas: `0x${gas.toString(16)}`, gasPrice: `0x${gasPrice.toString(16)}`, agentURI: AGENT_URI, balanceWei: balance.toString(), maxEstimatedFeeWei: fee.toString(), canAfford: balance >= fee, block: blockNumber.toString(), expiresAt: Date.now() + 120_000 };
}

export async function verifyRegistration(hash: string, client = publicClient()) {
  if (!/^0x[0-9a-fA-F]{64}$/.test(hash)) throw new Error("Enter a valid transaction hash.");
  await assertRegistry(client);
  const [receipt, tx] = await Promise.all([client.getTransactionReceipt({ hash: hash as Hash }), client.getTransaction({ hash: hash as Hash })]);
  if (receipt.status !== "success") throw new Error("This transaction reverted; it did not register an identity.");
  if (tx.from.toLowerCase() !== CAMPAIGN_OWNER.toLowerCase() || tx.to?.toLowerCase() !== IDENTITY_REGISTRY.toLowerCase() || tx.value !== 0n || tx.input.toLowerCase() !== registrationData().toLowerCase()) throw new Error("This is not Tavren's registration transaction from the campaign wallet.");
  const matches = parseEventLogs({ abi: identityAbi, eventName: "Registered", logs: receipt.logs }).filter(log => log.address.toLowerCase() === IDENTITY_REGISTRY.toLowerCase() && log.args.owner.toLowerCase() === CAMPAIGN_OWNER.toLowerCase() && log.args.agentURI === AGENT_URI);
  if (matches.length !== 1) throw new Error("No unique matching Registered event was found in this receipt.");
  const agentId = matches[0].args.agentId;
  const [owner, uri] = await Promise.all([
    client.readContract({ address: IDENTITY_REGISTRY, abi: identityAbi, functionName: "ownerOf", args: [agentId] }),
    client.readContract({ address: IDENTITY_REGISTRY, abi: identityAbi, functionName: "tokenURI", args: [agentId] }),
  ]);
  if (owner.toLowerCase() !== CAMPAIGN_OWNER.toLowerCase() || uri !== AGENT_URI) throw new Error("Current registry ownership or metadata URI does not match Tavren.");
  return { verified: true, agentId: agentId.toString(), chainId: CAMPAIGN_CHAIN_ID, registry: IDENTITY_REGISTRY, agentRegistry: `eip155:97:${IDENTITY_REGISTRY}`, owner, agentURI: uri, transactionHash: hash, explorer: `https://testnet.bscscan.com/tx/${hash}` };
}
