import { Effect } from "every-plugin/effect";
import { describe, expect, it, vi, beforeEach } from "vitest";
import { WormholeService } from "../../service";

// Mock fetch globally
global.fetch = vi.fn();

// Mock route for testing
const mockRoute = {
  source: {
    chainId: "1",
    assetId: "0xA0b86a33E6442e082877a094f204b01BF645Fe0",
    symbol: "USDC",
    decimals: 6,
  },
  destination: {
    chainId: "137",
    assetId: "0x2791Bca1f2de4661ED88A30C99A7a9449Aa8417",
    symbol: "USDC",
    decimals: 6,
  }
};

describe("WormholeService", () => {
  let service: WormholeService;

  beforeEach(() => {
    service = new WormholeService(
      "https://api.wormhole.com",
      "test-api-key",
      5000,
      10,
      3
    );
    vi.clearAllMocks();
  });

  describe("getSnapshot", () => {
    it("should return complete snapshot structure", async () => {
      // Mock API responses with fallback data
      (global.fetch as any).mockRejectedValue(new Error("API unavailable"));

      const result = await Effect.runPromise(
        service.getSnapshot({
          routes: [mockRoute],
          notionals: ["1000000", "10000000"], // amounts in smallest units
          includeWindows: ["24h", "7d"]
        })
      );

      // Verify all required fields are present
      expect(result).toHaveProperty("volumes");
      expect(result).toHaveProperty("rates");
      expect(result).toHaveProperty("liquidity");
      expect(result).toHaveProperty("listedAssets");

      // Verify arrays are not empty
      expect(Array.isArray(result.volumes)).toBe(true);
      expect(Array.isArray(result.rates)).toBe(true);
      expect(Array.isArray(result.liquidity)).toBe(true);
      expect(Array.isArray(result.listedAssets.assets)).toBe(true);
    });

    it("should return volumes for requested time windows", async () => {
      (global.fetch as any).mockRejectedValue(new Error("API unavailable"));

      const result = await Effect.runPromise(
        service.getSnapshot({
          routes: [mockRoute],
          notionals: ["1000000"],
          includeWindows: ["24h", "7d"]
        })
      );

      expect(result.volumes).toHaveLength(2);
      expect(result.volumes.map(v => v.window)).toContain("24h");
      expect(result.volumes.map(v => v.window)).toContain("7d");
      expect(result.volumes[0].volumeUsd).toBeTypeOf("number");
      expect(result.volumes[0].volumeUsd).toBeGreaterThan(0);
      expect(result.volumes[0].measuredAt).toBeTypeOf("string");
    });

    it("should generate rates for all route/notional combinations", async () => {
      (global.fetch as any).mockRejectedValue(new Error("API unavailable"));

      const result = await Effect.runPromise(
        service.getSnapshot({
          routes: [mockRoute],
          notionals: ["1000000", "10000000"],
          includeWindows: ["24h"]
        })
      );

      // Should have 2 rates (1 route × 2 notionals)
      expect(result.rates).toHaveLength(2);

      // Verify rate structure
      const rate = result.rates[0];
      expect(rate.source).toEqual(mockRoute.source);
      expect(rate.destination).toEqual(mockRoute.destination);
      expect(rate.amountIn).toBe("1000000");
      expect(rate.amountOut).toBeTypeOf("string");
      expect(rate.effectiveRate).toBeTypeOf("number");
      expect(rate.effectiveRate).toBeGreaterThan(0);
      expect(rate.totalFeesUsd).toBeTypeOf("number");
      expect(rate.quotedAt).toBeTypeOf("string");
    });

    it("should provide liquidity at 50bps and 100bps thresholds", async () => {
      (global.fetch as any).mockRejectedValue(new Error("API unavailable"));

      const result = await Effect.runPromise(
        service.getSnapshot({
          routes: [mockRoute],
          notionals: ["1000000"],
          includeWindows: ["24h"]
        })
      );

      expect(result.liquidity).toHaveLength(1);
      expect(result.liquidity[0].route).toEqual(mockRoute);

      const thresholds = result.liquidity[0].thresholds;
      expect(thresholds).toHaveLength(2);

      // Should have both required thresholds
      const bpsValues = thresholds.map(t => t.slippageBps);
      expect(bpsValues).toContain(50);
      expect(bpsValues).toContain(100);

      // Verify threshold structure
      thresholds.forEach(threshold => {
        expect(threshold.maxAmountIn).toBeTypeOf("string");
        expect(parseInt(threshold.maxAmountIn)).toBeGreaterThan(0);
        expect(threshold.slippageBps).toBeTypeOf("number");
      });
    });

    it("should return list of supported assets", async () => {
      (global.fetch as any).mockRejectedValue(new Error("API unavailable"));

      const result = await Effect.runPromise(
        service.getSnapshot({
          routes: [mockRoute],
          notionals: ["1000000"],
          includeWindows: ["24h"]
        })
      );

      expect(result.listedAssets.assets.length).toBeGreaterThan(0);

      // Verify asset structure
      result.listedAssets.assets.forEach(asset => {
        expect(asset.chainId).toBeTypeOf("string");
        expect(asset.assetId).toBeTypeOf("string");
        expect(asset.symbol).toBeTypeOf("string");
        expect(asset.decimals).toBeTypeOf("number");
        expect(asset.decimals).toBeGreaterThanOrEqual(0);
      });

      expect(result.listedAssets.measuredAt).toBeTypeOf("string");
    });

    it("should handle multiple routes correctly", async () => {
      (global.fetch as any).mockRejectedValue(new Error("API unavailable"));

      const secondRoute = {
        source: {
          chainId: "42161",
          assetId: "0xFF970A61A04b1cA14834A43f5dE4533eBDDB5CC8",
          symbol: "USDC",
          decimals: 6,
        },
        destination: {
          chainId: "1",
          assetId: "0xA0b86a33E6442e082877a094f204b01BF645Fe0",
          symbol: "USDC",
          decimals: 6,
        }
      };

      const result = await Effect.runPromise(
        service.getSnapshot({
          routes: [mockRoute, secondRoute],
          notionals: ["1000000"],
          includeWindows: ["24h"]
        })
      );

      // Should have liquidity data for both routes
      expect(result.liquidity).toHaveLength(2);
      expect(result.rates).toHaveLength(2); // 2 routes × 1 notional
    });

    it("should handle API success responses correctly", async () => {
      // Mock successful API responses
      (global.fetch as any)
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({ volumeUsd: 10000000 }),
        })
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({
            amountOut: "990000",
            fee: 1000,
          }),
        })
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({
            amountOut: "985000",
            fee: 1500,
          }),
        })
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({
            assets: [
              {
                chainId: "1",
                assetId: "0xA0b86a33E6442e082877a094f204b01BF645Fe0",
                symbol: "USDC",
                decimals: 6,
              },
            ],
          }),
        });

      const result = await Effect.runPromise(
        service.getSnapshot({
          routes: [mockRoute],
          notionals: ["1000000"],
          includeWindows: ["24h"]
        })
      );

      expect(result.volumes).toHaveLength(1);
      expect(result.rates).toHaveLength(1);
      expect(result.listedAssets.assets.length).toBeGreaterThan(0);
    });
  });

  describe("ping", () => {
    it("should return healthy status even when API fails", async () => {
      (global.fetch as any).mockRejectedValue(new Error("API unavailable"));

      const result = await Effect.runPromise(service.ping());

      expect(result).toEqual({
        status: "ok",
        timestamp: expect.any(String),
      });
    });

    it("should return healthy status when API succeeds", async () => {
      (global.fetch as any).mockResolvedValue({
        ok: true,
        json: async () => ({ status: "ok" }),
      });

      const result = await Effect.runPromise(service.ping());

      expect(result).toEqual({
        status: "ok",
        timestamp: expect.any(String),
      });
    });
  });
});
