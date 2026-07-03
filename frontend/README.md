# Frontend（AgentCore Runtime チャット UI）

Amazon Bedrock AgentCore Runtime とストリーミング通信する、React + Vite 製のチャット UI です。Cognito によるサインインを行い、エージェントとの対話を SSE（Server-Sent Events）でリアルタイムに表示します。

## 概要

- **フレームワーク**：React 19 + Vite（TypeScript）
- **認証**：`@aws-amplify/ui-react` の `Authenticator` コンポーネントと `aws-amplify/auth` を使用し、Cognito User Pool（[`cdk/`](../cdk) の `AuthStack` で作成）でサインイン。取得したアクセストークンを AgentCore Runtime 呼び出し時の `Authorization` ヘッダーに付与
- **チャット UI**：`@chatscope/chat-ui-kit-react` を使用したメッセージリスト・入力欄
- **Markdown 表示**：`streamdown` を使い、ストリーミング中の Markdown をアニメーション付きで逐次レンダリング
- **AgentCore 通信**：`src/service/AgentCoreRuntimeService.ts` が AgentCore Runtime の invocations エンドポイント（`https://bedrock-agentcore.<region>.amazonaws.com/runtimes/<エンコード済みARN>/invocations?qualifier=DEFAULT`）に対して `fetch` で SSE ストリームを開始し、Strands Agents SDK が出力するイベント（テキスト差分・ツール呼び出し開始／差分／結果・メッセージ確定・終了理由）をパースする

## ディレクトリ構成

frontend/
├── src/
│   ├── main.tsx                          # エントリポイント。/amplifyconfiguration.json を取得して Amplify.configure()
│   ├── app.tsx                           # チャット画面本体。ストリーミングイベントのハンドリングとメッセージ表示
│   ├── components/
│   │   └── SignOut.tsx                   # サインアウトボタン
│   └── service/
│       └── AgentCoreRuntimeService.ts    # AgentCore Runtime への SSE リクエスト・イベントパース
├── public/
├── index.html
├── package.json
└── vite.config.ts

## 設定ファイル（実行時に取得）

このアプリはビルド時の環境変数ではなく、実行時に静的ファイルとして配信される 2 つの JSON を `fetch` して初期化します。いずれも [`cdk/`](../cdk) の `FrontendDeployStack` がデプロイ時に生成し、S3 バケットのルートに配置します。

| ファイル | 内容 | 用途 |
| --- | --- | --- |
| `/amplifyconfiguration.json` | Cognito `userPoolId` / `userPoolClientId` | `Amplify.configure()` に渡してサインイン機能を有効化 |
| `/config.json` | `region` / `runtimeArn`（AgentCore Runtime の ARN） | AgentCore Runtime の invocations エンドポイント URL を組み立てる |

ローカル開発時にこれらのファイルを用意していない場合、起動時の `fetch` が失敗するため、`cdk/` でデプロイ済みの値をもとに `frontend/public/` へ手動で配置してください。

## セットアップ

```bash
cd frontend
pnpm install
```

## よく使うコマンド

```bash
pnpm dev         # 開発サーバーを起動（デフォルトで http://localhost:5173/）
pnpm build       # tsc による型チェック → vite build
pnpm preview     # ビルド成果物をローカルでプレビュー
pnpm lint        # ESLint
pnpm lint-fix    # ESLint（自動修正）
```

## デプロイ

このフロントエンドは単体ではデプロイされません。`pnpm build` で `frontend/dist` を生成した後、[`cdk/`](../cdk) の `FrontendDeployStack` が S3 + CloudFront へアップロードします。デプロイ手順の詳細は [../cdk/README.md](../cdk/README.md) を参照してください。

ローカル開発時（`http://localhost:5173/`）は、`cdk/` の `AuthStack` で Cognito User Pool Client のコールバック／ログアウト URL にあらかじめ登録されているため、そのままサインインを試せます。

## 関連

- 認証・配信基盤・AgentCore Runtime の定義：[../cdk/README.md](../cdk/README.md)
- 通信先のエージェント本体：[../agent/README.md](../agent/README.md)

## ライセンス

このディレクトリ配下のコードは `frontend/LICENSE`（MIT-0）に従います。
