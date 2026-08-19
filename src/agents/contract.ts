import { z } from 'zod';
import { AVAILABLE_CURRICULUM_TOTAL_DAYS } from '../curriculum/constants';
import { BoostModeSchema } from '../lib/schemas';

export const LEARNING_CONVERSATION_CONTRACT_VERSION = '1.0' as const;

export const ConversationProviderIdSchema = z.enum(['chatgpt', 'claude', 'gemini', 'generic']);
export type ConversationProviderId = z.infer<typeof ConversationProviderIdSchema>;

export const CapabilityStatusSchema = z.enum(['tested', 'unverified', 'unsupported']);
export type CapabilityStatus = z.infer<typeof CapabilityStatusSchema>;

export const ConversationCapabilitiesSchema = z
	.object({
		textConversation: CapabilityStatusSchema,
		voiceConversation: CapabilityStatusSchema,
		structuredJsonOutput: CapabilityStatusSchema,
		systemInstructions: CapabilityStatusSchema,
		persistentProjectContext: CapabilityStatusSchema,
		fileContext: CapabilityStatusSchema,
	})
	.strict();
export type ConversationCapabilities = z.infer<typeof ConversationCapabilitiesSchema>;

export interface ConversationProviderPreset {
	readonly id: ConversationProviderId;
	readonly label: string;
	readonly testedStatus: 'tested' | 'unverified';
	readonly capabilities: ConversationCapabilities;
	readonly setupNoteJa: string;
}

const tested = 'tested' as const;
const unverified = 'unverified' as const;
const unsupported = 'unsupported' as const;

/**
 * These are manual-copy/paste presets, never runtime integrations. A capability
 * marked unverified is intentionally not a product promise.
 */
export const CONVERSATION_PROVIDER_PRESETS: readonly ConversationProviderPreset[] = Object.freeze([
	{
		id: 'chatgpt',
		label: 'ChatGPT',
		testedStatus: 'tested',
		capabilities: {
			textConversation: tested,
			voiceConversation: tested,
			structuredJsonOutput: tested,
			systemInstructions: tested,
			persistentProjectContext: tested,
			fileContext: tested,
		},
		setupNoteJa: 'プロンプトをテキストで送信して内容を確認してから、Voiceを開始してください。',
	},
	{
		id: 'claude',
		label: 'Claude',
		testedStatus: 'unverified',
		capabilities: {
			textConversation: unverified,
			voiceConversation: unverified,
			structuredJsonOutput: unverified,
			systemInstructions: unverified,
			persistentProjectContext: unverified,
			fileContext: unverified,
		},
		setupNoteJa:
			'通常のテキスト会話へプロンプトを貼り付けます。音声やJSONの利用可否は利用中の環境で確認してください。',
	},
	{
		id: 'gemini',
		label: 'Gemini',
		testedStatus: 'unverified',
		capabilities: {
			textConversation: unverified,
			voiceConversation: unverified,
			structuredJsonOutput: unverified,
			systemInstructions: unverified,
			persistentProjectContext: unverified,
			fileContext: unverified,
		},
		setupNoteJa:
			'通常のテキスト会話へプロンプトを貼り付けます。音声やJSONの利用可否は利用中の環境で確認してください。',
	},
	{
		id: 'generic',
		label: 'その他の会話AI',
		testedStatus: 'unverified',
		capabilities: {
			textConversation: unverified,
			voiceConversation: unverified,
			structuredJsonOutput: unverified,
			systemInstructions: unsupported,
			persistentProjectContext: unsupported,
			fileContext: unsupported,
		},
		setupNoteJa:
			'テキスト会話へそのまま貼り付けます。Voice対応は事前に確認し、未対応ならCore Voiceの代替とは扱いません。',
	},
]);

export function getConversationProviderPreset(
	id: ConversationProviderId,
): ConversationProviderPreset {
	const preset = CONVERSATION_PROVIDER_PRESETS.find((candidate) => candidate.id === id);
	if (!preset) throw new Error(`Unknown conversation provider preset: ${id}`);
	return preset;
}

