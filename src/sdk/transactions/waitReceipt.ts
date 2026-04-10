import { waitForTransactionReceipt } from "@wagmi/core";
import { wagmiConfig } from "../../libs/appkit";
import type { Network } from "../types";

/**
 * Waits until a transaction hash is confirmed on-chain.
 */
export async function waitReceipt(
  hash: `0x${string}`,
  chainId: Network["chainId"],
): Promise<boolean> {
  try {
    const receipt = await waitForTransactionReceipt(wagmiConfig, {
      hash,
      chainId,
    });
    return receipt.status === "success";
  } catch {
    return false;
  }
}
