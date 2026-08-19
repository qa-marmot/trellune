import { expect, test, type Page } from '@playwright/test';
import { completeDayOneGrammarPractice } from './practice-helpers';

const baseline = {
	confidence: 3,
	taskCompletion: 4,
	grammar: 3,
	vocabulary: 4,
	fluency: 3,
	interaction: 4,
	strengths: ['短い文で答えられる'],
	priorities: ['聞き返しを増やす'],
};

function coreSession() {
	return {
		schemaVersion: '1.0',
		sessionId: crypto.randomUUID(),
		sessionType: 'core',
		curriculumDay: 1,
		occurredAt: new Date().toISOString(),
		durationMinutes: 10,
		boost: null,
		summaryJa: 'Coreの実画面受入テスト',
		evaluation: {
			taskCompletion: 4,
			grammar: 4,
			vocabulary: 4,
			fluency: 4,
			interaction: 4,
			commentJa: '回帰テスト用の合成評価です。',
		},
		mistakes: [],
		newVocabulary: [],
		newPhrases: [],
		previewGrammar: [],
		reviewCards: [],
	};
}

async function openBaseline(page: Page): Promise<void> {
	await page.goto('/onboarding');
	await page.getByLabel('呼ばれたい名前').fill('Flow Learner');
	await page.getByRole('button', { name: /ベースラインへ/ }).click();
	await expect(page.getByRole('heading', { name: '話し始める前の記録' })).toBeVisible();
}

test('dedicated baseline JSON flow previews, saves and rejects a duplicate', async ({ page }) => {
	await openBaseline(page);
	const source = `RAW_BASELINE_PROSE_MUST_NOT_PERSIST\n\`\`\`json\n${JSON.stringify(baseline)}\n\`\`\``;
	await page.getByLabel('会話AIが返したベースラインJSON').fill(source);
	await page.getByRole('button', { name: '検証してプレビュー' }).click();
	await expect(page.getByText(/保存前は端末データを変更していません/)).toBeVisible();
	await page.getByRole('button', { name: '評価を保存してDay 1へ' }).click();
	await expect(page).toHaveURL(/\/today$/);

	const stored = await page.evaluate(
		() =>
			new Promise<string>((resolve, reject) => {
				const request = indexedDB.open('english-os');
				request.onerror = () => reject(request.error);
				request.onsuccess = () => {
					const database = request.result;
					const transaction = database.transaction('assessments', 'readonly');
					const get = transaction.objectStore('assessments').get('baseline:current');
					get.onsuccess = () => resolve(JSON.stringify(get.result));
					get.onerror = () => reject(get.error);
					transaction.oncomplete = () => database.close();
				};
			}),
	);
	expect(stored).not.toContain('RAW_BASELINE_PROSE_MUST_NOT_PERSIST');

	await page.goto('/baseline');
	await page.getByLabel('会話AIが返したベースラインJSON').fill(JSON.stringify(baseline));
	await page.getByRole('button', { name: '検証してプレビュー' }).click();
	await page.getByRole('button', { name: '評価を保存してDay 1へ' }).click();
	await expect(page.getByRole('alert')).toContainText('同じベースライン評価は保存済み');
});

