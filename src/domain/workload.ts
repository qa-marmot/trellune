import type { CurriculumStage } from '../curriculum/model';

export interface StudyWorkload {
	preferredMinutes: number;
	minimumCoreMinutes: CurriculumStage['timeGuidance']['minimumCoreMinutes'];
	recommendedMinutes: CurriculumStage['timeGuidance']['recommendedMinutes'];
	preferredBudgetIsShort: boolean;
}

export function studyWorkload(stage: CurriculumStage, preferredMinutes: number): StudyWorkload {
	return {
		preferredMinutes,
		minimumCoreMinutes: stage.timeGuidance.minimumCoreMinutes,
		recommendedMinutes: stage.timeGuidance.recommendedMinutes,
		preferredBudgetIsShort: preferredMinutes < stage.timeGuidance.minimumCoreMinutes[0],
	};
}
