"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useTheme } from "./theme";
import { HelixIcon, TitleBar } from "./win98";

export function ThemedPage({ title, children }: { title: string; children: React.ReactNode }) {
	const { theme } = useTheme();
	const router = useRouter();

	if (theme === "win98") {
		return (
			<div className="min-h-dvh p-2 md:p-8 flex items-start justify-center">
				<div className="w98-window w-full max-w-4xl">
					<TitleBar title={title} icon={<HelixIcon />} onClose={() => router.push("/")} />
					<div className="p-3">
						{children}
						<div className="flex justify-end pt-3">
							<Link href="/" className="w98-btn w98-btn-default inline-flex items-center justify-center">
								OK
							</Link>
						</div>
					</div>
				</div>
			</div>
		);
	}

	return (
		<main className="max-w-4xl mx-auto px-4 py-6">
			<Link href="/" className="underline text-secondary-font-color hover:text-font-color">
				Back to the predictor
			</Link>
			{children}
		</main>
	);
}