test('the complete Core UI flow unlocks the selected Boost without prompt-copy evidence', async ({
	page,
}) => {
	await openBaseline(page);
	await page.getByRole('button', { name: /Day 1を始める/ }).click();

	await page.goto('/reviews');
	await expect(page.getByText('今日が期限のカードはありません。復習は完了です。')).toBeVisible();
	await page.goto('/grammar');
	await completeDayOneGrammarPractice(page);

	await page.goto('/voice');
	await expect(page.getByLabel('コピーする会話AIプロンプト')).toContainText('sessionType: core');
	await page.goto('/today');
	await expect(page.getByRole('button', { name: /Core会話と結果取込 · 未完了/ })).toBeVisible();
	await expect(page.getByRole('button', { name: 'Boostを選ぶ' })).toBeDisabled();

	await page.goto('/import');
	await page.getByLabel('会話AIが返したJSON').fill(JSON.stringify(coreSession()));
	await page.getByRole('button', { name: '検証してプレビュー' }).click();
	await page.getByRole('button', { name: 'この内容を保存' }).click();
	await expect(page.getByRole('status')).toContainText('セッションを保存しました');
	await page.goto('/today');
	await expect(page.getByRole('button', { name: 'Boostを選ぶ' })).toBeEnabled();
	await expect(page.getByLabel('Core 3/3 完了')).toBeVisible();

	await page.getByRole('button', { name: 'Boostを選ぶ' }).click();
	await page.getByRole('button', { name: /30/ }).click();
	await page.getByRole('button', { name: /Weakness Attack/ }).click();
	await page.getByRole('button', { name: 'Boostプロンプトを作る' }).click();
	await expect(page.getByLabel('コピーする会話AIプロンプト')).toContainText('boostDuration: 30');
	await expect(page.getByLabel('コピーする会話AIプロンプト')).toContainText(
		'boostMode: weakness_attack',
	);

	const studyDate = await page.evaluate(() => {
		const parts = new Intl.DateTimeFormat('en-US', {
			timeZone: 'Asia/Tokyo',
			year: 'numeric',
			month: '2-digit',
			day: '2-digit',
		}).formatToParts(new Date());
		const value = Object.fromEntries(parts.map((part) => [part.type, part.value]));
		return `${value.year}-${value.month}-${value.day}`;
	});
	await page.evaluate(
		({ date }) =>
			new Promise<void>((resolve, reject) => {
				const request = indexedDB.open('english-os');
				request.onerror = () => reject(request.error);
				request.onsuccess = () => {
					const database = request.result;
					const transaction = database.transaction(
						['acquisitionEvents', 'grammarProgress'],
						'readwrite',
					);
					transaction.objectStore('grammarProgress').put({
						id: 'preview:d2-grammar',
						curriculumDay: 2,
						status: 'previewed',
						updatedAt: new Date().toISOString(),
					});
					transaction.objectStore('acquisitionEvents').put({
						eventId: 'preview-limit-fixture',
						studyDate: date,
						kind: 'grammar-preview',
						entityId: 'd2-grammar',
						createdAt: new Date().toISOString(),
					});
					transaction.oncomplete = () => {
						database.close();
						resolve();
					};
					transaction.onerror = () => reject(transaction.error);
				};
			}),
		{ date: studyDate },
	);
	await page.goto('/voice?mode=boost-15&boost=next_lesson_preview');
	await expect(page).toHaveURL(/\/boost$/u);
});

test('clipboard denial keeps manual copy and paste recovery available', async ({ page }) => {
	await openBaseline(page);
	await page.getByRole('button', { name: /Day 1を始める/ }).click();
	await page.goto('/voice');
	await page.evaluate(() => {
		Object.defineProperty(navigator, 'clipboard', {
			configurable: true,
			value: {
				readText: () => Promise.reject(new DOMException('Denied', 'NotAllowedError')),
				writeText: () => Promise.reject(new DOMException('Denied', 'NotAllowedError')),
			},
		});
	});
	await page.getByRole('button', { name: 'コピー' }).click();
	await expect(page.getByRole('alert')).toContainText('手動でコピー');
	await expect(page.getByLabel('コピーする会話AIプロンプト')).toBeVisible();

	await page.goto('/import');
	await page.evaluate(() => {
		Object.defineProperty(navigator, 'clipboard', {
			configurable: true,
			value: {
				readText: () => Promise.reject(new DOMException('Denied', 'NotAllowedError')),
				writeText: () => Promise.reject(new DOMException('Denied', 'NotAllowedError')),
			},
		});
	});
	const editor = page.getByLabel('会話AIが返したJSON');
	await editor.fill('manual input remains');
	await page.getByRole('button', { name: 'クリップボード読込' }).click();
	await expect(page.getByRole('alert')).toContainText('直接貼り付けてください');
	await expect(editor).toHaveValue('manual input remains');
});

test('labels unverified conversation-provider Voice capability without changing the JSON trust boundary', async ({
	page,
}) => {
	await openBaseline(page);
	await page.getByRole('button', { name: /Day 1を始める/ }).click();
	await page.goto('/voice');

	await page.getByLabel('会話AIプリセット').selectOption('claude');
	await expect(page.getByText('このプリセットのVoice対応は未検証です。')).toBeVisible();
	const prompt = page.getByLabel('コピーする会話AIプロンプト');
	await expect(prompt).toContainText('preset: Claude');
	await expect(prompt).toContainText('SESSION_JSON 1.0');
	await expect(prompt).not.toContainText('ChatGPT');
});
