# Jzukan (にほんごずかん) 移行計画書

* **作成日**: 2026-07-20（Cloudflare移行計画として策定）
* **最終更新**: 2026-08-19（移行先の見直しに伴い再構成）
* **ステータス**: **方針見直し中**（移行先を Cloudflare から市役所のIISへ変更する前提で再検討）
* **対象リポジトリ**: `Jzukan-git`

---

## 1. 現状（2026-08-19時点）

* Google Apps Script (GAS) 上の単一 `index.html`（React 18 + Babel Standalone + Tailwind Play CDN、すべてCDN読み込み）と `コード.js` で運用中。
* データソースはバインドされた Google スプレッドシート。画像・動画は Google Drive でホストし、`https://drive.google.com/file/d/<id>/preview` を iframe で埋め込んでいる。
* 学校へは特定のデプロイID（`AKfycbxcDeWWz...`）の `/exec` URLを配布済み。**このURLは変更できない**ため、更新は「同じデプロイIDを新しいバージョンに差し替える」運用で行っている（`clasp create-version` → `clasp redeploy <デプロイID> -V <番号>`）。
* 直近の本番バージョンは `@61`。
* 検証は `@HEAD` デプロイ（`/dev` URL、Googleアカウントの編集権限が必要）で行える。専用のテスト環境は別途構築していない。

---

## 2. 移行方針（要確認）

移行先を **市役所のIIS** とする方針が示されている（2026-08-19）。ただし具体的な構成は未確定であり、以下を確認したうえで設計を確定する。

| # | 確認事項 | なぜ必要か |
|---|---|---|
| 1 | IISで何を動かせるか（静的ファイル配信のみか、ASP.NET等のサーバーサイド処理が使えるか、Node.jsは使えるか） | データ取得・整形をサーバー側で行えるかが決まり、アーキテクチャが変わる |
| 2 | データソースをGoogleスプレッドシートのまま維持するか | 維持する場合、IIS側からGoogle Sheets APIを叩ける経路（外部通信・認証情報の保管）が必要 |
| 3 | 画像・動画の置き場所（Driveのままか、市役所側に置くか） | Drive依存に起因する既知の制約（3章）が解消されるかが決まる |
| 4 | 公開URLをどうするか（学校への再周知が可能か） | 現URLは変更できない前提で運用してきたため、切替方法（併存期間の有無）を決める必要がある |
| 5 | アクセス制御（現在はログイン不要の匿名公開） | 4章の制約により、Googleログインを要する構成は採用できない |
| 6 | 更新運用（先生・教育委員会がブラウザから内容を更新できる形を維持するか） | 非エンジニアによる更新運用は本アプリの前提要件 |
| 7 | 移行時期・並行運用の可否 | 授業期間中の切替可否、切り戻し手段の設計に影響する |

---

## 3. 移行で解消が見込める既知の制約

現在の構成に起因し、**今のままでは直せない**と判明している事項。移行時にまとめて解消できる可能性がある。

