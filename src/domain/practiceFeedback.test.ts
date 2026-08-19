import { describe, expect, it } from 'vitest';
import { buildPracticeFeedbackPrompt } from './practiceFeedback';

describe('buildPracticeFeedbackPrompt', () => {
	it('keeps optional text feedback separate from Core and delays the rewrite', () => {
		const prompt = buildPracticeFeedbackPrompt({
			cefr: 'B1',
			task: 'Explain your choice.',
			response: 'I choose train because it is faster.',
			targetGrammar: 'because / comparison',
			feedback: {
				rationale: 'A reason should support the choice.',
				checklist: ['I answered the task.', 'I included a reason.'],
			},
		});

		expect(prompt).toContain('optional feedback, not Core completion and not Voice');
		expect(prompt).toContain('Do not begin by rewriting');
		expect(prompt).toContain('one priority correction');
		expect(prompt).toContain('I choose train because it is faster.');
	});
});
