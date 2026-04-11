<script lang="ts">
  import EN from "../locales/EN.json";

  const locales = EN.components.platformFeeInput;
  const PRESETS_PERCENT = [0.15, 0.2, 0.5];

  /**
   * Props for {@link PlatformFeeInput}.
   *
   * @property {number} [platformFeePercent=0] - Platform fee percentage.
   * @property {string} [label="Support fee (optional)"] - Fieldset legend text.
   * @property {string} [tooltip="venturarodriguez.xyz does not charge fees for facilitating swaps. If you want to support my work, you can add an optional support fee to help maintain the tool."] - Tooltip text.
   * @property {string} [className=""] - Extra classes for the fieldset root.
   */
  let {
    platformFeePercent = $bindable(0),
    label = locales.label,
    tooltip = locales.tooltip,
    className = "",
  }: {
    platformFeePercent?: number;
    label?: string;
    tooltip?: string;
    className?: string;
  } = $props();

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
    if (!sanitized) {
      platformFeePercent = 0;
      return;
    }
    const parsed = Number.parseFloat(sanitized);
    platformFeePercent = Math.min(
      100,
      Math.max(0, Number.isFinite(parsed) ? parsed : 0),
    );
  }

  function selectPreset(value: number) {
    platformFeePercent = value;
  }

  const displayValue = $derived.by(() => String(platformFeePercent));
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
    <button
      type="button"
      class="btn btn-sm {platformFeePercent === 0
        ? 'btn-neutral'
        : 'btn-ghost btn-outline'}"
      onclick={() => selectPreset(0)}
    >
      {locales.noFee}
    </button>

    {#each PRESETS_PERCENT as preset}
      <button
        type="button"
        class="btn btn-sm {platformFeePercent === preset
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
        value={displayValue}
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
