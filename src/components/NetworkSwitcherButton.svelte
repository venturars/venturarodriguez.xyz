<script lang="ts">
  import NetworkSwitcherModal from "./NetworkSwitcherModal.svelte";
  import TokenImage from "./TokenImage.svelte";
  import { SUPPORTED_NETWORKS } from "cooperative";
  import { walletAddress, walletChainId } from "../stores/user";
  import EN from "../locales/EN.json";
  import { interpolateTemplate } from "../utils/interface";

  const locales = EN.components.networkSwitcherButton;

  /**
   * Active network button for connected users:
   * - Reads `walletAddress` and `walletChainId` from the global store.
   * - Resolves the current network using `SUPPORTED_NETWORKS`.
   * - Shows "Disconnected" or the active network name.
   * - Dispatches the global `network-switcher-open` event to open the modal.
   */
  let { className = "" }: { className?: string } = $props();

  const isDisconnected = $derived(!$walletAddress);
  const activeChainId = $derived($walletChainId);
  const activeNetwork = $derived(
    activeChainId === undefined
      ? undefined
      : SUPPORTED_NETWORKS.find((network) => network.chainId === activeChainId),
  );

  function handleOpenNetworkSwitcher() {
    if (isDisconnected) return;
    window.dispatchEvent(new CustomEvent("network-switcher-open"));
  }
</script>

<button
  type="button"
  class={`btn btn-secondary btn-outline btn-md justify-between ${className}`}
  disabled={isDisconnected}
  onclick={handleOpenNetworkSwitcher}
  aria-label={locales.selectActiveNetworkAriaLabel}
>
  <span class="flex items-center gap-2">
    {#if !isDisconnected && activeNetwork}
      <TokenImage
        src={activeNetwork.nativeCurrency.logo}
        alt={interpolateTemplate(locales.networkLogoAlt, {
          name: activeNetwork.name,
        })}
        width={20}
        height={20}
      />
    {/if}
    <span>
      {#if isDisconnected}
        {locales.disconnected}
      {:else}
        {activeNetwork?.name ?? locales.unsupportedNetwork}
      {/if}
    </span>
  </span>
</button>

<NetworkSwitcherModal />
