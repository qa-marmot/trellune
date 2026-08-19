import { expect, test } from '@playwright/test';

test.beforeEach(async ({ page }) => {
	await page.goto('/onboarding');
	await page.getByLabel('呼ばれたい名前').fill('Assessment Learner');
	await page.getByRole('button', { name: /ベースラインへ/ }).click();
	await page.getByRole('button', { name: /Day 1を始める/ }).click();
});

test('starts, previews, imports and reloads a Foundation Stage Assessment', async ({
	page,
	context,
}) => {
	await context.grantPermissions(['clipboard-read', 'clipboard-write']);
	await page.goto('/curriculum');
	await page.getByRole('button', { name: 'Stage Assessment' }).click();
	await expect(page.getByRole('heading', { level: 1, name: 'Stage Assessment' })).toBeVisible();
	await page.getByRole('button', { name: 'Assessmentを開始' }).click();

	const prompt = await page.locator('.prompt-panel pre').innerText();
	const attemptId = /Attempt ID: ([0-9a-f-]+)/u.exec(prompt)?.[1];
	expect(attemptId).toMatch(/^[0-9a-f-]{36}$/u);
	expect(prompt).toContain('Required skills: grammar, vocabulary, speaking, interaction');
	await page.getByRole('button', { name: /コピー$/ }).click();
	await expect(page.getByRole('button', { name: /コピー済み/ })).toBeVisible();

	const assessment = {
		schemaVersion: '1.0',
		assessmentId: 'english-os-stage-assessment-foundation-v1',
		attemptId,
		assessmentType: 'stage',
		stageId: 'english-os-core-stage-foundation-a1-a2',
		curriculumRange: { startDay: 1, endDay: 90 },
		completedAt: '2026-08-13T10:00:00+09:00',
		result: 'provisional',
		scores: { grammar: 4, vocabulary: 3, speaking: 4, interaction: 3, pronunciation: 2 },
		strengths: ['短い説明を続けられる'],
		reinforcementTargets: ['過去形の精度'],
		evidence: [{ skill: 'grammar', note: '過去形を概ね正しく使えた。' }],
		nextTargets: ['理由を添えて答える'],
	};
	await page.getByLabel('会話AIが返したASSESSMENT_JSON').fill(JSON.stringify(assessment));
	await page.getByRole('button', { name: '検証してプレビュー' }).click();
	await expect(page.getByText('暫定評価', { exact: true })).toBeVisible();
	await expect(page.getByText(/文法 4\/5.*発音 2\/5/u)).toBeVisible();
	await page.getByRole('button', { name: 'Assessmentを保存' }).click();
	await expect(page.getByText('Stage Assessmentを保存しました。')).toBeVisible();
	await expect(page.getByRole('heading', { name: 'Attempt history' })).toBeVisible();
	await expect(page.getByText('短い説明を続けられる')).toBeVisible();

	await page.reload();
	await expect(page.getByText('短い説明を続けられる')).toBeVisible();
	await page.goto('/today');
	await expect(page.getByRole('heading', { name: '今日のCore' })).toBeVisible();
});