* **動画がDriveプレビュー依存であることに起因するもの**（[Issue #4](https://github.com/BC-WATANABE-KEISUKE/Jzukan/issues/4)）
  * 再生終了後、再生ボタンを2回タップしないと再生し直せない
  * 読み込み失敗時のエラー画面（「動画を読み込むことができませんでした」＋詳細／ダウンロード）を消すことも文言を変えることもできない。エラーが起きたこと自体を検知できない
  * Drive側UIを隠すために、枠の上64pxを隠し下に64pxの帯を確保する寸法調整が必要（[Design.md](Design.md) 「動画枠」参照）
  * 児童・教員がDrive側UIを押すと、Googleログイン画面へ遷移し学校のフィルタにブロックされる経路が残る
* **スプレッドシート由来テキストの保存型XSSリスク**（既存 Issue #1）。サーバー側での無害化処理で根本解決できる。
* **GAS固有の運用制約**。デプロイID単位のバージョン管理、`executeAs: USER_DEPLOYING` による実行アカウント権限依存（[Security_Checklist.md](Security_Checklist.md)）。

---

## 4. 移行先を問わず必ず引き継ぐ要件

1. **スプレッドシートによる更新運用の維持**: 先生や教育委員会などの非エンジニアが、ブラウザから単語・画像・意味を更新できる運用をそのまま残す。
2. **ログイン不要（匿名アクセス）**: 学校のiPadはネットワークフィルタが `accounts.google.com` の「Googleアカウントログイン」をブロックする（2026-08-19に実機で確認）。**ログインを要求する構成は採用できない。** Drive等の外部サービスを使い続ける場合も、匿名で参照できる共有設定が前提となる。
3. **共有iPadでの誤操作防止仕様**: テキスト選択・タップハイライト・フォーカスリング・ピンチズームの無効化（[CLAUDE.md](CLAUDE.md) / [Design.md](Design.md)）。
4. **デザインシステムの踏襲**: [Design.md](Design.md) および `Design_Guideline/Jzukan Design System.dc.html` に定義された色・書体・形・モーションのルール。
5. **公開範囲の維持と切り戻し手段**: 現行と同等の「即座に前のバージョンへ戻せる」運用を確保する。

---

## 5. 次のアクション

- [ ] 2章の確認事項を市役所側と整理し、移行先の構成を確定する
- [ ] 確定後、本ドキュメントの2章を「アーキテクチャ設計」に書き換え、実装ステップを引き直す
- [ ] 移行までの間に現行GAS版で対応する改善があれば、GitHub Issue として登録する

---

## 付録A. Cloudflare移行案（2026-07-20策定・**保留**）

移行先がCloudflareであることを前提に策定した案。移行先の変更に伴い保留中だが、**サーバー側でデータを整形・無害化し、フロントは静的配信にする**という考え方はIISでも流用できるため、参考として残す。

### A.1 目的
1. Googleスプレッドシート連携の100%維持
2. コンテンツ表示速度の高速化（Edge/KVキャッシュから配信）
3. 姉妹アプリ `Tatoeba-app` との技術スタック統一（Vite + React 18 + Tailwind CSS 3 / Hono on Cloudflare Workers）
4. スプレッドシート由来テキストのXSSリスクをサーバー側の無害化処理で根本解決

### A.2 データフロー案

```text
[ 先生・教員 (編集者) ]
      │ (ブラウザで今まで通り入力・更新)
      ▼
[ Google スプレッドシート ]
      │ (Google Sheets API 経由で取得)
      ▼
[ Cloudflare Workers (Hono API) ] ─── [ Cloudflare KV (キャッシュ層) ]
  ├─ 1. Google APIからデータ取得
  ├─ 2. テキスト無害化・Sanitize (XSS対策)
  ├─ 3. KV にキャッシュ保存 (TTL: 5~10分)
  └─ 4. GET /api/content でJSONレスポンス配信
      │
      ▼
[ Cloudflare Pages (Vite + React) ] ─── [ 共有iPad ]
```

### A.3 ディレクトリ構成案（`Tatoeba-app` との構造統一）

```text
Jzukan-git/
├── Source/
│   ├── frontend/            # Vite + React 18 + Tailwind CSS 3
│   │   ├── src/
│   │   │   ├── components/  # GradeSelect / UnitList / WordCard / Ruby / AboutPage
│   │   │   ├── utils/contentApi.ts
│   │   │   ├── App.jsx / main.jsx / index.css
│   │   ├── index.html / package.json / vite.config.js
│   └── backend/             # Hono on Cloudflare Workers (TypeScript)
│       ├── src/services/    # sheetsService.ts / sanitize.ts
│       ├── src/routes/content.ts
│       ├── src/index.ts
│       └── wrangler.toml
├── CLAUDE.md / Design.md / Migration_Plan.md / Security_Checklist.md
```

### A.4 技術仕様メモ
* **バックエンド**: Hono / Google Sheets API v4（Service Account認証）/ Cloudflare KV（TTL 5〜10分、手動パージ用の `POST /api/cache/purge` を用意）
* **フロントエンド**: Vite + Tailwind CSS 3、iPad誤操作防止スタイルを `index.css` に継承
* **実装ステップ**: 基盤構築 → バックエンド（Sheets取得・整形・無害化・KV）→ フロントのコンポーネント分割と移植 → GitHub Actions によるCI/CDとデプロイ検証

---

## 6. 参照ドキュメント
* [Design.md](Design.md) — デザインシステム仕様書
* [Security_Checklist.md](Security_Checklist.md) — セキュリティチェックリスト
* [CLAUDE.md](CLAUDE.md) — プロジェクト概要・アーキテクチャ
* `Tatoeba-app/CLAUDE.md` — 姉妹リポジトリのアーキテクチャ構成
