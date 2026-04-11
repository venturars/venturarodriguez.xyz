<script lang="ts">
  import EN from "../locales/EN.json";

  const locales = EN.components.slippageInput;
  const PRESETS = [0.1, 0.5, 1, 5];

  /**
   * Props for {@link SlippageInput}.
   *
   * @property {number} [slippage=1] - Current slippage percentage.
   * @property {string} [label="Slippage tolerance"] - Fieldset legend text.
   * @property {string} [tooltip="Slippage is the maximum price change you accept between the quote and execution. If the market moves more than this percentage, the transaction is cancelled."] - Tooltip text.
   * @property {string} [className=""] - Extra classes for the fieldset root.
   */
  let {
    slippage = $bindable(1),
    label = locales.label,
    tooltip = locales.tooltip,
    className = "",
  }: {
    slippage?: number;
    label?: string;
    tooltip?: string;
    className?: string;
  } = $props();

  /**
   * Parses and clamps custom slippage input to the `[0, 100]` range.
   */
  function sanitizePercentageInput(raw: string): string {
    const normalized = raw.replace(",", ".");
    const onlyAllowed = normalized.replace(/[^0-9.]/g, "");
    const firstDotIndex = onlyAllowed.indexOf(".");
    if (firstDotIndex === -1) return onlyAllowed;

    const integerPart = onlyAllowed.slice(0, firstDotIndex + 1);
    const decimalPart = onlyAllowed.slice(firstDotIndex + 1).replace(/\./g, "");
    return `${integerPart}${decimalPart}`;
  }

  function handleInput(e: Event) {
    const input = e.target as HTMLInputElement;
    const sanitized = sanitizePercentageInput(input.value);
    input.value = sanitized;
    const val = parseFloat(sanitized) || 0;
    slippage = Math.min(100, Math.max(0, val));
  }

  function selectPreset(value: number) {
    slippage = value;
  }
</script>

<fieldset class="fieldset {className}">
  <legend class="fieldset-legend text-base-200 text-base">
    <span
      class="tooltip tooltip-right cursor-help inline-flex items-center gap-1"
      data-tip={tooltip}
    >
      <span>{label}</span>
      <span
        class="h-4 w-4 rounded-full border border-base-200 text-center text-[10px] leading-[14px] text-base-200"
        aria-label={locales.infoAriaLabel}
      >
        ?
      </span>
    </span>
  </legend>

  <div class="flex flex-wrap items-center gap-2 w-fit p-2">
    {#each PRESETS as preset}
      <button
        type="button"
        class="btn btn-sm {slippage === preset
          ? 'btn-neutral'
          : 'btn-ghost btn-outline'}"
        onclick={() => selectPreset(preset)}
      >
        {preset}%
      </button>
    {/each}

    <label class="input input-sm input-neutral flex-1 max-w-20">
      <input
        type="text"
        value={slippage}
        oninput={handleInput}
        inputmode="decimal"
        pattern="[0-9]*[.,]?[0-9]*"
        placeholder={locales.customPlaceholder}
        class="grow bg-transparent text-right"
      />
      <span>%</span>
    </label>
  </div>
</fieldset>
