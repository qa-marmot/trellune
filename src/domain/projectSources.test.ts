import { describe, expect, it } from 'vitest';
import learnerProfile from '../../chatgpt-project-sources/01-learner-profile.md?raw';
import curriculumSource from '../../chatgpt-project-sources/03-curriculum.md?raw';
import boostPolicy from '../../chatgpt-project-sources/06-boost-study-policy.md?raw';
import manualSetup from '../../chatgpt-project-sources/CHATGPT_MANUAL_SETUP.md?raw';
import projectInstructions from '../../chatgpt-project-sources/PROJECT_INSTRUCTIONS.txt?raw';
import promptContract from '../../chatgpt-project-sources/07-prompt-contract.md?raw';

describe('ChatGPT Project Source parity', () => {
	it('describes the active 365-day product without legacy final-day assumptions', () => {
		expect(curriculumSource).toContain('| 361–365 | Graduation 23');
		expect(boostPolicy).toContain('現在の最終日Day 365');
		expect(
			[curriculumSource, boostPolicy, learnerProfile, projectInstructions].join('\n'),
		).not.toMatch(/現在の最終日Day (?:90|180|270)/u);
	});

	it('separates app-authored practice, integrated evidence and legacy spoken estimates', () => {
		expect(projectInstructions).toContain(
			'bundle-authored Reading, Writing, vocabulary or grammar',
		);
		expect(projectInstructions).toContain('Integrated Graduation Assessment');
		expect(projectInstructions).toContain('cefrEstimateScope: "spoken"');
		expect(learnerProfile).toContain('Listening、Reading、spoken interaction/production、Writing');
		expect(manualSetup).toContain('ASSESSMENT_JSON v1.0はSESSION_JSON v1.0とは別契約');
		expect(manualSetup).toContain('日数完了や`pass`だけでB2へしません');
	});

	it('keeps the Project source aligned with the provider-neutral prompt envelope', () => {
		expect(promptContract).toContain('LEARNING_CONVERSATION_REQUEST');
		expect(promptContract).toContain('provider-neutral');
		expect(promptContract).toContain('会話AIは「取込成功」と断言しません');
	});
});
