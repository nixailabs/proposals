/* Static assertions over the Al Ghadeer configurator config block.
   Extracts the region between `const STAGES` and `const LOCK_SVG` from the HTML,
   evaluates it in isolation, and checks presets, ladders and totals. */
const fs = require("fs");

const html = fs.readFileSync(__dirname + "/proposals/alghadeer.html", "utf8");
const start = html.indexOf("const STAGES");
const end = html.indexOf("const LOCK_SVG");
if (start < 0 || end < 0 || end <= start) throw new Error("could not locate config region");

const code = html.slice(start, end) +
  "\nmodule.exports = { STAGES, FEATURES, PRESETS, BANDS, WEEKS, SCALE_MIN, SCALE_MAX, UNIT_VALUE, CORE, CORE_FLOOR, presetTotal, pick, chosen, total, bandFor, weeksFor, applyPreset };";

/* The region references browser globals only inside functions we do not call. */
const mod = { exports: {} };
new Function("module", "document", "window", code)(mod, undefined, undefined);
const M = mod.exports;

const fails = [];
const ok = [];
function check(cond, msg) { (cond ? ok : fails).push(msg); }

/* ---- Structural integrity ------------------------------------------------ */
check(M.FEATURES.length === 28, `FEATURES has 28 entries (got ${M.FEATURES.length})`);
const ids = M.FEATURES.map((f) => f.id);
check(new Set(ids).size === ids.length, "all feature ids are unique");

const stageIds = new Set(M.STAGES.map((s) => s.id));
M.FEATURES.forEach((f) => check(stageIds.has(f.stage), `${f.id}: stage "${f.stage}" exists in STAGES`));

/* ---- Every levels array strictly increasing, no NaN ---------------------- */
M.FEATURES.forEach((f) => {
  check(f.levels.length >= 2, `${f.id}: has at least 2 levels`);
  f.levels.forEach((l, i) => {
    check(Number.isFinite(l.p) && !Number.isNaN(l.p), `${f.id}[${i}]: price is a finite number (${l.p})`);
    check(typeof l.n === "string" && l.n.length > 0, `${f.id}[${i}]: has a level name`);
    check(typeof l.d === "string" && l.d.length > 20, `${f.id}[${i}]: has a description`);
    if (i > 0) check(l.p > f.levels[i - 1].p, `${f.id}: level ${i} (${l.p}) > level ${i - 1} (${f.levels[i - 1].p})`);
  });
});

/* ---- Every preset references real ids at valid indices ------------------- */
const presetKeys = Object.keys(M.PRESETS);
check(presetKeys.length === 6, `PRESETS has 6 entries: ${presetKeys.join(", ")}`);
presetKeys.forEach((key) => {
  Object.entries(M.PRESETS[key].pick).forEach(([id, i]) => {
    const f = M.FEATURES.find((x) => x.id === id);
    check(!!f, `${key}: id "${id}" exists in FEATURES`);
    if (!f) return;
    check(Number.isInteger(i) && i >= 0 && i < f.levels.length,
      `${key}.${id}: level index ${i} valid (0..${f.levels.length - 1})`);
    if (f.core) check(i >= 0, `${key}.${id}: mandatory line is not switched off`);
  });
});

/* ---- Totals -------------------------------------------------------------- */
const core = M.FEATURES.filter((f) => f.core);
const optional = M.FEATURES.filter((f) => !f.core);
const coreFloor = core.reduce((s, f) => s + f.levels[0].p, 0);
const coreFlagship = core.reduce((s, f) => s + f.levels[f.levels.length - 1].p, 0);
const maxed = M.FEATURES.reduce((s, f) => s + f.levels[f.levels.length - 1].p, 0);

