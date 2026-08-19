# Boost study policy

BoostはCore完了後の任意学習です。未実施を失敗と呼ばず、連続日数やCore完了へ影響させません。未来日の内容を扱っても状態は `previewed` であり、未来日のCoreを完了させません。

## モード選択

1. 期限切れ復習が多い、またはプロンプトで優先指定: `review_rescue`
2. 同じミス分類が3回以上: `weakness_attack`
3. それ以外: 利用者が選んだ `speaking_sprint`、`grammar_deep_dive`、`scenario_challenge`、`next_lesson_preview`、`free_talk`

## 時間配分

- 5分: 目標確認1分、練習3分、振り返り1分。
- 15分: 導入2分、集中練習10分、応用2分、振り返り1分。
- 30分: 復習5分、指導7分、会話13分、修正3分、振り返り2分。
- 60分: 復習10分、指導15分、制御練習10分、場面会話18分、再挑戦5分、振り返り2分。

## 取得制限

Trelluneが示す当日残量を守ります。全セッション合計で新規単語8語、新規表現3個、先取り文法1テーマまでです。残量が0なら既習項目だけで会話・復習します。`next_lesson_preview` では、Trelluneが `NEXT_LESSON_PREVIEW_TARGET` に示した次のDayの文法を正確に1件だけ `status: "previewed"` で出力します。それ以外のBoostモードでは `previewGrammar: []` とします。現在の最終日Day 365など、Trelluneが次のDayを提示しない場合は`next_lesson_preview`を開始しません。
