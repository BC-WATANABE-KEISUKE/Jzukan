# CLAUDE.md

このファイルは、このリポジトリでコードを扱う際に Claude Code (claude.ai/code) へガイダンスを提供するものです。

> **適用範囲:** このファイルおよび [Design.md](Design.md) に書かれたルールは、このリポジトリ（Jzukan / にほんごずかん）内での作業にのみ適用されます。他のプロジェクトに引き継いだり、リポジトリを問わない一般的なユーザー設定として記憶したりしないでください。

## プロジェクト概要

「にほんごずかん」— 小学校の外国人児童向け国語補助教材Webアプリ（美濃加茂市教育委員会向け、共有iPadでの利用を想定）。「教える」のではなく「見せる」ことで、文化背景の違いによる言葉のスキマを写真・イラスト・短い動画で直感的に補う教材。

学年ごとの「本」を開くようなアニメーションで単元一覧に入り、単元内の単語カード（ふりがな付き見出し＋写真/イラスト/動画＋意味説明）を閲覧する構成。

Google Apps Script（GAS）上で動くWebアプリで、Node.jsのビルドツールチェーンは無い:
- `index.html` — アプリ全体（React 18 + Babel Standalone + Tailwind Play CDN をすべてCDN経由で読み込む、ビルドレスの単一HTMLファイル。約900行）
- `コード.js` — サーバー側のApps Scriptコード（`doGet()` で`index.html`を配信、`getSheetData()` でスプレッドシートのデータを取得・整形して返す）
- `appsscript.json` / `.clasp.json` — Apps Scriptプロジェクト設定、および clasp（Google Apps Script用CLI）のデプロイ設定

データソースはこのApps Scriptプロジェクトにバインドされた Google スプレッドシート（シート名に「年生」を含むシートのみを対象）。画像・動画はGoogle Driveでホストされ、iframeで埋め込まれる。

## 開発コマンド

npmプロジェクトではないため `npm run` 系のコマンドは無い。ローカルの変更は clasp コマンドでApps Script側に反映する:

```bash
clasp push      # ローカルの変更をApps Scriptプロジェクトへアップロード
clasp pull      # Apps Script側の内容をローカルへ反映
clasp open      # Apps Scriptエディタをブラウザで開く
clasp deploy    # Webアプリとして（再）デプロイ
```

自動テスト・Lint・CIは無い。`google.script.run` を使うロジック（データ取得等）はApps Script環境でしか動かないため、UIレイアウトの見た目だけをブラウザで素早く確認したい場合を除き、動作確認は基本的に `clasp push` → 実際のWebアプリURLで行う。

## アーキテクチャ

### 単一ファイルのReactモノリス（ビルドレス）

`index.html` 内の `<script type="text/babel">` にReactコンポーネント一式を直書きしている（Babel Standaloneがブラウザ上でJSXをその場でトランスパイルする）。主なコンポーネント:

- `App` — 画面全体の状態（`view`: grade/home/word 等、`activeGrade`、`activeUnit`、ローディング/エラー状態）を持つトップレベルコンポーネント
- `Ruby` — ふりがな（ルビ）表示用。漢字部分にだけ自動でルビを振る独自アルゴリズムを内包
- `WordCard` — 単語カード（写真/イラスト/動画＋ふりがな付き見出し＋意味説明）
- `AboutPage` — 「この教材について」ページ（大人向けの説明文）

学年選択は「本の背表紙を押す→浮き上がる→ページがめくれて開く」という3段階アニメーション（`spineWrapStyle` / `screenStripStyle` / `gradeOverlayStyle`）を経て単元一覧へ遷移する、このアプリ独自の儀式的な導線になっている。

### データは google.script.run 経由でサーバーから取得

`App` のマウント時に `google.script.run.withSuccessHandler(...).getSheetData()` を呼び、`コード.js` 側の `getSheetData()` がスプレッドシートの全「年生」シートを読んで返す。**`getSheetData()` は `PUBLIC_FIELDS` にある列だけをクライアントに返す設計になっており、スプレッドシートに内部用メモ列等を追加しても自動的には公開されない**（[Security_Checklist.md](Security_Checklist.md) 2章）。新しいデータ列を画面で使う場合は `PUBLIC_FIELDS` への追加が必要。

### 共有iPadでの誤操作防止が全体設計に効いている

`index.html` 冒頭の `<style>` で、テキスト選択・タップハイライト・フォーカスリング・ピンチズームをページ全体で無効化している。これは複数児童が共有のiPadで使う運用を前提とした意図的な制約であり、新規UIでもこの制約を崩さないこと（[Design.md](Design.md) 新規画面実装時のガイドライン5参照）。

## デザイン・UI作業

**画面を新規作成・変更する際は、必ず [Design.md](Design.md) を参照し、そこに定義されたカラー・タイポグラフィ・形/余白/影・コンポーネント・モーションのルールに基づいて実装すること。** Design.mdは要点を書き起こしたクイックリファレンスであり、正式なデザインシステムは [Design_Guideline/Jzukan Design System.dc.html](Design_Guideline/Jzukan%20Design%20System.dc.html)（ブラウザで開いて確認するHTML）。色見本やコンポーネントの実物を確認したい場合はHTML版を直接開くこと。

## ドキュメント構成

- [Design.md](Design.md) — デザインシステムのクイックリファレンス（新規画面実装時のガイドライン含む）
- `Design_Guideline/Jzukan Design System.dc.html` — 正式なデザインシステム（HTML、ブラウザ表示用）
- [Security_Checklist.md](Security_Checklist.md) — このアプリの脅威モデル（ログイン不要の匿名公開Webアプリ・スプレッドシートのデータ露出・CDN依存のサプライチェーンリスク）を踏まえたセキュリティチェックリスト
