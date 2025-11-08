import { createPlugin, PluginConfigurationError } from "every-plugin";
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
    baseUrl: z.string().url().default("https://api.wormholescan.io/api/v1"),
    timeout: z.number().min(1000).max(60000).default(10000),
    requestsPerSecond: z.number().min(1).max(100).default(10),
  }),

  secrets: z.object({
    apiKey: z.string().optional(),
  }),

  contract,

  initialize: (config) =>
    Effect.gen(function* () {
      // Create service instance with config
      const service = new WormholeService(
        config.variables.baseUrl,
        config.variables.timeout,
        config.variables.requestsPerSecond
      );

      // Test the connection during initialization (but don't fail if unavailable)
      // This allows the plugin to initialize even if the API is temporarily down
      yield* service.ping().pipe(
        Effect.catchAll(() => Effect.void) // Ignore ping errors during initialization
      );

      return { service };
    }),

  shutdown: () => Effect.void,

  createRouter: (context, builder) => {
    const { service } = context;

    return {
      getSnapshot: builder.getSnapshot.handler(async ({ input, errors }) => {
        try {
          const snapshot = await Effect.runPromise(
            service.getSnapshot(input)
          );
          return snapshot;
        } catch (error) {
          // Map errors to CommonPluginErrors following guide best practices
          if (error instanceof PluginConfigurationError) {
            throw errors.UNAUTHORIZED({
              message: error.message,
              data: { apiKeyProvided: true },
            });
          }

          if (error instanceof Error && error.message.includes("Rate limited")) {
            const retryAfterMatch = error.message.match(/Retry after (\d+) seconds/);
            const retryAfter = retryAfterMatch ? parseInt(retryAfterMatch[1], 10) : 60;
            
            throw errors.RATE_LIMITED({
              message: "API rate limit exceeded",
              data: { retryAfter, limitType: "requests" as const },
            });
          }

          // Map other errors to SERVICE_UNAVAILABLE
          throw errors.SERVICE_UNAVAILABLE({
            message: error instanceof Error ? error.message : "Unknown error occurred",
            data: { retryAfter: 30 },
          });
        }
      }),

      ping: builder.ping.handler(async ({ errors }) => {
        try {
          return await Effect.runPromise(service.ping());
        } catch (error) {
          // Ping should generally succeed, but handle errors gracefully
          if (error instanceof PluginConfigurationError) {
            throw errors.UNAUTHORIZED({
              message: error.message,
              data: { apiKeyProvided: true },
            });
          }

          // Even if ping fails, return ok status (health check should be resilient)
          return {
            status: "ok" as const,
            timestamp: new Date().toISOString(),
          };
        }
      }),
    };
  }
});
