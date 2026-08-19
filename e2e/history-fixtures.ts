import type { Page } from '@playwright/test';

type StoreRecords = Record<string, unknown[]>;

export interface HistoryFixture {
	stores: StoreRecords;
	expected: {
		days: number;
		currentDay: number;
		streak: number;
		coreSessions: number;
		boostSessions: number;
		reviewEvents: number;
		acquiredWords: number;
		acquiredPhrases: number;
		grammarProgress: number;
		assessments: number;
		latestSummary: string;
	};
}

export interface HistoryStoreEvidence {
	counts: Record<string, number>;
	progressDays: number[];
	completedProgressDays: number[];
	sessionIds: string[];
	assessmentTypes: string[];
}

const DATA_STORES = [
	'learnerProfiles',
	'settings',
	'dailyProgress',
	'learningEvents',
	'sessions',
	'mistakes',
	'learningItems',
	'acquisitionEvents',
	'reviewCards',
	'reviewEvents',
	'grammarProgress',
	'assessments',
] as const;

function addDays(studyDate: string, amount: number): string {
	const date = new Date(`${studyDate}T00:00:00Z`);
	date.setUTCDate(date.getUTCDate() + amount);
	return date.toISOString().slice(0, 10);
}

function fixtureUuid(day: number, kind: number): string {
	return `00000000-0000-4000-8000-${String(day * 10 + kind).padStart(12, '0')}`;
}

function sessionPayload(
	day: number,
	studyDate: string,
	kind: 'core' | 'boost',
	sessionId: string,
): Record<string, unknown> {
	const isBoost = kind === 'boost';
	return {
		schemaVersion: '1.0',
		sessionId,
		sessionType: kind,
		curriculumDay: day,
		occurredAt: `${studyDate}T${isBoost ? '18' : '09'}:00:00+09:00`,
		durationMinutes: isBoost ? 15 : 10,
		boost: isBoost ? { duration: 15, mode: 'speaking_sprint' } : null,
		summaryJa: `${isBoost ? 'Boost' : 'Core'} day ${day}`,
		evaluation: {
			taskCompletion: 4,
			grammar: 4,
			vocabulary: 4,
			fluency: 4,
			interaction: 4,
			commentJa: `Day ${day} fixture`,
		},
		mistakes: [],
		newVocabulary: [],
		newPhrases: [],
		previewGrammar: [],
		reviewCards: [],
	};
}

function completedAt(studyDate: string, hour: string): string {
	return new Date(`${studyDate}T${hour}:00:00+09:00`).toISOString();
}

function reviewFixture(day: number, studyDate: string, mistakeId: string) {
	const cardId = `review-card-${day}`;
	const occurredAt = `${studyDate}T08:00:00+09:00`;
	const dueAt = new Date(Date.parse(occurredAt) + 10 * 60_000).toISOString();
	const before = {
		id: cardId,
		front: `Review question ${day}`,
		back: `Review answer ${day}`,
		dueAt: `${studyDate}T00:00:00+09:00`,
		state: 'new',
		stabilityLevel: 0,
		lapses: 0,
		version: 1,
	};
	const after = {
		...before,
		dueAt,
		state: 'learning',
		lastReviewedAt: occurredAt,
		version: 2,
	};
	return {
		card: {
			...after,
			sourceType: 'mistake',
			sourceId: mistakeId,
			algorithmVersion: 1,
			updatedAt: occurredAt,
		},
		event: {
			eventId: `review-event-${day}`,
			cardId,
			grade: 'again',
			occurredAt,
			studyDate,
			curriculumDay: day,
			algorithmVersion: 1,
			before,
			after,
		},
	};
}

export function todayInTokyo(): string {
	const parts = new Intl.DateTimeFormat('en-US', {
		timeZone: 'Asia/Tokyo',
		year: 'numeric',
		month: '2-digit',
		day: '2-digit',
	}).formatToParts(new Date());
	const value = Object.fromEntries(parts.map((part) => [part.type, part.value]));
	return `${value.year}-${value.month}-${value.day}`;
}