check(coreFloor === M.CORE_FLOOR, `CORE_FLOOR constant matches computed floor (${M.CORE_FLOOR} vs ${coreFloor})`);
check(core.length === 9, `9 mandatory lines (got ${core.length}: ${core.map((f) => f.id).join(", ")})`);
["app", "crm", "omni", "automation"].forEach((id) => {
  const f = M.FEATURES.find((x) => x.id === id);
  check(f && f.core === false, `${id} is optional (core: false)`);
});
["app", "crm", "mkt"].forEach((sid) => {
  const inStage = M.FEATURES.filter((f) => f.stage === sid);
  check(inStage.every((f) => !f.core), `every feature in stage "${sid}" is optional`);
});
const appF = M.FEATURES.find((f) => f.id === "app");
check(appF.levels[0].p === 25000, `app Essential is $25,000 (got ${appF.levels[0].p})`);

const rows = [
  ["Mandatory-only floor", coreFloor],
  ["floor / entry preset", M.presetTotal("floor")],
  ["middle / growth preset", M.presetTotal("middle")],
  ["ceiling / flagship preset", M.presetTotal("ceiling")],
  ["damac preset", M.presetTotal("damac")],
  ["emaar preset", M.presetTotal("emaar")],
  ["binghatti preset", M.presetTotal("binghatti")],
  ["All mandatory at Flagship", coreFlagship],
  ["Everything maxed", maxed]
];

rows.forEach(([, v]) => check(Number.isFinite(v) && v > 0, "total is a finite positive number"));

/* ---- Sanity against BANDS / WEEKS / scale bounds ------------------------- */
check(M.SCALE_MIN < coreFloor, `SCALE_MIN (${M.SCALE_MIN}) is below the floor (${coreFloor})`);
check(M.SCALE_MAX > maxed, `SCALE_MAX (${M.SCALE_MAX}) is above everything-maxed (${maxed})`);
check(M.BANDS[M.BANDS.length - 1].max === Infinity, "last BAND is open-ended");
check(M.WEEKS[M.WEEKS.length - 1].max === Infinity, "last WEEKS entry is open-ended");
for (let i = 1; i < M.BANDS.length; i++) check(M.BANDS[i].max > M.BANDS[i - 1].max, `BANDS thresholds ascending at ${i}`);
for (let i = 1; i < M.WEEKS.length; i++) check(M.WEEKS[i].max > M.WEEKS[i - 1].max, `WEEKS thresholds ascending at ${i}`);

/* Competitor builds must be credible, distinct and correctly ordered. */
const d = M.presetTotal("damac"), e = M.presetTotal("emaar"), b = M.presetTotal("binghatti");
check(d > b && e > b, `DAMAC (${d}) and Emaar (${e}) both exceed Binghatti (${b})`);
check(b > 400000, `Binghatti build is in the high hundreds of thousands (${b})`);
check(d > 800000 && e > 800000, `DAMAC and Emaar approach or exceed $1M (${d}, ${e})`);
check(new Set([d, e, b]).size === 3, "the three competitor totals are distinct");
check(M.presetTotal("floor") === 50000, `entry preset is exactly $50,000 (got ${M.presetTotal("floor")})`);

/* ---- Report -------------------------------------------------------------- */
const money = (n) => "$" + n.toLocaleString("en-US");
const pad = (s, w) => String(s) + " ".repeat(Math.max(0, w - String(s).length));

console.log("\n  PRICE TABLE\n  " + "-".repeat(74));
rows.forEach(([label, v]) => {
  const band = M.bandFor(v), weeks = M.weeksFor(v);
  console.log("  " + pad(label, 28) + pad(money(v), 14) + pad(band.name, 22) + weeks.label);
});

console.log("\n  Mandatory lines (" + core.length + "): " + core.map((f) => f.id).join(", "));
console.log("  Optional lines (" + optional.length + "): " + optional.map((f) => f.id).join(", "));
console.log("  Scale window: " + money(M.SCALE_MIN) + " – " + money(M.SCALE_MAX));

console.log("\n  " + ok.length + " assertions passed.");
if (fails.length) {
  console.log("\n  FAILED (" + fails.length + "):");
  fails.forEach((f) => console.log("   x " + f));
  process.exit(1);
}
console.log("  No failures.\n");
