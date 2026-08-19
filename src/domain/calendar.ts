import {
	AVAILABLE_CURRICULUM_TOTAL_DAYS,
	SUPPORTED_CURRICULUM_DAY_MAX,
} from '../curriculum/constants';

const LocalDatePattern = /^(\d{4})-(\d{2})-(\d{2})$/u;

export interface CurriculumProgressLike {
	curriculumDay: number;
	coreCompleted: boolean;
}

export type StudyStatus = 'before-start' | 'active' | 'graduated';

export function isValidTimeZone(timeZone: string): boolean {
	try {
		new Intl.DateTimeFormat('en-US', { timeZone }).format(new Date(0));
		return true;
	} catch {
		return false;
	}
}

export function studyDateAt(instant: Date | string, timeZone: string): string {
	if (!isValidTimeZone(timeZone)) throw new RangeError(`Invalid IANA time zone: ${timeZone}`);
	const date = typeof instant === 'string' ? new Date(instant) : instant;
	if (!Number.isFinite(date.getTime())) throw new RangeError('Invalid instant');
	const parts = new Intl.DateTimeFormat('en-CA', {
		timeZone,
		year: 'numeric',
		month: '2-digit',
		day: '2-digit',
	}).formatToParts(date);
	const value = Object.fromEntries(parts.map((part) => [part.type, part.value]));
	return `${value.year}-${value.month}-${value.day}`;
}

export function addStudyDays(studyDate: string, amount: number): string {
	const match = LocalDatePattern.exec(studyDate);
	if (!match || !Number.isInteger(amount)) throw new RangeError('Invalid local calendar date');
	const date = new Date(Date.UTC(Number(match[1]), Number(match[2]) - 1, Number(match[3])));
	if (
		date.getUTCFullYear() !== Number(match[1]) ||
		date.getUTCMonth() !== Number(match[2]) - 1 ||
		date.getUTCDate() !== Number(match[3])
	) {
		throw new RangeError('Invalid local calendar date');
	}
	date.setUTCDate(date.getUTCDate() + amount);
	return date.toISOString().slice(0, 10);
}

function assertValidCurriculumTotalDays(totalDays: number): void {
	if (!Number.isInteger(totalDays) || totalDays < 1 || totalDays > SUPPORTED_CURRICULUM_DAY_MAX) {
		throw new RangeError(
			`Curriculum total days must be an integer from 1 to ${SUPPORTED_CURRICULUM_DAY_MAX}.`,
		);
	}
}

export function nextCurriculumDay(
	progress: readonly CurriculumProgressLike[],
	totalDays = AVAILABLE_CURRICULUM_TOTAL_DAYS,
): number {
	assertValidCurriculumTotalDays(totalDays);
	const completed = new Set(
		progress
			.filter((item) => item.coreCompleted)
			.map((item) => item.curriculumDay)
			.filter((day) => day >= 1 && day <= totalDays),
	);
	for (let day = 1; day <= totalDays; day += 1) {
		if (!completed.has(day)) return day;
	}
	return totalDays;
}

export function studyStatus(
	startDate: string,
	studyDate: string,
	progress: readonly CurriculumProgressLike[],
	totalDays = AVAILABLE_CURRICULUM_TOTAL_DAYS,
): StudyStatus {
	assertValidCurriculumTotalDays(totalDays);
	if (!LocalDatePattern.test(startDate) || !LocalDatePattern.test(studyDate)) {
		throw new RangeError('Invalid local calendar date');
	}
	if (studyDate < startDate) return 'before-start';
	const completed = new Set(
		progress
			.filter((item) => item.coreCompleted)
			.map((item) => item.curriculumDay)
			.filter((day) => day >= 1 && day <= totalDays),
	);
	return completed.size === totalDays ? 'graduated' : 'active';
}

export function calculateStreak(completedStudyDates: readonly string[], today: string): number {
	const completed = new Set(completedStudyDates);
	let cursor = completed.has(today) ? today : addStudyDays(today, -1);
	let streak = 0;
	while (completed.has(cursor)) {
		streak += 1;
		cursor = addStudyDays(cursor, -1);
	}
	return streak;
}
