import { describe, expect, it } from 'vitest';
import {
	addStudyDays,
	calculateStreak,
	nextCurriculumDay,
	studyDateAt,
	studyStatus,
} from './calendar';

describe('study calendar', () => {
	it('uses the configured timezone at 23:59, 00:00 and 00:01 boundaries', () => {
		expect(studyDateAt('2026-08-09T14:59:00.000Z', 'Asia/Tokyo')).toBe('2026-08-09');
		expect(studyDateAt('2026-08-09T15:00:00.000Z', 'Asia/Tokyo')).toBe('2026-08-10');
		expect(studyDateAt('2026-08-09T15:01:00.000Z', 'Asia/Tokyo')).toBe('2026-08-10');
	});

	it('uses IANA DST rules instead of a fixed offset', () => {
		expect(studyDateAt('2026-03-08T04:59:00.000Z', 'America/New_York')).toBe('2026-03-07');
		expect(studyDateAt('2026-03-08T05:00:00.000Z', 'America/New_York')).toBe('2026-03-08');
	});

	it('advances by completed curriculum sequence, not elapsed or missed dates', () => {
		expect(
			nextCurriculumDay([
				{ curriculumDay: 1, coreCompleted: true },
				{ curriculumDay: 3, coreCompleted: true },
			]),
		).toBe(2);
		expect(nextCurriculumDay([{ curriculumDay: 1, coreCompleted: false }])).toBe(1);
	});

	it.each([1, 91, 181, 271] as const)(
		'uses Day %i as a starting boundary without treating earlier days as complete',
		(entryDay) => {
			expect(nextCurriculumDay([], 365, entryDay)).toBe(entryDay);
			expect(studyStatus('2026-08-10', '2026-08-10', [], 365, entryDay)).toBe('active');
			const completed = Array.from({ length: 365 - entryDay + 1 }, (_, index) => ({
				curriculumDay: entryDay + index,
				coreCompleted: true,
			}));
			expect(studyStatus('2026-08-10', '2026-08-10', completed, 365, entryDay)).toBe('graduated');
		},
	);

	it('rejects a non-boundary or inactive starting day', () => {
		expect(() => nextCurriculumDay([], 365, 90)).toThrow(RangeError);
		expect(() => nextCurriculumDay([], 180, 271)).toThrow(RangeError);
	});

	it.each([
		[0, 1],
		[6, 7],
		[7, 8],
		[29, 30],
		[30, 31],
		[59, 60],
		[60, 61],
		[88, 89],
		[89, 90],
	] as const)('maps %i sequential completions to Day %i', (completedCount, expectedDay) => {
		expect(
			nextCurriculumDay(
				Array.from({ length: completedCount }, (_, index) => ({
					curriculumDay: index + 1,
					coreCompleted: true,
				})),
			),
		).toBe(expectedDay);
	});

	it('derives Day 91 from completed Core evidence without bulk migration', () => {
		const firstNinetyCompleted = Array.from({ length: 90 }, (_, index) => ({
			curriculumDay: index + 1,
			coreCompleted: true,
		}));

		expect(nextCurriculumDay(firstNinetyCompleted, 90)).toBe(90);
		expect(nextCurriculumDay(firstNinetyCompleted)).toBe(91);
		expect(nextCurriculumDay(firstNinetyCompleted, 365)).toBe(91);
		expect(
			nextCurriculumDay(
				[...firstNinetyCompleted, { curriculumDay: 366, coreCompleted: true }],
				365,
			),
		).toBe(91);
		expect(
			studyStatus(
				'2026-01-01',
				'2026-08-11',
				[
					{ curriculumDay: 1, coreCompleted: true },
					{ curriculumDay: 2, coreCompleted: true },
					{ curriculumDay: 3, coreCompleted: true },
				],
				3,
			),
		).toBe('graduated');
	});

	it('derives Day 181 from completed Core evidence only when ACTIVE allows it', () => {
		const firstOneEightyCompleted = Array.from({ length: 180 }, (_, index) => ({
			curriculumDay: index + 1,
			coreCompleted: true,
		}));
		expect(nextCurriculumDay(firstOneEightyCompleted, 180)).toBe(180);
		expect(nextCurriculumDay(firstOneEightyCompleted, 270)).toBe(181);
		expect(studyStatus('2026-01-01', '2026-08-11', firstOneEightyCompleted, 180)).toBe('graduated');
		expect(studyStatus('2026-01-01', '2026-08-11', firstOneEightyCompleted, 270)).toBe('active');
	});

	it('derives Day 271 from Core evidence only when ACTIVE 365 allows it', () => {
		const firstTwoSeventyCompleted = Array.from({ length: 270 }, (_, index) => ({
			curriculumDay: index + 1,
			coreCompleted: true,
		}));
		expect(nextCurriculumDay(firstTwoSeventyCompleted, 270)).toBe(270);
		expect(nextCurriculumDay(firstTwoSeventyCompleted, 365)).toBe(271);
		expect(studyStatus('2026-01-01', '2026-08-11', firstTwoSeventyCompleted, 270)).toBe(
			'graduated',
		);
		expect(studyStatus('2026-01-01', '2026-08-11', firstTwoSeventyCompleted, 365)).toBe('active');
	});

	it.each([0, 1.5, 541])('rejects an invalid curriculum total: %s', (totalDays) => {
		expect(() => nextCurriculumDay([], totalDays)).toThrow(RangeError);
		expect(() => studyStatus('2026-01-01', '2026-01-01', [], totalDays)).toThrow(RangeError);
	});

	it('derives streak from consecutive study dates without penalizing an unfinished today', () => {
		const completed = ['2026-08-07', '2026-08-08', '2026-08-09'];
		expect(calculateStreak(completed, '2026-08-10')).toBe(3);
		expect(calculateStreak([...completed, '2026-08-10'], '2026-08-10')).toBe(4);
		expect(calculateStreak(['2026-08-07', '2026-08-09'], '2026-08-10')).toBe(1);
		expect(addStudyDays('2024-02-28', 1)).toBe('2024-02-29');
	});

	it('distinguishes active extended stages and graduation after Day 365', () => {
		expect(studyStatus('2026-08-10', '2026-08-09', [])).toBe('before-start');
		expect(
			studyStatus(
				'2026-01-01',
				'2026-08-10',
				Array.from({ length: 89 }, (_, index) => ({
					curriculumDay: index + 1,
					coreCompleted: true,
				})),
			),
		).toBe('active');
		expect(
			studyStatus(
				'2026-01-01',
				'2026-08-11',
				Array.from({ length: 90 }, (_, index) => ({
					curriculumDay: index + 1,
					coreCompleted: true,
				})),
			),
		).toBe('active');
		expect(
			studyStatus(
				'2026-01-01',
				'2026-08-11',
				Array.from({ length: 365 }, (_, index) => ({
					curriculumDay: index + 1,
					coreCompleted: true,
				})),
			),
		).toBe('graduated');
	});
});
