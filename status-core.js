"use strict";
// ==========================================
// 🖥️ サーバーステータス公開ページ — 純粋ロジック
// status.json のデータを「表示用の文字列・集計結果」に変換する部分だけを集めた、
// DOM に触れないモジュール。ブラウザでは app.js の前に読み込まれてグローバルを共有し、
// Node では require して単体テストから使う。
// ==========================================

// 🎨 ステータス値 → ドットのクラス名と日本語ラベル
var STATUS_META = {
  online: { dot: "dot-online", label: "稼働中" },
  down: { dot: "dot-down", label: "停止中" },
  rebuilding: { dot: "dot-rebuilding", label: "復旧作業中" },
  held: { dot: "dot-unknown", label: "開始待ち" },
  unknown: { dot: "dot-unknown", label: "不明" }
};

// 🌐 Webサービスのチップ表示で使うカテゴリ（この順でグループ表示する）
var WEB_CATS = [
  { key: "portfolio", label: "ポートフォリオ" },
  { key: "kurashi", label: "くらし・実用" },
  { key: "gazou", label: "画像・投稿づくり" },
  { key: "uranai", label: "占い・診断" },
  { key: "asobi", label: "抽選・ゲーム・遊び" },
  { key: "other", label: "その他" }
];

// ❓ 未知のステータス値は unknown として扱う
function statusMeta(status) {
  return STATUS_META[status] || STATUS_META.unknown;
}

function isKnownStatus(status) {
  return Object.prototype.hasOwnProperty.call(STATUS_META, status);
}

// 🕐 ISO日時文字列を日本時間の表示文字列にする（解釈できなければ空文字）
// withYear=true: 「2026/11/25 17:45」、false: 「11/25 17:45」
function formatDateTime(iso, withYear) {
  if (!iso) return "";
  var d = new Date(iso);
  if (isNaN(d.getTime())) return "";
  var opts = {
    timeZone: "Asia/Tokyo",
    month: "numeric",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit"
  };
  if (withYear) opts.year = "numeric";
  return d.toLocaleString("ja-JP", opts);
}

// 📶 Ping表示: 数値なら「12ms」、ロス率があれば「12ms（ロス 0%）」
function formatPing(msValue, loss) {
  if (typeof msValue !== "number") return null;
  var text = msValue + "ms";
  if (typeof loss === "number") text += "（ロス " + loss + "%）";
  return text;
}

// 🧮 メトリクス1件分を [ラベル, 表示値] にする。値が無ければ null
function metricMemory(m) {
  if (typeof m.memoryUsedMb !== "number" || typeof m.memoryTotalMb !== "number") return null;
  var text = m.memoryUsedMb + "MB / " + m.memoryTotalMb + "MB";
  if (typeof m.memoryFreePercent === "number") text += "（空き " + m.memoryFreePercent + "%）";
  return text;
}

function metricDisk(m) {
  if (typeof m.diskPercent !== "number") return null;
  var text = m.diskPercent + "% 使用";
  if (typeof m.diskFreeGb === "number") text += "（空き " + m.diskFreeGb + "GB）";
  return text;
}

function metricAnomaly(m) {
  if (typeof m.systemdFailed !== "number" && typeof m.oom !== "number") return null;
  return "systemd失敗 " + (m.systemdFailed != null ? m.systemdFailed : "-") + "件 / OOM " +
    (m.oom != null ? m.oom : "-") + "件";
}

function metricLogSize(m) {
  if (!m.pm2LogSize && !m.varLogSize) return null;
  return "pm2ログ " + (m.pm2LogSize || "-") + " / /var/log " + (m.varLogSize || "-");
}

// 📋 サーバーのメトリクスを表示行の配列にする（値のある項目だけ、表示順は固定）
function buildMetricRows(m) {
  if (!m) return [];
  var candidates = [
    ["Ping（discord.com）", formatPing(m.pingDiscordMs, m.pingDiscordLoss)],
    ["Ping（1.1.1.1）", formatPing(m.ping11Ms, m.ping11Loss)],
    ["CPU", typeof m.cpuPercent === "number" ? m.cpuPercent + "%" : null],
    ["ロードアベレージ", m.loadAvg],
    ["メモリ", metricMemory(m)],
    ["スワップ", typeof m.swapPercent === "number" ? m.swapPercent + "% 使用" : null],
    ["ディスク", metricDisk(m)],
    ["inode", typeof m.inodePercent === "number" ? m.inodePercent + "% 使用" : null],
    ["サーバー稼働時間", m.uptime],
    ["異常系", metricAnomaly(m)],
    ["ログ容量", metricLogSize(m)]
  ];
  return candidates.filter(function (pair) { return pair[1] != null && pair[1] !== ""; });
}

// 🌐 公式サイト行の表示文字列（site が無ければ null）
function siteLineText(site) {
  if (!site) return null;
  var text = "🌐 " + (site.name || "公式サイト") + ": " + statusMeta(site.status).label;
  var hasMs = typeof site.responseMs === "number";
  var hasUptime = typeof site.uptime24hPercent === "number";
  if (hasMs) text += "（応答 " + site.responseMs + "ms";
  if (hasUptime) text += (hasMs ? " · " : "（") + "24時間稼働率 " + site.uptime24hPercent + "%";
  if (hasMs || hasUptime) text += "）";
  return text;
}

