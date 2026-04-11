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

  $effect(() => {
    if (!modalElement) return;
    if (open && !modalElement.open) {
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
    class="modal-box bg-base-100 max-w-lg w-full rounded-lg border border-warning/30"
    role="alertdialog"
    aria-modal="true"
    aria-labelledby="risk-modal-title"
  >
    <h3
      id="risk-modal-title"
      class="font-playfair text-lg font-semibold text-warning"
    >
      {locales.title}
    </h3>
    <p class="mt-3 text-base-content/90">{locales.intro}</p>
    <ul class="list-disc pl-5 mt-3 space-y-1 text-base-content/90">
      {#each locales.risks as risk}
        <li>{risk}</li>
      {/each}
    </ul>

    <div class="mt-6 flex flex-col sm:flex-row gap-3 sm:justify-end">
      <button
        type="button"
        class="btn btn-warning"
        onclick={() => onAccept?.()}
      >
        {locales.acceptLabel}
      </button>
      <button
        type="button"
        class="btn btn-outline btn-error"
        onclick={() => onDisconnect?.()}
      >
        {locales.disconnectLabel}
      </button>
    </div>
  </div>
</dialog>
