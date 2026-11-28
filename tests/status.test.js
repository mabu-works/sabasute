"use strict";
// 🧪 サーバーステータスの単体テスト（node --test）
// 対象: status-core.js の純粋ロジック、status.json（手動運用データ）の形と件数、
// api/sites.js と status.json スナップショットの整合、manifest の固定値。
// status.json の「値そのもの」は運用データなのでここでは書き換えず、
// 形・件数・参照整合だけを固定する（値の正しさは運用側の責任）。

const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const core = require("../status-core.js");
const SITES = require("../api/sites.js");

const ROOT = path.join(__dirname, "..");
const data = JSON.parse(fs.readFileSync(path.join(ROOT, "status.json"), "utf8"));

// ---------- 🎨 ステータスの表示対応 ----------

test("statusMeta: 既知のステータスは対応するドットとラベルを返す", () => {
  assert.deepEqual(core.statusMeta("online"), { dot: "dot-online", label: "稼働中" });
  assert.deepEqual(core.statusMeta("down"), { dot: "dot-down", label: "停止中" });
  assert.deepEqual(core.statusMeta("rebuilding"), { dot: "dot-rebuilding", label: "復旧作業中" });
  assert.deepEqual(core.statusMeta("held"), { dot: "dot-unknown", label: "開始待ち" });
  assert.deepEqual(core.statusMeta("unknown"), { dot: "dot-unknown", label: "不明" });
});

test("statusMeta: 未知の値と undefined は unknown に倒れる", () => {
  assert.deepEqual(core.statusMeta("weird"), core.STATUS_META.unknown);
  assert.deepEqual(core.statusMeta(undefined), core.STATUS_META.unknown);
  assert.equal(core.isKnownStatus("online"), true);
  assert.equal(core.isKnownStatus("weird"), false);
});

// ---------- 🕐 日時表示 ----------

test("formatDateTime: 年ありは「2026/11/25 17:45」形式（JST）", () => {
  assert.equal(core.formatDateTime("2026-11-25T17:45:16+09:00", true), "2026/11/25 17:45");
});

test("formatDateTime: 年なしは「11/25 17:45」形式（JST）", () => {
  assert.equal(core.formatDateTime("2026-11-25T17:37:02+09:00", false), "11/25 17:37");
});

test("formatDateTime: UTC入力もJSTに変換される", () => {
  assert.equal(core.formatDateTime("2026-11-25T08:45:00Z", true), "2026/11/25 17:45");
});

test("formatDateTime: 解釈できない入力は空文字", () => {
  assert.equal(core.formatDateTime("not-a-date", true), "");
  assert.equal(core.formatDateTime("", false), "");
  assert.equal(core.formatDateTime(null, false), "");
  assert.equal(core.formatDateTime(undefined, true), "");
});

// ---------- 📶 Ping・メトリクス表示 ----------

test("formatPing: 数値は ms 表記、ロス率つきも扱う", () => {
  assert.equal(core.formatPing(12, null), "12ms");
  assert.equal(core.formatPing(9.873, 0), "9.873ms（ロス 0%）");
  assert.equal(core.formatPing(undefined, 0), null);
  assert.equal(core.formatPing("12", 0), null);
});

test("buildMetricRows: 値のある項目だけを固定順で返す（無い項目は省く）", () => {
  const rows = core.buildMetricRows({
    pingDiscordMs: 10, pingDiscordLoss: 0,
    cpuPercent: 4.8, loadAvg: "0.22 / 0.09 / 0.03",
    memoryUsedMb: 675, memoryTotalMb: 960, memoryFreePercent: 29.6,
    swapPercent: 4.6, diskPercent: 10, diskFreeGb: 85,
    inodePercent: 4, uptime: "23時間47分",
    systemdFailed: 0, oom: 0, pm2LogSize: "80K", varLogSize: "65.5M"
  });
  // ping11Ms が無いので「Ping（1.1.1.1）」の行だけが省かれる
  assert.deepEqual(rows, [
    ["Ping（discord.com）", "10ms（ロス 0%）"],
    ["CPU", "4.8%"],
    ["ロードアベレージ", "0.22 / 0.09 / 0.03"],
    ["メモリ", "675MB / 960MB（空き 29.6%）"],
    ["スワップ", "4.6% 使用"],
    ["ディスク", "10% 使用（空き 85GB）"],
    ["inode", "4% 使用"],
    ["サーバー稼働時間", "23時間47分"],
    ["異常系", "systemd失敗 0件 / OOM 0件"],
    ["ログ容量", "pm2ログ 80K / /var/log 65.5M"]
  ]);
});

test("buildMetricRows: Ping（1.1.1.1）が無い場合はその行を省く", () => {
  const rows = core.buildMetricRows({ cpuPercent: 1 });
  assert.deepEqual(rows, [["CPU", "1%"]]);
});

test("buildMetricRows: メモリ・ディスク・異常系・ログ容量の合成", () => {
  const rows = Object.fromEntries(core.buildMetricRows({
    memoryUsedMb: 500, memoryTotalMb: 960,
    diskPercent: 15,
    systemdFailed: 2,
    varLogSize: "66.6M"
  }));
  assert.equal(rows["メモリ"], "500MB / 960MB");
  assert.equal(rows["ディスク"], "15% 使用");
  assert.equal(rows["異常系"], "systemd失敗 2件 / OOM -件");
  assert.equal(rows["ログ容量"], "pm2ログ - / /var/log 66.6M");
});

test("buildMetricRows: null や空オブジェクトは空配列", () => {
  assert.deepEqual(core.buildMetricRows(null), []);
  assert.deepEqual(core.buildMetricRows({}), []);
});

// ---------- 🌐 公式サイト行 ----------

