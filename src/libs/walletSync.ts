import {
  getConnection,
  getChainId,
  watchConnection,
  watchChainId,
} from "@wagmi/core";
import type { Address } from "viem";
import { walletAddress, walletChainId } from "../stores/user";
import { wagmiConfig } from "./web3";

let hasSyncedWalletStores = false;

/**
 * Subscribes once to wallet connection + chain changes and mirrors them to Svelte stores.
 *
 * Idempotent by design: repeated calls are no-ops after the first setup.
 */
export function setupWalletStoreSync(): void {
  if (hasSyncedWalletStores) return;
  hasSyncedWalletStores = true;

  watchConnection(wagmiConfig, {
    onChange() {
      const address = (getConnection(wagmiConfig)?.address ?? undefined) as
        | Address
        | undefined;
      walletAddress.set(address);
      if (!address) {
        walletChainId.set(undefined);
      } else {
        walletChainId.set(getChainId(wagmiConfig));
      }
    },
  });

  watchChainId(wagmiConfig, {
    onChange(chainId) {
      walletChainId.set(chainId);
    },
  });

  const initialConnection = getConnection(wagmiConfig);
  walletAddress.set(initialConnection?.address ?? undefined);
  walletChainId.set(getChainId(wagmiConfig));
}