const requiredText = (maximum: number) => z.string().trim().min(1).max(maximum);

export const LearningConversationRequestSchema = z
	.object({
		contractVersion: z.literal(LEARNING_CONVERSATION_CONTRACT_VERSION),
		sessionType: z.enum(['core', 'boost']),
		curriculumDay: z.number().int().min(1).max(AVAILABLE_CURRICULUM_TOTAL_DAYS),
		theme: requiredText(300),
		objective: requiredText(500),
		grammar: z.object({ title: requiredText(160), focus: requiredText(500) }).strict(),
		voiceTask: requiredText(1_000),
		coaching: requiredText(2_000),
		learnerContext: requiredText(100_000),
		boost: z
			.object({
				duration: z.union([z.literal(5), z.literal(15), z.literal(30), z.literal(60)]),
				mode: BoostModeSchema,
			})
			.strict()
			.optional(),
		outputContract: z
			.object({
				name: z.literal('SESSION_JSON'),
				schemaVersion: z.literal('1.0'),
				instruction: requiredText(1_000),
			})
			.strict(),
	})
	.strict()
	.superRefine((value, context) => {
		if (value.sessionType === 'core' && value.boost !== undefined) {
			context.addIssue({
				code: 'custom',
				path: ['boost'],
				message: 'Core learning conversations cannot carry Boost settings.',
			});
		}
		if (value.sessionType === 'boost' && value.boost === undefined) {
			context.addIssue({
				code: 'custom',
				path: ['boost'],
				message: 'Boost learning conversations require bounded Boost settings.',
			});
		}
	});

export type LearningConversationRequest = z.infer<typeof LearningConversationRequestSchema>;

function providerWorkflowNote(preset: ConversationProviderPreset): string {
	const voiceNote =
		preset.capabilities.voiceConversation === 'tested'
			? 'Voice対応はこのプリセットで確認済みです。テキスト送信後にVoiceを開始してください。'
			: preset.capabilities.voiceConversation === 'unverified'
				? 'Voice対応は未検証です。実際の利用可否を確認し、未対応ならCore Voiceの代替とは扱わないでください。'
				: 'Voice対応はこのプリセットの前提ではありません。Core Voiceの代替とは扱わないでください。';
	return `MANUAL_PROVIDER_WORKFLOW\npreset: ${preset.label}\nstatus: ${preset.testedStatus}\n${preset.setupNoteJa}\n${voiceNote}\nTrelluneは外部AIへ自動送信しません。`;
}

/**
 * Renders the portable learning request. Provider details are deliberately a
 * thin wrapper: the request itself contains no provider name or API contract.
 */
export function renderLearningConversationPrompt(
	request: LearningConversationRequest,
	preset: ConversationProviderPreset,
): string {
	// Requests are created from bundled curriculum and validated separately at
	// external boundaries. Keeping this renderer structural also lets the
	// checked-in prompt artifacts use their explicit placeholder tokens.
	const parsed = request;
	const boost = parsed.boost
		? `\nboostDuration: ${parsed.boost.duration}\nboostMode: ${parsed.boost.mode}`
		: '';
	return `Trellune LEARNING CONVERSATION\n\n${providerWorkflowNote(preset)}\n\nLEARNING_CONVERSATION_REQUEST\ncontractVersion: ${parsed.contractVersion}\nsessionType: ${parsed.sessionType}\ncurriculumDay: ${parsed.curriculumDay}\ntheme: ${parsed.theme}\nobjective: ${parsed.objective}\ngrammar: ${parsed.grammar.title} — ${parsed.grammar.focus}\nvoiceTask: ${parsed.voiceTask}${boost}\n\nVOICE_COACHING\n${parsed.coaching}\n\n${parsed.learnerContext}\n\nOUTPUT_REQUEST\n${parsed.outputContract.instruction}\n\n${parsed.outputContract.name} ${parsed.outputContract.schemaVersion} 要求後はJSONを1個だけ出力してください。Trellune側の検証を通るまで取込成功と断言しないでください。観察していない内容、未来日の完了、新規項目の上限超過を補わないでください。`;
}
