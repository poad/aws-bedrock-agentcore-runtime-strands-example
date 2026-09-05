# AWS CDK インフラストラクチャ - Bedrock AgentCore Runtime

このディレクトリには、**AWS Bedrock AgentCore Runtime Strands Example** アプリケーション一式（エージェントランタイム・認証・フロントエンド配信基盤）をデプロイするための AWS CDK（TypeScript）コードが含まれています。

## スタック構成

このプロジェクトは 4 つの CDK スタックで構成されています。

### `FrontendStack`

チャット UI を配信するための静的ホスティング基盤を構築します。

- コンテンツ用の S3 バケット（`aws-bedrock-agentcore-runtime-strands-example-website`）
- Origin Access Control（OAC）でバケットを保護した CloudFront ディストリビューション
- SPA 向けに 404 を `index.html` へフォールバックする設定

### `AuthStack`

利用者認証のための Amazon Cognito リソースを構築します。

- Cognito User Pool（`agentcore-users`）。パスワード／メール OTP／パスキーによるサインインをサポート、セルフサインアップは無効
- フロントエンド用の User Pool Client（`agentcore-web-client`）。OAuth Authorization Code Grant を有効化し、`FrontendStack` のディストリビューション URL とローカル開発用 URL（`http://localhost:5173/`）をコールバック／ログアウト URL に登録

### `AgentCoreStack`

Bedrock AgentCore Runtime 本体をデプロイします。

- `agent/.agentcore-staging`（`agent/` を `pnpm build` した成果物）をコードアセットとして、`AgentRuntimeArtifact.fromCodeAsset()` で AgentCore Runtime を構築（ECR は不使用）
- ランタイムの認可設定は `AuthStack` の Cognito User Pool / User Pool Client を利用（`RuntimeAuthorizerConfiguration.usingCognito()`）
- Bedrock モデル呼び出し、CloudWatch Logs／Metrics 出力、ワークロードアクセストークン取得に必要な最小権限の IAM ロールを付与

### `FrontendDeployStack`

`frontend/` のビルド成果物を配信基盤へデプロイします。

- `frontend/dist` を `FrontendStack` の S3 バケットへアップロード（`BucketDeployment`）し、CloudFront のキャッシュを無効化
- `amplifyconfiguration.json`（Cognito User Pool ID / Client ID）と `config.json`（リージョン・AgentCore Runtime ARN）をフロントエンド用の設定ファイルとして同時に配置
- S3 操作専用の IAM ロール（Lambda 実行ロール）を使ってデプロイ

## スタックの依存関係

`cdk/bin/app.ts` でのデプロイ順は以下のとおりです。

1. `FrontendStack`（CloudFront の URL を確定させる）
2. `AuthStack`（`FrontendStack` のディストリビューション URL を Cognito のコールバック URL に登録）
3. `AgentCoreStack`（`AuthStack` の User Pool / Client を使って認可設定）
4. `FrontendDeployStack`（`AgentCoreStack` のランタイム ARN と `AuthStack` の Cognito 情報をフロントエンド設定として書き出す）

## よく使うコマンド

- `pnpm build` TypeScript を JavaScript にコンパイル
- `pnpm watch` 変更を監視してコンパイル
- `pnpm test` ユニットテストを実行（vitest）
- `pnx aws-cdk@latest deploy` スタックをデフォルトの AWS アカウント／リージョンにデプロイ
- `pnx aws-cdk@latest diff` デプロイ済みスタックと現在の状態を比較
- `pnx aws-cdk@latest synth` CloudFormation テンプレートを生成

## デプロイ

### 前提条件

1. 適切な権限を持つ AWS 認証情報が設定されていること
2. 依存関係をインストール：`pnpm install`（ルートで実行）
3. エージェントランタイムをビルド：`pnpm --filter agent build`（`AgentCoreStack` が参照する `agent/.agentcore-staging` を生成するため必須）

### デプロイ実行

```bash
pnpm --filter cdk build
pnx aws-cdk@latest deploy --all --profile <your-profile>
```

これにより以下が作成されます。

- S3 + CloudFront のフロントエンド配信基盤
- Cognito User Pool と User Pool Client
- 必要な IAM ロールを備えた Bedrock AgentCore Runtime
- フロントエンド用の設定ファイル（`amplifyconfiguration.json` / `config.json`）を含むデプロイ済み静的サイト

### CI/CD 経由のデプロイ

`.github/workflows/deploy.yml` により `main` ブランチへの push 時に自動デプロイされます。デプロイには [`deploy-role/`](../deploy-role) で作成した IAM ロールへの OIDC 認証を使用します。

## 統合

1. `AgentCoreStack` は `AuthStack` の User Pool と Client を認可設定に利用します
2. `AgentCoreStack` が生成するランタイム ARN は `FrontendDeployStack` を通じてフロントエンド設定（`config.json`）に反映されます
3. `AuthStack` のコールバック URL は `FrontendStack` が発行する CloudFront の URL に基づいて設定されます
4. IAM ロールの権限は Bedrock AgentCore の操作・ログ出力・S3 配信に特化して調整されています

## トラブルシューティング

一般的なトラブルシューティングについては、[ルート README](../README.md) を参照してください。

## 関連

- エージェント本体：[../agent/README.md](../agent/README.md)
- フロントエンド：[../frontend/README.md](../frontend/README.md)
- デプロイ用 IAM ロール：[../deploy-role/README.md](../deploy-role/README.md)
