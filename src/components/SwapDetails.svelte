<script lang="ts">
  import StatusMessage from "./StatusMessage.svelte";

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
    if (!Number.isFinite(rate) || rate <= 0) return "-";
    if (rate < 0.000001) return "< 0.000001";
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
        aria-label="Loading swap details"
      ></span>
    </div>
  {:else}
    <div class="flex justify-between items-center">
      <span>Rate</span>
      <span>
        1 {tokenInSymbol} =
        {details.rate !== null
          ? ` ${formatRate(details.rate)} ${tokenOutSymbol}`
          : " -"}
      </span>
    </div>
    <div class="flex justify-between items-center">
      <span
        class="tooltip tooltip-right cursor-help"
        data-tip="The minimum amount you will receive if the price moves unfavorably before your transaction is confirmed. Based on your slippage tolerance."
      >
        Minimum received
      </span>
      <span>
        {details.minReceivedToken}
        {#if details.minReceivedToken !== "-"}
          {` ${tokenOutSymbol}`}
        {/if}
        {` (${details.minReceivedUsd})`}
      </span>
    </div>
    <div class="flex justify-between items-center">
      <span
        class="tooltip tooltip-right cursor-help underline"
        data-tip="The estimated market impact from the swap itself, excluding route fees."
      >
        Swap price impact
      </span>
      <span
        >{details.swapPriceImpactPercent} ({details.swapPriceImpactUsd})</span
      >
    </div>
    <div class="flex justify-between items-center">
      <span
        class="tooltip tooltip-right cursor-help underline"
        data-tip="Extra impact caused by fees in this route."
      >
        Fee price impact
      </span>
      <span>{details.feePriceImpactPercent} ({details.feePriceImpactUsd})</span>
    </div>
    <div class="flex justify-between items-center">
      <span
        class="tooltip tooltip-right cursor-help underline"
        data-tip="The effect your trade has on the market price. Larger trades typically have higher impact, which may result in worse execution."
      >
        Price impact
      </span>
      <span>{details.priceImpactPercent} ({details.priceImpactUsd})</span>
    </div>
    {#if details.hasUnavailableData}
      <StatusMessage
        variant="warning"
        message="Be careful, some data is unavailable for this swap."
        className="mt-4"
      />
    {/if}
  {/if}
</div>