test('imports the Independent Stage Assessment at Day 180 without locking Core', async ({
	page,
}) => {
	await page.evaluate(
		() =>
			new Promise<void>((resolve, reject) => {
				const request = indexedDB.open('english-os');
				request.onerror = () => reject(request.error);
				request.onsuccess = () => {
					const database = request.result;
					const transaction = database.transaction(
						['learnerProfiles', 'dailyProgress', 'metadata'],
						'readwrite',
					);
					const profileStore = transaction.objectStore('learnerProfiles');
					const profileRequest = profileStore.get('current');
					profileRequest.onsuccess = () =>
						profileStore.put({
							...profileRequest.result,
							currentDay: 180,
							startDate: '2026-01-01',
						});
					const progressStore = transaction.objectStore('dailyProgress');
					progressStore.clear();
					for (let day = 1; day < 180; day += 1) {
						const studyDate = new Date(Date.UTC(2026, 0, day)).toISOString().slice(0, 10);
						progressStore.put({
							id: `study:${studyDate}:curriculum:${day}`,
							studyDate,
							curriculumDay: day,
							reviewsCompleted: true,
							grammarCompleted: true,
							coreSessionImported: true,
							coreCompleted: true,
							version: 1,
							updatedAt: '2026-08-13T00:00:00.000Z',
						});
					}
					const todayParts = new Intl.DateTimeFormat('en-CA', {
						timeZone: 'Asia/Tokyo',
						year: 'numeric',
						month: '2-digit',
						day: '2-digit',
					}).formatToParts(new Date());
					const todayValues = Object.fromEntries(todayParts.map((part) => [part.type, part.value]));
					const today = `${todayValues.year}-${todayValues.month}-${todayValues.day}`;
					progressStore.put({
						id: `study:${today}:curriculum:180`,
						studyDate: today,
						curriculumDay: 180,
						reviewsCompleted: false,
						grammarCompleted: false,
						coreSessionImported: false,
						coreCompleted: false,
						version: 1,
						updatedAt: new Date().toISOString(),
					});
					transaction.objectStore('metadata').put({
						key: 'activeCurriculumTotalDays',
						value: 180,
						updatedAt: '2026-08-13T00:00:00.000Z',
					});
					transaction.oncomplete = () => {
						database.close();
						resolve();
					};
					transaction.onerror = () => reject(transaction.error);
					transaction.onabort = () => reject(transaction.error);
				};
			}),
	);
	await page.goto('/assessment');
	const seededState = await page.evaluate(
		() =>
			new Promise<{ activeTotalDays: unknown; currentDay: unknown; progressDays: number[] }>(
				(resolve, reject) => {
					const request = indexedDB.open('english-os');
					request.onerror = () => reject(request.error);
					request.onsuccess = () => {
						const database = request.result;
						const transaction = database.transaction(
							['learnerProfiles', 'dailyProgress', 'metadata'],
							'readonly',
						);
						const profile = transaction.objectStore('learnerProfiles').get('current');
						const progress = transaction.objectStore('dailyProgress').getAll();
						const active = transaction.objectStore('metadata').get('activeCurriculumTotalDays');
						transaction.oncomplete = () => {
							database.close();
							resolve({
								activeTotalDays: active.result?.value,
								currentDay: profile.result?.currentDay,
								progressDays: progress.result.map(
									(item: { curriculumDay: number }) => item.curriculumDay,
								),
							});
						};
						transaction.onerror = () => reject(transaction.error);
						transaction.onabort = () => reject(transaction.error);
					};
				},
			),
	);
	expect(seededState.activeTotalDays).toBe(180);
	expect(seededState.currentDay).toBe(180);
	expect(seededState.progressDays).toHaveLength(180);
	expect(seededState.progressDays).toContain(180);
	await expect(page.getByRole('heading', { name: 'Independent Stage Assessment' })).toBeVisible();
	await page.getByRole('button', { name: 'Assessmentを開始' }).click();
	const prompt = await page.locator('.prompt-panel pre').innerText();
	const attemptId = /Attempt ID: ([0-9a-f-]+)/u.exec(prompt)?.[1];
	expect(prompt).toContain('Curriculum range: Day 91-180');
	expect(prompt).toContain(
		'Required skills: grammar, vocabulary, speaking, interaction, listening, fluency',
	);
	const assessment = {
		schemaVersion: '1.0',
		assessmentId: 'english-os-stage-assessment-independent-v1',
		attemptId,
		assessmentType: 'stage',
		stageId: 'english-os-core-stage-independent-a2-b1-entry',
		curriculumRange: { startDay: 91, endDay: 180 },
		completedAt: '2026-08-13T10:00:00+09:00',
		result: 'reinforcement-recommended',
		scores: { grammar: 4, vocabulary: 4, speaking: 3, interaction: 4, listening: 3, fluency: 3 },
		strengths: ['理由と例を加えられる'],
		reinforcementTargets: ['自然速度の聞き返し'],
		evidence: [{ skill: 'interaction', note: '言い換えで会話を修復した。' }],
		nextTargets: ['8分会話を安定させる'],
	};
	await page.getByLabel('会話AIが返したASSESSMENT_JSON').fill(JSON.stringify(assessment));
	await page.getByRole('button', { name: '検証してプレビュー' }).click();
	await expect(page.getByText('補強を推奨', { exact: true })).toBeVisible();
	await page.getByRole('button', { name: 'Assessmentを保存' }).click();
	const attemptHistory = page.getByRole('region', { name: 'Attempt history' });
	await expect(attemptHistory.getByText('理由と例を加えられる', { exact: true })).toBeVisible();
	await page.reload();
	await expect(attemptHistory.getByText('理由と例を加えられる', { exact: true })).toBeVisible();
	await page.goto('/today');
	await expect(page.getByRole('heading', { name: '今日のCore' })).toBeVisible();
});

