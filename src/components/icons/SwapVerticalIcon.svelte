<script lang="ts">
  interface Props {
    className?: string;
  }

  let { className = "" }: Props = $props();
</script>

<svg
  xmlns="http://www.w3.org/2000/svg"
  viewBox="0 0 24 24"
  fill="none"
  stroke="currentColor"
  stroke-width="2.2"
  aria-hidden="true"
  class={className}
>
  <path stroke-linecap="round" stroke-linejoin="round" d="M12 4v14" />
  <path stroke-linecap="round" stroke-linejoin="round" d="M8 8l4-4 4 4" />
  <path stroke-linecap="round" stroke-linejoin="round" d="M12 20V6" />
  <path stroke-linecap="round" stroke-linejoin="round" d="M8 16l4 4 4-4" />
</svg>
