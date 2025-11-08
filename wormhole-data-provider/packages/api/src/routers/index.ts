import { publicProcedure } from "../index";
import { wormholeRouter } from "../runtime";
import type { RouterClient } from "@orpc/server";

export const appRouter = publicProcedure.router({
	healthCheck: publicProcedure.handler(() => {
		return "OK";
	}),
	wormhole: {
		getSnapshot: wormholeRouter.getSnapshot,
		ping: wormholeRouter.ping,
	},
});

export type AppRouter = typeof appRouter;
export type AppRouterClient = RouterClient<typeof appRouter>;
