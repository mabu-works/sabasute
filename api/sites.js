"use strict";
// ==========================================
// 🌐 応答チェック対象の Web サービス一覧（自動収集の対象定義）
// このページ自身（sabasute）と まぶ鯖公式サイト（status.json の site で表示）を除く24サイト。
// status.json の webServices スナップショットと同じ並び・同じカテゴリにそろえてあり、
// 両者がずれていないことは単体テストで固定している。
// cat: portfolio / kurashi / gazou / uranai / asobi（ページ側の表示グループ）
// ==========================================

var SITES = [
  { name: "ポートフォリオ", url: "https://mabu.vercel.app/", cat: "portfolio" },
  { name: "防災情報Web", url: "https://bosai.vercel.app/", cat: "kurashi" },
  { name: "電車の運行情報", url: "https://densha.vercel.app/info/", cat: "kurashi" },
  { name: "環境音ミキサー", url: "https://otoya.vercel.app/", cat: "kurashi" },
  { name: "タイピング練習", url: "https://taipingu.vercel.app/", cat: "kurashi" },
  { name: "集中タイマー", url: "https://shuchuya.vercel.app/", cat: "kurashi" },
  { name: "QRコードメーカー", url: "https://qruya.vercel.app/", cat: "kurashi" },
  { name: "席替え", url: "https://sekiya.vercel.app/", cat: "kurashi" },
  { name: "パスワード生成", url: "https://pasuya.vercel.app/", cat: "kurashi" },
  { name: "Quote画像", url: "https://miaq.vercel.app/", cat: "gazou" },
  { name: "Fake Tweet", url: "https://nisetsui.vercel.app/", cat: "gazou" },
  { name: "架空プロフィール", url: "https://kakupro.vercel.app/", cat: "gazou" },
  { name: "ドクカキ", url: "https://dokukaki.vercel.app/", cat: "gazou" },
  { name: "画像モザイク", url: "https://mozaya.vercel.app/", cat: "gazou" },
  { name: "カラーパレット", url: "https://iropare.vercel.app/", cat: "gazou" },
  { name: "診断メーカー", url: "https://shindanya.vercel.app/", cat: "uranai" },
  { name: "おみくじ", url: "https://mikuji.vercel.app/", cat: "uranai" },
  { name: "話題ガチャ", url: "https://wadaiya.vercel.app/", cat: "asobi" },
  { name: "あみだくじ", url: "https://amidaya.vercel.app/", cat: "asobi" },
  { name: "ルーレット", url: "https://ruletto.vercel.app/", cat: "asobi" },
  { name: "暗号・謎解き", url: "https://nazoya.vercel.app/", cat: "asobi" },
  { name: "ミニゲーム集", url: "https://chibigame.vercel.app/", cat: "asobi" },
  { name: "抽選ツール", url: "https://kujiya.vercel.app/", cat: "asobi" },
  { name: "グループ分け", url: "https://wakeya.vercel.app/", cat: "asobi" }
];

module.exports = SITES;
