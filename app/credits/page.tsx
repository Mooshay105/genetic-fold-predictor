import proteinPresets from "../../public/protein-presets.json";

export default function Credits() {
	return (
		<div className="flex flex-col items-center justify-center">
			<h1 className="text-2xl font-bold">Credits:</h1>
			<h2 className="text-xl font-bold mt-2">Tech:</h2>
			<div className="flex flex-row text-center gap-8">
				<div className="flex flex-col">
					<p className="font-bold">Next.js</p>
					<p className="text-secondary-font-color">By Vercel</p>
				</div>
				<div className="flex flex-col">
					<p className="font-bold">Vercel</p>
					<p className="text-secondary-font-color">By Vercel</p>
				</div>
				<div className="flex flex-col">
					<p className="font-bold">React</p>
					<p className="text-secondary-font-color">By Meta</p>
				</div>
				<div className="flex flex-col">
					<p className="font-bold">Tailwind</p>
					<p className="text-secondary-font-color">By Tailwind Labs</p>
				</div>
				<div className="flex flex-col">
					<p className="font-bold">Bun</p>
					<p className="text-secondary-font-color">By Oven/Anthropic</p>
				</div>
			</div>
			<h2 className="text-xl font-bold mt-2">Predictor:</h2>
			<div className="flex flex-row text-center gap-8">
				<div className="flex flex-col">
					<p className="font-bold">ESM Fold</p>
					<p className="text-secondary-font-color">By Meta</p>
				</div>
				<div className="flex flex-col">
					<p className="font-bold">NVIDIA BioNeMo</p>
					<p className="text-secondary-font-color">By Nvidia Corp</p>
				</div>
			</div>
			<h2 className="text-xl font-bold mt-2">Data:</h2>
			<p>The data for the protein presets is collected from the NIH and UniProt</p>
			<table>
				<tr className="border-b border-amber-50">
					<th>Name</th>
					<th>Link</th>
					<th>From</th>
				</tr>
				{proteinPresets.map((proteinPreset) => {
					return (
						<tr key={proteinPreset.singleLetterAminoAcidChain}>
							<td className="px-2 border-r border-amber-50">{proteinPreset.name}</td>
							<td className="px-2 border-r border-amber-50 underline">
								<a href={proteinPreset.link} target="_blank">
									{proteinPreset.link}
								</a>
							</td>
							<td className="px-2 text-center">{proteinPreset.from}</td>
						</tr>
					);
				})}
			</table>
		</div>
	);
}
