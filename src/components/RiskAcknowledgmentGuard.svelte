<script lang="ts">
  import { onMount } from "svelte";
  import { disconnect } from "@wagmi/core";
  import { walletAddress } from "../stores/user";
  import { setupWalletStoreSync } from "../libs/walletSync";
  import { wagmiConfig } from "../libs/web3";
  import RiskAcknowledgmentModal from "./RiskAcknowledgmentModal.svelte";

  /**
   * Wallet risk acknowledgment guard.
   *
   * Displays a blocking modal until the connected wallet explicitly accepts the
   * risk notice. Accepted wallets are tracked in a cookie by normalized address.
   */
  const COOKIE_KEY = "vr_risk_ack_wallets";
  const COOKIE_MAX_AGE_SECONDS = 31_536_000;
const MODAL_BYPASS_PATHS = new Set(["/terms-of-use", "/privacy-policy"]);

  let showModal = $state(false);
  let lastWalletAddress = $state<string | undefined>(undefined);

  onMount(() => {
    setupWalletStoreSync();
  });

  /** Normalize wallet address for case-insensitive comparisons. */
  function normalizeAddress(address: string): string {
    return address.trim().toLowerCase();
  }

/** Normalize route pathname for consistent matching. */
function normalizePath(pathname: string): string {
  const trimmedPath = pathname.trim().replace(/\/+$/, "");
  return (trimmedPath.length > 0 ? trimmedPath : "/").toLowerCase();
}

/** Skip modal on legal pages so users can read required documents. */
function shouldBypassRiskModalForCurrentPath(): boolean {
  if (typeof window === "undefined") return false;
  return MODAL_BYPASS_PATHS.has(normalizePath(window.location.pathname));
}

  /** Read a cookie value by name from `document.cookie`. */
  function getCookieValue(name: string): string | undefined {
    const cookiePrefix = `${name}=`;
    const targetCookie = document.cookie
      .split(";")
      .map((rawCookie) => rawCookie.trim())
      .find((rawCookie) => rawCookie.startsWith(cookiePrefix));

    if (!targetCookie) return undefined;
    return decodeURIComponent(targetCookie.slice(cookiePrefix.length));
  }

  /** Return the set of wallet addresses that already accepted the warning. */
  function getAcceptedWallets(): Set<string> {
    const raw = getCookieValue(COOKIE_KEY);
    if (!raw) return new Set<string>();
    return new Set(
      raw
        .split(",")
        .map((value) => normalizeAddress(value))
        .filter((value) => value.length > 0),
    );
  }

  /** Persist accepted wallets into a single cookie. */
  function setAcceptedWallets(wallets: Set<string>) {
    if (wallets.size === 0) {
      document.cookie = `${COOKIE_KEY}=; Max-Age=0; Path=/; SameSite=Lax`;
      return;
    }

    const value = Array.from(wallets).join(",");
    document.cookie =
      `${COOKIE_KEY}=${encodeURIComponent(value)}; Max-Age=${COOKIE_MAX_AGE_SECONDS}; ` +
      "Path=/; SameSite=Lax";
  }

  /** Check whether a wallet has already acknowledged risks. */
  function hasAcceptedWallet(address: string): boolean {
    return getAcceptedWallets().has(normalizeAddress(address));
  }

  /** Remove a wallet from the accepted set. */
  function removeAcceptedWallet(address: string) {
    const acceptedWallets = getAcceptedWallets();
    acceptedWallets.delete(normalizeAddress(address));
    setAcceptedWallets(acceptedWallets);
  }

  /** Store acknowledgment for the current wallet and close modal. */
  function handleAccept() {
    const connectedAddress = $walletAddress;
    if (!connectedAddress) return;

    const acceptedWallets = getAcceptedWallets();
    acceptedWallets.add(normalizeAddress(connectedAddress));
    setAcceptedWallets(acceptedWallets);
    showModal = false;
  }

  /** Disconnect current wallet and clear its acknowledgment. */
  async function handleDisconnect() {
    const connectedAddress = $walletAddress;
    if (connectedAddress) {
      removeAcceptedWallet(connectedAddress);
    }

    try {
      await disconnect(wagmiConfig);
    } catch (error) {
      console.error("Failed to disconnect wallet from risk modal", error);
    }
  }

  /**
   * Keep modal state in sync with wallet connection state:
   * - show on unacknowledged wallet
   * - hide on acknowledged/newly switched wallet
   * - clear local state on disconnect
   */
  $effect(() => {
    const connectedAddress = $walletAddress;
    const normalizedAddress = connectedAddress
      ? normalizeAddress(connectedAddress)
      : undefined;
    const hasChangedWallet = normalizedAddress !== lastWalletAddress;

    if (shouldBypassRiskModalForCurrentPath()) {
      showModal = false;
      lastWalletAddress = normalizedAddress;
      return;
    }

    if (!normalizedAddress) {
      if (lastWalletAddress) {
        removeAcceptedWallet(lastWalletAddress);
      }
      showModal = false;
      lastWalletAddress = undefined;
      return;
    }

    if (!hasAcceptedWallet(normalizedAddress)) {
      showModal = true;
    } else if (hasChangedWallet) {
      showModal = false;
    }

    lastWalletAddress = normalizedAddress;
  });
</script>

<RiskAcknowledgmentModal
  open={showModal}
  onAccept={handleAccept}
  onDisconnect={handleDisconnect}
/>
