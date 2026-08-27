import { z } from 'zod';

export const CURRICULUM_ENTRY_DAYS = [1, 91, 181, 271] as const;

export const CurriculumEntryDaySchema = z.union([
	z.literal(1),
	z.literal(91),
	z.literal(181),
	z.literal(271),
]);

export type CurriculumEntryDay = z.infer<typeof CurriculumEntryDaySchema>;

export function isCurriculumEntryDay(value: number): value is CurriculumEntryDay {
	return CURRICULUM_ENTRY_DAYS.some((day) => day === value);
}
