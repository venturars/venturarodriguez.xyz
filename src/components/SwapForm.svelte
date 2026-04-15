<script lang="ts">
  import SwapVerticalIcon from "./icons/SwapVerticalIcon.svelte";
  import TokenInput from "./TokenInput.svelte";
  import SlippageInput from "./SlippageInput.svelte";
  import PlatformDonationInput from "./PlatformDonationInput.svelte";
  import RecipientAddressInput from "./RecipientAddressInput.svelte";
  import SwapDetails from "./SwapDetails.svelte";
  import SubmitTransaction from "./SubmitTransaction.svelte";
  import type { SwapPrice, TokenWithChainId } from "cooperative";
  import {
    buildPlaceholderTokenWithChainId,
    formatBpsToPercent,
    formatFiat,
    formatTokenAmount,
    hasValidPositiveAmount,
    parseAmountToUnits,
    normalizeNumericInput,
  } from "../utils/interface";
  import { isValidAddress } from "cooperative";
  import {
    invalidateWalletData,
    walletChainId,
    walletAddress,
    walletDataEpoch,
  } from "../stores/user";
  import {
    getPrice,
    getQuote,
    retrieveTokenWithBalance,
    submitQuoteTransaction,
    validateQuoteAgainstPrice,
    waitReceipt,
  } from "cooperative";
  import { transactionToastStore } from "../stores/transactions";
  import {
    getTransactionErrorMessage,
    interpolateTemplate,
  } from "../utils/interface";
  import { type Address } from "viem";
  import EN from "../locales/EN.json";

  const locales = EN.pages.swaps.form;

  let tokenIn = $state<TokenWithChainId>(
    buildPlaceholderTokenWithChainId($walletChainId ?? 1),
  );
  let tokenOut = $state<TokenWithChainId>(
    buildPlaceholderTokenWithChainId($walletChainId ?? 1),
  );
  let amountIn = $state("");
  let amountOut = $state("");
  let tokenInBalance = $state<bigint | undefined>(undefined);
  let slippage = $state(0.5);
  let platformFeePercent = $state(0.15);
  let recipientAddress = $state("");
  let swapDetails = $state<SwapPrice | undefined>(undefined);
  let isLoadingQuote = $state(false);
  let isSubmitting = $state(false);
  let quoteError = $state<string | null>(null);
  let tokenInBalanceError = $state<string | null>(null);
  let submitMessage = $state<
    { text: string; variant: "warning" | "info" | "error" } | undefined
  >(undefined);
  const PRICE_REFRESH_INTERVAL_MS = 8_000;
  const PRICE_DEBOUNCE_MS = 280;
  const displayQuoteError = $derived.by(() => {
    if (!quoteError) return null;
    const normalized = quoteError.toLowerCase();

    if (normalized.includes("tokenin and tokenout cannot be the same")) {
      return locales.errors.tokenMismatch;
    }
    if (normalized.includes("no liquidity available")) {
      return locales.errors.noLiquidity;
    }
    if (normalized.includes("failed to fetch swap price")) {
      return locales.errors.quoteFetchFailed;
    }

    return locales.errors.quoteFetchFailed;
  });
  const recipientAddressError = $derived.by(() => {
    const normalizedRecipientAddress = recipientAddress.trim();
    if (!normalizedRecipientAddress) return null;
    if (isValidAddress(normalizedRecipientAddress, { strict: false }))
      return null;
    return locales.errors.recipientInvalid;
  });
  const hasInsufficientTokenInBalance = $derived.by(() => {
    if (tokenInBalance === undefined) return false;
    const normalizedAmount = normalizeNumericInput(amountIn);
    if (!hasValidPositiveAmount(normalizedAmount)) return false;
    const sellAmount = parseAmountToUnits(normalizedAmount, tokenIn.decimals);
    if (sellAmount === null) return false;
    return sellAmount > tokenInBalance;
  });
  const insufficientTokenBalanceError = $derived.by(() =>
    hasInsufficientTokenInBalance
      ? interpolateTemplate(locales.errors.insufficientBalance, {
          symbol: tokenIn.symbol,
        })
      : null,
  );
  const displaySubmitError = $derived.by(() => {
    if (recipientAddressError) return recipientAddressError;
    if (tokenInBalanceError) return tokenInBalanceError;
    if (insufficientTokenBalanceError) return insufficientTokenBalanceError;
    if (submitMessage?.variant === "error") return submitMessage.text;
    return displayQuoteError;
  });
  const displaySubmitMessage = $derived.by(() =>
    submitMessage?.variant !== "error" ? submitMessage : undefined,
  );
  const isSubmitDisabled = $derived.by(
    () =>
      isLoadingQuote ||
      isSubmitting ||
      swapDetails === undefined ||
      recipientAddressError !== null ||
      hasInsufficientTokenInBalance,
  );

  /**
   * Builds a firm quote and submits the swap transaction.
   *
   * Flow:
   * 1) Validate current form state and amount.
   * 2) Request a firm quote from the backend.
   * 3) Ensure quote still matches the latest displayed price within tolerance.
   * 4) Send transaction and wait for confirmation.
   * 5) Reset quote + amount fields on success.
   */
  async function handleSubmit(e: Event) {
    e.preventDefault();
    if (isSubmitDisabled || !$walletAddress || !$walletChainId || !swapDetails)
      return;

    const tokenInAddress = tokenIn.address;
    const tokenOutAddress = tokenOut.address;
    const tokenInDecimals = tokenIn.decimals;
    const slippageBps = Math.round(slippage * 100);
    const platformFeeBps = Math.round(platformFeePercent * 100);
    const normalizedAmount = normalizeNumericInput(amountIn);
    const sellAmount = parseAmountToUnits(normalizedAmount, tokenInDecimals);
    if (sellAmount === null) {
      submitMessage = { variant: "error", text: locales.errors.invalidAmount };
      return;
    }

    const normalizedRecipientAddress = recipientAddress.trim();
    const recipient =
      normalizedRecipientAddress.length > 0
        ? (normalizedRecipientAddress as Address)
        : undefined;

    isSubmitting = true;
    submitMessage = undefined;
    try {
      const quote = await getQuote({
        takerAddress: $walletAddress,
        chainId: $walletChainId,
        tokenIn: tokenInAddress,
        tokenOut: tokenOutAddress,
        sellAmount,
        recipientAddress: recipient,
        slippageBps,
        platformFeeBps,
      });

      const validation = validateQuoteAgainstPrice(swapDetails, quote);
      if (!validation.acceptable) {
        submitMessage = {
          variant: "info",
          text: locales.messages.quoteChangedBeforeExecution,
        };
        console.log(validation.reasons);
        return;
      }

      const txHash = await submitQuoteTransaction($walletChainId, quote);

      transactionToastStore.showSending(txHash);
      const isConfirmed = await waitReceipt(txHash, $walletChainId);
      if (!isConfirmed) {
        const message = locales.errors.txFailedOrReverted;
        transactionToastStore.showFailed(txHash, message);
        submitMessage = { variant: "error", text: message };
        return;
      }

      transactionToastStore.showConfirmed(txHash);
      await invalidateWalletData();
      swapDetails = undefined;
      amountIn = "";
      amountOut = "";
    } catch (error) {
      submitMessage = {
        variant: "error",
        text: getTransactionErrorMessage(error),
      };
    } finally {
      isSubmitting = false;
    }
  }

  /**
   * Formats a raw USD numeric string into localized fiat output.
   * Returns `undefined` when the value is missing or invalid.
   */
  function formatOptionalUsd(raw?: string | null): string | undefined {
    if (!raw) return undefined;
    const usd = Number(raw);
    if (!Number.isFinite(usd)) return undefined;
    return formatFiat(usd, "USD");
  }

  function swapTokens() {
    const nextTokenIn = tokenOut;
    const nextTokenOut = tokenIn;
    tokenIn = nextTokenIn;
    tokenOut = nextTokenOut;
    amountIn = "";
    amountOut = "";
    swapDetails = undefined;
    isLoadingQuote = false;
    quoteError = null;
    submitMessage = undefined;
  }

  /**
   * Resets swap state whenever the connected wallet network changes.
   * Placeholder tokens are recreated for the active chain.
   */
  $effect(() => {
    const activeChainId = $walletChainId ?? 1;
    tokenIn = buildPlaceholderTokenWithChainId(activeChainId);
    tokenOut = buildPlaceholderTokenWithChainId(activeChainId);
    amountIn = "";
    amountOut = "";
    swapDetails = undefined;
    isLoadingQuote = false;
    quoteError = null;
    submitMessage = undefined;
  });

  /**
   * Fetches the selected input token balance to block submits when amount exceeds funds.
   */
  $effect(() => {
    if (!$walletAddress || !$walletChainId) {
      tokenInBalance = undefined;
      tokenInBalanceError = null;
      return;
    }

    const epoch = $walletDataEpoch;
    void epoch;
    const tokenAddress = tokenIn.address;
    const tokenChainId = tokenIn.chainId;
    let cancelled = false;
    tokenInBalanceError = null;

    (async () => {
      try {
        const tokenWithBalance = await retrieveTokenWithBalance({
          walletAddress: $walletAddress,
          chainId: tokenChainId,
          tokenAddress,
        });
        if (cancelled) return;
        tokenInBalance = tokenWithBalance.balance;
        tokenInBalanceError = null;
      } catch (error) {
        console.error("Failed to retrieve token-in balance", error);
        if (cancelled) return;
        tokenInBalance = undefined;
        tokenInBalanceError = locales.errors.balanceFetchFailed;
      }
    })();

    return () => {
      cancelled = true;
    };
  });

  /**
   * Debounced + auto-refreshing price effect.
   *
   * Triggers whenever quote inputs change (wallet, tokens, amount, slippage, fee,
   * recipient). It performs an initial debounced request, then background refreshes
   * every {@link PRICE_REFRESH_INTERVAL_MS} while dependencies remain stable.
   */
  $effect(() => {
    if (!$walletAddress || !$walletChainId) return;
    const tokenInAddress = tokenIn.address;
    const tokenOutAddress = tokenOut.address;
    const tokenInDecimals = tokenIn.decimals;
    const tokenOutDecimals = tokenOut.decimals;
    const slippageBps = Math.round(slippage * 100);
    const platformFeeBps = Math.round(platformFeePercent * 100);
    const normalizedAmount = normalizeNumericInput(amountIn);
    if (!hasValidPositiveAmount(normalizedAmount)) {
      swapDetails = undefined;
      amountOut = "";
      isLoadingQuote = false;
      quoteError = null;
      return;
    }
    const sellAmount = parseAmountToUnits(normalizedAmount, tokenInDecimals);
    if (sellAmount === null) {
      swapDetails = undefined;
      amountOut = "";
      isLoadingQuote = false;
      quoteError = null;
      return;
    }
    const normalizedRecipientAddress = recipientAddress.trim();
    if (
      normalizedRecipientAddress &&
      !isValidAddress(normalizedRecipientAddress, { strict: false })
    ) {
      isLoadingQuote = false;
      quoteError = null;
      return;
    }

    let cancelled = false;
    let isFetching = false;
    let refreshIntervalId: number | undefined;
    quoteError = null;
    submitMessage = undefined;
    isLoadingQuote = true;
    const requestPrice = async (isBackgroundRefresh: boolean) => {
      if (cancelled || isFetching) return;
      isFetching = true;
      if (!isBackgroundRefresh) isLoadingQuote = true;
      try {
        const price = await getPrice({
          takerAddress: $walletAddress,
          chainId: $walletChainId,
          tokenIn: tokenInAddress,
          tokenOut: tokenOutAddress,
          sellAmount,
          recipientAddress:
            normalizedRecipientAddress.length > 0
              ? (normalizedRecipientAddress as Address)
              : undefined,
          slippageBps,
          platformFeeBps,
        });
        if (cancelled) return;
        swapDetails = price;
        quoteError = null;
        amountOut = formatTokenAmount(
          price.tokenOut.expectedAmount,
          tokenOutDecimals,
        );
      } catch (error) {
        if (cancelled) return;
        quoteError =
          error instanceof Error
            ? error.message
            : locales.errors.quoteFetchFailed;
        console.error("Failed to fetch swap price", error);
        swapDetails = undefined;
        amountOut = "";
      } finally {
        if (!cancelled && !isBackgroundRefresh) isLoadingQuote = false;
        isFetching = false;
      }
    };

    const timeoutId = window.setTimeout(() => {
      void requestPrice(false);
      refreshIntervalId = window.setInterval(() => {
        void requestPrice(true);
      }, PRICE_REFRESH_INTERVAL_MS);
    }, PRICE_DEBOUNCE_MS);

    return () => {
      cancelled = true;
      isLoadingQuote = false;
      window.clearTimeout(timeoutId);
      if (refreshIntervalId !== undefined)
        window.clearInterval(refreshIntervalId);
    };
  });
