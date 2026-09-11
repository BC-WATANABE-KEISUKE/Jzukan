# にほんごずかん（Jzukan）

小学校の外国人児童向け国語補助教材Webアプリ。美濃加茂市教育委員会向けに開発し、市内小学校の共有iPadでの利用を想定している。

> このREADMEは外部開発会社への見積もり・引き継ぎ資料として作成したもの。開発方針・設計ルールの詳細は [CLAUDE.md](CLAUDE.md) / [Design.md](Design.md) / [Migration_Plan.md](Migration_Plan.md) / [Security_Checklist.md](Security_Checklist.md) を参照。

---

## 1. アプリの概要

### 目的

文化背景や生活経験の違いによって生じる言葉の理解のスキマ（例：「豆まき」「先祖」「あちこち」など、教科書の場面理解に必要だが外国人児童には馴染みの薄い語彙）を、**「教える」のではなく「見せる」**ことで直感的に補う。1つの語彙に対して写真・イラスト・短い動画のいずれか1点を提示し、読解など本質的な学びに時間を割けるようにする。

### 画面構成と利用の流れ

1. **学年選択画面** — 本棚に並んだ学年ごとの「本」を選ぶ。本を押すと浮き上がり、ページがめくれて開くアニメーションで単元一覧へ遷移する（このアプリ独自の演出）。
2. **単元一覧画面（home）** — 開いた本の見開きに単元カードが並ぶ。複数ページある場合はページめくりで切り替える。
3. **単語カード画面（unit）** — 選んだ単元の単語カードを縦スクロールで閲覧する。各カードは「ふりがな付き見出し＋写真/イラスト/動画＋意味説明」で構成。「もくじ」から任意の語へジャンプできる。
4. **この教材について（about）** — 教員向けの説明ページ。収録／非収録の語彙の判断基準を記載。

### 運用上の前提

- **ログイン不要**の匿名公開Webアプリ（学校ネットワークが `accounts.google.com` をブロックしているため、Googleログインを前提にした設計は取れない）。
- **共有iPad**での複数児童利用を想定し、テキスト選択・タップハイライト・フォーカスリング・ピンチズームをページ全体で無効化している。
- コンテンツ（語彙・ふりがな・意味・画像/動画ID）は**Googleスプレッドシートで非エンジニアが編集**する。画像・動画はGoogleドライブでホストし、iframe/サムネイルURLで埋め込む。
- イラストは生成AIで制作。動画も一部生成AIを使用。実在するものを描いたイラストの一部は、伝わりやすさを優先して細部を簡略化している。素材の詳細は教育委員会が一元管理。

---

## 2. 技術構成

### 全体像

Google Apps Script（GAS）上で動作する**ビルドレスの単一HTMLアプリ**。Node.jsのビルドツールチェーン（npm / バンドラ / トランスパイル）は一切なく、JSXはブラウザ上でBabel Standaloneがその場でトランスパイルする。

| 層 | 技術 |
|---|---|
| フロントエンド | React 18（UMD、CDN読み込み）+ JSX（Babel Standaloneでブラウザ内トランスパイル）+ Tailwind CSS（Play CDN）。全コンポーネントを `index.html` 内の1つの `<script type="text/babel">` に直書きした単一ファイルのReactモノリス（約950行のJS + 約175行のCSS）。 |
| バックエンド | Google Apps Script（V8ランタイム）。`コード.js` の `doGet()` が `index.html` を配信し、`getSheetData()` が唯一のデータAPI。クライアントからは `google.script.run` 経由で呼ぶ。 |
| データストア | このApps ScriptプロジェクトにバインドされたGoogleスプレッドシート（シート名に「年生」を含むシートのみ対象）。 |
| アセット配信 | Googleドライブ（画像はサムネイルURL、動画は `drive.google.com/file/d/<id>/preview` のiframe）。 |
| デプロイ | clasp（Google Apps Script用CLI）でWebアプリとしてデプロイ。 |

### 使用ライブラリとバージョン

すべて外部CDNから読み込む。`package.json` / lockfile は存在しない。

