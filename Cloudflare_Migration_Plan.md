# Jzukan (にほんごずかん) Cloudflare 移行設計・実装計画書

* **作成日**: 2026-07-20
* **ステータス**: 計画・設計フェーズ (未実装)
* **対象リポジトリ**: `Jzukan-git`

---

## 1. 概要と目的

### 1.1 背景
現在 `Jzukan`（にほんごずかん）は Google Apps Script (GAS) 上で単一 `index.html`（React + Babel Standalone + Tailwind Play CDN）および `コード.js` として運用されています。
今後、姉妹アプリである `Tatoeba-app` と技術スタックおよび構成を統一し、パフォーマンス・保守性・セキュリティを高めるため、Cloudflare への移行計画を策定しました。

### 1.2 目的・要件
1. **Googleスプレッドシート連携の100%維持**: 先生や教育委員会などの非エンジニアが、ブラウザから簡単に単語・画像・意味などのコンテンツを更新できる運用をそのまま残す。
2. **コンテンツ表示速度の爆速化**: 共有iPad等での利用時、Google APIのレスポンス遅延を排除し、CloudflareのEdge（KVキャッシュ）から数ミリ秒で即座にデータを出力する。
3. **技術スタックの統一**: `Tatoeba-app` と同じく `Vite + React 18 + Tailwind CSS 3` (フロントエンド) および `Hono` on Cloudflare Workers (バックエンド) の構成を採用する。
4. **セキュリティ向上**: 既存イシュー #1 にある「スプレッドシート由来テキストの保存型XSSリスク」をバックエンド（Workers）でのデータ整形・無害化（Sanitization）処理により根本解決する。

---

## 2. アーキテクチャ設計

### 2.1 全体データフロー

```text
[ 先生・教員 (編集者) ]
      │ (ブラウザで今まで通り入力・更新)
      ▼
[ Google スプレッドシート ]
      │
      │ (Google Sheets API 経由で取得)
      ▼
[ Cloudflare Workers (Hono API) ] ─── [ Cloudflare KV (キャッシュ層) ]
  ├─ 1. Google APIからデータ取得
  ├─ 2. テキスト無害化・Sanitize (XSS対策)
  ├─ 3. KV にキャッシュ保存 (TTL: 5~10分)
  └─ 4. GET /api/content でJSONレスポンス配信
      │
      ▼ (数ミリ秒の爆速レスポンス)
[ Cloudflare Pages (Vite + React) ] ─── [ 共有iPad (児童) ]
```

---

## 3. ディレクトリ構成 (`Tatoeba-app` との構造統一)

`Tatoeba-app` のマルチパッケージ構造に倣い、`Source/frontend` と `Source/backend` の2つのプロジェクトに分割します。

```text
Jzukan-git/
├── Source/
│   ├── frontend/            # Vite + React 18 + Tailwind CSS 3
│   │   ├── src/
│   │   │   ├── components/  # 分割された各UIコンポーネント
│   │   │   │   ├── GradeSelect.jsx  # 学年選択（本の背表紙・めくりアニメーション）
│   │   │   │   ├── UnitList.jsx     # 単元一覧
│   │   │   │   ├── WordCard.jsx     # 単語・写真/イラスト/動画カード
│   │   │   │   ├── Ruby.jsx         # ふりがな（ルビ）自動付与コンポーネント
│   │   │   │   └── AboutPage.jsx    # この教材について（大人向け説明文）
│   │   │   ├── utils/
│   │   │   │   └── contentApi.ts    # Workers APIからのfetch処理
│   │   │   ├── App.jsx              # アプリ全体の状態管理
│   │   │   ├── main.jsx             # Reactエントリーポイント
│   │   │   └── index.css            # タッチ誤操作防止スタイル, Tailwindディレクティブ
│   │   ├── index.html
│   │   ├── package.json
│   │   └── vite.config.js
│   │
│   └── backend/             # Hono on Cloudflare Workers (TypeScript)
│       ├── src/
│       │   ├── services/
│       │   │   ├── sheetsService.ts  # Google Sheets API連携
│       │   │   └── sanitize.ts       # HTML/テキスト無害化処理 (XSS対策)
│       │   ├── routes/
│       │   │   └── content.ts        # GET /api/content 端点
│       │   └── index.ts
│       ├── package.json
│       └── wrangler.toml            # WorkersおよびCloudflare KVの設定
│
├── CLAUDE.md
├── Design.md
├── Cloudflare_Migration_Plan.md     # 本ドキュメント
└── Security_Checklist.md
```

---

## 4. コンポーネントおよび技術仕様

### 4.1 バックエンド (Cloudflare Workers / Hono)
* **フレームワーク**: Hono
* **Google API連携**: Google Sheets API v4 (Service Account 認証キーを使用)
* **キャッシュ戦略**: 
  * Cloudflare KV にレスポンス用 JSON をキャッシュ。
  * キャッシュの有効期限 (TTL) は標準 5〜10 分。
  * 必要に応じて手動キャッシュクリア用のシークレット端点 (`POST /api/cache/purge`) を準備。
* **XSSセキュリティ要件 (Issue #1 対応)**:
  * スプレッドシートから取得したテキスト中の HTML タグ・Script タグを強固に sanitize（無害化）した上で KV およびクライアントへ配信。

### 4.2 フロントエンド (Vite + React)
* **ビルドツール**: Vite
* **スタイリング**: Tailwind CSS 3
* **iPad誤操作防止仕様の継承**:
  * 共有iPadでの誤操作を防ぐため、`index.css` にてテキスト選択、タップハイライト、フォーカスリング、ピンチズームの無効化スタイルを設定。

---

## 5. 段階的実装ステップ (Roadmap)

### Phase 1: プロジェクト基盤の構築
- [ ] `Source/frontend` プロジェクトの作成 (`npm create vite@latest`) と Tailwind CSS 3 の導入
- [ ] `Source/backend` プロジェクトの作成 (`npm create hono@latest`)
- [ ] `Design.md` に基づくデザインシステム・CSSユーティリティの整理

### Phase 2: バックエンド (Workers) 開発
- [ ] Service Account による Google Sheets API 読み込み処理の実装
- [ ] スプレッドシートの「年生」シートデータ抽出・整形ロジックの構築
- [ ] HTML/テキストの無害化サニタイズ処理の実装
- [ ] Cloudflare KV キャッシュ層の統合とテスト

### Phase 3: フロントエンド リファクタリング & 移植
- [ ] `index.html` 内の React コードを `Source/frontend/src/components/` へコンポーネント分割
- [ ] `Ruby.jsx`（ルビ自動付与独自アルゴリズム）の移植と単体テスト
- [ ] `contentApi.ts` を作成し、Workers API (`GET /api/content`) と連動

### Phase 4: CI/CD & デプロイ設定
- [ ] GitHub Actions ワークフロー (`.github/workflows/ci.yml`) の構築
- [ ] Cloudflare Pages (フロントエンド) および Cloudflare Workers (バックエンド) への自動デプロイ確認
- [ ] 実環境での動作検証・パフォーマンステスト

---

## 6. 参照ドキュメント
* `Design.md` — Jzukan デザインシステム仕様書
* `Security_Checklist.md` — セキュリティチェックリスト
* `Tatoeba-app/CLAUDE.md` — 姉妹リポジトリのアーキテクチャ構成
