<script lang="ts">
  import StatusMessage from "./StatusMessage.svelte";
  import EN from "../locales/EN.json";

  const locales = EN.components.swapDetails;

  interface Props {
    tokenInAmount: string;
    tokenOutAmount: string;
    isLoading?: boolean;
    hasQuote?: boolean;
    tokenInSymbol?: string;
    tokenOutSymbol?: string;
    minReceivedToken?: string;
    minReceivedUsd?: string;
    priceImpactPercent?: string;
    priceImpactUsd?: string;
    feePriceImpactPercent?: string;
    feePriceImpactUsd?: string;
    swapPriceImpactPercent?: string;
    swapPriceImpactUsd?: string;
  }
  let {
    tokenInAmount,
    tokenOutAmount,
    isLoading = false,
    hasQuote = false,
    tokenInSymbol = "ETH",
    tokenOutSymbol = "USDC",
    minReceivedToken,
    minReceivedUsd,
    priceImpactPercent,
    priceImpactUsd,
    feePriceImpactPercent,
    feePriceImpactUsd,
    swapPriceImpactPercent,
    swapPriceImpactUsd,
  }: Props = $props();

  function formatRate(rate: number): string {
    if (!Number.isFinite(rate) || rate <= 0) return locales.rateFallback;
    if (rate < 0.000001) return locales.rateLessThanMinimum;
    const maximumFractionDigits = rate < 1 ? 8 : 6;
    return rate.toLocaleString("en-US", {
      minimumFractionDigits: 2,
      maximumFractionDigits,
    });
  }

  const details = $derived.by(() => {
    const inNum = parseFloat(String(tokenInAmount).replace(/,/g, "")) || 0;
    const outNum = parseFloat(String(tokenOutAmount).replace(/,/g, "")) || 0;

    // Rate = tokenOut / tokenIn (units of tokenOut per 1 tokenIn)
    const rate = inNum > 0 && outNum > 0 ? outNum / inNum : null;

    const formattedMinReceivedToken =
      minReceivedToken === undefined || minReceivedToken === ""
        ? "-"
        : minReceivedToken;
    const formattedMinReceivedUsd =
      minReceivedUsd === undefined || minReceivedUsd === ""
        ? "-"
        : minReceivedUsd;

    const formattedPriceImpactPercent =
      priceImpactPercent === undefined || priceImpactPercent === ""
        ? "-"
        : `${priceImpactPercent}%`;
    const formattedPriceImpactUsd =
      priceImpactUsd === undefined || priceImpactUsd === ""
        ? "-"
        : priceImpactUsd;

    const formattedFeePriceImpactPercent =
      feePriceImpactPercent === undefined || feePriceImpactPercent === ""
        ? "-"
        : `${feePriceImpactPercent}%`;
    const formattedFeePriceImpactUsd =
      feePriceImpactUsd === undefined || feePriceImpactUsd === ""
        ? "-"
        : feePriceImpactUsd;
    const formattedSwapPriceImpactPercent =
      swapPriceImpactPercent === undefined || swapPriceImpactPercent === ""
        ? "-"
        : `${swapPriceImpactPercent}%`;
    const formattedSwapPriceImpactUsd =
      swapPriceImpactUsd === undefined || swapPriceImpactUsd === ""
        ? "-"
        : swapPriceImpactUsd;

    const hasUnavailableData =
      hasQuote &&
      (rate === null ||
        formattedMinReceivedToken === "-" ||
        formattedMinReceivedUsd === "-" ||
        formattedPriceImpactPercent === "-" ||
        formattedPriceImpactUsd === "-" ||
        formattedSwapPriceImpactPercent === "-" ||
        formattedSwapPriceImpactUsd === "-" ||
        formattedFeePriceImpactPercent === "-" ||
        formattedFeePriceImpactUsd === "-");

    return {
      rate,
      minReceivedToken: formattedMinReceivedToken,
      minReceivedUsd: formattedMinReceivedUsd,
      priceImpactPercent: formattedPriceImpactPercent,
      priceImpactUsd: formattedPriceImpactUsd,
      swapPriceImpactPercent: formattedSwapPriceImpactPercent,
      swapPriceImpactUsd: formattedSwapPriceImpactUsd,
      feePriceImpactPercent: formattedFeePriceImpactPercent,
      feePriceImpactUsd: formattedFeePriceImpactUsd,
      hasUnavailableData,
    };
  });
</script>

<div class="space-y-2 text-sm text-base-200">
  {#if isLoading}
    <div class="min-h-[92px] flex items-center justify-center">
      <span
        class="loading loading-spinner w-16 h-16"
        aria-label={locales.loadingAriaLabel}
      ></span>
    </div>
  {:else}
    <div class="flex items-start justify-between gap-2 max-xs:flex-col">
      <span>{locales.rateLabel}</span>
      <span class="text-right wrap-break-word max-xs:text-left">
        1 {tokenInSymbol} =
        {details.rate !== null
          ? ` ${formatRate(details.rate)} ${tokenOutSymbol}`
          : ` ${locales.rateFallback}`}
      </span>
    </div>
    <div class="flex items-start justify-between gap-2 max-xs:flex-col">
      <span
        class="tooltip tooltip-right cursor-help max-xs:tooltip-bottom"
        data-tip={locales.minimumReceived.tooltip}
      >
        {locales.minimumReceived.label}
      </span>
      <span class="text-right wrap-break-word max-xs:text-left">
        {details.minReceivedToken}
        {#if details.minReceivedToken !== "-"}
          {` ${tokenOutSymbol}`}
        {/if}
        {` (${details.minReceivedUsd})`}
      </span>
    </div>
    <div class="flex items-start justify-between gap-2 max-xs:flex-col">
      <span
        class="tooltip tooltip-right cursor-help underline max-xs:tooltip-bottom"
        data-tip={locales.swapPriceImpact.tooltip}
      >
        {locales.swapPriceImpact.label}
      </span>
      <span class="text-right wrap-break-word max-xs:text-left"
        >{details.swapPriceImpactPercent} ({details.swapPriceImpactUsd})</span
      >
    </div>
    <div class="flex items-start justify-between gap-2 max-xs:flex-col">
      <span
        class="tooltip tooltip-right cursor-help underline max-xs:tooltip-bottom"
        data-tip={locales.feePriceImpact.tooltip}
      >
        {locales.feePriceImpact.label}
      </span>
      <span class="text-right wrap-break-word max-xs:text-left"
        >{details.feePriceImpactPercent} ({details.feePriceImpactUsd})</span
      >
    </div>
    <div class="flex items-start justify-between gap-2 max-xs:flex-col">
      <span
        class="tooltip tooltip-right cursor-help underline max-xs:tooltip-bottom"
        data-tip={locales.priceImpact.tooltip}
      >
        {locales.priceImpact.label}
      </span>
      <span class="text-right wrap-break-word max-xs:text-left"
        >{details.priceImpactPercent} ({details.priceImpactUsd})</span
      >
    </div>
    {#if details.hasUnavailableData}
      <StatusMessage
        variant="warning"
        message={locales.unavailableDataWarning}
        className="mt-4"
      />
    {/if}
  {/if}
</div>