| ライブラリ | バージョン | 読み込み元 | 備考 |
|---|---|---|---|
| React | **18.3.1** | `unpkg.com/react@18.3.1/umd/react.production.min.js` | SRI（`integrity`）付き |
| ReactDOM | **18.3.1** | `unpkg.com/react-dom@18.3.1/umd/react-dom.production.min.js` | SRI付き |
| @babel/standalone | **7.12.9** | `unpkg.com/@babel/standalone@7.12.9/babel.min.js` | SRI付き。**意図的に古いバージョンに固定**（新しいBabelが `import/export` を出力してGAS環境で動かなくなる問題の回避。`index.html` 9行目・194行目のコメント参照） |
| Tailwind CSS | **バージョン指定なし**（Play CDN、常に最新のv3系） | `cdn.tailwindcss.com` | 公式には本番非推奨。リクエストごとに内容が変わるためSRIを付けられない |
| Google Fonts | Klee One（weight 400 / 600） | `fonts.googleapis.com` | iPad内蔵フォントが認識されない場合の予備 |

### GAS プロジェクト設定（`appsscript.json`）

| 項目 | 値 |
|---|---|
| `runtimeVersion` | `V8` |
| `timeZone` | `Asia/Tokyo` |
| `exceptionLogging` | `STACKDRIVER` |
| `webapp.executeAs` | `USER_DEPLOYING`（デプロイしたGoogleアカウントの権限で実行） |
| `webapp.access` | `ANYONE_ANONYMOUS`（誰でもログインなしでアクセス可） |
| `dependencies` | なし（Advanced Services・ライブラリ未使用） |

---

## 3. ディレクトリ構成

```
Jzukan-git/
├── index.html                       アプリ本体（フロントエンド全部）。CDN読み込み + <style> + <script type="text/babel">
├── コード.js                        サーバー側 Apps Script。doGet() と getSheetData() のみ
├── appsscript.json                  Apps Script マニフェスト（ランタイム・Webアプリ公開設定・ログ）
├── .clasp.json                      clasp CLI 設定（対象 scriptId、同期するファイル種別）
├── .gitignore                       .DS_Store と .clasprc.json のみ除外
├── start.sh                         ローカル静的プレビュー起動（python3 -m http.server 8000）※gitには未コミット
├── CLAUDE.md                        プロジェクト概要・開発コマンド・アーキテクチャ解説（実質的な開発者向けREADME）
├── Design.md                        デザインシステムのクイックリファレンス（色・書体・余白・モーション・新規画面ガイドライン）
├── Design_Guideline/
│   └── Jzukan Design System.dc.html  正式なデザインシステム（ブラウザ表示用HTML。※同梱の support.js は未添付）
├── Migration_Plan.md                GASからの移行計画書（移行先の再検討中。GAS固有の制約と引き継ぐべき要件を整理）
└── Security_Checklist.md            このアプリの脅威モデルとデプロイ前セキュリティチェックリスト
```

### `index.html` の内部構造（上から順に）

| 区分 | 内容 |
|---|---|
| `<head>` | 4つのCDN（Tailwind / React / ReactDOM / Babel）+ Google Fonts の読み込み |
| `<style>` | 共有iPad向けの誤操作防止（no-select / no-zoom / no-focus-ring）、動画枠のレイアウトハック、各ボタンの押下時スタイル |
| `Icons` | Back / Grid / X の SVG アイコン |
| `Ruby` | ふりがな（ルビ）表示。漢字部分だけに自動でルビを割り当てる独自アルゴリズムを内包（メモ化再帰＋フォールバック整列。ファイル中で最も複雑なロジック） |
| `WordCard` | 単語カード。画像の縦横比に応じた表示切替、複数画像の切替、動画の再読み込みボタン |
| `AboutPage` | 「この教材について」ページ |
| `BOOKSHELF_BG_HTML` ほか定数 | 学年選択画面の本棚背景（静的マークアップ文字列）、学年ごとの配色パレット、固定デザインサイズ(860×620) |
| `spineWrapStyle` / `screenStripStyle` / `gradeOverlayStyle` | 本を開くアニメーションの各段階のインラインスタイルを組み立てる関数 |
| `App` | 画面全体の状態（`view`: grade / home / unit / about、`activeGrade`、`activeUnit`、ローディング/エラー）を持つトップレベルコンポーネント。`view` の値で表示を分岐 |

