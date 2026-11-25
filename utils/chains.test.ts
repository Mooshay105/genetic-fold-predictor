import { expect, test } from "bun:test";
import {
	appendChain,
	appendPreset,
	cleanSequence,
	fileSafeName,
	invalidResidues,
	nextChainId,
	relabelChains,
	type Preset,
} from "./chains";

test("nextChainId steps and wraps", () => {
	expect(nextChainId("A")).toBe("B");
	expect(nextChainId("Z")).toBe("A");
	expect(nextChainId("z")).toBe("a");
});

test("cleanSequence strips whitespace and upper-cases", () => {
	expect(cleanSequence(" mgr\nee pl\t")).toBe("MGREEPL");
});

test("invalidResidues reports letters not allowed for the type", () => {
	expect(invalidResidues("dna", "ACGTU")).toEqual(["U"]);
	expect(invalidResidues("protein", "MGRE1E!")).toEqual(["!", "1"]);
	expect(invalidResidues("protein", "MGREE")).toEqual([]);
});

test("appendChain assigns the next ID and builds the MSA", () => {
	const one = appendChain([], "protein", "MGR");
	const two = appendChain(one, "dna", "ACGT");
	expect(two.map((input) => input.id)).toEqual(["A", "B"]);
	expect(two[0].msa?.main_db.csv.alignment).toBe("key,sequence\n-1,MGR");
	expect(two[1].msa).toBeUndefined();
	expect(one).toHaveLength(1);
});

test("relabelChains closes gaps after a removal", () => {
	const inputs = appendChain(appendChain(appendChain([], "protein", "A"), "protein", "C"), "protein", "D");
	expect(relabelChains([inputs[0], inputs[2]]).map((input) => input.id)).toEqual(["A", "B"]);
});

test("appendPreset adds every chain of a multi-chain preset", () => {
	const preset: Preset = {
		name: "DNA Example",
		multipleSingleLetterAminoAcidChains: true,
		singleLetterAminoAcidChains: ["AGG", "TCC"],
		link: "",
		from: "",
		type: "dna",
	};
	const inputs = appendPreset(appendChain([], "protein", "MGR"), preset);
	expect(inputs.map((input) => [input.id, input.type, input.sequence])).toEqual([
		["A", "protein", "MGR"],
		["B", "dna", "AGG"],
		["C", "dna", "TCC"],
	]);
});

test("fileSafeName replaces path characters and falls back when empty", () => {
	expect(fileSafeName("Homo Sapiens: C1QA")).toBe("Homo Sapiens_ C1QA");
	expect(fileSafeName("   ")).toBe("protein");
});
