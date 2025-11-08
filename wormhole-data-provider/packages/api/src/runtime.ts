import { createPluginRuntime, type PluginBinding } from "every-plugin";

import type WormholePlugin from "@every-plugin/wormhole";

type AppBindings = {
  "@every-plugin/wormhole": PluginBinding<typeof WormholePlugin>;
};

const runtime = createPluginRuntime<AppBindings>({
  registry: {
    "@every-plugin/wormhole": {
      remoteUrl: "http://localhost:3015/remoteEntry.js",
    },
  },
  secrets: {
    WORMHOLE_API_KEY: process.env.WORMHOLE_API_KEY || "",
  },
});

export const { router: wormholeRouter } = await runtime.usePlugin("@every-plugin/wormhole", {
  variables: {
    baseUrl: process.env.WORMHOLE_BASE_URL || "https://api.wormholescan.io/api/v1",
    timeout: Number(process.env.WORMHOLE_TIMEOUT) || 10000,
    requestsPerSecond: Number(process.env.WORMHOLE_REQUESTS_PER_SECOND) || 10,
  },
  secrets: { apiKey: "{{WORMHOLE_API_KEY}}" },
});