---

## 4. ローカルでの動かし方

### 前提ソフトウェア

| 用途 | 必要なもの |
|---|---|
| UIレイアウトのプレビュー | Python 3 |
| Apps Scriptへの反映・デプロイ | Node.js + `@google/clasp`（`npm install -g @google/clasp`） |
| データ取得・デプロイ | 対象のApps Scriptプロジェクト・スプレッドシート・ドライブ素材に権限のあるGoogleアカウント |

### A. UIレイアウトだけをブラウザで確認する

```bash
./start.sh
# → http://localhost:8000 を開く
```

（親ディレクトリの共通ランチャー `../start.sh` から「2」を選んでも可）

**制約:** データ取得は `google.script.run.getSheetData()` に依存しており、これはGASランタイム内でしか動かない。ローカルでは学年一覧・単元・単語カードは表示されず、エラー画面またはローディングのままになる。見た目の骨格・アニメーションの確認用途に限られる。`Design_Guideline/*.dc.html` も同梱の `support.js` が無いためローカルでは完全には描画されない。

### B. 実際の変更を反映する（clasp）

```bash
clasp login              # 初回のみ。認証情報は ~/.clasprc.json に保存される（リポジトリ外・.gitignore対象）
clasp push               # ローカルの変更を Apps Script プロジェクトへアップロード
clasp pull               # Apps Script 側の内容をローカルへ反映
clasp open               # Apps Script エディタをブラウザで開く
```

動作確認は基本的に `clasp push` → 実際のWebアプリURL（`@HEAD` の `/dev` URL）で行う。`/dev` URLの閲覧には対象プロジェクトに編集権限のあるGoogleアカウントが必要。

### C. 本番デプロイ

固定のデプロイIDに対してバージョンを差し替える運用（詳細は [Migration_Plan.md](Migration_Plan.md) §14）。

```bash
clasp create-version "<変更内容>"
clasp redeploy <デプロイID> -V <バージョン番号>
```

- 配布済みの `/exec` URLを変えないため、デプロイIDは固定で変更しない。
- ステージング環境は無い。ロールバックはバージョンの手動差し替え。

### テスト・Lint・CI

**いずれも無し。** 自動テスト、リンター、フォーマッター、CIパイプライン、`npm audit` 相当の依存脆弱性スキャンは存在しない。

---

## 5. 既知の未対応事項・技術的負債

引き継ぎにあたり正直に記載する。

### 移行先が未確定（最重要）

[Migration_Plan.md](Migration_Plan.md) は「方針見直し中」。当初のCloudflare移行案は棚上げされ、新しい移行先候補は「市役所のIIS」だが、静的配信のみ可なのか / ASP.NET が使えるのか / Node が使えるのか、いずれも未確認。**外部見積もりはこの未確定の移行先を前提に含む必要がある。** 移行時に必ず維持すべき要件（[Migration_Plan.md](Migration_Plan.md) §4）:

- 非エンジニアがスプレッドシートで語彙を編集できること
- ログイン不要・匿名アクセス
- 共有iPad向けの誤操作防止
- デザインシステムの踏襲
- 即時ロールバック

### ビルド・開発基盤

