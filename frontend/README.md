# Frontend (Next.js + OpenNext + Cloudflare Workers)

このディレクトリは、Google OAuth で認証したユーザーの入力を受け取り、バックエンド Worker へ渡すフロントエンドです。  
バックエンド側では Workers AI / Workflows / D1 を使って予定候補を生成し、Google Calendar へ登録します。

## 技術スタック

- Next.js 16 (App Router)
- React 19
- Chakra UI v3
- OpenNext (`@opennextjs/cloudflare`)
- Wrangler

## 現在のデプロイ方針

- Cloudflare Workers へ OpenNext 経由でデプロイします。
- このリポジトリでは **OpenNext の R2 incremental cache は使いません**。
- incremental cache は `static-assets-incremental-cache` を利用します。

この設定は、認証中心の動的フローには十分です。  
ただし以下は使えない前提です。

- ISR 的な再生成（時間ベースの再検証）
- `revalidatePath` / `revalidateTag` を使った再検証フロー

つまり、`export const revalidate`は`dynamic`や`no-store`以外は指定できません。

将来的に ISR が必要になった場合は、R2 バケット構成へ戻してください。

## 構成の要点

- `src/app/layout.tsx`: ルートレイアウトと全体 Provider
- `src/components/ui/provider.tsx`: Chakra UI / テーマ設定
- `next.config.ts`: 開発時の OpenNext 初期化と Next 設定
- `open-next.config.ts`: OpenNext の Cloudflare 向け設定
- `wrangler.jsonc`: Worker エントリ、assets、service/images バインディング設定

## ローカル開発

```bash
cd frontend
npm ci
npm run dev
```

ブラウザで [http://localhost:3000](http://localhost:3000) を開いて確認します。

## プレビューとデプロイ

```bash
cd frontend
npm run preview
npm run deploy
```

初回のみ Cloudflare ログインが必要です。

```bash
npx wrangler login
```

## 現在使っている Cloudflare バインディング

- `ASSETS` (`.open-next/assets`)
- `WORKER_SELF_REFERENCE` (self-service binding)
- `IMAGES` (Cloudflare Images 最適化)

`wrangler.jsonc` のバインディングを変更したら型定義を再生成してください。

```bash
npm run cf-typegen
```

## CI 運用の注意

デプロイ経路は 1 つに統一してください。  
GitHub Actions と Cloudflare 側 Git 連携を同時に有効化すると、二重デプロイになりやすいです。
