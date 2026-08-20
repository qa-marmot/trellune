# テスト戦略

Stage Assessmentは、runtime/published schema parity、definition別required skills、単一JSON候補の厳格解析、IndexedDBの冪等性、sync outbox経路、backup v2 lossless round-trip、D1 fresh/upgrade migration parity、Worker CAS/replay/stale拒否、および1本のPlaywright copy/preview/import/reload flowで検証する。画面テストはどのresultからもCoreへ戻れることも確認する。

最終更新: 2026-08-20

## 1. 目的

テストは、英語学習の正しさだけでなく、Core/Boost境界、日次上限、二重取込、オフライン再送、後方互換、アクセシビリティ、本番承認境界を継続的に保証する。詳細な期待結果は[ACCEPTANCE_CRITERIA.md](./ACCEPTANCE_CRITERIA.md)を正とする。

## 2. テスト層

| 層               | 対象                                               | 実行基盤                   | 必須例                                      |
| ---------------- | -------------------------------------------------- | -------------------------- | ------------------------------------------- |
| 静的             | strict TypeScript、ESLint、Prettier、禁止API/秘密  | CI                         | `pnpm typecheck`、`pnpm lint`、format check |
| Unit             | 純粋ドメイン、日付、上限、復習、parser、Zod        | Vitest                     | Core真理値表、8/3/1境界、重複key            |
| Component        | Reactの状態・入力・a11y                            | Testing Library + jsdom    | エラー関連付け、keyboard、状態文言          |
| Integration      | IndexedDB、repository、D1、Hono、同期、transaction | Vitest/Workers pool        | rollback、migration、idempotency、競合      |
| E2E              | 主要ユーザーフロー、PWA、offline                   | Playwright Chromium        | onboarding→Core、Boost、import、backup      |
| Accessibility    | 自動・手動                                         | axe-core、Playwright、NVDA | 主要画面、ズーム、フォーカス、読み上げ      |
| Security/privacy | 境界、headers、artifact/log検査                    | integration + review       | Access拒否、ログredaction、秘密scan         |
| Recovery         | 更新・復元・ロールバック                           | Playwright + D1 fixture    | 旧版DB、壊れたbackup、同期中断              |

## 3. テスト設計原則

- テストは現在時刻、タイムゾーン、乱数、network、UUIDを注入可能にし、固定fixtureで再現する。
- 学習日の境界は`Asia/Tokyo`、UTC、夏時間のあるタイムゾーンで検証する。
- happy pathだけでなく、各永続化境界に失敗注入し、部分更新がないことを検証する。
- UIテストで内部実装を過度にmockせず、利用者が認識する名前・役割・状態を操作する。
- snapshotだけで正しさを判定しない。ドメイン不変条件を明示的にassertする。
- 実学習データ、メール、token、貼り付け原文をfixture、trace、screenshot、CI artifactへ入れない。
- flakeを単純な再実行で隠さない。再実行結果と根本原因を記録し、タイミング依存を除去する。

## 4. 最優先の自動テスト

### 4.1 Core/Boost不変条件

- 必須復習×文法×Core Voiceの全8組み合わせ。
- 必須復習0件、日付跨ぎ、遅延同期、重複イベント、順不同イベント。
- Boostだけ、previewだけ、週次評価だけではCore完了しない。
- Core完了の再計算と保存済み集計が一致する。
- Boost未実施は欠席・失敗・連続中断として扱われない。

### 4.2 日次上限

- 0、上限-1、上限、上限+1、重複項目、同一取込内重複。
- 単語の大文字小文字、Unicode正規化、全角/半角、前後空白の同一性規則。
- 2端末のオフライン操作を統合したときの超過競合。
- 上限到達後も復習・会話・既存項目更新が可能。

### 4.3 JSON Bridge

- 正常な全契約fixtureと、各必須フィールドを1つずつ欠落させたfixture。
- 生JSON、コードフェンス、BOM、単一コードフェンス前後の説明文、複数候補、破損、深すぎる/大きすぎる入力。
- 未知の契約版、Core/Boost不一致、未来/過去日、参照切れ、非有限数、危険なキー。
- 同一外部ID/同一hash、別ID/同一hash、同一ID/別hash。
- プレビュー前、確認前、transaction失敗時に永続化副作用が0。
- 手動修正後に全検証を再実行する。

### 4.4 同期・D1

- create/updateイベントを5回再送しても1回分と一致。
- request成功後response喪失、batch途中切断、逆順到着、欠落ack。
- 401、403、409、413、429、500、network timeoutのUIとqueue状態。
- 旧版ローカルschema/backup/API契約の後方互換。
- 空DBへの全migrationと、各既知旧版fixtureからのupgrade。
- SQL injection文字列を入力してもbind値として保存/拒否され、SQL構造が変わらない。

### 4.5 復元・認証・契約一致

- 復元前にremote inventory/versionを取得し、backupにないremote entityへ正しいbase versionのtombstoneを作る。
- paginated pull中断時はreconciliation markerと最後に確定したcursorを保持し、再試行で収束する。
- JWKS cache hit/miss/期限切れ/同時fetch/key rotation/unknown `kid`/network failure/巨大・不正応答を検証し、失敗時はfail closedとする。
- 公開JSON Schemaとruntime Zodへ同じvalid/invalid fixtureを入力し、UUID v4、Core/Boost、Boost durationの判定一致を固定する。

