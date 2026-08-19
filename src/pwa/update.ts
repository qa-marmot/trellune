import { useSyncExternalStore } from 'react';
import { registerSW } from 'virtual:pwa-register';

let updateAvailable = false;
let updateServiceWorker: ((reloadPage?: boolean) => Promise<void>) | undefined;
let stopUpdateChecks: (() => void) | undefined;
const listeners = new Set<() => void>();
const UPDATE_CHECK_INTERVAL_MS = 60 * 60 * 1_000;

function notify(): void {
	for (const listener of listeners) listener();
}

function startUpdateChecks(registration: ServiceWorkerRegistration | undefined): void {
	stopUpdateChecks?.();
	stopUpdateChecks = undefined;
	if (!registration) return;

	let updateInFlight = false;
	const checkForUpdate = () => {
		if (!navigator.onLine || updateInFlight) return;
		updateInFlight = true;
		void registration
			.update()
			.catch(() => undefined)
			.finally(() => {
				updateInFlight = false;
			});
	};
	const checkWhenVisible = () => {
		if (document.visibilityState === 'visible') checkForUpdate();
	};
	const interval = window.setInterval(checkForUpdate, UPDATE_CHECK_INTERVAL_MS);
	window.addEventListener('online', checkForUpdate);
	window.addEventListener('focus', checkForUpdate);
	document.addEventListener('visibilitychange', checkWhenVisible);
	stopUpdateChecks = () => {
		window.clearInterval(interval);
		window.removeEventListener('online', checkForUpdate);
		window.removeEventListener('focus', checkForUpdate);
		document.removeEventListener('visibilitychange', checkWhenVisible);
	};
	checkForUpdate();
}

export function configurePwaUpdates(): void {
	stopUpdateChecks?.();
	stopUpdateChecks = undefined;
	updateServiceWorker = registerSW({
		immediate: true,
		onRegisteredSW(_swScriptUrl, registration) {
			startUpdateChecks(registration);
		},
		onNeedRefresh() {
			updateAvailable = true;
			notify();
		},
	});
}

export function usePwaUpdate() {
	const available = useSyncExternalStore(
		(listener) => {
			listeners.add(listener);
			return () => listeners.delete(listener);
		},
		() => updateAvailable,
		() => false,
	);
	return {
		available,
		apply: async () => {
			if (!updateServiceWorker) return;
			await updateServiceWorker(true);
		},
	};
}
