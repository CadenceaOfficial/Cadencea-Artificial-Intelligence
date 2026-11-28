import { env } from "cloudflare:test";
import { describe, it, expect, vi } from "vitest";
import worker from "../src";

const APP_ORIGIN = "https://cadenceaofficial.github.io";

describe("Worker request protections", () => {
	it("serves a health response without exposing credentials", async () => {
		const response = await worker.fetch(new Request("https://worker.test/"), env);

		expect(response.status).toBe(200);
		expect(await response.text()).toBe("Cadence AI Worker is running");
		expect(response.headers.get("Cache-Control")).toBe("no-store");
	});

	it("rejects cross-origin requests before processing them", async () => {
		const response = await worker.fetch(new Request("https://worker.test/", {
			method: "POST",
			headers: {
				Origin: "https://attacker.example",
				"Content-Type": "application/json",
			},
			body: JSON.stringify({ history: [] }),
		}), env);

		expect(response.status).toBe(403);
		expect(response.headers.get("Access-Control-Allow-Origin")).toBeNull();
		await response.text();
	});

	it("requires a Firebase bearer token from an allowed browser origin", async () => {
		const response = await worker.fetch(new Request("https://worker.test/", {
			method: "POST",
			headers: {
				Origin: APP_ORIGIN,
				"Content-Type": "application/json",
			},
			body: JSON.stringify({ history: [{ role: "user", content: "hi" }] }),
		}), env);

		expect(response.status).toBe(401);
		expect(response.headers.get("Access-Control-Allow-Origin")).toBe(APP_ORIGIN);
		await response.text();
	});

	it("rejects an expired Firebase token without fetching signing keys", async () => {
		const now = Math.floor(Date.now() / 1000);
		const encode = (value) => btoa(JSON.stringify(value))
			.replace(/=/g, "")
			.replace(/\+/g, "-")
			.replace(/\//g, "_");
		const token = [
			encode({ alg: "RS256", kid: "test-key" }),
			encode({
				aud: "cadence-ai-37cdf",
				iss: "https://securetoken.google.com/cadence-ai-37cdf",
				sub: "test-user",
				exp: now - 10,
				iat: now - 120,
				auth_time: now - 180,
			}),
			"AA",
		].join(".");
		const fetchMock = vi.fn(() => {
			throw new Error("Signing keys must not be fetched for expired tokens");
		});
		vi.stubGlobal("fetch", fetchMock);

		try {
			const response = await worker.fetch(new Request("https://worker.test/", {
				method: "POST",
				headers: {
					Origin: APP_ORIGIN,
					"Content-Type": "application/json",
					Authorization: `Bearer ${token}`,
				},
				body: JSON.stringify({ history: [{ role: "user", content: "hi" }] }),
			}), env);

			expect(response.status).toBe(401);
			expect(fetchMock).not.toHaveBeenCalled();
			await response.text();
		} finally {
			vi.unstubAllGlobals();
		}
	});

	it("rejects oversized request bodies while reading the stream", async () => {
		const oversizedBody = JSON.stringify({ padding: "x".repeat(6 * 1024 * 1024) });
		const response = await worker.fetch(new Request("https://worker.test/", {
			method: "POST",
			headers: {
				Origin: APP_ORIGIN,
				"Content-Type": "application/json",
			},
			body: oversizedBody,
		}), env);

		expect(response.status).toBe(413);
		await response.text();
	});
});

describe("atomic daily usage quota", () => {
	it("enforces the limit under concurrent requests and releases failed reservations", async () => {
		const userId = `test-user-${crypto.randomUUID()}`;
		const day = "2026-11-28";
		const id = env.LIMITER.idFromName(userId);
		const limiter = env.LIMITER.get(id);
		const reserve = () => limiter.fetch("https://usage-limiter.internal/v1/quota", {
			method: "POST",
			headers: { "Content-Type": "application/json" },
			body: JSON.stringify({ action: "reserve", bucket: "messages", day }),
		});

		const results = await Promise.all(Array.from({ length: 60 }, reserve));
		const reservations = await Promise.all(results.map((response) => response.json()));
		const admitted = reservations.filter((result) => result.allowed);
		expect(admitted).toHaveLength(50);

		const releasedId = admitted[0].reservationId;
		const release = await limiter.fetch("https://usage-limiter.internal/v1/quota", {
			method: "POST",
			headers: { "Content-Type": "application/json" },
			body: JSON.stringify({
				action: "release",
				bucket: "messages",
				day,
				reservationId: releasedId,
			}),
		});
		expect(release.status).toBe(200);
		await release.json();

		const afterRelease = await reserve();
		expect((await afterRelease.json()).allowed).toBe(true);

		const staleDayResponse = await limiter.fetch("https://usage-limiter.internal/v1/quota", {
			method: "POST",
			headers: { "Content-Type": "application/json" },
			body: JSON.stringify({ action: "reserve", bucket: "messages", day: "2026-11-27" }),
		});
		expect((await staleDayResponse.json()).allowed).toBe(false);

		const stillFull = await reserve();
		expect((await stillFull.json()).allowed).toBe(false);
	});

	it("rejects invalid internal quota actions", async () => {
		const id = env.LIMITER.idFromName(`invalid-test-${crypto.randomUUID()}`);
		const limiter = env.LIMITER.get(id);
		const response = await limiter.fetch("https://usage-limiter.internal/v1/quota", {
			method: "POST",
			headers: { "Content-Type": "application/json" },
			body: JSON.stringify({ action: "reset", bucket: "messages", day: "2026-11-28" }),
		});

		expect(response.status).toBe(400);
		await response.text();
	});
});
