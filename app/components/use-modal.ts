"use client";

import { useCallback, useEffect, useRef } from "react";

export function useModal(open: boolean, onClose: () => void) {
	const ref = useRef<HTMLDialogElement>(null);
	const onCloseRef = useRef(onClose);

	useEffect(() => {
		onCloseRef.current = onClose;
	});

	useEffect(() => {
		const dialog = ref.current;
		if (!dialog) return;
		if (open && !dialog.open) {
			dialog.showModal();
			dialog.querySelector<HTMLElement>("[data-autofocus]")?.focus();
		}
		if (!open && dialog.open) dialog.close();
	}, [open]);

	useEffect(() => {
		const dialog = ref.current;
		if (!dialog) return;
		const handleClose = () => onCloseRef.current();
		dialog.addEventListener("close", handleClose);
		return () => dialog.removeEventListener("close", handleClose);
	}, []);

	const onBackdropClick = useCallback(
		(event: React.MouseEvent<HTMLDialogElement>) => {
			if (event.target === event.currentTarget) onClose();
		},
		[onClose],
	);

	return [ref, onBackdropClick] as const;
}
