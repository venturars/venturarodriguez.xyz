<script lang="ts">
  import { switchChain } from "@wagmi/core";
  import TokenImage from "./TokenImage.svelte";
  import { SUPPORTED_NETWORKS } from "cooperative";
  import { wagmiConfig } from "../libs/web3";
  import { walletAddress, walletChainId } from "../stores/user";
  import EN from "../locales/EN.json";
  import { interpolateTemplate } from "../utils/interface";

  const locales = EN.components.networkSwitcherModal;

  let open = $state(false);
  let isSwitching = $state(false);
  let error = $state<string | null>(null);
  let searchQuery = $state("");
  let modalElement: HTMLDialogElement;

  const activeChainId = $derived($walletChainId);
  const filteredNetworks = $derived.by(() => {
    const query = searchQuery.trim().toLowerCase();
    if (!query) return SUPPORTED_NETWORKS;
    return SUPPORTED_NETWORKS.filter((network) => {
      const matchesName = network.name.toLowerCase().includes(query);
      const matchesChainId = String(network.chainId).includes(query);
      return matchesName || matchesChainId;
    });
  });

  function close() {
    open = false;
    modalElement?.close();
  }

  async function handleSelect(chainId: number) {
    if (isSwitching || !$walletAddress || chainId === activeChainId) {
      close();
      return;
    }

    isSwitching = true;
    error = null;
    try {
      await switchChain(wagmiConfig, { chainId });
      close();
    } catch {
      error = locales.switchFailedFallback;
    } finally {
      isSwitching = false;
    }
  }

  /**
   * Opens local network selector modal from external button event
   * emitted by `NetworkSwitcherButton`.
   */
  $effect(() => {
    const handleOpen = () => {
      if (!$walletAddress) return;
      error = null;
      searchQuery = "";
      open = true;
    };
    window.addEventListener("network-switcher-open", handleOpen);
    return () => {
      window.removeEventListener("network-switcher-open", handleOpen);
    };
  });

  $effect(() => {
    if (open) {
      modalElement.showModal();
    } else {
      modalElement?.close();
    }
  });
</script>

<dialog bind:this={modalElement} class="modal" onclose={() => (open = false)}>
  <form method="dialog" class="modal-backdrop">
    <button
      type="submit"
      class="cursor-default w-full h-full min-w-0 min-h-0 p-0 border-0 bg-transparent"
    >
      <!-- Intentionally hardcoded: dialog backdrop close control text -->
      close
    </button>
  </form>
  <div
    class="modal-box bg-base-100 max-w-md w-full max-h-[80vh] flex flex-col gap-4 rounded-lg"
  >
    <div class="flex items-center justify-between">
      <h3 class="font-playfair text-lg font-semibold text-base-content">
        {locales.title}
      </h3>
      <button
        type="button"
        class="btn btn-ghost btn-md btn-circle text-base-content"
        onclick={close}
        aria-label={locales.closeAriaLabel}
      >
        ✕
      </button>
    </div>

    <input
      type="search"
      placeholder={locales.searchPlaceholder}
      bind:value={searchQuery}
      disabled={!$walletAddress}
      class="input input-neutral w-full border-base-300 input-md min-h-9 disabled:opacity-50"
    />

    <div class="overflow-y-auto flex-1 min-h-0 divide-y divide-base-300">
      {#if !$walletAddress}
        <p class="py-6 text-center text-base-content/70 px-2">
          {locales.connectWalletMessage}
        </p>
      {:else if filteredNetworks.length === 0}
        <p class="py-6 text-center text-base-content/70 px-2">
          {locales.noNetworksFound}
        </p>
      {:else}
        {#each filteredNetworks as network (`network-${network.chainId}`)}
          <button
            type="button"
            class="w-full flex items-center gap-3 py-3 px-2 hover:bg-base-200 transition-colors text-left disabled:opacity-60"
            onclick={() => handleSelect(network.chainId)}
            disabled={isSwitching}
          >
            <TokenImage
              src={network.nativeCurrency.logo}
              alt={interpolateTemplate(
                EN.components.networkSwitcherButton.networkLogoAlt,
                {
                  name: network.name,
                },
              )}
              width={32}
              height={32}
            />
            <div class="flex-1 min-w-0">
              <div class="font-medium text-base-content truncate">
                {network.name}
              </div>
              <div class="text-sm text-base-content/70">
                {interpolateTemplate(locales.chainIdTemplate, {
                  chainId: network.chainId,
                })}
              </div>
            </div>
            {#if network.chainId === activeChainId}
              <span class="badge badge-outline badge-success"
                >{locales.currentBadge}</span
              >
            {/if}
          </button>
        {/each}
      {/if}
    </div>

    <div class="min-h-5">
      {#if error}
        <p class="text-sm text-error">{error}</p>
      {:else if isSwitching}
        <p class="text-sm text-base-content/70">
          {locales.switchingNetwork}
        </p>
      {:else}
        <p class="text-sm invisible">placeholder</p>
      {/if}
    </div>
  </div>
</dialog>
