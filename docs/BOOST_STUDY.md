# Boost学習設計

## 位置づけ

Boostはその日のCore完了後に選べる任意学習である。行わなくても失敗、欠席、連続記録の中断とは表示しない。Boostの完了はCoreの文法課題・Voice・JSON取込の代替にならず、未来日のCoreを完了させない。

## 選択肢

時間は5 / 15 / 30 / 60分、モードは以下の7つ。

| モード              | 目的                                  | 新規取得の既定                 |
| ------------------- | ------------------------------------- | ------------------------------ |
| Review Rescue       | 期限切れ・低定着カードを減らす        | なし                           |
| Speaking Sprint     | 既習項目で発話回数を増やす            | 原則なし                       |
| Grammar Deep Dive   | 既習文法の誤りを説明と再練習で直す    | 原則なし                       |
| Scenario Challenge  | 既習範囲を複合場面で使う              | 残量内で可                     |
| Weakness Attack     | 3回以上繰り返した同分類ミスを集中修正 | 原則なし                       |
| Next Lesson Preview | 次のCore文法を軽く見る                | 文法1テーマまで、必ずpreviewed |
| Free Talk           | 興味のある話題で会話維持を練習        | 残量内で可                     |

## 推奨ロジック

推奨は強制せず、理由を画面に表示する。優先順位は次の通り。

1. 同一の正規化ミスキーが直近30日で3回以上、かつ未解決なら `Weakness Attack`
2. 期限切れカードが10件以上、または最古期限が3日以上前なら `Review Rescue`
3. interactionの直近3セッション平均が3未満なら `Speaking Sprint`
4. grammarの直近3セッション平均が3未満なら `Grammar Deep Dive`
5. それ以外は利用者の選択を維持し、選択がなければ `Scenario Challenge`

期限切れが25件以上の場合は、学習負荷を下げるためReview Rescueを第一表示にする。ただし利用者は別モードを選べる。Weakness AttackとReview Rescueが同時に該当する場合は、直近セッションでも同じミスが出ていればWeakness Attack、それ以外はReview Rescueを先にする。

## 時間別構成

| 時間 | 構成                                                   |
| ---: | ------------------------------------------------------ |
|  5分 | 目標1、練習3、振り返り1                                |
| 15分 | 導入2、集中練習10、応用2、振り返り1                    |
| 30分 | 復習5、指導7、会話13、修正3、振り返り2                 |
| 60分 | 復習10、指導15、制御練習10、会話18、再挑戦5、振り返り2 |

## 取得上限と状態遷移

単語8、定型表現3、先取り文法1という上限は、Core、Boost、手動追加を含むローカル日単位の合計で判定する。プロンプトには残数を渡す。JSON Schemaの配列上限に加え、取込時に既存の当日取得数と合算して検査する。超過JSONは一部だけ黙って保存せず、全体を取込不可として修正箇所を示す。

Next Lesson Previewで触れた文法は `previewed`。次のCore日に教材を開いても自動で`completed`にせず、文法課題の完了により`learned`、Core全体の完了により当日の進行が確定する。preview中に作られた語彙・表現カードも未来日のCoreを消化した印にはしない。

## Boost JSON

`sessionType` は `boost`、`boost.duration` と `boost.mode` は生成プロンプトと一致必須。Core取込処理を呼ばず、Core完了フラグ、カリキュラム日、連続日数を変更しない。重複 `sessionId` は拒否する。詳細は `docs/CHATGPT_INTEGRATION.md` と `chatgpt-project-sources/05-session-schema.json` を参照する。
