# Deploy Role（GitHub Actions 用デプロイ IAM ロール）

GitHub Actions から OIDC（OpenID Connect）でこのリポジトリの CDK スタック（[`cdk/`](../cdk)）をデプロイするための IAM ロールを作成する、独立した AWS CDK（TypeScript）プロジェクトです。

## 概要

このスタックが作成する `aws-bedrock-agentcore-runtime-strands-example-deploy-role` は以下の特徴を持ちます。

- **信頼関係**：`token.actions.githubusercontent.com` を OIDC プロバイダーとする `FederatedPrincipal`。`repo:poad/aws-bedrock-agentcore-runtime-strands-example:*` に一致する GitHub Actions ジョブのみが `sts:AssumeRoleWithWebIdentity` でこのロールを引き受け可能（セッションタグ付き）
- **アタッチされているマネージドポリシー**：`CdkDeployMinimalPolicy`（CDK デプロイに必要な最小権限ポリシー）
- **インラインポリシー**：CDK が IAM ロール／ポリシーを作成・更新・削除できるようにするための `iam:*Role*` / `iam:*Policy*` 系アクション

これにより、GitHub Actions のワークフロー（`.github/workflows/deploy.yml`）は長期的な IAM ユーザー認証情報を使わずに、一時的な認証情報でこのリポジトリの CDK スタックをデプロイできます。

## ディレクトリ構成

deploy-role/
├── bin/
│ └── deploy-role.ts # CDK アプリのエントリポイント
├── lib/
│ └── deploy-role-stack.ts # DeployRoleStack の定義
├── cdk.json
└── package.json

## よく使うコマンド

- `pnpm build` TypeScript を JavaScript にコンパイル
- `pnpm watch` 変更を監視してコンパイル
- `pnpm test` ユニットテストを実行（vitest）
- `pnx aws-cdk@latest deploy` このスタックをデフォルトの AWS アカウント／リージョンにデプロイ
- `pnx aws-cdk@latest diff` デプロイ済みスタックと現在の状態を比較
- `pnx aws-cdk@latest synth` CloudFormation テンプレートを生成

## デプロイ

このスタックは他のスタックとは独立して、リポジトリの管理者が一度だけ手動でデプロイすることを想定しています（CI/CD が使う IAM ロール自体を CI/CD より先に作る必要があるため）。

```bash
pnpm install
pnpm --filter deploy-role build
pnx aws-cdk@latest deploy --profile <your-profile>
```

事前に GitHub Actions 用の OIDC プロバイダー（`token.actions.githubusercontent.com`）が対象 AWS アカウントに登録されている必要があります。

## 関連

- このロールを利用するワークフロー：[../.github/workflows/deploy.yml](../.github/workflows/deploy.yml)
- デプロイ対象の CDK スタック：[../cdk/README.md](../cdk/README.md)