## 5. Playwrightプロジェクト

最低限`chromium`をCI blockingとし、ローカル/リリース候補では追加ブラウザを実行する。

| Project         | Viewport/条件            | 用途         | CI           |
| --------------- | ------------------------ | ------------ | ------------ |
| `chromium`      | Desktop既定              | 全E2E        | 必須         |
| `mobile-chrome` | Pixel 7相当              | 全主要フロー | リリース必須 |
| `mobile-safari` | iPhone相当               | WebKit互換   | リリース必須 |
| `offline`       | mobile + context offline | PWA/queue    | 必須         |
| `a11y`          | chromium                 | 主要画面axe  | 必須         |

CIはブラウザ実行前に次を行う。

```text
pnpm exec playwright install --with-deps chromium
pnpm playwright test
```

テスト用webServerはproduction buildまたはCloudflare local runtimeを使用し、Playwrightが起動・終了を管理する。専用検証scriptはOS割当の空きportを使用し、既存プロセスをCIで再利用しない。

### 必須E2E

1. onboarding → baseline skip → Today。
2. 復習 → 文法 → Core prompt → 有効JSON import → Core完了。
3. Core未完了でBoost blocked、完了後に全時間/モード選択。
4. preview import後も未来Core未完了。
5. 不正JSON修正、重複、上限超過、transaction失敗。
6. offlineでCore操作 → reload → reconnect → 1回同期。
7. backup作成 → 別状態へ復元 → 集計一致。
8. service worker更新通知と安全な再読込。
9. onboardingの空欄/IANAエラー、履歴filter/deep link、アプリ内reduced motion、端末削除の二段階確認、削除後再読込、通信中のremote pullより端末削除が優先されること。
10. 未取得URLをofflineで開き、専用説明と取得済みTodayへの導線を確認する。
11. normalized IndexedDBを逆順・重複/replay・skipped day付きで作り、実startup hydrationから履歴/分析/Core集計を再構築する。
12. 1/7/30/90/365日fixtureでnavigation、FCP、ready、DOM、heap（取得可能時）、record数を記録する。承認されていない絶対閾値は追加しない。

## 6. アクセシビリティ検証

### 自動

- `@axe-core/playwright`でonboarding、Today、復習、文法、Voice、import、Boost、履歴、分析、backup、設定を検査する。
- critical/seriousを0件のblocking条件にする。moderate/minorもissue化し、誤検知除外には根拠と最小範囲を必要とする。
- component testでaccessible name、description、error association、live regionを検証する。

### 手動（リリース候補ごと）

- キーボードのみ: Tab/Shift+Tab、Enter/Space、Escape、フォーカス復帰、skip link。
- NVDA + Chrome/Edge: 見出し、landmark、フォーム、エラー、進捗、同期/取込通知。
- 320 CSS px、200%ズーム、OS文字拡大、縦横、ソフトウェアキーボード。
- 明色/暗色、高コントラスト、`prefers-reduced-motion`。
- タップ対象寸法と危険操作間隔。

記録には環境、画面、手順、結果、問題IDを含める。個人データ入りscreenshotを添付しない。

## 7. 性能・容量

- fixture規模: day 90、語彙800、表現150、セッション1,000、復習イベント50,000、同期queue 5,000。
- Today初期表示、検索、分析集計、JSON 1 MB上限付近、backup/restoreを計測する。
- Core Web Vitals目標はPRODUCT_REQUIREMENTSのNFR-PERFに従う。
- IndexedDB quota不足、D1 batch制限、API payload上限を超える場合、データ消失せず具体的な案内を返す。

## 8. CI実行順

1. checkout。
2. Node 22とCorepack/pnpmをpackage.jsonから準備。
3. `pnpm install --frozen-lockfile`。
4. `pnpm prompts:check`と`pnpm format:check`。
5. `pnpm lint`。
6. `pnpm typecheck`。
7. `pnpm test`。
8. `pnpm build`と`pnpm audit --prod`。
9. `pnpm test:d1:local`と`pnpm test:pwa:update`。
10. ChromiumとOS依存をinstall。
11. `pnpm playwright test`。
12. 失敗時のみ、秘密・個人データを含まないPlaywright reportを短期間artifact化する。

lint/typecheck/test/buildを`&&`で1 stepにまとめず、どのGateが失敗したか明確にする。Playwrightはbuild成功後に行う。

## 9. Gate exit criteria

各Gateで次を満たす。

- 変更要件に対応するunit/integration/E2Eを追加または更新した。
- `pnpm lint`、`pnpm typecheck`、`pnpm test`、`pnpm build`と関連Playwrightが成功した。
- 自己レビューと独立観点レビューを実施し、findingsを`docs/reviews/`へ保存した。
- Open P0/P1が0件。P2/P3は影響、回避策、予定Gateを持つ。
- 最大5サイクルで解消しない場合はGateを完了にせず、停止理由と選択肢を`MANUAL_ACTIONS.md`へ記録した。

## 10. 再現性記録

失敗報告は次を含める。

- commit SHA、Node/pnpm/browser版、OS、timezone。
- 実行コマンド、seed、fixture ID、テスト名、最初の失敗メッセージ。
- 期待/実際、再現率、network/offline条件、schema/migration/contract版。
- P0〜P3、Core/Boost・データ・プライバシーへの影響。

token、メール、Access header、貼り付けJSON、学習本文、ローカルDBを添付しない。
