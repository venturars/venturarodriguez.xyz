<script lang="ts">
  import EN from "../locales/EN.json";

  const locales = EN.components.riskAcknowledgmentModal;

  /**
   * Props for `RiskAcknowledgmentModal`.
   *
   * `open` is controlled by the parent. Native close attempts (Esc/backdrop)
   * are prevented while `open` remains true, so dismissal only happens through
   * explicit user actions wired to callbacks.
   */
  type RiskAcknowledgmentModalProps = {
    open?: boolean;
    onAccept?: () => void | Promise<void>;
    onDisconnect?: () => void | Promise<void>;
  };

  /** Blocking risk acknowledgment modal state controlled by parent. */
  let {
    open = false,
    onAccept,
    onDisconnect,
  }: RiskAcknowledgmentModalProps = $props();

  let modalElement: HTMLDialogElement;
  let acknowledgedRisks = $state(locales.risks.map(() => false));
  let legalAcknowledged = $state({
    termsOfUse: false,
    privacyPolicy: false,
  });
  const allRisksAcknowledged = $derived(acknowledgedRisks.every(Boolean));
  const allLegalAcknowledged = $derived(
    legalAcknowledged.termsOfUse && legalAcknowledged.privacyPolicy,
  );
  const canAccept = $derived(allRisksAcknowledged && allLegalAcknowledged);

  function resetAcknowledgments() {
    acknowledgedRisks = locales.risks.map(() => false);
    legalAcknowledged = {
      termsOfUse: false,
      privacyPolicy: false,
    };
  }

  function handleRiskCheckboxChange(index: number, event: Event) {
    acknowledgedRisks[index] = (
      event.currentTarget as HTMLInputElement
    ).checked;
  }

  function handleLegalCheckboxChange(
    key: "termsOfUse" | "privacyPolicy",
    event: Event,
  ) {
    legalAcknowledged[key] = (event.currentTarget as HTMLInputElement).checked;
  }

  $effect(() => {
    if (!modalElement) return;
    if (open && !modalElement.open) {
      resetAcknowledgments();
      modalElement.showModal();
      return;
    }
    if (!open && modalElement.open) {
      modalElement.close();
    }
  });

  /** Prevent closing via ESC key or browser cancel behavior. */
  function handleCancel(event: Event) {
    event.preventDefault();
  }

  /** Re-open modal if an external close occurs while still required. */
  function handleClose() {
    if (open) modalElement?.showModal();
  }
</script>

<dialog
  bind:this={modalElement}
  class="modal"
  oncancel={handleCancel}
  onclose={handleClose}
>
  <div
    class="modal-box bg-base-100 max-h-[90dvh] w-full max-w-2xl overflow-y-auto rounded-lg border border-warning p-4 sm:p-6"
    role="alertdialog"
    aria-modal="true"
    aria-labelledby="risk-modal-title"
  >
    <h3
      id="risk-modal-title"
      class="font-playfair text-xl font-semibold text-warning"
    >
      {locales.title}
    </h3>
    <div class="prose prose-sm sm:prose-base max-w-none mt-3 text-base-content">
      <p>{locales.intro}</p>
    </div>
    <fieldset class="mt-4 space-y-3" aria-label="Risk acknowledgments">
      {#each locales.risks as risk, index}
        <label class="flex items-start gap-3 cursor-pointer">
          <input
            type="checkbox"
            class="checkbox checkbox-warning mt-0.5"
            checked={acknowledgedRisks[index]}
            required
            onchange={(event) => handleRiskCheckboxChange(index, event)}
          />
          <span class="text-sm sm:text-base text-base-content">{risk}</span>
        </label>
      {/each}
    </fieldset>
    <div class="divider"></div>
    <fieldset class="mt-4 space-y-3" aria-label="Legal acknowledgments">
      <label class="flex items-start gap-3 cursor-pointer">
        <input
          type="checkbox"
          class="checkbox checkbox-warning mt-0.5"
          checked={legalAcknowledged.termsOfUse}
          required
          onchange={(event) => handleLegalCheckboxChange("termsOfUse", event)}
        />
        <span class="text-sm sm:text-base text-base-content">
          I have read and accept the
          <a
            href="/terms-of-use"
            target="_blank"
            rel="noopener noreferrer"
            class="link link-warning font-medium"
          >
            Terms of use
          </a>.
        </span>
      </label>
      <label class="flex items-start gap-3 cursor-pointer">
        <input
          type="checkbox"
          class="checkbox checkbox-warning mt-0.5"
          checked={legalAcknowledged.privacyPolicy}
          required
          onchange={(event) =>
            handleLegalCheckboxChange("privacyPolicy", event)}
        />
        <span class="text-sm sm:text-base text-base-content/90">
          I have read and accept the
          <a
            href="/privacy-policy"
            target="_blank"
            rel="noopener noreferrer"
            class="link link-warning font-medium"
          >
            Privacy policy
          </a>.
        </span>
      </label>
    </fieldset>

    <div class="mt-6 flex flex-col sm:flex-row gap-3 sm:justify-end">
      <button
        type="button"
        class="btn btn-warning btn-md"
        disabled={!canAccept}
        onclick={() => canAccept && onAccept?.()}
      >
        {locales.acceptLabel}
      </button>
      <button
        type="button"
        class="btn btn-outline btn-error btn-md"
        onclick={() => onDisconnect?.()}
      >
        {locales.disconnectLabel}
      </button>
    </div>
  </div>
</dialog>
