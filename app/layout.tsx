import type { Metadata } from "next";
import "./styles.css";

export const metadata: Metadata = {
	title: "Malcolm's 56DIGI Website",
};

export default function RootLayout({
	children,
}: Readonly<{
	children: React.ReactNode;
}>) {
	return (
		<html lang="en">
			<body>{children}</body>
		</html>
	);
}
