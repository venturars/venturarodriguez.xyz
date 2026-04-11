<script lang="ts">
  import StatusMessage from "./StatusMessage.svelte";
  import { approveAllowance } from "../sdk/token/approveAllowance";
  import { retrieveAllowance } from "../sdk/token/retrieveAllowance";
  import { waitReceipt } from "../sdk/transactions/waitReceipt";
  import { transactionToastStore } from "../stores/transactions";
  import { walletAddress, walletChainId } from "../stores/user";
  import { getTransactionErrorMessage } from "../utils/interface";
  import type { Address, Hex } from "viem";
  import EN from "../locales/EN.json";

  const locales = EN.components.submitTransaction;

  type SubmitType = "button" | "submit" | "reset";

  interface Props {
    text: string;
    className?: string;
    onClick?: (event: MouseEvent) => void;
    type?: SubmitType;
    error?: string | boolean | null;
    message?: {
      text: string;
      variant: "success" | "error" | "warning" | "info";
    };
    disabled?: boolean;
    allowance?: {
      text: string;
      allowanceToken: Address;
      allowanceAmount: bigint;
      spenderAddress: Address;
    };
  }

  let {
    text,
    className = "",
    onClick,
    type = "submit",
    error = null,
    message,
    disabled = false,
    allowance = undefined,
  }: Props = $props();

  let allowanceError = $state<string | null>(null);
  const hasError = $derived(Boolean(error));
  let isAllowanceLoading = $state(false);
  let isApprovingAllowance = $state(false);
  let hasSufficientAllowance = $state<boolean | null>(null);

  function handleClick(event: MouseEvent) {
    if (allowance && hasSufficientAllowance === false) {
      event.preventDefault();
      const ownerAddress = $walletAddress;
      const chainId = $walletChainId;

      if (!ownerAddress || !chainId) {
        allowanceError = locales.connectWalletToApproveAllowance;
        return;
      }

      allowanceError = null;
      isApprovingAllowance = true;
      (async () => {
        let txHash: Hex | null = null;
        try {
          txHash = await approveAllowance(
            chainId,
            allowance.allowanceToken,
            allowance.spenderAddress,
            allowance.allowanceAmount,
          );
          transactionToastStore.showSending(txHash);
          const isConfirmed = await waitReceipt(txHash, chainId);
          if (!isConfirmed) {
            transactionToastStore.showFailed(
              txHash,
              locales.approvalFailedOrReverted,
            );
            allowanceError = locales.approvalFailedOrReverted;
            return;
          }
          transactionToastStore.showConfirmed(txHash);

          const currentAllowance = await retrieveAllowance(
            chainId,
            allowance.allowanceToken,
            ownerAddress,
            allowance.spenderAddress,
          );
          hasSufficientAllowance =
            currentAllowance >= allowance.allowanceAmount;
        } catch (e) {
          const friendlyError = getTransactionErrorMessage(e);
          if (txHash) {
            transactionToastStore.showFailed(txHash, friendlyError);
          }
          allowanceError = friendlyError;
        } finally {
          isApprovingAllowance = false;
        }
      })();
      return;
    }

    onClick?.(event);
  }

  $effect(() => {
    const ownerAddress = $walletAddress;
    const chainId = $walletChainId;
    if (!allowance) {
      hasSufficientAllowance = null;
      allowanceError = null;
      isAllowanceLoading = false;
      return;
    }
    if (!ownerAddress || !chainId) {
      hasSufficientAllowance = null;
      allowanceError = null;
      isAllowanceLoading = false;
      return;
    }

    let cancelled = false;
    allowanceError = null;
    isAllowanceLoading = true;
    (async () => {
      try {
        const currentAllowance = await retrieveAllowance(
          chainId,
          allowance.allowanceToken,
          ownerAddress,
          allowance.spenderAddress,
        );
        if (cancelled) return;
        hasSufficientAllowance = currentAllowance >= allowance.allowanceAmount;
      } catch {
        if (cancelled) return;
        hasSufficientAllowance = null;
        allowanceError = locales.allowanceVerificationFailed;
      } finally {
        if (!cancelled) isAllowanceLoading = false;
      }
    })();

    return () => {
      cancelled = true;
    };
  });

  const ctaText = $derived(
    isApprovingAllowance
      ? locales.approving
      : hasSufficientAllowance === false
        ? allowance?.text
        : text,
  );
  const isDisabled = $derived(
    disabled || hasError || isAllowanceLoading || isApprovingAllowance,
  );
  const displayError = $derived(
    typeof error === "string" && error.length > 0 ? error : allowanceError,
  );
</script>

{#if displayError}
  <StatusMessage variant="error" message={displayError} className="mt-2 mb-4" />
{:else if message}
  <StatusMessage
    variant={message.variant}
    message={message.text}
    className="mt-2 mb-4"
  />
{/if}

<button
  {type}
  class={`${className} ${hasError ? "btn-error" : ""}`.trim()}
  disabled={isDisabled}
  title={displayError ?? undefined}
  onclick={handleClick}
>
  {ctaText}
</button>
