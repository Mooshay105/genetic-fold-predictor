"use client";

import { useEffect, useRef, useState } from "react";

/** One entry in a Windows 98 menu. */
export type MenuItem =
	| { separator: true }
	| {
			separator?: false;
			/** Text shown for the item. */
			label: string;
			/** Runs when the item is picked. */
			onSelect: () => void;
			/** Greys the item out. */
			disabled?: boolean;
			/** Shows a tick (`check`) or bullet (`radio`) when true. */
			checked?: boolean;
			/** Whether `checked` draws a tick or a bullet. */
			kind?: "check" | "radio";
			/** Keyboard hint shown on the right. */
			hint?: string;
	  };

/** A top-level menu in a menu bar. */
export type Menu = {
	/** Menu title; its first letter is underlined. */
	label: string;
	/** Items in the menu. */
	items: MenuItem[];
};

export function HelixIcon({ size = 16 }: { size?: number }) {
	return (
		<svg width={size} height={size} viewBox="0 0 16 16" aria-hidden shapeRendering="crispEdges">
			<path d="M4 1h2v2h1v2h1v1h1v1h1v2H9v1H8v1H7v2H6v2H4v-2h1v-2h1V9h1V7H6V6H5V4H4z" fill="#0000c0" />
			<path d="M10 1h2v3h-1v2h-1v1H9v2h1v1h1v2h1v3h-2v-2H9v-2H8V9H7V7h1V5h1V3h1z" fill="#c00000" />
			<path d="M5 3h6v1H5zM6 12h4v1H6z" fill="#008000" />
		</svg>
	);
}

export function ErrorIcon() {
	return (
		<svg width="32" height="32" viewBox="0 0 32 32" aria-hidden className="shrink-0">
			<circle cx="16" cy="16" r="14" fill="#ff0000" stroke="#800000" strokeWidth="1" />
			<path d="M10 10L22 22M22 10L10 22" stroke="#ffffff" strokeWidth="3.5" />
		</svg>
	);
}

export function InfoIcon() {
	return (
		<svg width="32" height="32" viewBox="0 0 32 32" aria-hidden className="shrink-0">
			<circle cx="16" cy="16" r="14" fill="#ffffff" stroke="#000080" strokeWidth="1.5" />
			<rect x="14" y="13" width="4" height="11" fill="#000080" />
			<rect x="14" y="7" width="4" height="4" fill="#000080" />
		</svg>
	);
}

function Glyph({ name }: { name: "min" | "max" | "restore" | "close" }) {
	const paths: Record<"min" | "max" | "restore", string> = {
		min: "M1 7h6v2H1z",
		max: "M0 0h9v9H0zM1 2v6h7V2z",
		restore: "M2 0h7v6H7v-1h1V2H3v1H2zM0 3h7v6H0zM1 5v3h5V5z",
	};
	if (name === "close") {
		return (
			<svg width="9" height="9" viewBox="0 0 9 9" aria-hidden>
				<path d="M1 1L8 8M8 1L1 8" stroke="currentColor" strokeWidth="1.7" />
			</svg>
		);
	}
	return (
		<svg width="9" height="9" viewBox="0 0 9 9" aria-hidden shapeRendering="crispEdges">
			<path d={paths[name]} fill="currentColor" fillRule="evenodd" />
		</svg>
	);
}

export function TitleBar({
	title,
	icon,
	inactive,
	onMinimize,
	onMaximize,
	maximized,
	onClose,
	onDoubleClick,
}: {
	title: string;
	icon?: React.ReactNode;
	inactive?: boolean;
	onMinimize?: () => void;
	onMaximize?: () => void;
	maximized?: boolean;
	onClose?: () => void;
	onDoubleClick?: () => void;
}) {
	return (
		<div className="w98-titlebar" data-inactive={inactive ? "" : undefined} onDoubleClick={onDoubleClick}>
			{icon}
			<span className="w98-titlebar-text">{title}</span>
			{onMinimize && (
				<button className="w98-titlebar-button" aria-label="Minimize" onClick={onMinimize}>
					<Glyph name="min" />
				</button>
			)}
			{onMaximize && (
				<button className="w98-titlebar-button" aria-label={maximized ? "Restore" : "Maximize"} onClick={onMaximize}>
					<Glyph name={maximized ? "restore" : "max"} />
				</button>
			)}
			{onClose && (
				<button className="w98-titlebar-button ml-0.5" aria-label="Close" onClick={onClose}>
					<Glyph name="close" />
				</button>
			)}
		</div>
	);
}

function Underlined({ label }: { label: string }) {
	return (
		<>
			<u>{label[0]}</u>
			{label.slice(1)}
		</>
	);
}

export function MenuList({
	items,
	onDone,
	className,
	style,
}: {
	items: MenuItem[];
	onDone: () => void;
	className?: string;
	style?: React.CSSProperties;
}) {
	return (
		<div role="menu" className={`w98-menu ${className ?? ""}`} style={style}>
			{items.map((item, index) =>
				item.separator ? (
					<div key={index} className="w98-menu-separator" role="separator" />
				) : (
					<button
						key={index}
						role={item.kind === "radio" ? "menuitemradio" : item.kind === "check" ? "menuitemcheckbox" : "menuitem"}
						aria-checked={item.kind ? Boolean(item.checked) : undefined}
						disabled={item.disabled}
						className="w98-menu-item"
						onClick={() => {
							onDone();
							item.onSelect();
						}}
					>
						<span className="text-center">{item.checked ? (item.kind === "radio" ? "●" : "✓") : ""}</span>
						<span>{item.label}</span>
						<span className="pl-6">{item.hint}</span>
					</button>
				),
			)}
		</div>
	);
}

export function useDismiss(open: boolean, close: () => void) {
	const ref = useRef<HTMLDivElement>(null);
	const closeRef = useRef(close);

	useEffect(() => {
		closeRef.current = close;
	});

	useEffect(() => {
		if (!open) return;
		const onPointer = (event: PointerEvent) => {
			if (!ref.current?.contains(event.target as Node)) closeRef.current();
		};
		const onKey = (event: KeyboardEvent) => {
			if (event.key === "Escape") closeRef.current();
		};
		document.addEventListener("pointerdown", onPointer);
		document.addEventListener("keydown", onKey);
		return () => {
			document.removeEventListener("pointerdown", onPointer);
			document.removeEventListener("keydown", onKey);
		};
	}, [open]);

	return ref;
}

export function MenuBar({ menus }: { menus: Menu[] }) {
	const [open, setOpen] = useState<number | null>(null);
	const ref = useDismiss(open !== null, () => setOpen(null));

	return (
		<div ref={ref} className="w98-menubar" role="menubar">
			{menus.map((menu, index) => (
				<div key={menu.label} className="relative">
					<button
						className="w98-menubar-item"
						aria-haspopup="menu"
						aria-expanded={open === index}
						onClick={() => setOpen(open === index ? null : index)}
						onPointerEnter={() => {
							if (open !== null) setOpen(index);
						}}
					>
						<Underlined label={menu.label} />
					</button>
					{open === index && (
						<MenuList items={menu.items} onDone={() => setOpen(null)} style={{ top: "100%", left: 0 }} />
					)}
				</div>
			))}
		</div>
	);
}
