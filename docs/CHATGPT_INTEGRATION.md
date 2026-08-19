# 会話AIコピー＆ペースト連携

## 境界

Trelluneは会話AIへネットワーク接続しない。OpenAI API、Realtime API、Agents SDK、Workers AI、他のAI API、ブラウザ自動操作、自動投稿は使用しない。利用者がプロンプトをコピーして自分で選んだ会話AIへ貼り、返されたJSONをTrelluneへ貼り付ける。ChatGPT固有のProject／Study Mode手順は`chatgpt-project-sources/`に分離している。

## 対象プロンプト

- Core Voice
- Boost 5 / 15 / 30 / 60分
- Study Mode
- ベースライン評価
- 週次評価

生成時はセッション種別、カリキュラム日、テーマ、目標、対象文法、必要な期限復習、当日教材、直近のミス、Boost時間・モード、新規取得残数だけを含める。秘密、メール、音声、全バックアップ、不要な過去ログは含めない。学習者由来文字列は明確なデータ区画へJSONエンコードし、プロンプト命令と混在させない。

## 取込パイプライン

Core/Boostは`05-session-schema.json`のSESSION_JSONを通常取込画面へ渡す。ベースラインは8キーの専用JSONをベースライン画面へ渡し、`BaselineAssessmentSchema`で同じく厳格解析、プレビュー、明示保存、重複防止を行う。Foundation Stage Assessmentはアプリが現在のStage、Day範囲、target CEFR、required skills、反復ミスを含む専用promptを生成する。テキスト送信後にVoiceを開始し、終了後に明示要求した別契約`ASSESSMENT_JSON` 1.0を厳格解析・preview・保存する。Stage結果はCEFR認定やCore lockに直結しない。週次評価とStudy Modeは取込JSONを生成しない。

```mermaid
flowchart LR
  A["貼り付け原文"] --> B["JSON候補抽出"]
  B --> C["JSON.parse"]
  C --> D["Zod構造検証"]
  D --> E["業務規則検証"]
  E --> F["取込プレビュー"]
  F --> G["人間が確認・手動修正"]
  G --> H["原子的保存"]
  H --> I["カード・進捗を更新"]
```

### 1. 原文保持

貼り付けまたはClipboard APIで取得した文字列を編集前の `rawInput` としてメモリ上に保持する。Clipboard APIはボタン操作時だけ呼び、拒否されたら貼り付け欄へ戻す。原文は取込確定前に失わず、ページ離脱時は保存しない旨を確認する。原文をそのまま永続化・同期・ログ送信しない。

### 2. JSON候補抽出

文字列全体がJSONならそれを候補にする。そうでなければMarkdownの fenced code blockを走査し、言語ラベルが `json` または空のブロックを候補にする。候補が0または2個以上なら利用者に選択・修正を求める。括弧の補充、引用符の置換、末尾カンマ削除などの自動修復はしない。

### 3. 構文・スキーマ検証

候補を標準 `JSON.parse` し、その結果をZodの厳格スキーマで検証する。未知プロパティ、型違い、範囲外、欠損をパス付きで表示する。ChatGPT Projectの `05-session-schema.json` とアプリのZodスキーマは版 `1.0` で同期する。将来版を受け取った場合は保存せず、対応版を案内する。

### 4. 業務規則検証

- `curriculumDay` は生成したプロンプトの対象日と一致
- Coreは `boost: null` かつ `previewGrammar: []`
- Boostの `next_lesson_preview` はTrelluneが指定した次のDayの文法を正確に1件だけ `previewGrammar` に入れ、それ以外のBoostモードは空配列にする
- Boostは時間・モードが生成プロンプトと一致
- `durationMinutes` は正数で妥当な範囲
- 当日既存数との合計が新規単語8、表現3、先取り文法1以下
- preview grammarのstatusは必ず`previewed`
- `sessionId` が未取込

一つでも失敗すれば全体を保存しない。上限に合う先頭項目だけを黙って取り込むことは禁止する。

### 5. プレビューと手動修正

セッション種別、日、日時、評価、ミス、新規項目、previewed項目、生成される復習カードを一覧にする。利用者は候補JSONの編集欄で手動修正し、再検証できる。編集しても `rawInput` を「元に戻す」で復元できる。アプリが内容を推測補完しない。

### 6. 原子的保存と重複防止

`sessionId` に一意制約を置く。ローカルの1トランザクションでsession、mistake、採用したreview card、acquisition event、preview record、Core完了判定を保存する。途中失敗時は全てロールバックする。同じIDの再取込は既存の取込日時を示して拒否し、UUIDの書き換えを促さない。同期先でも同じ一意制約で冪等にする。

## Core完了への影響

検証済み `sessionType: core` で対象日が一致し、期限復習と文法課題も完了している場合だけ、その日のCoreを完了する。Boost、ベースライン、週次評価、Study ModeはCore完了フラグを変更しない。Boostのpreviewは未来日の教材を既読・完了にしない。

## エラー表示

エラーは「何が不正か」「どこを直すか」「原文が保持されているか」を日本語で示す。例: `newVocabulary: 当日の残りは2語ですが3語あります。ChatGPTで2語以下に再生成してください。原文は保存されていません。` JSONの値をアプリが勝手に丸めたり翻訳したりしない。

## Project配布物

`chatgpt-project-sources/` の14ファイルを配布する。手動の画面操作は `CHATGPT_MANUAL_SETUP.md` に、指導・スキーマ契約は01〜07、利用開始用のプロンプトは各TXTに分離している。学習実データや会話ログをリポジトリへ追加しない。