// 🧮 サーバーとBotの稼働数を数える
function summarizeServers(servers) {
  var list = servers || [];
  var result = { serverOnline: 0, serverTotal: list.length, botOnline: 0, botTotal: 0 };
  list.forEach(function (server) {
    if (server.status === "online") result.serverOnline++;
    (server.bots || []).forEach(function (bot) {
      result.botTotal++;
      if (bot.status === "online") result.botOnline++;
    });
  });
  return result;
}

// 🧮 Webサービスの応答数を数える（items が無ければ null）
function summarizeWeb(items) {
  if (!items || !items.length) return null;
  var online = items.filter(function (s) { return s.status === "online"; }).length;
  return { online: online, total: items.length };
}

// 🏷️ Webサービスをカテゴリ別にグループ化する（空のカテゴリは含めない）
function groupWebItems(items) {
  var byCat = {};
  (items || []).forEach(function (svc) {
    var key = svc.cat || "other";
    if (!byCat[key]) byCat[key] = [];
    byCat[key].push(svc);
  });
  var groups = [];
  WEB_CATS.forEach(function (cat) {
    if (byCat[cat.key] && byCat[cat.key].length) {
      groups.push({ key: cat.key, label: cat.label, items: byCat[cat.key] });
    }
  });
  return groups;
}

// ✅ status.json の形を検証し、問題点の文字列配列を返す（問題なければ空配列）
// 手動更新されるデータファイルなので、壊れたまま公開されないようテストと共に使う。
function validateStatusData(data) {
  var problems = [];
  function bad(msg) { problems.push(msg); }
  function checkStatus(owner, status) {
    if (!isKnownStatus(status)) bad(owner + " の status が不正です: " + status);
  }
  function checkDate(owner, value) {
    if (typeof value !== "string" || isNaN(new Date(value).getTime())) {
      bad(owner + " が日時として解釈できません: " + value);
    }
  }

  if (!data || typeof data !== "object") return ["データ全体がオブジェクトではありません"];
  checkDate("generatedAt", data.generatedAt);

  if (!data.overall || typeof data.overall !== "object") {
    bad("overall がありません");
  } else {
    checkStatus("overall", data.overall.status);
  }

  if (data.site != null) {
    checkStatus("site", data.site.status);
    if (typeof data.site.name !== "string") bad("site.name が文字列ではありません");
    if (typeof data.site.url !== "string") bad("site.url が文字列ではありません");
  }

  if (!Array.isArray(data.servers)) {
    bad("servers が配列ではありません");
  } else {
    data.servers.forEach(function (server, i) {
      var owner = "servers[" + i + "](" + (server && server.name) + ")";
      if (!server || typeof server !== "object") { bad(owner + " がオブジェクトではありません"); return; }
      if (typeof server.name !== "string" || !server.name) bad(owner + " の name がありません");
      if (typeof server.role !== "string") bad(owner + " の role が文字列ではありません");
      checkStatus(owner, server.status);
      if (!Array.isArray(server.bots)) {
        bad(owner + " の bots が配列ではありません");
      } else {
        server.bots.forEach(function (bot, j) {
          if (!bot || typeof bot.name !== "string") bad(owner + ".bots[" + j + "] の name がありません");
          if (bot) checkStatus(owner + ".bots[" + j + "]", bot.status);
        });
      }
      if (server.metrics != null) {
        if (typeof server.metrics !== "object") bad(owner + " の metrics がオブジェクトではありません");
        else if (server.metrics.checkedAt != null) checkDate(owner + ".metrics.checkedAt", server.metrics.checkedAt);
      }
    });
  }

  if (data.webServices != null) {
    var ws = data.webServices;
    if (ws.checkedAt != null) checkDate("webServices.checkedAt", ws.checkedAt);
    if (!Array.isArray(ws.items)) {
      bad("webServices.items が配列ではありません");
    } else {
      var catKeys = WEB_CATS.map(function (c) { return c.key; });
      ws.items.forEach(function (item, i) {
        var owner = "webServices.items[" + i + "](" + (item && item.name) + ")";
        if (!item || typeof item !== "object") { bad(owner + " がオブジェクトではありません"); return; }
        if (typeof item.name !== "string") bad(owner + " の name が文字列ではありません");
        if (typeof item.url !== "string") bad(owner + " の url が文字列ではありません");
        checkStatus(owner, item.status);
        if (catKeys.indexOf(item.cat) < 0) bad(owner + " の cat が不正です: " + item.cat);
      });
    }
  }
  return problems;
}

// 📦 Node（テスト）から使えるようにエクスポートする（ブラウザでは無視される）
if (typeof module !== "undefined" && module.exports) {
  module.exports = {
    STATUS_META: STATUS_META,
    WEB_CATS: WEB_CATS,
    statusMeta: statusMeta,
    isKnownStatus: isKnownStatus,
    formatDateTime: formatDateTime,
    formatPing: formatPing,
    buildMetricRows: buildMetricRows,
    siteLineText: siteLineText,
    summarizeServers: summarizeServers,
    summarizeWeb: summarizeWeb,
    groupWebItems: groupWebItems,
    validateStatusData: validateStatusData
  };
}
