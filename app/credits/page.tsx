import type { Metadata } from "next";
import { ThemedPage } from "../components/themed-page";
import { PRESETS } from "@/utils/presets";

export const metadata: Metadata = {
	title: "Credits - Genetic Fold Predictor",
};

/** Software and services the app is built on, grouped by section. */
const CREDITS: { heading: string; items: { name: string; by: string }[] }[] = [
	{
		heading: "Tech",
		items: [
			{ name: "Next.js", by: "By Vercel" },
			{ name: "Vercel", by: "By Vercel" },
			{ name: "React", by: "By Meta" },
			{ name: "Tailwind", by: "By Tailwind Labs" },
			{ name: "Bun", by: "By Oven/Anthropic" },
			{ name: "3Dmol.js", by: "By the University of Pittsburgh" },
		],
	},
	{
		heading: "Predictor",
		items: [
			{ name: "Boltz-2", by: "By MIT and Recursion" },
			{ name: "OpenFold", by: "By AlQuraishi Lab at Columbia University" },
			{ name: "NVIDIA BioNeMo", by: "By Nvidia Corp" },
		],
	},
];

export default function Credits() {
	return (
		<ThemedPage title="Credits">
			<h1 className="text-2xl font-bold mt-4 text-center">Credits</h1>
			{CREDITS.map((section) => (
				<section key={section.heading} className="mt-4">
					<h2 className="text-xl font-bold text-center">{section.heading}</h2>
					<ul className="flex flex-row flex-wrap justify-center text-center gap-x-8 gap-y-2 mt-1">
						{section.items.map((item) => (
							<li key={item.name} className="flex flex-col">
								<span className="font-bold">{item.name}</span>
								<span className="text-secondary-font-color">{item.by}</span>
							</li>
						))}
					</ul>
				</section>
			))}
			<section className="mt-4">
				<h2 className="text-xl font-bold text-center">Data</h2>
				<p className="text-center">
					The data for the protein presets is collected from the NIH and UniProt.
				</p>
				<div className="overflow-x-auto mt-2">
					<table className="mx-auto">
						<thead>
							<tr className="border-b border-line">
								<th className="px-2 text-left">Name</th>
								<th className="px-2 text-left">Link</th>
								<th className="px-2">From</th>
							</tr>
						</thead>
						<tbody>
							{PRESETS.map((preset) => (
								<tr key={preset.name}>
									<td className="px-2 border-r border-line">{preset.name}</td>
									<td className="px-2 border-r border-line underline break-all">
										<a href={preset.link} target="_blank" rel="noreferrer">
											{preset.link}
										</a>
									</td>
									<td className="px-2 text-center whitespace-nowrap">{preset.from}</td>
								</tr>
							))}
						</tbody>
					</table>
				</div>
			</section>
		</ThemedPage>
	);
}
