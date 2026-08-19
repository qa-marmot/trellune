import type { BoostMode } from '../lib/schemas';

export interface BoostRecommendationInput {
	overdueReviewCount: number;
	oldestOverdueDays?: number;
	repeatedMistakeCount: number;
	repeatedMistakeInLatestSession?: boolean;
	recentInteractionScores?: readonly number[];
	recentGrammarScores?: readonly number[];
	selectedMode?: BoostMode;
}

export interface BoostRecommendation {
	mode: BoostMode;
	reason: string;
}

function recentAverage(values: readonly number[] | undefined): number | null {
	const recent = values?.slice(-3) ?? [];
	if (!recent.length) return null;
	return recent.reduce((total, value) => total + value, 0) / recent.length;
}

export function recommendBoost(input: BoostRecommendationInput): BoostRecommendation {
	const reviewRescue = input.overdueReviewCount >= 10 || (input.oldestOverdueDays ?? 0) >= 3;
	const weakness = input.repeatedMistakeCount >= 3;
	if (input.overdueReviewCount >= 25) {
		return {
			mode: 'review_rescue',
			reason: '期限切れが25件以上あるため、学習負荷を先に下げます。',
		};
	}
	if (weakness && input.repeatedMistakeInLatestSession) {
		return {
			mode: 'weakness_attack',
			reason: '直近セッションでも反復ミスが出たため、先に修復します。',
		};
	}
	if (reviewRescue) {
		return { mode: 'review_rescue', reason: '期限切れが10件以上、または最古期限が3日以上前です。' };
	}
	if (weakness) {
		return { mode: 'weakness_attack', reason: '同じ正規化ミスが3回以上記録されています。' };
	}
	if ((recentAverage(input.recentInteractionScores) ?? 5) < 3) {
		return { mode: 'speaking_sprint', reason: '直近3セッションのやり取り評価を補強します。' };
	}
	if ((recentAverage(input.recentGrammarScores) ?? 5) < 3) {
		return { mode: 'grammar_deep_dive', reason: '直近3セッションの文法評価を補強します。' };
	}
	return {
		mode: input.selectedMode ?? 'scenario_challenge',
		reason: input.selectedMode ? '前回の選択を維持します。' : '既習範囲を場面会話で統合します。',
	};
}

export function recommendBoostMode(input: BoostRecommendationInput): BoostMode {
	return recommendBoost(input).mode;
}
