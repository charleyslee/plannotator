import { describe, expect, test } from "bun:test";
import { PLANNOTATOR_REQUEST_CHANNEL, registerPlannotatorEventListeners } from "./plannotator-events";

function createFakePi() {
	const lifecycleHandlers = new Map<string, Array<(event: unknown, ctx: unknown) => unknown>>();
	const busHandlers = new Map<string, Array<(data: unknown) => unknown>>();

	const pi = {
		on(event: string, handler: (event: unknown, ctx: unknown) => unknown) {
			const handlers = lifecycleHandlers.get(event) ?? [];
			handlers.push(handler);
			lifecycleHandlers.set(event, handlers);
		},
		events: {
			on(channel: string, handler: (data: unknown) => unknown) {
				const handlers = busHandlers.get(channel) ?? [];
				handlers.push(handler);
				busHandlers.set(channel, handlers);
				return () => {
					const current = busHandlers.get(channel) ?? [];
					busHandlers.set(channel, current.filter((h) => h !== handler));
				};
			},
			emit(channel: string, data: unknown) {
				for (const handler of busHandlers.get(channel) ?? []) handler(data);
			},
		},
	};

	return {
		pi,
		async emitLifecycle(event: string, payload: unknown, ctx: unknown) {
			for (const handler of lifecycleHandlers.get(event) ?? []) {
				await handler(payload, ctx);
			}
		},
		busHandlerCount(channel: string) {
			return busHandlers.get(channel)?.length ?? 0;
		},
	};
}

describe("Plannotator shared event listeners", () => {
	test("unsubscribes request listener on session shutdown", async () => {
		const fake = createFakePi();
		registerPlannotatorEventListeners(fake.pi as unknown as Parameters<typeof registerPlannotatorEventListeners>[0]);

		expect(fake.busHandlerCount(PLANNOTATOR_REQUEST_CHANNEL)).toBe(1);
		await fake.emitLifecycle("session_start", { reason: "startup" }, { hasUI: false });
		await fake.emitLifecycle("session_shutdown", { reason: "new" }, { hasUI: false });

		expect(fake.busHandlerCount(PLANNOTATOR_REQUEST_CHANNEL)).toBe(0);
	});
});