test('imports and reloads the Fluency Stage Assessment at Day 270 without certification or Core lock', async ({
	page,
}) => {
	await page.evaluate(
		() =>
			new Promise<void>((resolve, reject) => {
				const request = indexedDB.open('english-os');
				request.onerror = () => reject(request.error);
				request.onsuccess = () => {
					const database = request.result;
					const transaction = database.transaction(
						['learnerProfiles', 'dailyProgress', 'metadata'],
						'readwrite',
					);
					const profileStore = transaction.objectStore('learnerProfiles');
					const profileRequest = profileStore.get('current');
					profileRequest.onsuccess = () =>
						profileStore.put({
							...profileRequest.result,
							currentDay: 270,
							startDate: '2025-11-01',
						});
					const progressStore = transaction.objectStore('dailyProgress');
					progressStore.clear();
					for (let day = 1; day < 270; day += 1) {
						const studyDate = new Date(Date.UTC(2025, 10, day)).toISOString().slice(0, 10);
						progressStore.put({
							id: `study:${studyDate}:curriculum:${day}`,
							studyDate,
							curriculumDay: day,
							reviewsCompleted: true,
							grammarCompleted: true,
							coreSessionImported: true,
							coreCompleted: true,
							version: 1,
							updatedAt: '2026-08-14T00:00:00.000Z',
						});
					}
					transaction.objectStore('metadata').put({
						key: 'activeCurriculumTotalDays',
						value: 270,
						updatedAt: '2026-08-14T00:00:00.000Z',
					});
					transaction.oncomplete = () => {
						database.close();
						resolve();
					};
					transaction.onerror = () => reject(transaction.error);
					transaction.onabort = () => reject(transaction.error);
				};
			}),
	);
	await page.goto('/assessment');
	await expect(page.getByRole('heading', { name: 'Fluency Stage Assessment' })).toBeVisible();
	await page.getByRole('button', { name: 'Assessmentを開始' }).click();
	const prompt = await page.locator('.prompt-panel pre').innerText();
	const attemptId = /Attempt ID: ([0-9a-f-]+)/u.exec(prompt)?.[1];
	expect(prompt).toContain('Curriculum range: Day 181-270');
	expect(prompt).toContain(
		'Required skills: speaking, interaction, fluency, grammar, vocabulary, listening',
	);
	expect(prompt).toContain('do not claim that a pass automatically certifies CEFR');
	const assessment = {
		schemaVersion: '1.0',
		assessmentId: 'english-os-stage-assessment-fluency-v1',
		attemptId,
		assessmentType: 'stage',
		stageId: 'english-os-core-stage-fluency-b1-b1-plus',
		curriculumRange: { startDay: 181, endDay: 270 },
		completedAt: '2026-08-14T10:00:00+09:00',
		result: 'pass',
		scores: { speaking: 4, interaction: 4, fluency: 3, grammar: 4, vocabulary: 4, listening: 3 },
		strengths: ['要約して言い換えられる'],
		reinforcementTargets: ['自然速度のdetail理解'],
		evidence: [{ skill: 'fluency', note: '長い発話をrepairしながら継続した。' }],
		nextTargets: ['clarificationを早める'],
	};
	await page.getByLabel('会話AIが返したASSESSMENT_JSON').fill(JSON.stringify(assessment));
	await page.getByRole('button', { name: '検証してプレビュー' }).click();
	await expect(page.getByText('Pass', { exact: true })).toBeVisible();
	await page.getByRole('button', { name: 'Assessmentを保存' }).click();
	const history = page.getByRole('region', { name: 'Attempt history' });
	await expect(history.getByText('要約して言い換えられる', { exact: true })).toBeVisible();
	await page.reload();
	await expect(history.getByText('要約して言い換えられる', { exact: true })).toBeVisible();
	await expect(page.getByText(/certif/iu)).toHaveCount(0);
	await page.goto('/today');
	await expect(page.getByRole('heading', { name: '今日のCore' })).toBeVisible();
});

