<script lang="ts">
  import TokenSelectorModal from "./TokenSelectorModal.svelte";
  import { retrieveTokenWithDetails } from "../sdk/token/retrieveTokenWithDetails";
  import { retrieveTokenWithBalance } from "../sdk/user/retrieveTokenWithBalance";
  import { walletAddress, walletDataEpoch } from "../stores/user";
  import { formatFiat, normalizeAmount } from "../utils/interface";
  import type { TokenWithBalance, TokenWithChainId } from "../sdk/types";
  import { formatUnits } from "viem";
  import EN from "../locales/EN.json";

  const locales = EN.components.tokenInput;

  /**
   * Token amount input with selector modal and fiat preview.
   *
   * In normal mode, the amount field is editable. In `previewOnly` mode, it only renders incoming
   * values and blocks manual edits.
   */

  /**
   * @typedef {object} TokenInputProps
   * @property {TokenWithChainId} token - Selected token (bindable).
   * @property {string} [legend] - Optional fieldset legend.
   * @property {string} [value] - Token amount string (bindable).
   * @property {string} [placeholder="0.00"] - Placeholder for amount input.
   * @property {"balances"|"top10"} [emptyQueryMode="top10"] - Empty-search behavior in selector modal.
   * @property {boolean} [previewOnly=false] - When true, amount input is read-only and not editable.
   * @property {boolean} [showAmountPresetButtons=false] - Renders MAX/50%/25% amount preset buttons.
   */
  let {
    token = $bindable<TokenWithChainId>(),
    legend,
    value = $bindable(""),
    placeholder = "0.00",
    emptyQueryMode = "top10",
    previewOnly = false,
    showAmountPresetButtons = false,
  }: {
    token: TokenWithChainId;
    legend?: string;
    value?: string;
    placeholder?: string;
    emptyQueryMode?: "balances" | "top10";
    previewOnly?: boolean;
    showAmountPresetButtons?: boolean;
  } = $props();

  let tokenModalOpen = $state(false);
  let fiatUnitPrice = $state<number | null>(null);
  let fiatCurrency = $state("USD");
  let isLoadingFiat = $state(false);
  let previousTokenKey = $state<string | null>(null);
  let maxAmount = $state<number | undefined>(undefined);

  const fiatValue = $derived.by((): string | null => {
    const amount = normalizeAmount(value);
    if (fiatUnitPrice === null) return locales.fiatUnavailableFallback;
    if (amount <= 0) return "0.00";
    return formatFiat(amount * fiatUnitPrice, fiatCurrency);
  });

  function handleInput(e: Event) {
    if (previewOnly) return;
    const input = e.target as HTMLInputElement;
    value = input.value.replace(/[^\d,.]/g, "");
  }

  function openTokenModal() {
    tokenModalOpen = true;
  }

  function applyPreset(multiplier: number): void {
    if (previewOnly || maxAmount === undefined) return;
    value = (maxAmount * multiplier).toString();
  }

  function isPresetActive(multiplier: number): boolean {
    if (maxAmount === undefined) return false;
    const currentAmount = normalizeAmount(value);
    const presetAmount = maxAmount * multiplier;
    return currentAmount === presetAmount;
  }

  function applySelectedToken(selected: TokenWithChainId | TokenWithBalance) {
    token = {
      chainId: selected.chainId,
      address: selected.address,
      decimals: selected.decimals,
      name: selected.name,
      symbol: selected.symbol,
      logo: selected.logo,
    };
  }

  $effect(() => {
    const tokenKey = `${token.chainId}:${token.address.toLowerCase()}`;
    if (previousTokenKey === null) {
      previousTokenKey = tokenKey;
      return;
    }
    if (previousTokenKey !== tokenKey) {
      value = "";
      previousTokenKey = tokenKey;
    }
  });

  /**
   * Fetches token metadata for fiat display.
   * When preset buttons are enabled and wallet is connected, it also retrieves
   * selected token balance for MAX/50%/25%.
   */
  $effect(() => {
    const { chainId, address } = token;
    const wallet = $walletAddress;
    const epoch = $walletDataEpoch;
    void epoch;
    let cancelled = false;
    isLoadingFiat = true;

    (async () => {
      try {
        if (showAmountPresetButtons && wallet) {
          const tokenWithBalance = await retrieveTokenWithBalance({
            walletAddress: wallet,
            chainId,
            tokenAddress: address,
          });
          if (cancelled) return;
          const unitPrice = Number(tokenWithBalance.fiatValue);
          fiatUnitPrice = unitPrice;
          fiatCurrency = tokenWithBalance.fiatCurrency;
          maxAmount = normalizeAmount(
            formatUnits(tokenWithBalance.balance, tokenWithBalance.decimals),
          );
          return;
        }

        const details = await retrieveTokenWithDetails(chainId, address);
        if (cancelled) return;
        const unitPrice = Number(details.fiatValue);
        fiatUnitPrice = unitPrice;
        fiatCurrency = details.fiatCurrency || "USD";
        maxAmount = undefined;
      } catch (error) {
        console.error("Error retrieving token details", error);
        if (cancelled) return;
        fiatUnitPrice = null;
        fiatCurrency = "USD";
        maxAmount = undefined;
      } finally {
        if (!cancelled) isLoadingFiat = false;
      }
    })();

    return () => {
      cancelled = true;
    };
  });
