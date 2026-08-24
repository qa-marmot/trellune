import { describe, expect, it } from 'vitest';
import {
	CONVERSATION_PROVIDER_PRESETS,
	LearningConversationRequestSchema,
	getConversationProviderPreset,
	renderLearningConversationPrompt,
} from './contract';

const request = {
	contractVersion: '1.0',
	sessionType: 'core',
	curriculumDay: 12,
	theme: '週末の予定',
	objective: '予定を理由と一緒に説明する',
	grammar: { title: 'be going to', focus: '予定を話す' },
	voiceTask: '予定を1分話し、質問に答える。',
	coaching: '一度に一問だけ進める。',
	learnerContext: 'LEARNER_CONTEXT\nremainingNewWords: 4',
	outputContract: {
		name: 'SESSION_JSON',
		schemaVersion: '1.0',
		instruction: '私が明示的に要求するまでJSONを出力しない。',
	},
} as const;

describe('provider-neutral learning conversation contract', () => {
	it('has a strict generic request with no provider field', () => {
		const parsed = LearningConversationRequestSchema.safeParse(request);
		expect(parsed.success).toBe(true);
		expect(
			LearningConversationRequestSchema.safeParse({ ...request, provider: 'chatgpt' }).success,
		).toBe(false);
	});

	it('keeps core requests inside the currently bundled curriculum', () => {
		expect(
			LearningConversationRequestSchema.safeParse({ ...request, curriculumDay: 365 }).success,
		).toBe(true);
		expect(
			LearningConversationRequestSchema.safeParse({ ...request, curriculumDay: 366 }).success,
		).toBe(false);
	});

	it('ships ChatGPT, Claude, Gemini, and generic manual presets without claiming unverified voice', () => {
		expect(CONVERSATION_PROVIDER_PRESETS.map((preset) => preset.id)).toEqual([
			'chatgpt',
			'claude',
			'gemini',
			'generic',
		]);
		expect(getConversationProviderPreset('chatgpt').capabilities.voiceConversation).toBe('tested');
		expect(getConversationProviderPreset('claude').capabilities.voiceConversation).toBe(
			'unverified',
		);
		expect(getConversationProviderPreset('gemini').capabilities.voiceConversation).toBe(
			'unverified',
		);
	});

	it('renders a portable request while leaving the final trust boundary with SESSION_JSON validation', () => {
		const prompt = renderLearningConversationPrompt(
			request,
			getConversationProviderPreset('generic'),
		);
		expect(prompt).toContain('LEARNING_CONVERSATION_REQUEST');
		expect(prompt).toContain('SESSION_JSON 1.0');
		expect(prompt).toContain('Trellune側の検証を通るまで取込成功と断言しない');
		expect(prompt).not.toContain('ChatGPT');
	});

	it('renders provider workflow and trust-boundary guidance in English when requested', () => {
		const prompt = renderLearningConversationPrompt(
			{
				...request,
				supportLanguage: 'en',
				theme: 'Weekend plans',
				objective: 'Explain a plan and a reason.',
				grammar: { title: 'Future forms', focus: 'Choose a form that matches the plan.' },
				voiceTask: 'Discuss a weekend plan.',
				coaching: 'Ask one question at a time.',
				outputContract: {
					name: 'SESSION_JSON',
					schemaVersion: '1.1',
					instruction: 'Wait for the explicit output request.',
				},
			},
			getConversationProviderPreset('generic'),
		);
		expect(prompt).toContain('supportLanguage: en');
		expect(prompt).toContain('Trellune never sends data to an external AI automatically.');
		expect(prompt).not.toMatch(/[ぁ-んァ-ン一-龯]/u);
	});
});
