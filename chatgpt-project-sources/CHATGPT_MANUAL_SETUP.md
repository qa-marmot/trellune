# ChatGPT 手動セットアップ

この操作は利用者がChatGPT画面で行います。TrelluneはChatGPTへ自動接続せず、外部AI APIも使用しません。画面名はChatGPTの更新や契約プランにより多少異なる場合があります。

## 0. 役割を分ける

| 機能            | 使う場所                                                      | 役割                                                                                                    | Trelluneへの取込                                                                                          |
| --------------- | ------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------- |
| ChatGPT Project | `Trellune` Project内のチャット                                | Project instructionsと8つのProject Sourcesを共有し、Core Voice、Boost、各Assessmentを再現可能に実施する | Core/BoostはSESSION_JSON、Stage AssessmentはASSESSMENT_JSON、ベースラインは専用JSONとして検証後に取り込む |
| Study Mode      | Project外の通常チャット                                       | `LEARNER_CONTEXT`を使い、質問中心で文法・理解・発話を補助する                                           | 取り込まない。Core/Boost完了や連続日数を変更しない                                                        |
| Voice           | Core/Boost用Projectチャットで、テキストプロンプト送信後に開始 | 実際の音声会話を行う                                                                                    | Voice終了後、同じチャットでSESSION_JSONを明示要求する                                                     |
| Scheduled Task  | ChatGPTの通常チャットまたはScheduled画面                      | Trelluneを開く時刻を通知する                                                                            | 通知だけ。Project Sources、学習状態、Core/Boost、JSON、同期を扱わない                                     |

Study ModeはGPTまたはProject会話では利用できません。Project内でStudy Modeを開始しようとせず、必ずProject外の新しい通常チャットでStudy Modeを有効にします。Scheduled TaskもProjectファイルを参照できる前提にしません。

参考:

