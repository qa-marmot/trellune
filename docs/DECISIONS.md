# 設計判断記録

最終更新: 2026-08-06

各判断は、前提が変わる場合に新しいADRで置き換える。既存判断を履歴から削除しない。

## ADR-001 ChatGPT連携は手動copy/pasteのみ

- 状態: Accepted
- 判断: Trelluneはversion付きプロンプトを生成し、利用者がChatGPTへ手動で貼る。結果はJSON Schema/Zod検証、プレビュー、明示確定後に取り込む。
- 理由: AI API、音声保存、自動投稿を避け、送信内容と保存内容を本人が確認できる。
- 帰結: Clipboard拒否のfallback、原文保持、契約版、重複防止、手動修正UIが必要。OpenAI API等のSDK/依存/秘密を追加しない。

## ADR-002 CoreとBoostを別のdomain eventとして保持

- 状態: Accepted
- 判断: Core必須要素とBoost sessionを同じ「学習済み」booleanへ集約しない。Core完了は必須復習、当日文法、Core Voice importから導出する。
- 理由: Boost未実施を失敗にせず、Boostが未来Coreや連続日数を誤って完了することを構造的に防ぐ。
- 帰結: session種別、route、集計、同期、backup、分析、テストの全層で区別する。

## ADR-003 先取りは`previewed`として永続化

- 状態: Accepted
- 判断: Next Lesson Previewの文法/項目は正式習得や未来Core完了ではなく`previewed`状態にする。
- 理由: 先取りの学習価値を記録しつつ、90日カリキュラムの必須進捗を歪めない。
- 帰結: 予定日のCore開始まで状態を保持し、UIで色以外にも表示する。同期競合でも状態を格下げ/昇格させない。

## ADR-004 新規獲得上限はdomain transactionで強制

- 状態: Accepted
- 判断: 1学習日あたり単語8、定型表現3、preview文法1を、UIだけでなくlocal repository、import、API、同期統合で検証する。
- 理由: offline/複数端末/直接API/再送でも上限を守るため。
- 帰結: 日付・同一性規則・競合解決を決定的にし、超過を黙って切り捨てない。上限後も復習と会話を許可する。

## ADR-005 local-first store + idempotent D1 sync

- 状態: Accepted
- 判断: IndexedDBを即時の端末storeとし、一意なoperation IDを持つoutboxでHono/D1へ同期する。serverはoperation IDを重複排除する。
- 理由: 不安定回線でも毎日の学習を止めず、response喪失や再送で二重反映しない。
- 帰結: 同期状態、ack、backoff、競合UI、schema版、複数端末テストが必要。単純なlast-write-winsで不変条件を壊さない。

## ADR-006 JSON importはpreview付き原子transaction

- 状態: Accepted
- 判断: 抽出→Zod検証→domain検証→preview→明示確定→原子保存の順にする。外部session IDとcanonical content hashを保存する。
- 理由: 不正補完、部分更新、二重取込、種別誤認を防ぐ。
- 帰結: 貼り付け原文は画面内に残すが永続化/ログに残さない。同じIDで異なる内容は衝突として拒否する。

## ADR-007 TypeScript strictとZodを信頼境界に使用

- 状態: Accepted
- 判断: TypeScript strictを有効にし、JSON、API、URL parameter、backup、IndexedDB旧版など外部/永続化境界をZodで検証後、domainへ渡す。
- 理由: 静的型だけではruntime inputと旧データを保証できない。
- 帰結: `unknown`からparseし、unsafe castや暗黙defaultで検証を回避しない。schemaに版とmigration testを持つ。

## ADR-008 D1変更は番号付きforward migration

- 状態: Accepted
- 判断: SQLはbind parameterを使用し、schema変更を追記型の番号付きmigrationで行う。適用済みfileを書き換えず、後方互換なforward-fixを優先する。
- 理由: 再現性、監査性、既存データ保護、段階deploy互換のため。
- 帰結: 空DBと全既知旧版fixtureのmigration test、pre-migration復旧点、appの前後版互換が必要。

## ADR-009 環境をWorker/D1/Access単位で分離

- 状態: Accepted
- 判断: local、dev、productionでWorker env、D1、hostname、Access applicationを分離する。remote commandは環境を明示する。
- 理由: 検証データと本番データの混在、誤deploy/migrationを防ぐ。
- 帰結: `trellune-dev`/`trellune-prod`、`dev.app.example`/`app.example`を使用予定。本番・開発の変更は人間承認対象。

## ADR-010 Accessは入口と主体情報に使用し、アプリ認可も行う

- 状態: Accepted
- 判断: host全体をCloudflare Access Self-hosted applicationで保護し、Workerは検証済みAccess主体からdata partition keyを導出する。
- 理由: Accessだけに依存したclient user IDは差し替え可能で、入口の設定ミスにも多層防御が必要。
- 帰結: Everyone Bypassを作らず、未認証/別主体integration testを行う。本人メール入力とpolicy変更は人間操作/承認。

## ADR-011 ログは相関可能な最小metadataのみ

- 状態: Accepted
- 判断: correlation ID、route、code、duration、count、versionを記録し、body、学習本文、プロンプト、JSON原文、メール、tokenを記録しない。
- 理由: 個人学習データと資格情報の漏えい面を減らす。
- 帰結: error objectの自動serializationを避け、redaction testと診断情報previewを用意する。

## ADR-012 PWA更新は利用者制御

- 状態: Accepted
- 判断: 新service workerを検出しても即時強制reloadせず、未保存/未同期状態を示して利用者が更新する。
- 理由: Core途中、JSON修正中、offline queueのデータ消失を防ぐ。
- 帰結: 更新通知、version表示、offline fallback、旧IndexedDB schema migration、update E2Eが必要。

## ADR-013 WCAG 2.2 AAをrelease目標にする

- 状態: Accepted
- 判断: semantic HTMLとkeyboardを基礎にし、axeをCI、NVDA/zoom/mobileを手動受入へ含める。
- 理由: スマートフォンの初心者向け学習は、認知負荷、視認性、入力の失敗回復を含めて利用可能である必要がある。
- 帰結: 状態を色だけで示さず、44px対象、可視focus、error関連付け、reduced motion、graph代替を実装する。

## ADR-014 CIは1つの再現可能な品質順序を実行

- 状態: Accepted
- 判断: clean checkoutでpnpm lockfileを固定し、lint、typecheck、unit/integration、build、Chromium準備、Playwrightの順で実行する。
- 理由: localでだけ動く構成と、ブラウザ未installによる偽失敗を防ぐ。
- 帰結: P0/P1が残る場合はCI成功でもGateを完了にしない。CI artifactに実データを含めない。

## ADR-015 GitHubとCloudflareのproduction actionは承認制

- 状態: Accepted
- 判断: local commitまでは自動化可能だが、remote作成/push、Cloudflare login/resource/deploy/DNS/Access/production data変更は個別承認後だけ行う。
- 理由: 外部状態変更と本番影響を本人が把握・制御するため。
- 帰結: 承認は環境、resource、commit、操作、rollback、有効期限を記録する。無承認でmainへ直接pushしない。
