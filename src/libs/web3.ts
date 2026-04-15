import { base, mainnet, polygon } from "@reown/appkit/networks";
import { WagmiAdapter } from "@reown/appkit-adapter-wagmi";
import { configureSetup, createWagmiChainClient } from "cooperative";

export const projectId = import.meta.env.PUBLIC_REOWN_PROJECT_ID;

export const networks: [typeof base, typeof mainnet, typeof polygon] = [
  base,
  mainnet,
  polygon,
];

export const metadata = {
  name: "venturarodriguez.xyz",
  description: "Ventura Rodriguez's personal site",
  url: "https://venturarodriguez.xyz",
  icons: ["https://venturarodriguez.xyz/favicon.ico"],
};

export const wagmiAdapter = new WagmiAdapter({
  projectId,
  networks,
});

export const wagmiConfig = wagmiAdapter.wagmiConfig;

configureSetup({
  chainClient: createWagmiChainClient(wagmiConfig),
});
