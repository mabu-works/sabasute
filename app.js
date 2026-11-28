"use strict";
// ==========================================
// 🖥️ サーバーステータス公開ページ — 描画
// status.json を取得して、全体状況とサーバー別・Bot別の稼働状況を表示する。
// status.json は手動で更新する運用データ（将来は監視側が自動更新する想定）。
// 表示文字列への変換ルールは status-core.js に分離してある（テスト対象）。
// Web サービスのチップは /api/web-status（自動収集・CDNに10分キャッシュ）のライブ値を優先し、
// 取得に失敗した場合は status.json の webServices スナップショットで表示する。
// ==========================================

// 🧱 要素を作る小さなヘルパー（text は textContent で入れるので HTML エスケープ不要）
function el(tag, className, text) {
  var node = document.createElement(tag);
  if (className) node.className = className;
  if (text != null) node.textContent = text;
  return node;
}

// 🌐 Webサービス1件分のチップ（リンク）
function chipFor(svc) {
  var wMeta = statusMeta(svc.status);
  var chip = el("a", "chip");
  chip.href = svc.url;
  chip.target = "_blank";
  chip.rel = "noopener";
  chip.appendChild(el("span", "dot dot-small " + wMeta.dot));
  chip.appendChild(el("span", "chip-name", svc.name));
  chip.appendChild(el("span", "chip-ms",
    typeof svc.responseMs === "number" ? svc.responseMs + "ms" : wMeta.label));
  return chip;
}

// 🌐 Webサービス欄（サマリ行・タイル・チップ・計測時刻）をまとめて描く
function renderWeb(items, checkedAt) {
  var summary = summarizeWeb(items);

  var webLine = document.getElementById("webLine");
  if (summary) {
    webLine.textContent = "🌐 Webサービス: " + summary.online + " / " + summary.total + " サイト応答あり";
    webLine.hidden = false;
  } else {
    webLine.hidden = true;
  }

  var tileWeb = document.getElementById("tileWeb");
  if (tileWeb) {
    tileWeb.innerHTML = summary
      ? summary.online + " <small>/ " + summary.total + "</small>"
      : "-";
  }

  var chips = document.getElementById("webChips");
  if (!chips) return;
  chips.textContent = "";
  groupWebItems(items).forEach(function (group) {
    var box = el("div", "web-group");
    box.appendChild(el("h3", "web-group-title", group.label));
    var row = el("div", "web-chips");
    group.items.forEach(function (svc) { row.appendChild(chipFor(svc)); });
    box.appendChild(row);
    chips.appendChild(box);
  });

  var webChecked = document.getElementById("webCheckedAt");
  var checkedText = formatDateTime(checkedAt, false);
  if (webChecked && checkedText) webChecked.textContent = checkedText;
}

// 🖥️ サーバー1台分のカードを作る
function serverCard(server) {
  var sMeta = statusMeta(server.status);
  var card = el("section", "server-card");
  card.classList.add("is-" + (server.status || "unknown"));
  card.setAttribute("aria-label", server.name);

  var head = el("div", "server-head");
  var title = el("h2", "server-name");
  title.appendChild(el("span", "dot " + sMeta.dot));
  title.appendChild(document.createTextNode(server.name));
  head.appendChild(title);
  head.appendChild(el("span", "badge badge-" + (server.status || "unknown"), sMeta.label));
  card.appendChild(head);

  card.appendChild(el("p", "server-role", server.role || ""));
  if (server.note) card.appendChild(el("p", "server-note", server.note));

  if (server.metrics) {
    var rows = buildMetricRows(server.metrics);
    if (rows.length) {
      var grid = el("div", "metrics");
      rows.forEach(function (pair) {
        var cell = el("div", "metric");
        cell.appendChild(el("span", "metric-label", pair[0]));
        cell.appendChild(el("span", "metric-value", pair[1]));
        grid.appendChild(cell);
      });
      card.appendChild(grid);
    }
    var measuredAt = formatDateTime(server.metrics.checkedAt, false);
    if (measuredAt) {
      card.appendChild(el("p", "metrics-at", "計測: " + measuredAt + " 時点"));
    }
  }

  var list = el("div", "bot-pills");
  (server.bots || []).forEach(function (bot) {
    var bMeta = statusMeta(bot.status);
    var item = el("span", "bot-pill");
    item.appendChild(el("span", "dot dot-small " + bMeta.dot));
    item.appendChild(el("span", "bot-name", bot.name));
    item.appendChild(el("span", "bot-status", bMeta.label));
    list.appendChild(item);
  });
  card.appendChild(list);
  return card;
}