- [Projects in ChatGPT](https://help.openai.com/en/articles/10169521-projects-in-chatgpt)
- [Using Study Mode in ChatGPT](https://help.openai.com/en/articles/11780217-chatgpt-study-mode-faq)
- [Voice Mode FAQ](https://help.openai.com/en/articles/8400625-voice-mode)
- [Scheduled Tasks in ChatGPT](https://help.openai.com/en/articles/10291617-scheduled-tasks-in-chatgpt)

## 1. Projectを作る

1. ChatGPTを開き、正しい個人アカウントでログインします。
2. Project作成前にChatGPTの「Settings」→「Personalization」を開きます。
3. 個人向けプランでは「Reference saved memories（保存したメモリを参照）」と「Reference chat history（チャット履歴を参照）」を有効にします。管理対象のBusiness / Enterprise / Eduでは、個人設定のメモリに加えてワークスペース側のMemoryが有効か管理者に確認します。
4. 左サイドバーの「Projects」または「新しいプロジェクト」を選びます。
5. 「Create project」を選び、名前を `Trellune` にします。
6. メモリ範囲で「Project only」を選びます。選択肢が表示されない場合はdefault memoryのまま作成せず、手順2〜3の設定とワークスペース制限を確認します。
7. Projectを作成し、名前が `Trellune`、メモリがProject-onlyであることを確認します。

既存Projectがdefault memoryの場合、後からProject-onlyへ切り替えることはできません。上記設定を確認して新しいProjectを作り、Project instructionsとProject Sourcesを新しいProjectへ登録します。

Project-only memoryでは、同じProject内の会話は参照できますが、Project外の会話や保存メモリは参照しません。毎回の最新学習状態は、過去会話ではなくTrelluneが生成した `LEARNER_CONTEXT` を正とします。

## 2. Project instructionsを登録する

1. Project名の横のメニュー（`…`）から「Project settings」または「Instructions」を開きます。
2. `PROJECT_INSTRUCTIONS.txt` をテキストエディタで開き、全文をコピーします。
3. Project instructions欄へ貼り付け、「Save」を選びます。
4. 保存後に設定を開き直し、冒頭が `You are the English coach` であることを確認します。

Project instructionsはこのProject内だけに適用されます。Project外のStudy ModeやScheduled Taskへ自動的には引き継がれません。

## 3. Project Sourcesを追加する

1. Project画面の「Add files」「Sources」またはクリップのアイコンを選びます。
2. 次の8ファイルをまとめて選びます。
   - `01-learner-profile.md`
   - `02-coaching-policy.md`
   - `03-curriculum.md`
   - `04-mistake-taxonomy.md`
   - `05-session-schema.json`
   - `06-boost-study-policy.md`
   - `07-prompt-contract.md`
   - `08-session-schema-1.1.json`
3. アップロード完了表示を待ち、8件すべてのファイル名がProject Sourcesに見えることを確認します。
4. アップロードに失敗したファイルだけを再選択します。同名の重複ができた場合は古い方を削除し、各1件にします。

過去の学習チャット、SESSION_JSON、バックアップ、メール、トークン、音声をProject Sourcesへ追加しません。

## 4. Project設定を再現確認する

1. Project内で新しいテキストチャットを作ります。
2. `設定確認だけを行います。Project instructionsの役割、参照できるProject Sourcesのファイル名、CoreとBoostの違いを簡潔に答えてください。SESSION_JSONは出力しないでください。` と送ります。
3. Project instructionsと8ファイルを参照でき、CoreとBoostを分離して説明することを確認します。
4. 「外部APIで自動連携する」「BoostでCoreを完了できる」「Study ModeをこのProject内で開始する」と提案した場合は会話を止め、Project instructionsとProject Sourcesを再確認します。
5. この確認チャットには実名、メール、秘密情報、実学習データを貼り付けません。

## 5. ベースライン評価を行う

1. Project内で別の新しいチャットを作ります。
2. `BASELINE_ASSESSMENT_PROMPT.txt` をテキストとして貼り付け、先に送信します。
3. 音声を使う場合は、ChatGPTがプロンプトを受け付けたことを確認してからVoiceボタンを選びます。
4. 8〜10分の評価を終え、各1〜5の5指標、自信、強み、優先課題を含むベースラインJSONが1個だけ表示されることを確認します。これはSESSION_JSONではありません。音声を使えなければテキストでも実施できます。
5. JSONをコピーし、Trelluneのベースライン画面へ戻って専用欄へ貼り付けます。「検証してプレビュー」で内容を確認し、「評価を保存してDay 1へ」を選びます。音声ファイルと貼り付け原文は保存しません。

## 6. 毎日のCore Voiceを使う

1. Trelluneの「今日」から期限復習と文法課題を完了します。
2. 「Core Voice準備」で、その日用の `SESSION_REQUEST`、最新の `LEARNER_CONTEXT`、`OUTPUT_REQUEST` を含むプロンプトを生成し、「コピー」を選びます。
3. ChatGPTの `Trellune` Project内で、その日用の新しいテキストチャットを作ります。
4. Voiceを開始する前に、コピーしたプロンプトをテキストで貼り付けて送信します。
5. ChatGPTがセッション種別 `core`、カリキュラム日、目標を確認したことを見てからVoiceを開始します。
6. Voiceで会話を行い、終了ボタンでVoiceを終了します。
7. 同じチャットのテキスト入力で `SESSION_JSONを出力` と送ります。
8. `05-session-schema.json`に従うJSONコードブロックが1個だけ返ることを確認し、コードブロック全体をコピーします。
9. Trelluneの「Session取込」に貼り付けます。「クリップボードから読む」が使える場合も、表示内容を確認してから続けます。
10. 検証エラーがあれば保存せず、元の貼り付けを残したまま同じChatGPTチャットで修正を依頼します。再出力時は同じ `sessionId` を使います。
11. 取込プレビューでCore、日、項目数、ミス、評価を確認し、「取込」を選びます。
12. 「今日」にCore完了が表示されたことを確認します。

Voiceを先に開始してからプロンプトを貼り付けません。プロンプトのテキスト送信、内容確認、Voice開始の順を守ります。

## 7. Boostを使う

1. その日のCore完了後にTrelluneの「Boost」を開きます。
2. 5 / 15 / 30 / 60分とモードを選びます。推奨が表示された場合は理由も確認します。
3. 生成プロンプトをコピーし、Project内の新しいテキストチャットへ貼り付けて送信します。
4. ChatGPTが `boost`、時間、モードを正しく確認した後、必要ならVoiceを開始します。
5. Voiceを終了後、同じチャットで `SESSION_JSONを出力` と送ります。
6. JSONをTrelluneへ貼り、プレビューで `Boost`、時間、モードを確認して取り込みます。
7. Next Lesson Previewの文法は `previewed` と表示されること、未来日のCoreが完了にならないことを確認します。

CoreとBoostは必ず別チャットにします。CoreのプロンプトやJSONをBoostチャットで再利用しません。

## 8. Study Modeを通常チャットで使う

1. `Trellune` Projectから出て、Project外で新しい通常チャットまたはTemporary Chatを作ります。
2. ChatGPTのツールメニューから「Study」を選ぶか、Webでは `https://chatgpt.com/studymode` を開き、Study Modeが有効であることを確認します。
3. TrelluneでStudy Mode用プロンプトを生成し、最新の `LEARNER_CONTEXT` と指示を含む全文を、その通常チャットへ1回だけ貼り付けて送信します。
4. 必要な場合だけ、通常のStudy Modeチャットへ `01-learner-profile.md` と `03-curriculum.md` を個別に添付します。他のProject SourcesやProject instructionsを参照できるとは想定しません。
5. ChatGPTが一度に一問ずつ進め、文法説明、確認問題、発話練習、振り返りを行うことを確認します。

`STUDY_MODE_INITIAL_PROMPT.txt` はTrelluneが生成する本文の参照テンプレートです。未展開のプレースホルダーを別メッセージとして先に送りません。Study Modeは補助学習であり、SESSION_JSONを出力・取込せず、CoreやBoostの完了、カリキュラム日、連続日数を変更しません。最新状態は毎回Trelluneが生成した全文で貼り付け直します。

## 9. Stage Assessmentを行う

1. TrelluneのAssessment画面で、現在利用可能なAssessmentを選び「Assessmentを開始」を選びます。
2. Trelluneが生成したAssessment ID、attempt ID、learner context、課題、出力契約を含むプロンプト全文をコピーします。
3. Project内の新しいテキストチャットへ全文を先に送信します。Integrated Graduation Assessmentでは、ChatGPTに答えを代筆させず、プロンプト内のReading質問とWriting課題へ自分で回答します。
4. Speaking/Interaction/Listening評価を行うときだけ、プロンプト受領を確認した後にVoiceを開始します。
5. 全課題の終了後、同じチャットで `ASSESSMENT_JSONを出力` と明示し、JSONをTrelluneへ貼り付けます。
6. 検証プレビューでAssessment ID、attempt ID、評価skill、CEFR推定scopeを確認してから保存します。

ASSESSMENT_JSON v1.0はSESSION_JSON v1.0とは別契約です。Integrated GraduationのCEFR推定はListening、Reading、spoken interaction/production、Writingのtask evidenceを統合しますが、正式なCEFR認定ではありません。現行Mastery定義は8技能すべてに1〜5のscoreと具体的なevidenceを要求します。B2-entryは全skill 3/5以上、B2は`pass`かつ全skill 4/5以上が必要で、平均点で弱いmodeを隠しません。日数完了や`pass`だけでB2へしません。旧Graduation attemptに表示されるspoken/listening推定は、full CEFR推定へ読み替えません。Assessment結果はCore進行を永久lockしません。

## 10. Scheduled Taskを通知だけに使う

1. 必要なら通常チャットまたはChatGPTのScheduled画面で、例として `毎日20時にTrelluneを開くよう通知してください` と依頼します。
2. 通知時刻と通知先を確認します。
3. 学習開始時は通知からTrelluneを開き、実際の状態をTrelluneで確認します。

Scheduled TaskへProject Sources、SESSION_JSON、`LEARNER_CONTEXT`、実学習本文を保存しません。Scheduled Taskは通知だけであり、Projectの代行、Voice実行、Study Mode実行、Core/Boost完了、同期、JSON生成や取込を行いません。

## 11. 週次評価とProject Sources更新

週次評価は `WEEKLY_ASSESSMENT_PROMPT.txt` のプレースホルダーをTrelluneが埋めたものを、Project内の新しいチャットへテキスト送信して使います。週次評価はSESSION_JSONを生成せず、Core/Boost完了を変更しません。

Project Sourcesの更新版が配布された場合は、Project設定で旧版を削除してから同名の新版を追加し、7ファイルとProject instructionsを再確認します。過去の学習チャットをソースファイルとしてアップロードしないでください。

## トラブルシューティング

- Study Modeが見つからない: Project内ではなくProject外の新しい通常チャットを開き、ツールメニューで「Study」を探します。Webでは `https://chatgpt.com/studymode` も確認します。
- Study ModeがProject内容を知らない: 正常です。最新の `LEARNER_CONTEXT` を貼り付け、必要なら `01-learner-profile.md` と `03-curriculum.md` を個別添付します。
- JSONの前後に説明がある: Core/Boostの同じProjectチャットで「07-prompt-contract.mdどおりJSONコードブロック1個だけ再出力」と依頼します。
- JSONが検証を通らない: Trelluneのエラー位置を同じCore/Boostチャットへ伝えます。Trellune上で推測補完はしません。
- 重複取込と表示される: 同じセッションは既に保存済みです。新しいUUIDへ書き換えて再取込しません。
- Voiceで会話できない: ChatGPT側のマイク権限と音声設定を確認し、解決まではテキストで練習します。
- 上限超過: 新規項目を勝手に削って保存せず、残量を示してJSONを再生成します。
