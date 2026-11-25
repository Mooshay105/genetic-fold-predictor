import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { ImageResponse } from "next/og";

export const size = {
	width: 180,
	height: 180,
};
export const contentType = "image/png";

export default async function AppleIcon() {
	const svg = await readFile(join(process.cwd(), "app/icon.svg"), "utf8");
	const square = svg.replace('rx="14"', 'rx="0"');
	const src = `data:image/svg+xml;base64,${Buffer.from(square).toString("base64")}`;

	return new ImageResponse(
		<img src={src} width={size.width} height={size.height} alt="" />,
		{ ...size },
	);
}
