<script lang="ts">
  import { transactionToastStore } from "../stores/transactions";
  import { getNetwork } from "cooperative";
  import EN from "../locales/EN.json";
  import { interpolateTemplate } from "../utils/interface";

  const locales = EN.components.transactionToast;

  /**
   * Reactive transaction toast payload from global transaction store.
   */
  const txToast = $derived($transactionToastStore);

  /**
   * Shortens a transaction hash for compact UI display.
   *
   * @param hash Full transaction hash.
   * @returns Truncated hash (`0x1234...abcd` style).
   */
  function shortenHash(hash: `0x${string}`): string {
    return `${hash.slice(0, 16)}...${hash.slice(-4)}`;
  }

  /**
   * Maps transaction status to DaisyUI alert variant.
   */
  const alertClass = $derived.by(() => {
    if (!txToast) return "alert-info";
    if (txToast.status === "confirmed") return "alert-success";
    if (txToast.status === "failed") return "alert-error";
    return "alert-info";
  });

  /**
   * Builds the explorer transaction URL for the active toast network.
   *
   * Uses the network configuration (`explorerUrl`) and normalizes trailing slash.
   * Returns `null` when toast/network is unavailable.
   */
  const explorerTxUrl = $derived.by(() => {
    if (!txToast) return null;
    try {
      const network = getNetwork(txToast.chainId);
      const baseUrl = network.explorerUrl.replace(/\/$/, "");
      return `${baseUrl}/tx/${txToast.hash}`;
    } catch {
      return null;
    }
  });
</script>

{#if txToast}
  <div class="fixed bottom-4 right-4 z-50 w-[min(92vw,420px)]">
    <div class={`alert shadow-lg relative ${alertClass}`}>
      <div class="flex justify-between items-center absolute top-0 right-0">
        <button
          type="button"
          class="btn btn-xs btn-square bg-transparent border-none text-inherit p-2"
          aria-label={locales.closeAriaLabel}
          onclick={() => transactionToastStore.clear()}
        >
          ✕
        </button>
      </div>
      <div class="flex-1 min-w-0">
        <p class="font-medium wrap-break-word">{txToast.message}</p>
        <div class="mt-1 flex items-center gap-2">
          <p class="text-xs opacity-80 break-all">
            {interpolateTemplate(locales.txLabelTemplate, {
              hash: shortenHash(txToast.hash),
            })}
          </p>
          {#if explorerTxUrl}
            <a
              href={explorerTxUrl}
              target="_blank"
              rel="noopener noreferrer"
              class="btn btn-ghost btn-xs min-h-0 h-6 px-2"
            >
              {locales.viewOnExplorer}
            </a>
          {/if}
        </div>
      </div>
    </div>
  </div>
{/if}
