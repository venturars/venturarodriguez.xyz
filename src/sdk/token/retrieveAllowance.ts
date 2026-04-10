import { readContract } from "@wagmi/core";
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
 * Retrieves ERC-20 allowance amount in raw units.
 * Returns `MAX_UINT256` for the native token placeholder since allowance is not required.
 */
export async function retrieveAllowance(
  chainId: Network["chainId"],
  tokenAddress: Address,
  ownerAddress: Address,
  spenderAddress: Address,
): Promise<bigint> {
  if (!SUPPORTED_CHAIN_IDS.includes(chainId))
    throw new Error("Unsupported chainId");
  if (!isValidAddress(tokenAddress, { allowNative: true, strict: false }))
    throw new Error("Invalid tokenAddress");
  if (!isValidAddress(ownerAddress, { strict: false }))
    throw new Error("Invalid ownerAddress");
  if (!isValidAddress(spenderAddress, { strict: false }))
    throw new Error("Invalid spenderAddress");

  if (tokenAddress.toLowerCase() === NATIVE_TOKEN_ADDRESS.toLowerCase())
    return MAX_UINT256;

  const allowance = await readContract(wagmiConfig, {
    address: tokenAddress,
    abi: erc20Abi,
    functionName: "allowance",
    args: [ownerAddress, spenderAddress],
    chainId,
  });

  return allowance;
}
