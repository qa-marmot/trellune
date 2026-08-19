import { describe, expect, it } from 'vitest';
import { CURRICULUM, DAILY_NEW_WORD_LIMIT } from './curriculum';

const identity = (value: string) =>
	value.normalize('NFKC').trim().toLocaleLowerCase('en-US').replace(/\s+/gu, ' ');

describe('Day 1-365 curriculum integrity', () => {
	it('has exactly 365 ordered days and complete day-specific grammar material', () => {
		expect(CURRICULUM).toHaveLength(365);
		CURRICULUM.forEach((day, index) => {
			expect(day.day).toBe(index + 1);
			expect(day.grammar.explanation).not.toHaveLength(0);
			expect(day.grammar.examples).toHaveLength(2);
			expect(day.grammar.exercise).not.toHaveLength(0);
			expect(day.grammar.expectedAnswer).not.toHaveLength(0);
			expect(day.grammar.examples.every((example) => /[A-Za-z]/u.test(example))).toBe(true);
			expect(day.grammar.exercise).not.toContain('中心となる文法の形');
			expect(day.grammar.expectedAnswer).not.toBe(day.grammar.focus);
			expect(day.vocabulary.length).toBeLessThanOrEqual(DAILY_NEW_WORD_LIMIT);
		});
	});

	it('provides at least 600 NFKC-normalized unique Core word surfaces', () => {
		const words = CURRICULUM.slice(0, 90).flatMap((day) =>
			day.vocabulary.map((item) => identity(item.text)),
		);
		expect(new Set(words).size).toBeGreaterThanOrEqual(600);
	});

	it('provides at least 150 unique Core phrases without exceeding three per day', () => {
		const phrases = CURRICULUM.slice(0, 90).flatMap((day) =>
			day.phrases.map((item) => identity(item.text)),
		);
		expect(new Set(phrases).size).toBeGreaterThanOrEqual(150);
		expect(CURRICULUM.every((day) => day.phrases.length <= 3)).toBe(true);
	});

	it('keeps curated vocabulary and phrases aligned with each lesson context', () => {
		const vocabulary = (day: number) => CURRICULUM[day - 1].vocabulary.map((item) => item.text);
		const phrases = (day: number) => CURRICULUM[day - 1].phrases.map((item) => item.text);

		expect(vocabulary(15)).toContain('espresso');
		expect(vocabulary(15)).not.toContain('accommodation');
		expect(vocabulary(29)).toContain('clothing');
		expect(vocabulary(29)).not.toContain('appliance');
		expect(vocabulary(50)).toContain('dizzy');
		expect(vocabulary(50)).not.toContain('equipment');
		expect(vocabulary(61)).toEqual(
			expect.arrayContaining(['hot water', 'maintenance', 'inconvenience']),
		);
		expect(phrases(20)).toContain('I do not think this is my order.');
	});

	it('uses the authored final-day slice after omitting the rehearsal day', () => {
		expect(CURRICULUM[89].theme).toBe('90日最終会話');
		expect(CURRICULUM[89].vocabulary.map((item) => item.text)).toEqual([
			'final',
			'conversation',
			'communicate',
			'explain',
			'ask',
			'respond',
			'maintain',
		]);
		expect(CURRICULUM[89].phrases.map((item) => item.text)).toEqual([
			'I can explain my ideas more clearly now.',
			'I want to keep improving.',
		]);
	});

	it('keeps the Independent stage within acquisition limits and unit boundaries', () => {
		const independent = CURRICULUM.slice(90, 180);
		expect(independent).toHaveLength(90);
		expect(independent[0]?.day).toBe(91);
		expect(independent.at(-1)?.day).toBe(180);
		expect(independent.every((day) => day.phase === 'Independent')).toBe(true);
		expect(
			independent.every((day) => day.vocabulary.length >= 4 && day.vocabulary.length <= 6),
		).toBe(true);
		expect(independent.every((day) => day.phrases.length >= 1 && day.phrases.length <= 3)).toBe(
			true,
		);
		expect([105, 106, 120, 121, 135, 136, 150, 151, 165, 166, 180]).toEqual(
			CURRICULUM.filter((day) =>
				[105, 106, 120, 121, 135, 136, 150, 151, 165, 166, 180].includes(day.day),
			).map((day) => day.day),
		);
	});

	it('controls Independent vocabulary and phrase repetition while preserving useful recycling', () => {
		for (let startDay = 91; startDay <= 166; startDay += 15) {
			const unit = CURRICULUM.slice(startDay - 1, startDay + 14);
			const words = unit.flatMap((day) => day.vocabulary.map((item) => identity(item.text)));
			const phrases = unit.flatMap((day) => day.phrases.map((item) => identity(item.text)));
			expect(new Set(words).size).toBeGreaterThanOrEqual(55);
			expect(new Set(phrases).size).toBeGreaterThanOrEqual(24);
		}
	});

	it('progresses from short reasons to an 8-12 minute integrated conversation', () => {
		expect(CURRICULUM[90].voiceTask).toContain('4分');
		expect(CURRICULUM[179].voiceTask).toContain('8–12分');
		expect(CURRICULUM[90].grammar.title).toBe('現在完了と過去形');
		expect(CURRICULUM[179].grammar.title).toBe('Independent Stage integration');
		expect(new Set(CURRICULUM.slice(90, 180).map((day) => day.theme))).toHaveLength(90);
	});

	it('progresses through the Fluency stage within acquisition limits', () => {
		const fluency = CURRICULUM.slice(180, 270);
		expect(fluency).toHaveLength(90);
		expect(fluency[0]?.day).toBe(181);
		expect(fluency.at(-1)?.day).toBe(270);
		expect(fluency.every((day) => day.phase === 'Fluency')).toBe(true);
		expect(fluency.every((day) => day.vocabulary.length >= 3 && day.vocabulary.length <= 5)).toBe(
			true,
		);
		expect(fluency.every((day) => day.phrases.length >= 1 && day.phrases.length <= 3)).toBe(true);
		expect(CURRICULUM[180].voiceTask).toContain('2分');
		expect(CURRICULUM[269].voiceTask).toContain('12～18分');
		expect(CURRICULUM[269].grammar.title).toBe('Fluency Stage integration');
		expect(new Set(fluency.map((day) => day.theme))).toHaveLength(90);
	});

	it('progresses through the B2 Challenge within acquisition limits', () => {
		const challenge = CURRICULUM.slice(270, 365);
		expect(challenge).toHaveLength(95);
		expect(challenge[0]?.day).toBe(271);
		expect(challenge.at(-1)?.day).toBe(365);
		expect(challenge.every((day) => day.phase === 'B2 Challenge')).toBe(true);
		expect(challenge.every((day) => day.vocabulary.length >= 2 && day.vocabulary.length <= 4)).toBe(
			true,
		);
		expect(challenge.every((day) => day.phrases.length >= 1 && day.phrases.length <= 3)).toBe(true);
		expect(CURRICULUM[270].voiceTask).toContain('12分');
		expect(CURRICULUM[364].voiceTask).toContain('25分');
		expect(new Set(challenge.map((day) => day.theme))).toHaveLength(95);
	});
});