test("siteLineText: 応答時間と稼働率の両方がある場合", () => {
  assert.equal(
    core.siteLineText({ name: "まぶ鯖公式サイト", status: "online", responseMs: 1235, uptime24hPercent: 100 }),
    "🌐 まぶ鯖公式サイト: 稼働中（応答 1235ms · 24時間稼働率 100%）"
  );
});

test("siteLineText: 稼働率だけの場合・どちらも無い場合・site自体が無い場合", () => {
  assert.equal(
    core.siteLineText({ name: "公式", status: "down", uptime24hPercent: 98 }),
    "🌐 公式: 停止中（24時間稼働率 98%）"
  );
  assert.equal(core.siteLineText({ status: "online" }), "🌐 公式サイト: 稼働中");
  assert.equal(core.siteLineText(null), null);
  assert.equal(core.siteLineText(undefined), null);
});

// ---------- 🧮 集計 ----------

test("summarizeServers: サーバーとBotの稼働数を数える", () => {
  const s = core.summarizeServers([
    { status: "online", bots: [{ status: "online" }, { status: "down" }] },
    { status: "down", bots: [{ status: "online" }] },
    { status: "rebuilding" }
  ]);
  assert.deepEqual(s, { serverOnline: 1, serverTotal: 3, botOnline: 2, botTotal: 3 });
  assert.deepEqual(core.summarizeServers(undefined),
    { serverOnline: 0, serverTotal: 0, botOnline: 0, botTotal: 0 });
});

test("summarizeWeb: 空なら null、あれば応答数を数える", () => {
  assert.equal(core.summarizeWeb([]), null);
  assert.equal(core.summarizeWeb(null), null);
  assert.deepEqual(
    core.summarizeWeb([{ status: "online" }, { status: "down" }, { status: "online" }]),
    { online: 2, total: 3 }
  );
});

test("groupWebItems: カテゴリ順に並び、空カテゴリと未知カテゴリを処理する", () => {
  const groups = core.groupWebItems([
    { name: "a", cat: "asobi" },
    { name: "b", cat: "kurashi" },
    { name: "c" },
    { name: "d", cat: "kurashi" }
  ]);
  assert.deepEqual(groups.map((g) => g.key), ["kurashi", "asobi", "other"]);
  assert.deepEqual(groups[0].items.map((i) => i.name), ["b", "d"]);
  assert.equal(groups[0].label, "くらし・実用");
});

// ---------- ✅ status.json の検証ロジック ----------

test("validateStatusData: 最小の正しいデータは問題なし", () => {
  const ok = {
    generatedAt: "2026-11-25T17:45:16+09:00",
    overall: { status: "online", label: "稼働中", message: "" },
    servers: [{ name: "s1", role: "r", status: "online", bots: [{ name: "b", status: "online" }] }]
  };
  assert.deepEqual(core.validateStatusData(ok), []);
});

test("validateStatusData: 不正な status と壊れた日時を検出する", () => {
  const bad = {
    generatedAt: "いつか",
    overall: { status: "weird" },
    servers: [{ name: "s1", role: "r", status: "online", bots: [{ name: "b", status: "???" }] }]
  };
  const problems = core.validateStatusData(bad);
  assert.equal(problems.length, 3);
});

test("validateStatusData: 全体がオブジェクトでない場合は1件で返す", () => {
  assert.equal(core.validateStatusData(null).length, 1);
  assert.equal(core.validateStatusData("x").length, 1);
});

// ---------- 📄 引き継いだ status.json（手動運用データ）の固定 ----------

test("status.json: 形の検証を通る", () => {
  assert.deepEqual(core.validateStatusData(data), []);
});

test("status.json: 件数を固定する（サーバー4台・Bot23件・Webスナップショット24件）", () => {
  assert.equal(data.servers.length, 4);
  assert.deepEqual(data.servers.map((s) => s.name), ["minase", "mabu", "yanagi", "kura"]);
  assert.equal(data.servers.reduce((n, s) => n + s.bots.length, 0), 23);
  assert.equal(data.webServices.items.length, 24);
  assert.equal(data.site.name, "まぶ鯖公式サイト");
});

test("status.json: 全サーバーにメトリクスがあり checkedAt が解釈できる", () => {
  for (const server of data.servers) {
    assert.ok(server.metrics, server.name + " に metrics がある");
    assert.notEqual(core.formatDateTime(server.metrics.checkedAt, false), "");
    assert.ok(core.buildMetricRows(server.metrics).length >= 10, server.name + " の表示行がそろっている");
  }
});

// ---------- 🌐 api/sites.js との整合 ----------

test("api/sites.js: 24サイトで、status.json のスナップショットと name/url/cat が一致する", () => {
  assert.equal(SITES.length, 24);
  const snap = data.webServices.items.map(({ name, url, cat }) => ({ name, url, cat }));
  assert.deepEqual(SITES, snap);
});

test("api/sites.js: URL に重複がなく、カテゴリは表示グループのいずれか", () => {
  assert.equal(new Set(SITES.map((s) => s.url)).size, SITES.length);
  const keys = core.WEB_CATS.map((c) => c.key);
  for (const site of SITES) assert.ok(keys.includes(site.cat), site.name);
});

// ---------- 📱 manifest の固定値 ----------

test("manifest.webmanifest: 名称とテーマ色を固定する", () => {
  const manifest = JSON.parse(fs.readFileSync(path.join(ROOT, "manifest.webmanifest"), "utf8"));
  assert.equal(manifest.name, "サーバーステータス");
  assert.equal(manifest.short_name, "鯖ステ");
  assert.equal(manifest.theme_color, "#0b1220");
  assert.equal(manifest.display, "standalone");
  assert.equal(manifest.icons.length, 3);
});
