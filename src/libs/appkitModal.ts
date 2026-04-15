import { createAppKit } from "@reown/appkit";
import { metadata, networks, projectId, wagmiAdapter } from "./web3";

/**
 * Shared AppKit modal singleton for the whole app.
 */
export const appKitModal = createAppKit({
  adapters: [wagmiAdapter],
  networks,
  metadata,
  projectId,
  allowUnsupportedChain: false,
  enableNetworkSwitch: true,
  features: {
    analytics: false,
    swaps: false,
    onramp: false,
  },
  themeMode: "light",
  themeVariables: {
    "--w3m-font-family": "'Lato', sans-serif",
    "--w3m-accent": "var(--color-accent)",
    "--w3m-color-mix-strength": 20,
    "--w3m-color-mix": "var(--color-base-300)",
    "--w3m-border-radius-master": "0px",
  },
});