test('imports and reloads the Graduation Assessment with an evidence-based estimate and no automatic B2', async ({
	page,
}) => {
	await page.evaluate(
		() =>
			new Promise<void>((resolve, reject) => {
				const request = indexedDB.open('english-os');
				request.onerror = () => reject(request.error);
				request.onsuccess = () => {
					const database = request.result;
					const transaction = database.transaction(
						['learnerProfiles', 'dailyProgress', 'metadata'],
						'readwrite',
					);
					const profileStore = transaction.objectStore('learnerProfiles');
					const profileRequest = profileStore.get('current');
					profileRequest.onsuccess = () =>
						profileStore.put({ ...profileRequest.result, currentDay: 365 });
					const progressStore = transaction.objectStore('dailyProgress');
					progressStore.clear();
					for (let day = 1; day < 365; day += 1) {
						const studyDate = new Date(Date.UTC(2025, 0, day)).toISOString().slice(0, 10);
						progressStore.put({
							id: `study:${studyDate}:curriculum:${day}`,
							studyDate,
							curriculumDay: day,
							reviewsCompleted: true,
							grammarCompleted: true,
							coreSessionImported: true,
							coreCompleted: true,
							version: 1,
							updatedAt: '2026-08-14T00:00:00.000Z',
						});
					}
					transaction.objectStore('metadata').put({
						key: 'activeCurriculumTotalDays',
						value: 365,
						updatedAt: '2026-08-14T00:00:00.000Z',
					});
					transaction.oncomplete = () => {
						database.close();
						resolve();
					};
					transaction.onerror = () => reject(transaction.error);
				};
			}),
	);
	await page.goto('/assessment');
	await expect(
		page.getByRole('heading', { name: 'Integrated Graduation Assessment' }),
	).toBeVisible();
	await page.getByRole('button', { name: 'Assessmentを開始' }).click();
	const prompt = await page.locator('.prompt-panel pre').innerText();
	const attemptId = /Attempt ID: ([0-9a-f-]+)/u.exec(prompt)?.[1];
	expect(prompt).toContain('Curriculum range: Day 271-365');
	expect(prompt).toContain('Curriculum completion and pass status alone must never determine it');
	expect(prompt).toContain('INTEGRATED READING TASK');
	expect(prompt).toContain('INTEGRATED WRITING TASK');
	expect(prompt).toContain('Required length: 180-250 words');
	expect(prompt).toContain('SKILL SCORE RUBRIC');
	expect(prompt).toContain('Never average away a weak mode');
	await expect(page.getByText('1–5 rubricとCEFR推定条件を確認')).toBeVisible();
	const assessment = {
		schemaVersion: '1.0',
		assessmentId: 'english-os-stage-assessment-graduation-integrated-v2',
		attemptId,
		assessmentType: 'stage',
		stageId: 'english-os-core-stage-b2-challenge-b1-plus-b2',
		curriculumRange: { startDay: 271, endDay: 365 },
		completedAt: '2026-08-14T10:00:00+09:00',
		result: 'pass',
		cefrEstimate: 'B2-entry',
		cefrEstimateScope: 'integrated',
		scores: {
			speaking: 4,
			interaction: 4,
			fluency: 4,
			grammar: 4,
			vocabulary: 4,
			listening: 3,
			reading: 4,
			writing: 3,
		},
		strengths: ['長い議論で立場と根拠を保てる'],
		reinforcementTargets: ['自然速度での暗示理解'],
		evidence: [
			{ skill: 'speaking', note: '立場、根拠、反論をつないで説明した。' },
			{ skill: 'interaction', note: '反論を要約して応答した。' },
			{ skill: 'fluency', note: '長い応答を大きく止めずに続けた。' },
			{ skill: 'grammar', note: '条件と譲歩を複数の形で表した。' },
			{ skill: 'vocabulary', note: '課題語彙を言い換えながら使った。' },
			{ skill: 'listening', note: '要点と話者のstanceを区別した。' },
			{ skill: 'reading', note: '本文の根拠から推論を説明した。' },
			{ skill: 'writing', note: '反論を認めた上で提案を構成した。' },
		],
		nextTargets: ['推測の確度をより正確に表す'],
	};
	await page.getByLabel('会話AIが返したASSESSMENT_JSON').fill(JSON.stringify(assessment));
	await page.getByRole('button', { name: '検証してプレビュー' }).click();
	await expect(page.getByText('統合8技能CEFR推定（認定ではありません）')).toBeVisible();
	await expect(page.getByText('B2-entry', { exact: true })).toBeVisible();
	await page.getByRole('button', { name: 'Assessmentを保存' }).click();
	const history = page.getByRole('region', { name: 'Attempt history' });
	await expect(history.getByText(/統合8技能CEFR推定 B2-entry/u)).toBeVisible();
	await page.reload();
	await expect(history.getByText(/統合8技能CEFR推定 B2-entry/u)).toBeVisible();
	await page.goto('/today');
	await expect(page.getByRole('heading', { name: '今日のCore' })).toBeVisible();
});
