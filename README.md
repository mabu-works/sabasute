# サーバーステータス（公開ページ）

まぶ鯖・水無瀬組・夜凪鯖で動く Bot 群の稼働状況を公開するページ。

| 項目 | 内容 |
|---|---|
| バージョン | 1.0.0 |
| 状態 | 公開中 |
| 稼働先 | [sabasute.vercel.app](https://sabasute.vercel.app)（Vercel） |
| 実装 | 静的 Web サイト（HTML / CSS / JavaScript、api/ で Web サービスの応答状況を自動収集） |
| 更新履歴 | [CHANGELOG.md](CHANGELOG.md) |

## 📖 概要

本体は Bot 群の稼働状況を表示するステータス表示ページです。

- 表示データは同一オリジンの `status.json`（ページは5分ごとに再取得する）
- 将来は監視の再設計（server-guard + 監視ジョブ）がこの JSON を自動更新する想定。当面は復旧作業に合わせて手動で更新する

## 📋 技術メモ

- `status.json` の形式: `generatedAt` / `overall {status, label, message}` / `site {name, url, status, responseMs, uptime24hPercent}` / `servers[] {name, role, status, note, metrics, bots[] {name, status}}`。status は online / down / rebuilding / held / unknown
- `servers[].metrics` は監視チェック時点の計測スナップショット（任意項目）: checkedAt / uptime / pingDiscordMs・pingDiscordLoss / ping11Ms・ping11Loss / cpuPercent / loadAvg / memoryUsedMb・memoryTotalMb・memoryFreePercent / swapPercent / diskPercent・diskUsedGb・diskTotalGb・diskFreeGb / inodePercent / processes / zombies / systemdFailed / oom / pm2LogSize / varLogSize
- Web サービス（Vercel）の応答状況は自動収集: `api/web-status.js` が対象24サイト（このページ自身と `site` の公式サイトを除く）へ並行リクエストし、応答コードと応答時間を返す。CDN キャッシュ（s-maxage=600）で実チェックは最大10分に1回。ページは API のライブ値をチップ形式（カテゴリ `cat`: portfolio / kurashi / gazou / uranai / asobi でグループ表示）で表示し、取得失敗時は `status.json` の `webServices {checkedAt, items[] {name, url, status, responseMs, cat}}` スナップショットにフォールバックする
- 表示文字列への変換（メトリクス行の合成、日時表示、集計）は `status-core.js` の純粋関数に分離してあり、`npm test` で検証する。`status.json` の形・件数と `api/sites.js` との整合もテストで固定している
- テーマはダーク既定＋ライト切り替え（localStorage `sabasute-theme` に保存）。確認用プレビューは別プロジェクト sabasute-preview（同じ内容をデプロイして目視確認してから本番へ反映する運用）
- 「安全の仕組み」セクションは index.html 内の静的コンテンツ（接続の制限 / 自動復旧 / 監視 / バックアップ）
- PWA対応。Service Worker は status.json をキャッシュしない（常に最新を取りに行く）

## 📁 ファイル構成

```
index.html            画面
style.css             スタイル
status-core.js        表示変換の純粋ロジック（テスト対象）
app.js                取得と描画
status.json           表示データ（手動で更新）
api/                  Web サービス応答状況の自動収集（sites.js = 対象定義、web-status.js = 計測 API）
sw.js                 Service Worker
manifest.webmanifest  PWA マニフェスト
icons/                アイコン
vercel.json           Vercel 設定
tests/                単体テスト（node --test）
```
