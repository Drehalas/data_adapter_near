import { createPlugin } from "every-plugin";
import { Effect } from "every-plugin/effect";
import { z } from "every-plugin/zod";

import { contract } from "./contract";
import { WormholeService } from "./service";

/**
 * Wormhole Data Provider Plugin - Collects cross-chain bridge metrics from Wormhole.
 * 
 * This plugin implements the data provider contract for Wormhole, providing:
 * - Volume metrics for 24h, 7d, 30d windows
 * - Rate quotes with proper decimal normalization
 * - Liquidity depth at 50bps and 100bps thresholds
 * - List of supported assets
 * 
 * Features:
 * - Retry logic with exponential backoff
 * - Rate limiting to respect Wormhole API limits
 * - Comprehensive error handling
 * - Fallback data when API unavailable
 */
export default createPlugin({
  id: "@every-plugin/wormhole",

  variables: z.object({
    baseUrl: z.string().url().default("https://api.wormhole.com"),
    timeout: z.number().min(1000).max(60000).default(10000),
    requestsPerSecond: z.number().min(1).max(100).default(10),
    maxRetries: z.number().min(0).max(10).default(3),
  }),

  secrets: z.object({
    apiKey: z.string().min(1, "API key is required").optional(),
  }),

  contract,

  initialize: (config) =>
    Effect.gen(function* () {
      // Create service instance with config
      const service = new WormholeService(
        config.variables.baseUrl,
        config.secrets.apiKey || "",
        config.variables.timeout,
        config.variables.requestsPerSecond,
        config.variables.maxRetries
      );

      // Test the connection during initialization
      yield* service.ping();

      return { service };
    }),

  shutdown: () => Effect.void,

  createRouter: (context, builder) => {
    const { service } = context;

    return {
      getSnapshot: builder.getSnapshot.handler(async ({ input }) => {
        const snapshot = await Effect.runPromise(
          service.getSnapshot(input)
        );
        return snapshot;
      }),

      ping: builder.ping.handler(async () => {
        return await Effect.runPromise(service.ping());
      }),
    };
  }
});
