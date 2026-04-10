import { writeContract } from "@wagmi/core";
import { erc20Abi, type Address } from "viem";
import { wagmiConfig } from "../../libs/appkit";
import {
  MAX_UINT256,
  NATIVE_TOKEN_ADDRESS,
  SUPPORTED_CHAIN_IDS,
} from "../constants";
import type { Network } from "../types";
import { isValidAddress } from "../utils";

/**
 * Sends ERC-20 approve transaction and waits for confirmation.
 * Uses MAX_UINT256 allowance by default.
 */
export async function approveAllowance(
  chainId: Network["chainId"],
  tokenAddress: Address,
  spenderAddress: Address,
  amount: bigint = MAX_UINT256,
): Promise<`0x${string}`> {
  if (!SUPPORTED_CHAIN_IDS.includes(chainId))
    throw new Error("Unsupported chainId");
  if (!isValidAddress(tokenAddress, { allowNative: true, strict: false }))
    throw new Error("Invalid tokenAddress");
  if (!isValidAddress(spenderAddress, { strict: false }))
    throw new Error("Invalid spenderAddress");
  if (amount < 0n) throw new Error("Invalid allowance amount");
  if (tokenAddress.toLowerCase() === NATIVE_TOKEN_ADDRESS.toLowerCase())
    throw new Error("Native token does not require approval");

  const hash = await writeContract(wagmiConfig, {
    address: tokenAddress,
    abi: erc20Abi,
    functionName: "approve",
    args: [spenderAddress, amount],
    chainId,
  });

  return hash;
}