</script>

<div class="mx-auto w-full max-w-lg bg-primary p-4 sm:p-6 md:p-8 max-xs:p-4">
  <form class="flex flex-col text-base-200" onsubmit={handleSubmit}>
    <TokenInput
      legend={locales.legendTokenIn}
      bind:token={tokenIn}
      bind:value={amountIn}
      placeholder="0.0"
      emptyQueryMode="balances"
      showAmountPresetButtons={true}
    />

    <div class="flex justify-center translate-y-4">
      <button
        type="button"
        class="btn btn-circle btn-md btn-neutral"
        aria-label={locales.swapAriaLabel}
        onclick={swapTokens}
      >
        <SwapVerticalIcon className="size-6 text-primary-content" />
      </button>
    </div>

    <TokenInput
      legend={locales.legendTokenOut}
      bind:token={tokenOut}
      bind:value={amountOut}
      placeholder="0.0"
      emptyQueryMode="top20"
      previewOnly={true}
    />

    <RecipientAddressInput
      bind:recipientAddress
      error={recipientAddressError}
      className="mt-2"
    />

    <SlippageInput bind:slippage className="mt-2" />
    <PlatformDonationInput bind:platformFeePercent className="mt-2" />

    <div class="divider"></div>

    <SwapDetails
      tokenInAmount={amountIn}
      tokenOutAmount={amountOut}
      isLoading={isLoadingQuote}
      hasQuote={swapDetails !== undefined}
      tokenInSymbol={tokenIn.symbol}
      tokenOutSymbol={tokenOut.symbol}
      priceImpactPercent={formatBpsToPercent(swapDetails?.priceImpactBps)}
      priceImpactUsd={formatOptionalUsd(swapDetails?.priceImpactUsd)}
      swapPriceImpactPercent={formatBpsToPercent(swapDetails?.swapPriceImpact)}
      swapPriceImpactUsd={formatOptionalUsd(swapDetails?.swapPriceImpactUsd)}
      feePriceImpactPercent={formatBpsToPercent(swapDetails?.feePriceImpact)}
      feePriceImpactUsd={formatOptionalUsd(swapDetails?.feePriceImpactUsd)}
      minReceivedToken={swapDetails
        ? formatTokenAmount(swapDetails.tokenOut.minAmount, tokenOut.decimals)
        : undefined}
      minReceivedUsd={formatOptionalUsd(swapDetails?.tokenOut.minFiatValue)}
    />

    <div class="divider"></div>

    <SubmitTransaction
      text={isSubmitting ? locales.submitting : locales.submit}
      className="btn btn-neutral btn-xl text-primary-content"
      error={displaySubmitError}
      message={displaySubmitMessage}
      disabled={isSubmitDisabled}
      allowance={swapDetails
        ? {
            text: locales.approveAllowance,
            allowanceToken: swapDetails.tokenIn.address,
            allowanceAmount: swapDetails.tokenIn.amount,
            spenderAddress: swapDetails.allowanceTarget,
          }
        : undefined}
    />
  </form>
</div>
