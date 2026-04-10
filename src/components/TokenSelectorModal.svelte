<script lang="ts">
  import TokenImage from "./TokenImage.svelte";
  import { searchSelectorTokens } from "../sdk/search/tokens";
  import { formatTokenBalance } from "../sdk/utils";
  import { walletAddress, walletChainId } from "../stores/user";
  import type { TokenWithBalance, TokenWithChainId } from "../sdk/types";

  /**
   * Modal for choosing a token on the active wallet chain: search by name, symbol, or contract
   * address, optionally weighted by {@link searchSelectorTokens} empty-query behavior.
   */

  /**
   * @typedef {object} TokenSelectorModalProps
   * @property {boolean} [open=false] - Whether the dialog is visible. Use `bind:open` from the parent.
   * @property {"balances"|"top10"} [emptyQueryMode] - What to list when the search field is empty.
   * @property {(token: import("../sdk/types").TokenWithChainId|import("../sdk/types").TokenWithBalance) => void} [onSelect] - Fired when the user confirms a token; the modal closes afterward.
   */

  /** @type {TokenSelectorModalProps} */
  let {
    open = $bindable(false),
    onSelect,
    emptyQueryMode,
  }: {
    open?: boolean;
    emptyQueryMode?: "balances" | "top10";
    onSelect?: (token: TokenWithChainId | TokenWithBalance) => void;
  } = $props();

  let rows = $state<(TokenWithChainId | TokenWithBalance)[]>([]);
  let loading = $state(false);
  let error = $state<string | null>(null);
  let searchQuery = $state("");
  let modalElement: HTMLDialogElement;

  const SEARCH_DEBOUNCE_MS = 280;

  function close() {
    open = false;
    modalElement?.close();
  }

  function handleSelect(token: TokenWithChainId | TokenWithBalance) {
    onSelect?.(token);
    close();
  }

  $effect(() => {
    if (open) {
      modalElement.showModal();
    } else if (!open) {
      modalElement.close();
    }
  });

  /**
   * Loads or clears the token list when the modal opens, wallet or chain changes, or the search
   * query updates. Debounces only non-empty queries; cancels in-flight work on cleanup.
   */
  $effect(() => {
    const isOpen = open;
    const addr = $walletAddress;
    const chain = $walletChainId;
    const q = searchQuery;

    if (!isOpen || addr === undefined || chain === undefined) {
      rows = [];
      error = null;
      loading = false;
      return;
    }

    let cancelled = false;
    loading = true;
    error = null;

    const delay = q.trim() === "" ? 0 : SEARCH_DEBOUNCE_MS;
    const timer = setTimeout(async () => {
      try {
        const data = await searchSelectorTokens({
          walletAddress: addr,
          chainId: chain,
          query: q,
          emptyQueryMode,
        });
        if (!cancelled) {
          rows = data;
          error = null;
        }
      } catch (e) {
        if (!cancelled) {
          error = e instanceof Error ? e.message : "Failed to load tokens";
          rows = [];
        }
      } finally {
        if (!cancelled) loading = false;
      }
    }, delay);

    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  });
</script>

<svelte:window
  onkeydown={(e) => {
    if (e.key === "Escape") close();
  }}
/>

<dialog bind:this={modalElement} class="modal" onclose={() => (open = false)}>
  <form method="dialog" class="modal-backdrop">
    <button
      type="submit"
      class="cursor-default w-full h-full min-w-0 min-h-0 p-0 border-0 bg-transparent"
    >
      close
    </button>
  </form>
  <div
    class="modal-box bg-base-100 max-w-md w-full max-h-[80vh] flex flex-col gap-4 rounded-lg"
  >
    <div class="flex items-center justify-between">
      <h3 class="font-playfair text-lg font-semibold text-base-content">
        Select a token
      </h3>
      <button
        type="button"
        class="btn btn-ghost btn-md btn-circle text-base-content"
        onclick={close}
        aria-label="Close"
      >
        ✕
      </button>
    </div>

    <input
      type="search"
      placeholder="Search by name, symbol or contract address"
      bind:value={searchQuery}
      disabled={!$walletAddress || $walletChainId === undefined}
      class="input input-neutral w-full border-base-300 input-md min-h-9 disabled:opacity-50"
    />

    <div class="overflow-y-auto flex-1 min-h-0 divide-y divide-base-300">
      {#if !$walletAddress}
        <p class="py-6 text-center text-base-content/70 px-2">
          Connect your wallet to search tokens, see your balances, and select
          one.
        </p>
      {:else if $walletChainId === undefined}
        <p class="py-6 text-center text-base-content/70 px-2">
          No active chain detected. Open your wallet and select a supported
          network.
        </p>
      {:else if loading}
        <p class="py-6 text-center text-base-content/70">Loading tokens…</p>
      {:else if error}
        <p class="py-6 text-center text-error">{error}</p>
      {:else if rows.length === 0}
        <p class="py-6 text-center text-base-content/70">No tokens found</p>
      {:else}
        {#each rows as token (token.chainId + ":" + token.address + ":" + token.symbol + ":list")}
          <button
            type="button"
            class="w-full flex items-center gap-3 py-3 px-2 hover:bg-base-200 transition-colors text-left"
            onclick={() => handleSelect(token)}
          >
            <TokenImage src={token.logo} alt="" width={32} height={32} />
            <div class="flex-1 min-w-0">
              <div class="font-medium text-base-content truncate">
                {token.name}
              </div>
              <div class="text-sm text-base-content/70">{token.symbol}</div>
            </div>
            <div class="text-sm text-base-content/80 tabular-nums">
              {(token as TokenWithBalance)?.balance
                ? formatTokenBalance(
                    (token as TokenWithBalance).balance.toString(),
                    (token as TokenWithBalance).decimals,
                  )
                : "0"}
            </div>
          </button>
        {/each}
      {/if}
    </div>
  </div>
</dialog>
