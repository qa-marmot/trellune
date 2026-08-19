# 復習アルゴリズム

## 目的

語彙、定型表現、文法、ミス由来カードを、説明可能でオフラインでも同じ結果になる決定的な間隔反復で出題する。サーバー時刻に依存せず、保存されたISO時刻と利用者設定のIANAタイムゾーンからローカル学習日を求める。

## 状態

- `new`: 未出題
- `learning`: 初回定着中
- `review`: 通常復習中
- `relearning`: reviewで失敗し再学習中
- `previewed`: Boostで先取りした文法。Core学習済みとは別
- `suspended`: 利用者が一時停止

カードには `dueAt`, `state`, `stabilityLevel`, `lapses`, `lastReviewedAt`, `sourceType`, `sourceId` を保存する。`previewed` 文法はプレビュー用記録であり、Coreの正規文法カードが作られるまで通常reviewへ昇格しない。

## 評価ボタン

| 評価  | 意味                                 |
| ----- | ------------------------------------ |
| Again | 思い出せない、または意味が変わる誤り |
| Hard  | 大きな手掛かりが必要、非常に遅い     |
| Good  | 自力で正しく想起                     |
| Easy  | 即答し、別文でも使える               |

音声セッションから作られたカードは自動で正解扱いにしない。ChatGPT評価は推奨の根拠にできるが、復習カードの評価は利用者の操作で確定する。

## スケジュール

初回表示を `t0` とする。時刻は分単位、1日以上は利用者のローカル日で同じ時刻に丸める。

| 現状態     | Again                                        | Hard            | Good                   | Easy                   |
| ---------- | -------------------------------------------- | --------------- | ---------------------- | ---------------------- |
| new        | 10分後・learning                             | 1日後・learning | 2日後・review(level 1) | 4日後・review(level 2) |
| learning   | 10分後・learning                             | 1日後・learning | 3日後・review(level 1) | 6日後・review(level 2) |
| review     | 10分後・relearning、lapses+1、levelを1下げる | 現間隔×1.2      | 現間隔×2.0、level+1    | 現間隔×3.0、level+2    |
| relearning | 10分後                                       | 1日後           | 3日後・review          | 5日後・review          |

reviewの間隔は1〜180日に丸め、同日再出題は10分後以外を翌日以降にする。`currentIntervalDays` は `lastReviewedAt` と `dueAt` の差から求める。未来時刻、端末時計の巻き戻り、欠損値はZod検証後に安全な既定（1日、level 0）へ移行し、元レコードを監査ログに残す。

## 出題順

Core開始時に `dueAt <= Core開始時刻` かつ非suspendedのカードを必須集合として固定する。途中で新たに期限が来たカードは次回の集合へ回す。必須集合は次の順に安定ソートする。

1. `dueAt` が古い
2. `lapses` が多い
3. sourceType: mistake → phrase → grammar → vocabulary
4. card IDの辞書順

この固定集合を全件評価して初めて「必須復習完了」とする。アプリ再起動後も同じ集合を復元する。カードが多くても勝手に省略せず、残件数と目安時間、Core後のReview Rescue推奨を表示する。

## ミス由来カード

検証済みJSONの各mistakeから、`learnerSaid` を表、`suggested + explanationJa` を裏にした候補を作る。取込プレビューで利用者が採用したものだけ保存する。同一カード判定キーは `category + normalized(learnerSaid) + normalized(suggested)`。Unicode NFKC、前後空白除去、連続空白の1個化、英字小文字化だけを行い、意味を変える自動修正はしない。

同一キーのミス回数は直近30ローカル日で数える。3回以上なら未解決の反復ミスとしWeakness Attackを推奨する。Good以上が連続2回、かつその後14日同ミスがなければ解決扱いにする。履歴自体は削除しない。

## オフラインと同期

評価操作には一意な操作ID、card ID、評価、端末時刻、前状態バージョンを保存する。同一操作IDは一度だけ適用する。競合時は単純なlast-write-winsで評価を失わず、未適用の操作を時刻・操作ID順に再生して状態を再計算する。アルゴリズムの版をカードに保存し、将来の変更では既存カードを破壊せずマイグレーションする。