</script>

<fieldset class="fieldset">
  {#if legend}
    <legend class="fieldset-legend text-base-200 text-base cursor-default">
      {legend}
    </legend>
  {/if}

  <label class="input w-full input-neutral input-xl pl-0 border-0 gap-0">
    <button
      type="button"
      class="btn btn-ghost text-primary-content btn-lg h-full gap-1 px-2"
      onclick={openTokenModal}
    >
      {#if token.logo}
        <img
          src={token.logo}
          alt={`${token.symbol} logo`}
          class="w-5 h-5 rounded-full object-cover"
          loading="lazy"
        />
      {/if}
      {token.symbol}
    </button>

    <input
      type="text"
      bind:value
      oninput={handleInput}
      readonly={previewOnly}
      aria-readonly={previewOnly}
      inputmode="decimal"
      {placeholder}
      autocomplete="off"
      class="grow border-l border-r border-base-300 px-2 text-primary-content {previewOnly
        ? 'cursor-default'
        : ''}"
    />

    <span class="pl-2 text-primary-content cursor-default">
      {#if isLoadingFiat}
        <span
          class="loading loading-spinner loading-sm"
          aria-label={locales.loadingFiatValueAriaLabel}
        ></span>
      {:else}
        {fiatValue ?? ""}
      {/if}
    </span>
  </label>

  {#if showAmountPresetButtons && !previewOnly}
    <div class="mt-2 flex items-center gap-2">
      <button
        type="button"
        class={`btn btn-xs ${isPresetActive(1) ? "btn-neutral" : "btn-outline"}`}
        disabled={maxAmount === undefined}
        onclick={() => applyPreset(1)}
      >
        {locales.maxPreset}
      </button>
      <button
        type="button"
        class={`btn btn-xs ${isPresetActive(0.5) ? "btn-neutral" : "btn-outline"}`}
        disabled={maxAmount === undefined}
        onclick={() => applyPreset(0.5)}
      >
        {locales.halfPreset}
      </button>
      <button
        type="button"
        class={`btn btn-xs ${isPresetActive(0.25) ? "btn-neutral" : "btn-outline"}`}
        disabled={maxAmount === undefined}
        onclick={() => applyPreset(0.25)}
      >
        {locales.quarterPreset}
      </button>
    </div>
  {/if}

  <TokenSelectorModal
    bind:open={tokenModalOpen}
    {emptyQueryMode}
    onSelect={applySelectedToken}
  />
</fieldset>
