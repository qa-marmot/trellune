import { z } from 'zod';
import { AVAILABLE_CURRICULUM_TOTAL_DAYS, SUPPORTED_CURRICULUM_DAY_MAX } from './constants';

export const ActiveCurriculumTotalDaysSchema = z
	.number()
	.int()
	.min(1)
	.max(SUPPORTED_CURRICULUM_DAY_MAX);

export class CurriculumCompatibilityError extends Error {
	readonly userMessage: string;

	constructor(
		readonly activeTotalDays: number,
		message?: string,
	) {
		super(
			message ??
				`Active curriculum Day ${activeTotalDays} exceeds bundled Day ${AVAILABLE_CURRICULUM_TOTAL_DAYS}.`,
		);
		this.name = 'CurriculumCompatibilityError';
		this.userMessage =
			'Trelluneは現在有効なカリキュラムを処理できません。アプリを更新してから再度開いてください。';
	}
}

export function assertBundledCurriculumCompatibility(activeTotalDays: unknown): number {
	const parsed = ActiveCurriculumTotalDaysSchema.safeParse(activeTotalDays);
	if (!parsed.success) {
		throw new CurriculumCompatibilityError(
			typeof activeTotalDays === 'number' ? activeTotalDays : Number.NaN,
			'Active curriculum total is outside the supported client range.',
		);
	}
	if (AVAILABLE_CURRICULUM_TOTAL_DAYS > SUPPORTED_CURRICULUM_DAY_MAX) {
		throw new CurriculumCompatibilityError(
			parsed.data,
			'Bundled curriculum availability exceeds the supported client range.',
		);
	}
	if (parsed.data > AVAILABLE_CURRICULUM_TOTAL_DAYS) {
		throw new CurriculumCompatibilityError(parsed.data);
	}
	return parsed.data;
}

export function assertCurriculumDayWithinActive(
	curriculumDay: number,
	activeTotalDays: number,
): void {
	if (!Number.isInteger(curriculumDay) || curriculumDay < 1 || curriculumDay > activeTotalDays) {
		throw new CurriculumCompatibilityError(
			activeTotalDays,
			`Curriculum Day ${curriculumDay} exceeds active Day ${activeTotalDays}.`,
		);
	}
}