// 🎨 status.json 全体を描く
function render(data) {
  var overall = data.overall || {};
  var oMeta = statusMeta(overall.status);
  document.getElementById("overallDot").className = "dot " + oMeta.dot;
  document.getElementById("overallLabel").textContent = overall.label || oMeta.label;
  var navDot = document.getElementById("navDot");
  if (navDot) navDot.className = "dot " + oMeta.dot;
  var navLabel = document.getElementById("navLabel");
  if (navLabel) navLabel.textContent = overall.label || oMeta.label;
  document.getElementById("overallMessage").textContent = overall.message || "";
  document.getElementById("overall").classList.add("overall-" + (overall.status || "unknown"));

  var generated = formatDateTime(data.generatedAt, true);
  if (generated) document.getElementById("generatedAt").textContent = generated;

  var siteLine = document.getElementById("siteLine");
  var siteText = siteLineText(data.site);
  if (siteText != null) {
    siteLine.textContent = siteText;
    siteLine.hidden = false;
  } else {
    siteLine.hidden = true;
  }

  var tiles = document.getElementById("summaryTiles");
  if (tiles) {
    var summary = summarizeServers(data.servers);
    var tileServers = document.getElementById("tileServers");
    if (tileServers) tileServers.innerHTML = summary.serverOnline + " <small>/ " + summary.serverTotal + "</small>";
    var tileBots = document.getElementById("tileBots");
    if (tileBots) tileBots.innerHTML = summary.botOnline + " <small>/ " + summary.botTotal + "</small>";
    tiles.hidden = false;
  }

  var snapshot = data.webServices || {};
  if (snapshot.items && snapshot.items.length) renderWeb(snapshot.items, snapshot.checkedAt);

  var container = document.getElementById("servers");
  container.textContent = "";
  (data.servers || []).forEach(function (server) {
    container.appendChild(serverCard(server));
  });
}

// 🌐 ライブの Web サービス応答状況を取得する（失敗時はスナップショット表示のまま）
async function loadWeb() {
  try {
    var res = await fetch("/api/web-status");
    if (!res.ok) throw new Error("HTTP " + res.status);
    var data = await res.json();
    if (data && data.items && data.items.length) renderWeb(data.items, data.checkedAt);
  } catch (e) {
    console.error(e);
  }
}

// 📥 status.json を取得して描く（5分ごとの自動再取得からも呼ばれる）
async function load() {
  try {
    var res = await fetch("status.json", { cache: "no-store" });
    if (!res.ok) throw new Error("HTTP " + res.status);
    var data = await res.json();
    document.getElementById("fetchError").hidden = true;
    render(data);
    loadWeb();
  } catch (e) {
    console.error(e);
    document.getElementById("fetchError").hidden = false;
    document.getElementById("overallLabel").textContent = "取得できませんでした";
  }
}

// ------------------------------------------
// 🌙 テーマ切り替え（ダーク既定＋ライト切替、localStorage に保存）
// ------------------------------------------
(function initTheme() {
  var root = document.documentElement;
  if (!root || !root.getAttribute || !root.setAttribute) return;
  function apply(theme) {
    root.setAttribute("data-theme", theme);
    var btn = document.getElementById("themeToggle");
    if (btn) btn.textContent = theme === "light" ? "☀️" : "🌙";
  }
  var current = root.getAttribute("data-theme");
  if (current !== "light" && current !== "dark") {
    try { current = localStorage.getItem("sabasute-theme"); } catch (e) { current = null; }
  }
  apply(current === "light" ? "light" : "dark");
  var btn = document.getElementById("themeToggle");
  if (btn && btn.addEventListener) {
    btn.addEventListener("click", function () {
      var next = root.getAttribute("data-theme") === "light" ? "dark" : "light";
      apply(next);
      try { localStorage.setItem("sabasute-theme", next); } catch (e) { /* 保存できなくても切り替え自体は有効 */ }
    });
  }
})();

load();
setInterval(load, 5 * 60 * 1000);
