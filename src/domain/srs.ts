import { addStudyDays, studyDateAt } from './calendar';

export type ReviewGrade = 'again' | 'hard' | 'good' | 'easy';
export type ReviewState = 'new' | 'learning' | 'review' | 'relearning' | 'previewed' | 'suspended';

export interface SrsCardState {
	state: ReviewState;
	dueAt: string;
	lastReviewedAt?: string;
	stabilityLevel: number;
	lapses: number;
}

export interface SrsSchedule extends SrsCardState {
	intervalDays: number;
}

export interface ReviewHistorySnapshot extends SrsCardState {
	version: number;
}

export interface ReviewHistoryEvent {
	eventId: string;
	grade: ReviewGrade;
	occurredAt: string;
	before: ReviewHistorySnapshot;
	after: ReviewHistorySnapshot;
}

function zonedParts(instant: Date, timeZone: string) {
	const parts = new Intl.DateTimeFormat('en-US', {
		timeZone,
		year: 'numeric',
		month: '2-digit',
		day: '2-digit',
		hour: '2-digit',
		minute: '2-digit',
		second: '2-digit',
		hourCycle: 'h23',
	}).formatToParts(instant);
	const values = Object.fromEntries(parts.map((part) => [part.type, Number(part.value)]));
	return {
		year: values.year,
		month: values.month,
		day: values.day,
		hour: values.hour,
		minute: values.minute,
		second: values.second,
	};
}

function localDateTimeToInstant(
	studyDate: string,
	time: { hour: number; minute: number; second: number },
	timeZone: string,
): string {
	const [year, month, day] = studyDate.split('-').map(Number);
	const desired = Date.UTC(year, month - 1, day, time.hour, time.minute, time.second);
	let candidate = desired;
	for (let iteration = 0; iteration < 4; iteration += 1) {
		const actual = zonedParts(new Date(candidate), timeZone);
		const represented = Date.UTC(
			actual.year,
			actual.month - 1,
			actual.day,
			actual.hour,
			actual.minute,
			actual.second,
		);
		const delta = desired - represented;
		candidate += delta;
		if (delta === 0) break;
	}
	type LocalParts = {
		year: number;
		month: number;
		day: number;
		hour: number;
		minute: number;
		second: number;
	};
	const scalar = (parts: LocalParts) =>
		Date.UTC(parts.year, parts.month - 1, parts.day, parts.hour, parts.minute, parts.second);
	const exact: number[] = [];
	let compatibleAfter: { instant: number; represented: number } | undefined;
	for (let offsetMinutes = -240; offsetMinutes <= 240; offsetMinutes += 1) {
		const instant = candidate + offsetMinutes * 60_000;
		const actual = zonedParts(new Date(instant), timeZone);
		const represented = scalar(actual);
		if (represented === desired) exact.push(instant);
		else if (
			actual.year === year &&
			actual.month === month &&
			actual.day === day &&
			represented > desired &&
			(!compatibleAfter || represented < compatibleAfter.represented)
		) {
			compatibleAfter = { instant, represented };
		}
	}
	if (exact.length) return new Date(Math.min(...exact)).toISOString();
	if (compatibleAfter) return new Date(compatibleAfter.instant).toISOString();
	return new Date(candidate).toISOString();
}

function dueInDays(now: string, amount: number, timeZone: string): string {
	const instant = new Date(now);
	const parts = zonedParts(instant, timeZone);
	return localDateTimeToInstant(
		addStudyDays(studyDateAt(instant, timeZone), amount),
		{ hour: parts.hour, minute: parts.minute, second: parts.second },
		timeZone,
	);
}

function currentIntervalDays(card: SrsCardState, timeZone: string): number {
	if (!card.lastReviewedAt) return 1;
	const from = studyDateAt(card.lastReviewedAt, timeZone);
	const to = studyDateAt(card.dueAt, timeZone);
	const interval = Math.round(
		(Date.parse(`${to}T00:00:00Z`) - Date.parse(`${from}T00:00:00Z`)) / 86_400_000,
	);
	return Math.min(180, Math.max(1, Number.isFinite(interval) ? interval : 1));
}

export function scheduleReview(
	card: SrsCardState,
	grade: ReviewGrade,
	now: string,
	timeZone: string,
): SrsSchedule {
	if (card.state === 'previewed' || card.state === 'suspended') {
		throw new RangeError(`Card state ${card.state} cannot be graded.`);
	}
	if (!Number.isFinite(Date.parse(now))) throw new RangeError('Invalid review time.');

	const interval = currentIntervalDays(card, timeZone);
	let stabilityLevel = card.stabilityLevel;
	let lapses = card.lapses;

	if (grade === 'again') {
		const nextState =
			card.state === 'review' ? 'relearning' : card.state === 'new' ? 'learning' : card.state;
		if (card.state === 'review') {
			lapses += 1;
			stabilityLevel = Math.max(0, stabilityLevel - 1);
		}
		return {
			state: nextState,
			dueAt: new Date(Date.parse(now) + 10 * 60_000).toISOString(),
			lastReviewedAt: now,
			stabilityLevel,
			lapses,
			intervalDays: 0,
		};
	}
	let intervalDays: number;
	let state: ReviewState;

	if (card.state === 'review') {
		const multiplier = grade === 'hard' ? 1.2 : grade === 'good' ? 2 : 3;
		intervalDays = Math.min(180, Math.max(1, Math.round(interval * multiplier)));
		stabilityLevel += grade === 'hard' ? 0 : grade === 'good' ? 1 : 2;
		state = 'review';
	} else {
		const table = {
			new: { hard: 1, good: 2, easy: 4 },
			learning: { hard: 1, good: 3, easy: 6 },
			relearning: { hard: 1, good: 3, easy: 5 },
		} as const;
		intervalDays = table[card.state][grade];
		state = grade === 'hard' ? (card.state === 'relearning' ? 'relearning' : 'learning') : 'review';
		stabilityLevel = grade === 'easy' ? 2 : grade === 'good' ? 1 : stabilityLevel;
	}

	return {
		state,
		dueAt: dueInDays(now, intervalDays, timeZone),
		lastReviewedAt: now,
		stabilityLevel,
		lapses,
		intervalDays,
	};
}

export function reconstructReviewHistory(
	events: readonly ReviewHistoryEvent[],
	timeZone: string,
): ReviewHistorySnapshot | null {
	if (!events.length) return null;
	const ordered = [...events].sort((left, right) =>
		left.occurredAt === right.occurredAt
			? left.eventId.localeCompare(right.eventId)
			: left.occurredAt.localeCompare(right.occurredAt),
	);
	let current = ordered[0].before;
	for (const event of ordered) {
		if (
			event.before.version !== current.version ||
			event.before.state !== current.state ||
			event.before.dueAt !== current.dueAt ||
			event.before.stabilityLevel !== current.stabilityLevel ||
			event.before.lapses !== current.lapses
		) {
			throw new RangeError(`Review history diverges before event ${event.eventId}.`);
		}
		const scheduled = scheduleReview(current, event.grade, event.occurredAt, timeZone);
		if (
			event.after.version !== current.version + 1 ||
			event.after.state !== scheduled.state ||
			event.after.dueAt !== scheduled.dueAt ||
			event.after.lastReviewedAt !== scheduled.lastReviewedAt ||
			event.after.stabilityLevel !== scheduled.stabilityLevel ||
			event.after.lapses !== scheduled.lapses
		) {
			throw new RangeError(`Review history diverges after event ${event.eventId}.`);
		}
		current = event.after;
	}
	return current;
}
