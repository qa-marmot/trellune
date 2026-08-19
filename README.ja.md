# Trellune（日本語）

**Trellune は、毎日の積み上げを支えるローカル優先の365日英語学習PWAです。**

| Today                                                                               | Grammar / Practice                                                             |
| ----------------------------------------------------------------------------------- | ------------------------------------------------------------------------------ |
| ![合成データのTrellune Day 1 Today画面](docs/assets/demo/today-day1.png)            | ![合成データのTrellune Grammar練習画面](docs/assets/demo/grammar-practice.png) |
| Conversation AI request                                                             | Progress / SRS                                                                 |
| ![合成データのTrellune会話プロンプト画面](docs/assets/demo/conversation-prompt.png) | ![合成データのTrellune進捗画面](docs/assets/demo/progress-srs.png)             |

すべての画像はリセット可能な合成デモで撮影しており、学習者データを含みません。

間隔反復、Grammar転移練習、語彙の産出、Reading/Writing Lab、著者設計の
フィードバックと再挑戦、会話練習を一つの明確な学習ループにまとめます。AI APIキーは
不要です。アプリで会話用リクエストをコピーし、使いたい会話AIへ貼り付け、返ってきた
`SESSION_JSON` をアプリ内で厳格に検証してから取り込みます。

> Day 365の完了はCEFR認定ではありません。学習到達の見立ては、記録された証拠に
> 基づく推定であり、資格・認定ではありません。

## 特長

- **365日カリキュラム:** Foundation / Independent / Fluency / B2 Challenge の4段階。
  Day 366–540は意図的に未開放です。
- **ローカル優先:** 学習データはIndexedDBに保持し、取得済みの主要画面はオフラインでも
  利用できます。
- **会話AIを選べる:** ChatGPT、Claude、Gemini、その他の会話AI向けに手動コピー＆
  ペーストのプリセットを用意しています。未検証の機能は未検証のまま表示します。
- **会話だけに依存しない学習ループ:** SRS、復習、文法、語彙、Reading/Writing、
  フィードバック、再挑戦、会話を分離して扱います。
- **同期は任意:** Cloudflare Worker/D1同期は自分で運用する場合の追加機能です。
  ローカル学習にCloudflareアカウントは不要です。

## 合成デモを試す

[Trellune デモを開く](https://trellune-demo.pages.dev)。合成された端末内データだけを
使用し、サインイン・D1・任意同期サービスへは接続しません。いつでもリセットできます。

## ローカルで試す

```bash
git clone https://github.com/qa-marmot/trellune.git
cd trellune
corepack enable
pnpm install --frozen-lockfile
pnpm db:migrate:local
pnpm db:seed:local
pnpm dev
```

表示されたローカルURLを開いてDay 1を始めます。Cloudflareログイン、リモートDB、
AI APIキーはいりません。詳細は[ローカルセットアップ](docs/LOCAL_SETUP.md)を参照してください。

## 会話AIとの連携

1. **会話AI**画面でプリセットを選び、リクエストをコピーします。
2. 会話AIの通常テキスト会話に貼り付け、先に送信します。
3. 利用環境でVoice対応を確認できる場合だけVoiceを開始します。
4. 終了後に明示して`SESSION_JSON`を要求します。
5. Trelluneへ貼り付け、プレビューで検証結果を確認して保存します。

プロバイダ出力はそのまま保存しません。未知フィールド、不正ID、未来日、上限超過は
ローカル検証で拒否します。詳細は[Provider integration](docs/PROVIDER_INTEGRATION.md)。

## ライセンス

Trellune、ドキュメント、著者作成のカリキュラムは [MIT License](LICENSE) で公開します。
第三者パッケージは各著作者のライセンスに従います。
