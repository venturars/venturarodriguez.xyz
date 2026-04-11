import { get, writable } from "svelte/store";
import { walletChainId } from "./user";
import EN from "../locales/EN.json";

export type TransactionToastStatus = "sending" | "confirmed" | "failed";

export interface TransactionToastState {
  chainId: number;
  hash: `0x${string}`;
  status: TransactionToastStatus;
  message: string;
}

const txToast = writable<TransactionToastState | null>(null);
let clearTimer: ReturnType<typeof setTimeout> | undefined;
const locales = EN.components.transactionToast.messages;

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
      message: locales.sending,
    });
  },
  showConfirmed(hash: `0x${string}`): void {
    txToast.set({
      chainId: getCurrentChainId(),
      hash,
      status: "confirmed",
      message: locales.confirmed,
    });
    scheduleClear(8000);
  },
  showFailed(hash: `0x${string}`, message = locales.failedDefault): void {
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
