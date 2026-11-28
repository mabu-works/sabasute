"use strict";
// ==========================================
// 🌐 Webサービス応答チェック API（自動収集）
// 対象24サイト（api/sites.js）へ並行して HTTP リクエストを送り、
// 応答コードと応答時間を JSON で返す Vercel Function。
// レスポンスは CDN に10分キャッシュされる（s-maxage=600）ため、実際のチェックは
// 最大でも10分に1回程度しか走らない。ページ側はこの API のライブ値を優先し、
// 失敗時は status.json の webServices スナップショットにフォールバックする。
// ==========================================

var SITES = require("./sites");

var TIMEOUT_MS = 6000;

// 🔍 1サイト分の応答を測る。HTTP 200 のときだけ online とし、それ以外と通信エラーは down
async function check(site) {
  var started = Date.now();
  var controller = new AbortController();
  var timer = setTimeout(function () { controller.abort(); }, TIMEOUT_MS);
  try {
    var res = await fetch(site.url, {
      signal: controller.signal,
      redirect: "follow",
      headers: { "User-Agent": "sabasute-web-status/1.0" }
    });
    // 本文の内容は見ない。読み切ることで応答時間を実測に近づける
    try { await res.text(); } catch (e) { /* 読み切り失敗でも応答コードは使える */ }
    return {
      name: site.name,
      url: site.url,
      cat: site.cat,
      status: res.status === 200 ? "online" : "down",
      httpStatus: res.status,
      responseMs: Date.now() - started
    };
  } catch (e) {
    return {
      name: site.name,
      url: site.url,
      cat: site.cat,
      status: "down",
      httpStatus: null,
      responseMs: Date.now() - started
    };
  } finally {
    clearTimeout(timer);
  }
}

module.exports = async function handler(req, res) {
  var items = await Promise.all(SITES.map(check));
  res.setHeader("Cache-Control", "public, s-maxage=600, stale-while-revalidate=60");
  res.setHeader("Content-Type", "application/json; charset=utf-8");
  res.status(200).json({
    checkedAt: new Date().toISOString(),
    items: items
  });
};

// 🧪 テスト用に内部関数も公開する（Vercel のハンドラ解決には影響しない）
module.exports.check = check;
module.exports.TIMEOUT_MS = TIMEOUT_MS;
