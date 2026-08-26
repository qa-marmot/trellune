import { z } from 'zod';

const DRAFT_NAMESPACE = 'trellune:practice-draft:v1:';
export const MAX_PRACTICE_DRAFT_BYTES = 100_000;
export const PRACTICE_DRAFT_MAX_AGE_MS = 30 * 24 * 60 * 60 * 1_000;
const MAX_DRAFT_ENTRIES = 32;

export interface PracticeDraftIdentity {
	learnerKey: string;
	curriculumDay: number;
	promptId: string;
	supportLanguage: 'ja' | 'en';
}

const PracticeDraftSchema = z
	.object({
		version: z.literal(1),
		identity: z
			.object({
				learnerKey: z.string().min(1).max(500),
				curriculumDay: z.number().int().min(1).max(540),
				promptId: z.string().min(1).max(500),
				supportLanguage: z.enum(['ja', 'en']),
			})
			.strict(),
		text: z.string().max(MAX_PRACTICE_DRAFT_BYTES),
		updatedAt: z.number().int().nonnegative(),
	})
	.strict();

type PracticeDraft = z.infer<typeof PracticeDraftSchema>;

function identityKey(identity: PracticeDraftIdentity): string {
	return `${DRAFT_NAMESPACE}${encodeURIComponent(identity.learnerKey)}:${identity.curriculumDay}:${encodeURIComponent(identity.promptId)}:${identity.supportLanguage}`;
}

function sameIdentity(left: PracticeDraftIdentity, right: PracticeDraftIdentity): boolean {
	return (
		left.learnerKey === right.learnerKey &&
		left.curriculumDay === right.curriculumDay &&
		left.promptId === right.promptId &&
		left.supportLanguage === right.supportLanguage
	);
}

export function cleanupPracticeDrafts(storage: Storage, now = Date.now()): void {
	const entries: Array<{ key: string; updatedAt: number }> = [];
	for (let index = 0; index < storage.length; index += 1) {
		const key = storage.key(index);
		if (!key?.startsWith(DRAFT_NAMESPACE)) continue;
		const parsed = PracticeDraftSchema.safeParse(
			(() => {
				try {
					return JSON.parse(storage.getItem(key) ?? 'null') as unknown;
				} catch {
					return null;
				}
			})(),
		);
		if (!parsed.success || now - parsed.data.updatedAt > PRACTICE_DRAFT_MAX_AGE_MS) {
			storage.removeItem(key);
			continue;
		}
		entries.push({ key, updatedAt: parsed.data.updatedAt });
	}
	entries
		.sort((left, right) => right.updatedAt - left.updatedAt)
		.slice(MAX_DRAFT_ENTRIES)
		.forEach(({ key }) => storage.removeItem(key));
}

export function loadPracticeDraft(
	storage: Storage,
	identity: PracticeDraftIdentity,
	now = Date.now(),
): string {
	const key = identityKey(identity);
	const raw = storage.getItem(key);
	if (!raw) return '';
	try {
		const parsed = PracticeDraftSchema.safeParse(JSON.parse(raw) as unknown);
		if (
			!parsed.success ||
			!sameIdentity(parsed.data.identity, identity) ||
			now - parsed.data.updatedAt > PRACTICE_DRAFT_MAX_AGE_MS
		) {
			storage.removeItem(key);
			return '';
		}
		return parsed.data.text;
	} catch {
		storage.removeItem(key);
		return '';
	}
}

export function savePracticeDraft(
	storage: Storage,
	identity: PracticeDraftIdentity,
	text: string,
	now = Date.now(),
): boolean {
	const bytes = new TextEncoder().encode(text).byteLength;
	if (bytes > MAX_PRACTICE_DRAFT_BYTES) return false;
	if (!text.trim()) {
		storage.removeItem(identityKey(identity));
		return true;
	}
	const draft: PracticeDraft = PracticeDraftSchema.parse({
		version: 1,
		identity,
		text,
		updatedAt: now,
	});
	storage.setItem(identityKey(identity), JSON.stringify(draft));
	cleanupPracticeDrafts(storage, now);
	return true;
}

export function clearPracticeDraft(storage: Storage, identity: PracticeDraftIdentity): void {
	storage.removeItem(identityKey(identity));
}
