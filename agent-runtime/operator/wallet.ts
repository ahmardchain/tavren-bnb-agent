import { EVMWalletProvider, NETWORKS } from "@bnbagent/sdk";
import type { SignableTransaction } from "@bnbagent/sdk/wallets";
import { decodeFunctionData, encodeFunctionData, parseAbi, parseEventLogs, type Abi, type PublicClient } from "viem";
import { publicClient, prepareRepayment, tokenAbi, nativeRepayAbi } from "../../lib/venus.ts";
import { parseUsd, WAD } from "../../lib/risk.ts";
import type { OperatorPolicy } from "./policy.ts";
import type { Prepared, RepaymentIO } from "./repayment.ts";

export function checkSigningFee(tx: SignableTransaction, policy: OperatorPolicy) {
  if (tx.chainId !== 97) throw new Error("The operator cannot sign for another chain.");
  if (!tx.gas || !tx.gasPrice || tx.gas <= 0n || tx.gasPrice <= 0n || tx.gas * tx.gasPrice > policy.maxFeeWei) throw new Error("Transaction gas fee exceeds the operator's fixed cap.");
}

export function openWallet(policy: OperatorPolicy) {
  const password = process.env.TAVREN_WALLET_PASSWORD;
  const walletsDir = process.env.TAVREN_WALLETS_DIR || undefined;
  if (!password || !EVMWalletProvider.keystoreExists(policy.account, walletsDir)) throw new Error("Configure an existing encrypted operator keystore and its password locally. No wallet is generated or imported by this runner.");
  const wallet = new EVMWalletProvider({ address: policy.account, password, walletsDir });
  if (wallet.address.toLowerCase() !== policy.account.toLowerCase()) throw new Error("Keystore does not match the campaign wallet.");
  const sign = wallet.signTransaction.bind(wallet);
  wallet.signTransaction = async tx => { checkSigningFee(tx, policy); return sign(tx); };
  return wallet;
}

export function testnetNetwork() {
  const rpc = process.env.BSC_TESTNET_RPC_URL ?? "https://bsc-testnet-rpc.publicnode.com";
  if (!rpc.startsWith("https://")) throw new Error("The operator RPC must use HTTPS.");
  // A concrete preset prevents SDK environment overrides selecting contracts
  // or a mainnet network. All writes self-pay within checkSigningFee.
  return { ...NETWORKS["bsc-testnet"]!, rpcUrl: rpc, usePaymaster: false };
}

const repayEvent = parseAbi(["event RepayBorrow(address payer,address borrower,uint256 repayAmount,uint256 accountBorrows,uint256 totalBorrows)"]);
export function repaymentIO(policy: OperatorPolicy, wallet: EVMWalletProvider): RepaymentIO {
  const client = publicClient();
  // The SDK accepts an unbound PublicClient. Erase viem's concrete chain
  // generic at this library boundary; every execution verifies chain 97.
  const executor = wallet.makeExecutor({ client: client as unknown as PublicClient, receiptTimeout: 90 });
  return {
    prepare: () => prepareRepayment(policy.account, policy, client),
    async send(transaction, prepared: Prepared) {
      if (await client.getChainId() !== 97) throw new Error("RPC chain changed.");
      const market = prepared.plan.market!;
      const amount = BigInt(prepared.plan.amountRaw);
      if (transaction.kind === "repay") {
        const fresh = await prepareRepayment(policy.account, policy, client);
        if (fresh.plan.action !== "REPAY" || fresh.plan.market?.address.toLowerCase() !== market.address.toLowerCase() || BigInt(fresh.plan.amountRaw) < amount || amount * BigInt(fresh.plan.market.price) / WAD > parseUsd(policy.maxRepayUsd) || BigInt(fresh.plan.market.price) > BigInt(market.price)) throw new Error("The position or price changed; reconcile approvals and prepare again.");
      }
      const native = transaction.kind === "repay" && !market.underlying;
      const abi: Abi = native ? nativeRepayAbi : tokenAbi;
      const functionName = transaction.kind === "repay" ? "repayBorrow" : "approve";
      const args = transaction.kind === "repay" ? (native ? [] : [amount]) : [market.address, transaction.kind === "reset" ? 0n : amount];
      const expectedTo = transaction.kind === "repay" ? market.address : market.underlying;
      const value = native ? amount : 0n;
      // Only locally rebuilt calldata can reach the signer.
      const expectedData = encodeFunctionData({ abi, functionName, args });
      if (!expectedTo || transaction.to.toLowerCase() !== expectedTo.toLowerCase() || transaction.data !== expectedData || BigInt(transaction.value) !== value) throw new Error("Prepared transaction does not match its bounded intent.");
      decodeFunctionData({ abi, data: expectedData });
      const simulation = await client.simulateContract({ account: policy.account, address: expectedTo, abi, functionName, args, value });
      if (simulation.result === false || (typeof simulation.result === "bigint" && simulation.result !== 0n)) throw new Error("Venus or the token rejected the simulated action.");
      const sent = await executor.execute({ call: { address: expectedTo, abi, functionName, args }, value, description: "Tavren bounded testnet repayment" });
      const receipt = sent.receipt ?? await client.waitForTransactionReceipt({ hash: sent.transactionHash, confirmations: 2 });
      if (receipt.status !== "success" || sent.status !== 1) throw new Error("The transaction did not succeed.");
      const confirmedRepay = transaction.kind === "repay" && parseEventLogs({ abi: repayEvent, logs: receipt.logs, strict: true }).some(event => event.address.toLowerCase() === market.address.toLowerCase() && event.args.borrower.toLowerCase() === policy.account.toLowerCase() && event.args.payer.toLowerCase() === policy.account.toLowerCase() && event.args.repayAmount > 0n && event.args.repayAmount <= amount);
      return { hash: sent.transactionHash, confirmedRepay };
    },
  };
}