- **ビルドステップ・`package.json`・lockfileが無い**ため、依存バージョンの固定管理・脆弱性スキャンができない。[Security_Checklist.md](Security_Checklist.md) は React / ReactDOM / Babel の**手動**での月次バージョン確認を求めている。
- **Babel Standaloneがページ読み込みごとにブラウザ上でJSXをトランスパイルする**。共有iPad上での初期表示にレイテンシが乗る。かつ 7.12.9（2020年12月）に固定されており、アップグレードには前述の `import/export` 回避策の再検証が必要。
- **Tailwind は Play CDN（`cdn.tailwindcss.com`、バージョン指定なし）**。公式に本番非推奨で、内容がリクエストごとに変わるためSRIで保護できない。
- 単一の1,150行 `index.html` にCSS・全コンポーネント・アニメーションロジックが同居しており、分割されていない。
- サーバーファイル名が非ASCII（`コード.js`）。gitではエスケープ表現で保存され、ツールによっては扱いにくい。
- 自動テスト・CI・staging環境・LICENSEファイルが無い。`start.sh` は未コミット。

### セキュリティ（詳細は [Security_Checklist.md](Security_Checklist.md)）

- Webアプリは `ANYONE_ANONYMOUS` かつ `executeAs: USER_DEPLOYING` のため、`コード.js` はデプロイしたアカウントのSheets/Drive権限で実行される。学校ネットワークの制約上、ログインゲートは選択肢に入れられない（構造的制約）。
- **スプレッドシート由来テキストのストアドXSS懸念**: `Ruby` コンポーネントがスプレッドシートの文字列を `dangerouslySetInnerHTML` で描画し、`&lt;` → `<` の再デコードまで行う（`index.html` 216〜222行目付近、本棚背景の注入箇所も同様）。サーバー側（`コード.js`）にサニタイズ処理は無い。GitHub Issue #1 として追跡中、[Migration_Plan.md](Migration_Plan.md) §3 に記載。
- データ公開範囲の制御は `コード.js` の `PUBLIC_FIELDS` 配列（手動メンテナンス）1つに依存。UIで使う列を追加する際はここへの追記が必須（追記しないと画面に出ないが、内部用メモ列を勝手に公開しない安全側の設計でもある）。
- CDN（unpkg / cdn.tailwindcss.com / Google Fonts）のサプライチェーンリスクが [Security_Checklist.md](Security_Checklist.md) で最重要脅威とされている。React/ReactDOM/BabelにはSRIがあるが、Tailwind と Google Fonts には付けられない。
- エラー画面が `google.script.run` の `err.message` を生で表示する（`index.html` 786〜791行目付近）。内部情報の漏洩可能性を [Security_Checklist.md](Security_Checklist.md) §5 が指摘。

### Googleドライブ埋め込みの制約（[Migration_Plan.md](Migration_Plan.md) §3 / GitHub Issue #4）

- 動画は再生終了後、再生し直すのにダブルタップが必要。
- クロスオリジンiframe内のDrive側エラー表示を検知・非表示・文言変更できず、常設の「もういちど よみこむ」ボタン（iframeを React `key` で作り直す）が唯一の復旧手段。
- 動画時は上64pxを隠し下に64pxの帯を確保するCSSハック（`index.html` 129〜152行目付近）でDrive自身のUIを子要素から遠ざけている。
- DriveのUIをタップするとGoogleログインページへ遷移してしまい、学校フィルタでブロックされることがある。

### コメント密度

- `index.html` のReact部分（約950行）に対しインラインコメントはごく少数（コンポーネント間の「なぜ存在するか」の一行コメントが中心。アルゴリズムの説明はほぼ無し）。本引き継ぎで主要コンポーネント・関数に説明コメントを追記した。
- `コード.js` はセキュリティ上重要な `PUBLIC_FIELDS` の意図のみコメント済み。他の関数は短く可読なため最小限。

---

## 6. リポジトリ情報

- GitHub: `BC-WATANABE-KEISUKE/Jzukan`
- ブランチ: `main`
- 機密情報スキャン結果: APIキー・トークン・OAuthシークレット・パスワード・サービスアカウントJSON・メールアドレスはリポジトリ内に**存在しない**（このアプリは実行時シークレットを持たない設計）。`.clasp.json` の `scriptId` はプロジェクト識別子であり機密ではない（[Security_Checklist.md](Security_Checklist.md) §8）。clasp の認証トークン（`.clasprc.json`）はホームディレクトリ側にあり、リポジトリ外かつ `.gitignore` 対象。
