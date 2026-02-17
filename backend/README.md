# Backend (Hono + Cloudflare Workers + Workflows + Workers AI)

このディレクトリは、フロントエンドから受けたタスク入力を Workers AI で分解し、
必要に応じて Workflows と連携して非同期実行する API バックエンドです。

## 技術スタック

- Hono
- Cloudflare Workers
- Cloudflare Workflows
- Workers AI
- TypeScript
- Wrangler

## API エンドポイント

- `GET /`: サービス情報
- `ALL /api/auth/*`: Better Auth (Google OAuth / session)
- `POST /tasks/decompose`: 即時分解（同期実行）
- `POST /workflows/decompose`: Workflow 実行開始（非同期, 要ログイン）
- `GET /workflows/:id`: Workflow 状態確認（要ログイン）

## 構成

このバックエンドは、厳密な DDD ではなく、Cloudflare Workers + Hono で一般的な
「薄いエントリポイント + ルート層 + 機能単位のサービス層」構成です。

- `src/index.ts`: Worker エントリポイント（app生成と Workflow export のみ）
- `src/app.ts`: Hono app の組み立て
- `src/routes/*`: HTTP ルーティング
- `src/features/task-decompose/*`: 入力検証、AI呼び出し、Workflow 実装

## 現在のデプロイ方針

- 通常のデプロイは GitHub Actions (`.github/workflows/deploy-workers.yml`) で自動実行します。
- 手動デプロイは初回確認や緊急時に使います。
- `workers_dev` は無効化し、Custom Domain ルーティングを使います。
- `preview_urls` は有効化しています。

GitHub Actions での自動デプロイ対応:

- PR (`pull_request`): `env.pr` へデプロイ
- `develop` への push: `env.develop` へデプロイ
- `main` への push: top-level 環境へデプロイ

## ドメインと環境

- backend 本番 (`main`): `https://api.kc3hack2026-9.yaken.org`
- backend ステージング (`develop`): `https://api.develop.kc3hack2026-9.yaken.org`
- backend PR (`pull_request`): `https://api.test.kc3hack2026-9.yaken.org`

Cloudflare Workers の環境は `main` が top-level、`develop` が `env.develop`、PR が `env.pr` を使います。

## ローカル開発

```bash
cd backend
pnpm install
pnpm exec wrangler d1 migrations apply kc3hack2026-9-auth --local
pnpm dev
```

Google OAuth を使うため、以下の secrets をローカルにも設定してください。

```bash
cd backend
pnpm exec wrangler secret put BETTER_AUTH_SECRET
pnpm exec wrangler secret put GOOGLE_CLIENT_ID
pnpm exec wrangler secret put GOOGLE_CLIENT_SECRET
```

## 手動デプロイ

初回のみ Cloudflare ログインが必要です。

```bash
cd backend
pnpm exec wrangler login
```

まず dry-run で確認します。

```bash
# 本番 (main)
cd backend
pnpm run deploy --env "" --dry-run

# ステージング (develop)
cd backend
pnpm run deploy --env develop --dry-run

# PR (pull_request)
cd backend
pnpm run deploy --env pr --dry-run
```

実デプロイ:

```bash
# 本番 (main)
cd backend
pnpm run deploy --env ""

# ステージング (develop)
cd backend
pnpm run deploy --env develop

# PR (pull_request)
cd backend
pnpm run deploy --env pr
```

## 現在使っている Cloudflare バインディング

- `AI` (Workers AI)
- `MY_WORKFLOW` (`TaskDecompositionWorkflow`)
- `AUTH_DB` (D1, Better Auth 用)

`wrangler.jsonc` のバインディングを変更したら型定義を再生成してください。

```bash
pnpm cf-typegen
```

## Actions 実行時に必要な Secrets

Repository Secrets（GitHub）に以下を設定します。

- `CLOUDFLARE_API_TOKEN`
- `CLOUDFLARE_ACCOUNT_ID`
- `BETTER_AUTH_SECRET`
- `GOOGLE_CLIENT_ID`
- `GOOGLE_CLIENT_SECRET`

`wrangler.jsonc` の `AUTH_DB.database_id` はダミー値を入れています。実際の D1 database ID に置き換えてください。
