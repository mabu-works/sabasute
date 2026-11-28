# 設計書

サーバーステータス（sabasute）の設計と、作り直しにあたっての同等性棚卸し・判断記録。

## 構成

- 静的サイト（ビルド不要の HTML / CSS / JavaScript）＋ Vercel Function 1本。Vercel で公開。
  - `index.html` — 画面（全体状況 / サーバー / Webサービス / 安全の仕組み / このページについて）
  - `style.css` — スタイル（ダーク既定＋ライト切替、CSS 変数で切替）
  - `status-core.js` — DOM に触れない純粋ロジック（ステータス表示対応、日時整形、メトリクス行の合成、集計、カテゴリ分類、status.json の形検証）
  - `app.js` — status.json と /api/web-status の取得、描画、テーマ切り替え、5分ごとの再取得
  - `status.json` — 手動で更新する表示データ（運用データ）
  - `api/sites.js` — 自動収集の対象24サイトの定義
  - `api/web-status.js` — 対象サイトへ並行リクエストして応答コード・応答時間を返す Function（CDN に10分キャッシュ）
  - `sw.js` — Service Worker（殻だけキャッシュ。status.json は常にネットワーク）
- Windows 版などのコンパニオンアプリは無い（旧実装にも無かった）。

## 同等性棚卸し（旧実装 → 新実装）

### 維持したもの

- ページ構成と文面（上部バー、全体状況カード＋サマリタイル3件、サーバーカード、安全の仕組み4カード、このページについて、フッター）
- status.json のデータ値すべて（後述「引き継いだアセット・データ」参照）。形式（generatedAt / overall / site / servers[] / webServices）も同一
- 表示ルール: ステータス5種（online / down / rebuilding / held / unknown）のドット・ラベル対応、公式サイト行の応答時間・24時間稼働率の合成、メトリクス行の項目・順序・単位表記、Bot ピル、Web チップ（カテゴリ順 portfolio / kurashi / gazou / uranai / asobi / other、応答 ms 表示）
- 取得とフォールバック: status.json を cache: no-store で取得し5分ごとに再取得。Web サービスは /api/web-status のライブ値を優先し、失敗時は status.json の webServices スナップショットで表示。status.json の取得自体に失敗したらエラー文を表示
- 自動収集 API: 対象24サイト（このページ自身と公式サイトを除く）、並行リクエスト、タイムアウト6秒、HTTP 200 のみ online、応答は s-maxage=600 で CDN キャッシュ、User-Agent は `sabasute-web-status/1.0`、Function のリージョン hnd1・最大10秒（vercel.json）
- テーマ: ダーク既定＋ライト切り替え、localStorage キー `sabasute-theme`、描画前の初期化スクリプト、トグルアイコン 🌙/☀️
- デザイン（配色・レイアウト・グラデーション見出し・ドットの発光と脈動アニメーション、prefers-reduced-motion 対応）
- PWA（manifest の内容、Service Worker のキャッシュ対象と取得方式 — status.json は対象外）
- vercel.json のヘッダー（/sw.js と /status.json の Cache-Control、全パスへの nosniff / Referrer-Policy）

### 意図的に変えたもの

- 表示変換ロジックを app.js から `status-core.js` に分離した（挙動は同一）。テストから直接読み込めるようにするため。Service Worker のキャッシュ対象に status-core.js を追加した
- 自動収集の対象一覧を web-status.js 内蔵から `api/sites.js` に分離した（対象・順序・カテゴリは同一）。status.json のスナップショットとずれていないことをテストで固定するため
- 単体テストを新規追加した（旧実装にはテストなし。計25件）。status.json の形・件数（サーバー4台 / Bot23件 / Web 24件）と sites.js との整合も固定した
- CI に手動実行（workflow_dispatch）と単体テストのステップを追加した（旧 CI は構文チェック・JSON 検証・index.html 存在確認のみ）
- Service Worker のキャッシュ名を `sabasute-v5` から `sabasute-v1` に変更した（バージョンリセットに合わせる。旧キャッシュは activate 時に削除されるため影響なし）
- バージョンを 1.0.0 にリセットした（旧実装は日付管理でバージョンなし）

### 引き継いだアセット・データ

- status.json のデータ値すべて: 手動運用データ（コンテンツデータ）として引き継ぎ。旧ファイルとキー順を無視した深い等価比較で完全一致を確認し、形・件数・参照整合をテストで固定した。値の内訳: generatedAt 2026-11-25T17:45:16+09:00、サーバー4台（minase / mabu / yanagi / kura）、Bot 23件（8 / 6 / 3 / 6）、site 1件、webServices スナップショット24件（checkedAt 2026-11-20T18:34:43+09:00）。ファイルの整形（インデント・キー順）は新しい整形にそろえたが、値そのものは変更していない
- PWA アイコン2点（icons/icon-192.png: MD5 57f5fa482d70b78c6b66ba246c9380e5 / icons/icon-512.png: MD5 3527e36386c91ccaa3128c2af18ff292）

### 旧実装になく、追加しなかったもの

- status.json の自動更新（将来の監視再設計の担当範囲であり、このページの作り直しでは扱わない）
- アクセス解析、アカウント機能（旧実装にも無い）

## 判断記録

- 2026-11-28: 全リポジトリ作り直しの一環としてゼロから再実装した。開発手順を統一し（Issue → ブランチ → PR → CI → Rebase and merge）、Issue / PR テンプレートと CONTRIBUTING.md を配置した
- 2026-11-28: status.json は「コード」ではなく「手動運用データ」として、そのまま引き継ぐ判断をした。とくに kura サーバーは 2026-11-28 に削除済みだが、status.json の値はこの作り直しでは変更しない（値の実態反映は運用側の通常のデータ更新として別途行う）。壊れたデータが公開されないよう、形と件数はテストで固定した
- 2026-11-28: ロジック分離（status-core.js / api/sites.js）はテスト可能性のための構造変更で、利用者から見える挙動は変えない。localStorage のキーや保存形式も互換性を保った
- 2026-11-28: バージョン管理を日付管理から SemVer に切り替え、v1.0.0 とした
