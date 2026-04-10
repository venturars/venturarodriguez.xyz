<script lang="ts">
  /**
   * Token logo `<img>`; empty `src` or load error → `/images/token-placeholder.svg` (once, no loop).
   *
   * @remarks Defaults 32×32, `loading` `"lazy"`, empty `src`/`alt`. In `.astro` hydrate (`client:visible` | `client:load`).
   */
  const TOKEN_IMAGE_PLACEHOLDER = "/images/token-placeholder.svg";

  function resolveTokenImageSrc(src: string | undefined | null): string {
    const s = src?.trim() ?? "";
    return s || TOKEN_IMAGE_PLACEHOLDER;
  }

  function onImageError(e: Event): void {
    const img = e.currentTarget as HTMLImageElement;
    img.onerror = null;
    img.src = TOKEN_IMAGE_PLACEHOLDER;
  }

  interface Props {
    src?: string;
    alt?: string;
    class?: string;
    width?: number;
    height?: number;
    loading?: "lazy" | "eager";
  }

  let {
    src = "",
    alt = "",
    class: className = "",
    width = 32,
    height = 32,
    loading = "lazy",
  }: Props = $props();

  const imageSrc = $derived(resolveTokenImageSrc(src));
</script>

<img
  src={imageSrc}
  {alt}
  {width}
  {height}
  {loading}
  class="shrink-0 rounded-full object-cover bg-base-200 ring-1 ring-base-300 {className}"
  onerror={onImageError}
/>
