import { expect, test } from "bun:test";
import { exceedsApiLimits, parseServerLink, readChains, serverLink } from "./fold-server-api";

test("reads the link the server prints", () => {
	expect(parseServerLink(" http://localhost:8765/?token=abc ")).toEqual({
		ok: true,
		connection: { url: "http://localhost:8765", token: "abc" },
	});
	expect(parseServerLink("https://fold.example.ts.net/sub/#token=xyz")).toEqual({
		ok: true,
		connection: { url: "https://fold.example.ts.net/sub", token: "xyz" },
	});
});

test("round-trips links built by serverLink", () => {
	const parsed = parseServerLink(serverLink("https://fold.example.com/", "a+b/c"));
	expect(parsed).toEqual({ ok: true, connection: { url: "https://fold.example.com", token: "a+b/c" } });
});

test("refuses links browsers would block or that lack a token", () => {
	expect(parseServerLink("http://192.168.1.20:8765/?token=abc").ok).toBe(false);
	expect(parseServerLink("http://localhost:8765/").ok).toBe(false);
	expect(parseServerLink("ftp://localhost/?token=a").ok).toBe(false);
	expect(parseServerLink("not a link").ok).toBe(false);
});

test("spots chains NVIDIA's API cannot take", () => {
	expect(exceedsApiLimits([{ sequence: "A".repeat(4096) }])).toBe(false);
	expect(exceedsApiLimits([{ sequence: "A".repeat(4097) }])).toBe(true);
	expect(exceedsApiLimits(Array.from({ length: 13 }, () => ({ sequence: "AC" })))).toBe(true);
});

test("validates chains from a request body", () => {
	expect(readChains([{ id: "A", type: "protein", sequence: "MGRE", extra: 1 }])).toEqual({
		ok: true,
		chains: [{ id: "A", type: "protein", sequence: "MGRE" }],
	});
	expect(readChains([{ id: "A", type: "protein", sequence: "MG" }, { id: "A", type: "dna", sequence: "AC" }]).ok).toBe(false);
	expect(readChains([{ id: "AB", type: "protein", sequence: "MG" }]).ok).toBe(false);
	expect(readChains([{ id: "A", type: "rna", sequence: "AC" }]).ok).toBe(false);
	expect(readChains("nope").ok).toBe(false);
});
