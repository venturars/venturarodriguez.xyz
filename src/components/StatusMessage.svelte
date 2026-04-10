<script lang="ts">
  type Variant = "success" | "error" | "warning" | "info";

  /**
   * Props for the status message component.
   *
   * @property message - Text shown to the user.
   * @property variant - Visual style variant (`success`, `error`, `warning`, `info`).
   * @property className - Additional CSS classes to apply to the container.
   */
  let {
    message = "",
    variant = "warning",
    className = "",
  }: {
    message?: string;
    variant?: Variant;
    className?: string;
  } = $props();

  const stylesByVariant: Record<
    Variant,
    { container: string; text: string; role: "status" | "alert" }
  > = {
    success: {
      container: "bg-success/80",
      text: "text-success-content",
      role: "status",
    },
    warning: {
      container: "bg-warning/80",
      text: "text-warning-content",
      role: "status",
    },
    info: {
      container: "bg-info/80",
      text: "text-info-content",
      role: "status",
    },
    error: {
      container: "bg-error/80",
      text: "text-error-content",
      role: "alert",
    },
  };

  const style = $derived(stylesByVariant[variant]);
</script>

<div
  class={`flex p-3 rounded-md ${style.container} ${className}`}
  role={style.role}
>
  <p class={`text-xs ${style.text}`}>
    {message}
  </p>
</div>
