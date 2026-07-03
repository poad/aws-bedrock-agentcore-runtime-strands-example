# AWS Bedrock AgentCore Runtime × Strands Agents Example

Amazon Bedrock AgentCore Runtime 上で [Strands Agents SDK](https://github.com/strands-agents/sdk) を使った TypeScript 製 AI エージェントを動かす、フルスタックのサンプルリポジトリです。

AWS のアーキテクチャ設計を支援するチャットエージェントを題材に、以下を一通り含んでいます。

- AgentCore Runtime 上で動作するエージェントアプリケーション（Node.js / Strands Agents SDK）
- エージェントをデプロイする AWS CDK インフラストラクチャ
- Cognito 認証付きのチャット UI（React + Vite）
- CI/CD 用の GitHub Actions デプロイロール（OIDC）

## 構成

このリポジトリは pnpm workspace によるモノレポです。

| ディレクトリ | 役割 | 詳細 README |
| --- | --- | --- |
| [`agent/`](./agent) | AgentCore Runtime 上で動くエージェント本体（Strands Agents SDK） | [agent/README.md](./agent/README.md) |
| [`cdk/`](./cdk) | AgentCore Runtime・Cognito・フロントエンド配信基盤を構築する CDK スタック群 | [cdk/README.md](./cdk/README.md) |
| [`deploy-role/`](./deploy-role) | GitHub Actions から OIDC でデプロイするための IAM ロールを構築する CDK スタック | [deploy-role/README.md](./deploy-role/README.md) |
| [`frontend/`](./frontend) | AgentCore Runtime とストリーミング通信するチャット UI（React + Vite） | [frontend/README.md](./frontend/README.md) |

## アーキテクチャ概要

ブラウザ（React SPA, CloudFront配信）
│  Cognito User Pool でサインイン
│  アクセストークンを Authorization ヘッダーに付与
▼
Bedrock AgentCore Runtime（Cognito JWT 認証）
│
  ▼
Strands Agent（Node.js） ── aws-knowledge-mcp-server を MCP 経由で利用
│
├─ Amazon Bedrock（基盤モデル呼び出し）
└─ Databricks（OTel Trace/Logs/Metrics を UC テーブルへ送信、任意）

エージェントは AWS の設計・構築を支援するアシスタントとして動作し、`aws-knowledge-mcp-server` を MCP ツールとして呼び出しながら回答します。フロントエンドは Server-Sent Events でエージェントの応答をストリーミング表示します。

## セットアップ

### 前提条件

- Node.js（`package.json` の `devEngines` で指定：`^24.18.0` 相当）
- pnpm（`^11.15.0` 相当）
- 適切な権限を持つ AWS 認証情報

### インストール

```bash
pnpm install
```

### ビルド・Lint（全パッケージ一括）

```bash
pnpm build
pnpm lint
pnpm lint-fix
```

内部的には `pnpm run -r --parallel --if-present` で各ワークスペースの同名スクリプトを並列実行します。

## デプロイの流れ

1. **`cdk/` をデプロイ**：CloudFront/S3 の配信基盤、Cognito User Pool、AgentCore Runtime を作成
2. **`frontend/` をビルド**：`cdk` の `FrontendDeployStack` が `frontend/dist` を S3 にアップロードし、`amplifyconfiguration.json` / `config.json` を生成
3. CI/CD からデプロイする場合は、あらかじめ `deploy-role/` で GitHub Actions 用の IAM ロール（OIDC）を作成しておく

各手順の詳細は、それぞれのサブディレクトリの README を参照してください。

## CI/CD

`.github/workflows/` に以下のワークフローがあります。

- `ci.yml`：Lint・テストなどの CI
- `deploy.yml`：`main` ブランチへの push で `cdk/` を自動デプロイ（`deploy-role/` で作成した IAM ロールを OIDC で引き受け）
- `codeql-analysis.yml`：CodeQL によるコード解析
- `auto-merge.yml`：Dependabot PR の自動マージ

## ライセンス

各サブディレクトリのライセンス表記に従います（`frontend/LICENSE` など）。