export function buildHistoryFixture(
	days: 1 | 7 | 30 | 90,
	options: { skippedStudyDays?: boolean } = {},
): HistoryFixture {
	const today = todayInTokyo();
	const offsets = Array.from({ length: days }, (_, index) => index - (days - 1));
	if (options.skippedStudyDays && days === 7) {
		offsets.splice(0, offsets.length, -8, -7, -6, -4, -2, -1, 0);
	}
	const studyDates = offsets.map((offset) => addDays(today, offset));
	const now = new Date().toISOString();
	const stores: StoreRecords = Object.fromEntries(DATA_STORES.map((store) => [store, []]));
	stores.learnerProfiles.push({
		id: 'current',
		onboarded: true,
		learnerName: `History ${days}`,
		goal: 'Normalized history reconstruction fixture',
		timeZone: 'Asia/Tokyo',
		startDate: studyDates[0],
		currentDay: days,
		streak: 9_999,
		updatedAt: now,
	});
	stores.settings.push({
		id: 'current',
		dailyMinutes: 20,
		syncEnabled: false,
		reduceMotion: false,
		updatedAt: now,
	});

	for (let index = 0; index < days; index += 1) {
		const day = index + 1;
		const studyDate = studyDates[index];
		const coreId = fixtureUuid(day, 1);
		const boostId = fixtureUuid(day, 2);
		const mistakeId = `mistake-${day}`;
		const wordId = `word-${day}`;
		const phraseId = `phrase-${day}`;
		const review = reviewFixture(day, studyDate, mistakeId);

		stores.dailyProgress.push({
			id: `study:${studyDate}:curriculum:${day}`,
			studyDate,
			curriculumDay: day,
			reviewsCompleted: true,
			grammarCompleted: true,
			coreSessionImported: true,
			coreCompleted: true,
			version: 3,
			updatedAt: completedAt(studyDate, '20'),
		});
		stores.learningEvents.push({
			eventId: `learning-event-${day}`,
			type: 'core-completed',
			studyDate,
			curriculumDay: day,
			payload: {},
			createdAt: completedAt(studyDate, '20'),
		});
		for (const [kind, sessionId, hour] of [
			['core', coreId, '09'],
			['boost', boostId, '18'],
		] as const) {
			stores.sessions.push({
				sessionId,
				kind,
				completedAt: completedAt(studyDate, hour),
				durationMinutes: kind === 'core' ? 10 : 15,
				summary: `${kind === 'core' ? 'Core' : 'Boost'} day ${day}`,
				score: 80 + (day % 10),
				mistakes: kind === 'core' ? [`Mistake ${day}`] : [],
				payload: sessionPayload(day, studyDate, kind, sessionId),
				studyDate,
			});
		}
		stores.mistakes.push({
			id: mistakeId,
			category: 'grammar_tense',
			original: `I go yesterday ${day}.`,
			correction: `I went yesterday ${day}.`,
			repetitions: (day % 3) + 1,
			sessionId: coreId,
		});
		stores.learningItems.push(
			{
				id: wordId,
				kind: 'vocabulary',
				canonicalText: `fixture word ${day}`,
				displayText: `Fixture word ${day}`,
				meaningJa: `単語${day}`,
				status: 'new',
				updatedAt: completedAt(studyDate, '09'),
			},
			{
				id: phraseId,
				kind: 'phrase',
				canonicalText: `fixture phrase ${day}`,
				displayText: `Fixture phrase ${day}`,
				meaningJa: `表現${day}`,
				status: 'learned',
				updatedAt: completedAt(studyDate, '09'),
			},
		);
		stores.acquisitionEvents.push(
			{
				eventId: `acquisition-word-${day}`,
				studyDate,
				kind: 'vocabulary',
				entityId: wordId,
				sourceSessionId: coreId,
				createdAt: completedAt(studyDate, '09'),
			},
			{
				eventId: `acquisition-phrase-${day}`,
				studyDate,
				kind: 'phrase',
				entityId: phraseId,
				sourceSessionId: coreId,
				createdAt: completedAt(studyDate, '09'),
			},
		);
		stores.reviewCards.push(review.card);
		stores.reviewEvents.push(review.event);
		stores.grammarProgress.push({
			id: `completed:grammar-${day}`,
			curriculumDay: day,
			status: 'completed',
			updatedAt: completedAt(studyDate, '10'),
		});
	}

	if (days < 90) {
		const previewDay = days + 1;
		const sourceSessionId = fixtureUuid(days, 2);
		stores.grammarProgress.push({
			id: 'preview:fixture-preview-topic',
			curriculumDay: previewDay,
			status: 'previewed',
			updatedAt: now,
		});
		stores.acquisitionEvents.push({
			eventId: 'acquisition-grammar-preview',
			studyDate: studyDates.at(-1),
			kind: 'grammar-preview',
			entityId: 'fixture-preview-topic',
			sourceSessionId,
			createdAt: now,
		});
	}

	stores.assessments.push({
		id: 'baseline:current',
		type: 'baseline',
		completedAt: completedAt(studyDates[0], '07'),
		payload: {
			confidence: 3,
			taskCompletion: 3,
			grammar: 3,
			vocabulary: 3,
			fluency: 3,
			interaction: 3,
			strengths: ['継続'],
			priorities: ['流暢さ'],
		},
	});
	for (let endDay = Math.min(7, days); endDay <= days; endDay += 7) {
		stores.assessments.push({
			id: `weekly:${endDay}`,
			type: 'weekly',
			completedAt: completedAt(studyDates[endDay - 1], '21'),
			payload: {
				startDay: Math.max(1, endDay - 6),
				endDay,
				evaluation: {
					taskCompletion: 4,
					grammar: 4,
					vocabulary: 4,
					fluency: 4,
					interaction: 4,
					commentJa: `Week ending ${endDay}`,
				},
				strength: '継続',
				priority: '会話',
			},
		});
	}

	for (const records of Object.values(stores)) records.reverse();
	const streak = options.skippedStudyDays && days === 7 ? 3 : days;
	return {
		stores,
		expected: {
			days,
			currentDay: days,
			streak,
			coreSessions: days,
			boostSessions: days,
			reviewEvents: days,
			acquiredWords: days,
			acquiredPhrases: days,
			grammarProgress: days + (days < 90 ? 1 : 0),
			assessments: stores.assessments.length,
			latestSummary: `Boost day ${days}`,
		},
	};
}

