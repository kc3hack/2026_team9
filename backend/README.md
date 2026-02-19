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
cp .dev.vars.example .dev.vars
pnpm exec wrangler d1 migrations apply kc3hack2026-9 --local
pnpm dev
```

ローカルで使う値は `backend/.dev.vars` に設定します。  
まず `cp .dev.vars.example .dev.vars` を実行し、以下を実値に置き換えてください。

- `BETTER_AUTH_SECRET`
- `GOOGLE_CLIENT_ID`
- `GOOGLE_CLIENT_SECRET`
- `BETTER_AUTH_URL` (`http://localhost:8787`)

Cloudflare 環境 (`main/develop/pr`) へ反映する secret ファイルは `backend/.secrets/*.env` を使います。  
テンプレートは以下です。

- `backend/.secrets/main.env.example`
- `backend/.secrets/develop.env.example`
- `backend/.secrets/pr.env.example`

## 環境変数の分離

- 本番/開発/PR 環境の値は `wrangler.jsonc` の `vars` と `env.*.vars` で分離します
- ローカル実行時は `.dev.vars` が優先されるため、ローカル専用値をここに置きます
- Better Auth の `redirect_uri` は `BETTER_AUTH_URL` を使うため、環境ごとに必ず設定してください

## 環境変数の設定先ルール

### 1. 非機密値（public/non-secret）

例:

- `FRONTEND_ORIGINS`
- `AUTH_COOKIE_DOMAIN`
- `BETTER_AUTH_URL`

設定先:

- `main/develop/pr`: `backend/wrangler.jsonc` の `vars` / `env.<name>.vars`
- `local`: `backend/.dev.vars`

### 2. 機密値（secret）

例:

- `BETTER_AUTH_SECRET`
- `GOOGLE_CLIENT_ID`
- `GOOGLE_CLIENT_SECRET`

設定先:

- `main/develop/pr`: Cloudflare Workers Secret (`wrangler secret bulk`)
- `local`: `backend/.dev.vars`（ローカル限定）

設定コマンド（推奨）:

```bash
cd backend

# 1) テンプレートから作成（初回のみ）
cp .secrets/main.env.example .secrets/main.env
cp .secrets/develop.env.example .secrets/develop.env
cp .secrets/pr.env.example .secrets/pr.env

# 2) 値を埋める（.secrets/*.env を編集）

# 3) 一括反映
pnpm run secrets:put:main
pnpm run secrets:put:develop
pnpm run secrets:put:pr

# まとめて反映
pnpm run secrets:put:all
```

### 3. CI 実行用の秘密値（GitHub Actions）

用途:

- Cloudflare へ deploy するための認証

設定先:

- GitHub Repository Secrets

値:

- `CLOUDFLARE_API_TOKEN`
- `CLOUDFLARE_ACCOUNT_ID`

## 環境変数を追加するときの手順

1. その変数が `secret` か `non-secret` かを決める
2. `backend/src/types/env.d.ts` に型を追加する
3. `non-secret` なら `backend/wrangler.jsonc` の `vars` / `env.develop.vars` / `env.pr.vars` に追加する
4. `secret` なら `backend/.secrets/main.env` / `develop.env` / `pr.env` に値を追加する
5. Cloudflare に `pnpm run secrets:put:main|develop|pr`（または `pnpm run secrets:put:all`）で反映する
6. ローカル値は `backend/.dev.vars` に追加する
7. `pnpm cf-typegen` を実行して型定義を更新する
8. 必要なら README の変数一覧を更新する

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
