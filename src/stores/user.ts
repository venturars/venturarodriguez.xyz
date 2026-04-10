import { writable } from "svelte/store";
import type { Address } from "viem";

export const walletAddress = writable<Address | undefined>(undefined);

export const walletChainId = writable<number | undefined>(undefined);

/**
 * Monotonic counter used to invalidate wallet-derived data (balances, allowances, etc).
 */
export const walletDataEpoch = writable(0);

/**
 * Invalidates wallet-derived client state after a small delay.
 *
 * Useful for eventual-consistency sources (e.g. indexed data) that may lag right
 * after transaction confirmation. Once resolved, the `walletDataEpoch` has been
 * incremented so dependent effects can refetch fresh data.
 *
 * @returns Promise that resolves after the delayed invalidation is applied.
 */
export async function invalidateWalletData(): Promise<void> {
  const delayMs = 1_300;
  await new Promise<void>((resolve) => {
    setTimeout(() => {
      walletDataEpoch.update((value) => value + 1);
      resolve();
    }, delayMs);
  });
}
