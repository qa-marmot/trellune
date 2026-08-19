import type { CefrBand, PracticeFeedback } from '../curriculum/model';

export interface PracticeFeedbackPromptInput {
	readonly cefr: CefrBand;
	readonly task: string;
	readonly response: string;
	readonly targetGrammar: string;
	readonly feedback: PracticeFeedback;
}

export function buildPracticeFeedbackPrompt(input: PracticeFeedbackPromptInput): string {
	return `Trellune OPTIONAL TEXT FEEDBACK

This is optional feedback, not Core completion and not Voice.
CEFR context: ${input.cefr}
Task: ${input.task}
Target grammar/language feature: ${input.targetGrammar}
Learner response:
${input.response}

Self-review rubric:
${input.feedback.checklist.map((item) => `- ${item}`).join('\n')}

Give feedback in Japanese in this order:
1. task achievement
2. grammar and target feature
3. vocabulary and clarity
4. one priority correction with a short reason
Do not begin by rewriting the whole answer. After the explanation, show one improved version while preserving the learner's intended meaning. Do not claim that this feedback completes Trellune Core.`;
}
