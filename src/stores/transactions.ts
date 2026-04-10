import { get, writable } from "svelte/store";
import { walletChainId } from "./user";

export type TransactionToastStatus = "sending" | "confirmed" | "failed";

export interface TransactionToastState {
  chainId: number;
  hash: `0x${string}`;
  status: TransactionToastStatus;
  message: string;
}

const txToast = writable<TransactionToastState | null>(null);
let clearTimer: ReturnType<typeof setTimeout> | undefined;

function scheduleClear(delayMs: number): void {
  if (clearTimer) clearTimeout(clearTimer);
  clearTimer = setTimeout(() => {
    txToast.set(null);
    clearTimer = undefined;
  }, delayMs);
}

function getCurrentChainId(): number {
  return get(walletChainId) as number;
}

export const transactionToastStore = {
  subscribe: txToast.subscribe,
  showSending(hash: `0x${string}`): void {
    if (clearTimer) {
      clearTimeout(clearTimer);
      clearTimer = undefined;
    }
    txToast.set({
      chainId: getCurrentChainId(),
      hash,
      status: "sending",
      message: "Transaction submitted. Waiting for confirmation...",
    });
  },
  showConfirmed(hash: `0x${string}`): void {
    txToast.set({
      chainId: getCurrentChainId(),
      hash,
      status: "confirmed",
      message: "Transaction confirmed.",
    });
    scheduleClear(8000);
  },
  showFailed(hash: `0x${string}`, message = "Transaction failed."): void {
    txToast.set({
      chainId: getCurrentChainId(),
      hash,
      status: "failed",
      message,
    });
    scheduleClear(12000);
  },
  clear(): void {
    if (clearTimer) {
      clearTimeout(clearTimer);
      clearTimer = undefined;
    }
    txToast.set(null);
  },
};