export async function seedHistoryFixture(page: Page, fixture: HistoryFixture): Promise<void> {
	await page.goto('/onboarding');
	await page.getByRole('heading', { name: '話す日を、365日つづける。' }).waitFor();
	await page.evaluate(async ({ stores }) => {
		const database = await new Promise<IDBDatabase>((resolve, reject) => {
			const request = indexedDB.open('english-os');
			request.onerror = () => reject(request.error);
			request.onsuccess = () => resolve(request.result);
		});
		const storeNames = Array.from(database.objectStoreNames);
		const transaction = database.transaction(storeNames, 'readwrite');
		const completed = new Promise<void>((resolve, reject) => {
			transaction.oncomplete = () => resolve();
			transaction.onerror = () => reject(transaction.error);
			transaction.onabort = () => reject(transaction.error);
		});
		for (const name of storeNames) transaction.objectStore(name).clear();
		for (const [name, records] of Object.entries(stores)) {
			for (const record of records) transaction.objectStore(name).put(record);
		}
		const replayTargets = [
			['sessions', stores.sessions[0]],
			['reviewEvents', stores.reviewEvents[0]],
			['acquisitionEvents', stores.acquisitionEvents[0]],
		] as const;
		for (const [name, record] of replayTargets) {
			if (record) transaction.objectStore(name).put(record);
		}
		const now = new Date().toISOString();
		transaction.objectStore('metadata').put({
			key: 'bootstrapComplete',
			value: { schemaVersion: 5, migration: false },
			updatedAt: now,
		});
		transaction.objectStore('metadata').put({ key: 'localRevision', value: 1, updatedAt: now });
		await completed;
		database.close();
	}, fixture);
}

export async function readHistoryStoreEvidence(page: Page): Promise<HistoryStoreEvidence> {
	return page.evaluate(
		async (storeNames) => {
			const database = await new Promise<IDBDatabase>((resolve, reject) => {
				const request = indexedDB.open('english-os');
				request.onerror = () => reject(request.error);
				request.onsuccess = () => resolve(request.result);
			});
			const transaction = database.transaction(storeNames, 'readonly');
			const results = Object.fromEntries(
				storeNames.map((name) => [name, transaction.objectStore(name).getAll()]),
			) as Record<string, IDBRequest<unknown[]>>;
			await new Promise<void>((resolve, reject) => {
				transaction.oncomplete = () => resolve();
				transaction.onerror = () => reject(transaction.error);
				transaction.onabort = () => reject(transaction.error);
			});
			const records = Object.fromEntries(
				Object.entries(results).map(([name, request]) => [name, request.result]),
			);
			database.close();
			return {
				counts: Object.fromEntries(
					Object.entries(records).map(([name, values]) => [name, values.length]),
				),
				progressDays: (records.dailyProgress as Array<{ curriculumDay: number }>)
					.map((item) => item.curriculumDay)
					.sort((left, right) => left - right),
				completedProgressDays: (
					records.dailyProgress as Array<{ curriculumDay: number; coreCompleted: boolean }>
				)
					.filter((item) => item.coreCompleted)
					.map((item) => item.curriculumDay)
					.sort((left, right) => left - right),
				sessionIds: (records.sessions as Array<{ sessionId: string }>).map(
					(item) => item.sessionId,
				),
				assessmentTypes: (records.assessments as Array<{ type: string }>).map((item) => item.type),
			};
		},
		[...DATA_STORES],
	);
}
