# Preflop Range Quiz

`public/hand_range.csv` に定義されたハンドレンジを暗記するための React + Vite 製シングルページアプリ。重み付き乱数でミスしがちなハンドが出題され、ローカルストレージに履歴を保存できる。

## 必要ツール

- Node.js 18+ (開発環境では 22 系を使用)
- npm

## セットアップ

```bash
npm install
```

## 開発サーバー

```bash
npm run dev
```

ブラウザで http://localhost:5173 を開く。CSV は `public/hand_range.csv` から配信される。

## ビルド

```bash
npm run build
```

`dist/` に本番ビルドが生成される。

## GitHub Pages へのデプロイ

1. GitHub のリポジトリ設定で `Settings > Pages > Build and deployment > Source` を **GitHub Actions** に設定する。
2. `.github/workflows/deploy.yml` が `master` ブランチへの push をトリガーに自動実行され、`dist/` を Pages へ配信する。
3. デプロイ完了後、Actions ログに表示される URL（例: `https://taksai.github.io/preflop-range-quiz/`）でアプリが公開される。

### 手動デプロイ (バックアップ)

GitHub Actions が使えない場合は下記コマンドで `gh-pages` ブランチへ直接配信できる。

```bash
npm run deploy
```

## 設定メモ

- `vite.config.ts` の `base` は GitHub Pages の公開パス `/preflop-range-quiz/` に合わせてある。独自ドメイン等に切り替える場合は適宜変更する。
- ローカルストレージキー: `preflop-range-progress`。ブラウザごとに学習履歴が分かれる仕様。
