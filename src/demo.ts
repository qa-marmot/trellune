import type { AppData } from './domain/appData';

/**
 * Public demo builds are deliberately isolated from the normal learner store.
 * This flag is compile-time only (`VITE_DEMO_MODE=true`) and is never enabled
 * by an ordinary Trellune build.
 */
export const isDemoMode = import.meta.env.VITE_DEMO_MODE === 'true';

export const persistenceDatabaseName = isDemoMode ? 'trellune-demo' : 'english-os';
export const persistenceBroadcastChannel = isDemoMode
	? 'trellune-demo-database-v1'
	: 'english-os-database-v2';
export const persistenceLegacyStorageKey = isDemoMode
	? 'trellune-demo-state-v1'
	: 'english-os-state-v1';

/** Synthetic-only starter state used by the public demo. It never enables sync. */
export const DEMO_STARTER_PATCH: Partial<AppData> = {
	onboarded: true,
	learnerName: 'Demo learner',
	goal: '日常の英語を少しずつ使えるようになる',
	dailyMinutes: 20,
	timeZone: 'Asia/Tokyo',
	syncEnabled: false,
};
