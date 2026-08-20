import { useSyncExternalStore } from 'react';
import { registerSW } from 'virtual:pwa-register';

let updateAvailable = false;
let updateServiceWorker: ((reloadPage?: boolean) => Promise<void>) | undefined;
let stopUpdateChecks: (() => void) | undefined;
const listeners = new Set<() => void>();
const UPDATE_CHECK_INTERVAL_MS = 60 * 60 * 1_000;
const isLegacyPwaTestClient = import.meta.env.VITE_PWA_TEST_LEGACY_CLIENT === 'true';

/**
 * A deliberately small, redacted update diagnostic. It never stores a URL,
 * response body, Access token, or learner data; it only lets the Settings
 * screen explain whether a normal service-worker check completed.
 */
export type PwaUpdateStatus =
	'idle' | 'checking' | 'ready' | 'available' | 'offline' | 'unsupported' | 'error';

let updateStatus: PwaUpdateStatus = 'idle';
let registeredWorker: ServiceWorkerRegistration | undefined;
let updateInFlight = false;

function notify(): void {
	for (const listener of listeners) listener();
}

function setUpdateStatus(next: PwaUpdateStatus): void {
	if (updateStatus === next) return;
	updateStatus = next;
	notify();
}

async function checkForUpdate(): Promise<void> {
	if (!registeredWorker) {
		setUpdateStatus('unsupported');
		return;
	}
	if (!navigator.onLine) {
		setUpdateStatus('offline');
		return;
	}
	if (updateInFlight) return;
	updateInFlight = true;
	setUpdateStatus('checking');
	try {
		await registeredWorker.update();
		setUpdateStatus(updateAvailable ? 'available' : 'ready');
	} catch {
		// Keep this intentionally redacted. Registration failures can include
		// deployment or Access details that do not belong in learner-facing UI.
		setUpdateStatus('error');
	} finally {
		updateInFlight = false;
	}
}

function startUpdateChecks(registration: ServiceWorkerRegistration | undefined): void {
	stopUpdateChecks?.();
	stopUpdateChecks = undefined;
	registeredWorker = registration;
	if (!registration) {
		setUpdateStatus('unsupported');
		return;
	}

	const check = () => void checkForUpdate();
	const checkWhenVisible = () => {
		if (document.visibilityState === 'visible') check();
	};
	const interval = window.setInterval(check, UPDATE_CHECK_INTERVAL_MS);
	window.addEventListener('online', check);
	window.addEventListener('focus', check);
	document.addEventListener('visibilitychange', checkWhenVisible);
	stopUpdateChecks = () => {
		window.clearInterval(interval);
		window.removeEventListener('online', check);
		window.removeEventListener('focus', check);
		document.removeEventListener('visibilitychange', checkWhenVisible);
	};
	check();
}

export function configurePwaUpdates(): void {
	stopUpdateChecks?.();
	stopUpdateChecks = undefined;
	registeredWorker = undefined;
	updateInFlight = false;
	updateAvailable = false;
	setUpdateStatus('idle');
	const onNeedRefresh = () => {
		updateAvailable = true;
		setUpdateStatus('available');
		notify();
	};
	updateServiceWorker = isLegacyPwaTestClient
		? registerSW({
				immediate: false,
				onNeedRefresh,
			})
		: registerSW({
				immediate: true,
				onRegisteredSW(_swScriptUrl, registration) {
					startUpdateChecks(registration);
				},
				onNeedRefresh,
				onRegisterError() {
					setUpdateStatus('error');
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
	const status = useSyncExternalStore(
		(listener) => {
			listeners.add(listener);
			return () => listeners.delete(listener);
		},
		() => updateStatus,
		() => 'idle' as const,
	);
	return {
		available,
		status,
		check: checkForUpdate,
		apply: async () => {
			if (!updateServiceWorker) return;
			await updateServiceWorker(true);
		},
	};
}
