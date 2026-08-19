# トラブルシューティング

最終更新: 2026-08-06

利用者にターミナル操作を依頼しない。ブラウザで解決できない問題は、診断画面の個人データを除いた情報を確認し、Codex/運用担当がworkspaceで対応する。サイトデータ削除、remote migration、restore、deployは安易に行わない。

## pnpmが`packages field missing or empty`になる

原因候補: 親directoryの不正な`pnpm-workspace.yaml`を拾っている、またはproject local workspace境界がない。

確認:

```text
Get-Location
pnpm --version
Get-Command pnpm
Get-Content .\pnpm-workspace.yaml
```

期待するproject local内容は単一packageを表す`packages: ['.']`。workspaceからdrive rootまで親設定の有無をread-onlyで確認する。Workspace外の親fileを変更せず、project local境界を修正してから`pnpm install`する。

## Coreが完了にならない

Todayの未完了理由で「必須復習」「今日の文法」「Core Voice取込」を確認する。

- Boost結果はCore Voiceの代わりにならない。
- JSONがpreviewだけで、取込確定されていない場合は完了しない。
- 重複JSONは既存sessionを再利用し、新しい完了eventを作らない。
- 日付/タイムゾーン不一致なら設定を確認する。完了させるために端末時計やDBを直接変更しない。

診断では学習日、各要素のevent ID/状態、timezone、contract版を確認し、学習本文は収集しない。

## Boostを開始できない

Boostは当日のCore完了後だけ利用できる。Todayに戻り、3つのCore要素を確認する。Core完了済みなのにblockedなら、offline queueと再計算状態を確認する。未来日を手動完了したりguardを無効にしない。

## 新しい単語・表現・文法を取り込めない

当日の上限は単語8、定型表現3、先取り文法1。上限到達は正常で、復習と会話は継続できる。

- 同じ項目が別表記で重複していないかプレビューを確認する。
- 複数端末同期で上限競合なら競合画面から採用項目を選ぶ。
- JSONから項目を修正して再検証できるが、アプリは超過分を黙って捨てない。

## JSONを読み込めない

1. 用途（Core/Boost等）がChatGPT側のsession typeと一致するか確認する。
2. Markdown code blockが1つだけか確認する。単一JSONコードブロックの前後にある説明文は警告付きで無視される。複数JSON候補がある場合は、採用するJSONだけを編集用欄へコピーする。
3. 画面のJSON path別errorを修正し、再検証する。
4. 未知契約版ならアプリとChatGPT Project用fileの版を揃える。

アプリは不正JSONを推測補完しない。原文は画面を閉じる前に本人が必要に応じて安全な場所へ戻し、support/logへ送らない。

## 「すでに取り込み済み」と表示される

既存sessionへのlinkを開き、日時・種別を確認する。同じ内容はsession IDやhashで冪等に扱うため、再取込してもカードや連続日数は増えない。同じIDなのに内容が異なる場合は衝突として拒否される。DB上書きで解消しない。

## Clipboardが使えない

ブラウザ権限、HTTPS、foreground user gestureが必要な場合がある。権限を拒否しても、プロンプト本文の選択/手動コピーとJSON直接貼り付けを使える。権限設定変更を強制しない。

## オフライン表示が消えない / 同期しない

1. 他サイトを開くのではなく、Trelluneの接続/最終同期/未同期数を見る。
2. 401/403ならAccessへ再ログインする。
3. 409なら競合画面を解決する。
4. 429/5xxならqueueを保持したまま待ち、手動再試行を1回行う。
5. app再起動後も未同期数が維持されることを確認する。

サイトデータやIndexedDBを削除しない。必要なら診断のapp/schema版、error code、相関ID、未同期件数だけを共有する。

## PWAがinstallできない

- 対応browser/OS、HTTPS、manifest/icon/service workerを確認する。
- install promptが出なくてもbrowser menuから可能な場合がある。
- install不可でも通常Webアプリとして利用できる。
- iOS/Androidで導線が異なるため、実機用案内を確認する。

## 更新後に古い画面が残る

画面の「更新可能」から、安全な再読込を行う。未確定の取込、未保存の文法回答、未同期queueを先に確認する。強制更新でも直らない場合、service worker/app versionを診断する。`Clear site data`は未同期データ消失リスクがあるため最後の手段とし、backupと明示確認を必要とする。

## Backupを作れない

- browser download権限、空き容量、popup/download blockを確認する。
- 生成中に画面を閉じない。失敗しても学習DBは変更されない。
- 診断にbackup内容を添付しない。形式版、件数、error codeだけを確認する。

## Restoreを受け付けない

未知将来版、破損、上限違反、参照切れ、過大fileは安全のため拒否する。元fileを自動修復しない。対応版の正常backupを選び、プレビューまで既存データが変わらないことを確認する。適用失敗時に既存データが変わった疑いがあればP0として書込を止める。

## ローカルD1 migrationが失敗する

1. 対象が`--local`か確認し、remoteを誤操作しない。
2. 適用済みmigrationと番号順、SQL error、schema版を確認する。
3. 新しい空DBと既知旧版fixtureの両方で再現する。
4. migration fileを書き換えて適用済み履歴を偽装せず、新しい番号のforward-fixを作る。

ローカルDB初期化が必要なら対象absolute pathを確認し、架空fixtureであることを確認して事前報告する。

## Cloudflareで401/403になる

- 未ログインならAccessの正常な拒否である。本人としてログインする。
- ログイン済みなら対象hostname、Access application、Allow policy、session expirationを確認する。
- Everyone Bypassや広いemail domainで一時回避しない。
- Worker APIがAccess主体を正しく検証しているか確認する。クライアントの利用者IDを信頼しない。

## Deploy/migration対象を間違えそう

実行を止める。`dev`/`production`、Worker名、hostname、D1名/database ID suffix、`--env`、`--local`/`--remote`を表で照合する。環境指定のないremote commandは禁止する。承認記録が対象環境とresourceを明示していなければ再承認を求める。

## GitHub ActionsでPlaywrightだけ失敗する

- browser install stepが`pnpm exec playwright install --with-deps chromium`を実行したか確認する。
- webServerのbuild、port、baseURL、health待機、終了codeを確認する。
- CI artifactのtraceは架空fixtureだけか確認してから開く。
- timeoutを増やす前に、固定sleep、race、network依存を除去する。

## エスカレーション時に共有してよい情報

- commit/app/Worker/schema/contract版、OS/browser/pnpm/Node版。
- 発生日時とtimezone、route、操作名、error code、相関ID、未同期件数。
- 架空fixtureでの最小再現手順。

共有禁止: 実JSON、学習本文、メール、Access token/header、cookie、backup/DB、音声、秘密。
