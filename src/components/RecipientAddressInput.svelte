<script lang="ts">
  import EN from "../locales/EN.json";

  const locales = EN.components.recipientAddressInput;
  /**
   * Props for {@link RecipientAddressInput}.
   *
   * @property {string} [recipientAddress=""] - Recipient wallet address.
   * @property {string} [label="Recipient address (optional)"] - Fieldset legend text.
   * @property {string} [tooltip="Optional wallet address that will receive the output tokens. If you do not provide it, your connected address will be used."] - Tooltip text.
   * @property {string | null} [error=null] - Validation error shown below the input.
   * @property {string} [className=""] - Extra classes for the fieldset root.
   */
  let {
    recipientAddress = $bindable(""),
    label = locales.label,
    tooltip = locales.tooltip,
    error = null,
    className = "",
  }: {
    recipientAddress?: string;
    label?: string;
    tooltip?: string;
    error?: string | null;
    className?: string;
  } = $props();

  function sanitizeAddressInput(raw: string): string {
    const compact = raw.replace(/\s+/g, "");
    if (!compact) return "";

    if (/^0[xX]/.test(compact)) {
      const hexOnly = compact.slice(2).replace(/[^0-9a-fA-F]/g, "");
      return `0x${hexOnly}`.slice(0, 42);
    }

    return compact.replace(/[^0-9a-fA-F]/g, "").slice(0, 40);
  }

  function handleInput(e: Event) {
    const input = e.target as HTMLInputElement;
    recipientAddress = sanitizeAddressInput(input.value);
  }
</script>

<fieldset class="fieldset {className}">
  <legend class="fieldset-legend text-base-200 text-base">
    <span
      class="tooltip tooltip-mobile-safe tooltip-right max-sm:tooltip-bottom cursor-help inline-flex min-w-0 flex-wrap items-center gap-1 wrap-break-word"
      data-tip={tooltip}
    >
      <span>{label}</span>
      <span
        class="h-4 w-4 rounded-full border border-base-200 text-center text-[10px] leading-[14px] text-secondary-content"
        aria-label={locales.infoAriaLabel}
      >
        ?
      </span>
    </span>
  </legend>
  <label
    class={`input w-full ${error ? "input-error text-error" : "input-neutral"}`}
  >
    <input
      type="text"
      bind:value={recipientAddress}
      oninput={handleInput}
      placeholder={locales.placeholder}
      autocomplete="off"
      class="grow min-w-0"
    />
  </label>
</fieldset>
