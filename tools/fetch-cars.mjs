/**
 * 把候选车型抓成 js/data.js 可用的草稿条目，写入 data/incoming.json，并下载配图。
 *
 * 能自动拿到的：中文简介正文、品牌、产地、类别、年份、动力形式、功率、驱动、配图。
 * 拿不到的（维基信息框通常没有）：极速、零百加速、参考价、冷知识。
 * 这些会列在每条的 _todo 里，merge 时会拦住，必须人工/AI 补全后才能并入图鉴，
 * 避免机器抓来的半成品数据直接上线。
 *
 * 用法：
 *   node tools/fetch-cars.mjs                          读 data/candidates.json
 *   node tools/fetch-cars.mjs --titles "Xiaomi YU7"    直接指定维基条目名
 */

import { pageDetails, zhPage, sectionWikitext, downloadCarImage, loadCars, saveJson, readJson, slug } from "./wiki.mjs";

const args = process.argv.slice(2);
const argVal = (name, fallback) => {
  const i = args.indexOf(`--${name}`);
  return i >= 0 && args[i + 1] ? args[i + 1] : fallback;
};

// 品牌中文名（抓不到的就只保留英文，人工补）
const BRAND_ZH = {
  Xiaomi: "小米", BYD: "比亚迪", Nio: "蔚来", NIO: "蔚来", XPeng: "小鹏", Zeekr: "极氪",
  Hongqi: "红旗", Wuling: "五菱", Geely: "吉利", Chery: "奇瑞", Changan: "长安",
  GWM: "长城", Haval: "哈弗", Aion: "埃安", Denza: "腾势", Yangwang: "仰望", AITO: "问界",
  Avatr: "阿维塔", Deepal: "深蓝", Baojun: "宝骏", Exeed: "星途", Jetour: "捷途", Lynkco: "领克",
  Toyota: "丰田", Honda: "本田", Nissan: "日产", Mazda: "马自达", Subaru: "斯巴鲁",
  Suzuki: "铃木", Mitsubishi: "三菱", Lexus: "雷克萨斯", Infiniti: "英菲尼迪",
  Volkswagen: "大众", BMW: "宝马", Audi: "奥迪", Porsche: "保时捷", Opel: "欧宝",
  "Mercedes-Benz": "奔驰", Hyundai: "现代", Kia: "起亚", Genesis: "捷尼赛思",
  Ford: "福特", Chevrolet: "雪佛兰", Tesla: "特斯拉", Jeep: "吉普", Dodge: "道奇",
  Cadillac: "凯迪拉克", Rivian: "Rivian", Lucid: "Lucid", GMC: "GMC", Buick: "别克",
  Ferrari: "法拉利", Lamborghini: "兰博基尼", Maserati: "玛莎拉蒂", Fiat: "菲亚特",
  "Alfa Romeo": "阿尔法·罗密欧", Bugatti: "布加迪", Renault: "雷诺", Peugeot: "标致",
  Citroën: "雪铁龙", Alpine: "阿尔派", Volvo: "沃尔沃", Koenigsegg: "柯尼塞格",
  Polestar: "极星", McLaren: "迈凯伦", Bentley: "宾利", "Rolls-Royce": "劳斯莱斯",
  "Aston Martin": "阿斯顿·马丁", Jaguar: "捷豹", "Land Rover": "路虎", Lotus: "路特斯",
  Mini: "Mini", Škoda: "斯柯达", Skoda: "斯柯达", "SEAT": "西雅特", Cupra: "Cupra",
};

const BRAND_COUNTRY = {
  小米: "中国", 比亚迪: "中国", 蔚来: "中国", 小鹏: "中国", 极氪: "中国", 红旗: "中国",
  五菱: "中国", 吉利: "中国", 奇瑞: "中国", 长安: "中国", 长城: "中国", 哈弗: "中国",
  埃安: "中国", 腾势: "中国", 仰望: "中国", 问界: "中国", 阿维塔: "中国", 深蓝: "中国",
  宝骏: "中国", 星途: "中国", 捷途: "中国", 领克: "中国", 极星: "中国",
  丰田: "日本", 本田: "日本", 日产: "日本", 马自达: "日本", 斯巴鲁: "日本", 铃木: "日本",
  三菱: "日本", 雷克萨斯: "日本", 英菲尼迪: "日本",
  大众: "德国", 宝马: "德国", 奥迪: "德国", 保时捷: "德国", 奔驰: "德国", 欧宝: "德国",
  现代: "韩国", 起亚: "韩国", 捷尼赛思: "韩国",
  福特: "美国", 雪佛兰: "美国", 特斯拉: "美国", 吉普: "美国", 道奇: "美国",
  凯迪拉克: "美国", 别克: "美国", GMC: "美国", Rivian: "美国", Lucid: "美国",
  法拉利: "意大利", 兰博基尼: "意大利", 玛莎拉蒂: "意大利", 菲亚特: "意大利",
  "阿尔法·罗密欧": "意大利",
  布加迪: "法国", 雷诺: "法国", 标致: "法国", 雪铁龙: "法国", 阿尔派: "法国",
  沃尔沃: "瑞典", 柯尼塞格: "瑞典",
  迈凯伦: "英国", 宾利: "英国", 劳斯莱斯: "英国", "阿斯顿·马丁": "英国",
  捷豹: "英国", 路虎: "英国", 路特斯: "英国", Mini: "英国",
  斯柯达: "捷克", 西雅特: "西班牙", Cupra: "西班牙",
};

// 维基 class / body style -> 本站类别
const CLASS_RULES = [
  [/pickup/i, "皮卡"],
  [/(off-road|off road)/i, "越野"],
  [/(sport utility|crossover|\bSUV\b)/i, "SUV"],
  [/(hypercar|supercar)/i, "超级跑车"],
  [/(sports car|grand tourer|\bGT\b|muscle)/i, "跑车"],
  [/(luxury|executive|full-size)/i, "豪华轿车"],
  [/(bus|coach)/i, "巴士"],
  [/(truck|lorry)/i, "卡车"],
  [/(racing|race car|formula)/i, "赛车"],
  [/(city car|supermini|compact|subcompact|hatchback|sedan|saloon|family)/i, "家用轿车"],
];

const CATEGORY_EMOJI = {
  超级跑车: "🏎️", 跑车: "🏁", 豪华轿车: "🛎️", SUV: "🚙", 电动车: "🔌",
  越野: "🧭", 经典老爷车: "🕰️", 家用轿车: "🚗", 皮卡: "🛻", 卡车: "🚛",
  工程车: "🏗️", 巴士: "🚌", 赛车: "🏆",
};

const ACCENTS = [
  "linear-gradient(135deg,#1f4037,#99f2c8)", "linear-gradient(135deg,#2c3e50,#4ca1af)",
  "linear-gradient(135deg,#42275a,#734b6d)", "linear-gradient(135deg,#603813,#b29f94)",
  "linear-gradient(135deg,#16222a,#3a6073)", "linear-gradient(135deg,#8e2de2,#4a00e0)",
  "linear-gradient(135deg,#c31432,#240b36)", "linear-gradient(135deg,#0f2027,#2c5364)",
];

/** 去掉 wikitext 里的链接、模板、脚注等标记 */
function plain(v) {
  return String(v)
    .replace(/<ref[^>]*>[\s\S]*?<\/ref>|<ref[^>]*\/>/g, "")
    .replace(/\[\[(?:[^\]|]*\|)?([^\]]*)\]\]/g, "$1")
    .replace(/'''?/g, "")
    .replace(/<[^>]+>/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

/** 解析首段 Infobox 的 "| 键 = 值"，值里的花括号模板原样保留（后面单独处理） */
function parseInfobox(wikitext) {
  const box = {};
  const start = wikitext.search(/\{\{\s*Infobox/i);
  if (start < 0) return box;
  let depth = 0;
  let body = "";
  for (let i = start; i < wikitext.length; i++) {
    const two = wikitext.slice(i, i + 2);
    if (two === "{{") { depth++; i++; body += two; continue; }
    if (two === "}}") { depth--; i++; body += two; if (depth === 0) break; continue; }
    body += wikitext[i];
  }
  // 按顶层 | 切分
  let level = 0;
  let cur = "";
  const parts = [];
  for (let i = 0; i < body.length; i++) {
    const two = body.slice(i, i + 2);
    if (two === "{{" || two === "[[") { level++; cur += two; i++; continue; }
    if (two === "}}" || two === "]]") { level--; cur += two; i++; continue; }
    if (body[i] === "|" && level === 1) { parts.push(cur); cur = ""; continue; }
    cur += body[i];
  }
  parts.push(cur);
  for (const part of parts.slice(1)) {
    const eq = part.indexOf("=");
    if (eq < 0) continue;
    const key = part.slice(0, eq).trim().toLowerCase().replace(/\s+/g, "_");
    const val = part.slice(eq + 1).replace(/\}\}$/, "").trim();
    if (key && val) box[key] = val;
  }
  return box;
}

/** {{convert|495|kW|...}} -> { value, unit }，用来把功率统一换算成马力 */
function firstConvert(val) {
  const m = /\{\{\s*(?:convert|cvt)\s*\|\s*([\d.,]+)\s*\|\s*([A-Za-z]+)/i.exec(val || "");
  if (m) return { value: Number(m[1].replace(/,/g, "")), unit: m[2] };
  const n = /([\d.,]+)\s*(kW|PS|hp|bhp)/i.exec(plain(val || ""));
  return n ? { value: Number(n[1].replace(/,/g, "")), unit: n[2] } : null;
}

function toHorsepower(val) {
  const c = firstConvert(val);
  if (!c || !Number.isFinite(c.value)) return null;
  const u = c.unit.toLowerCase();
  if (u === "kw") return Math.round(c.value * 1.3596);
  if (u === "ps") return Math.round(c.value);
  if (u === "hp" || u === "bhp") return Math.round(c.value * 1.0139);
  return null;
}

function pickCategory(box, extract) {
  const hay = [box.class, box.body_style, box.layout].filter(Boolean).map(plain).join(" ");
  for (const [re, cat] of CLASS_RULES) if (re.test(hay)) return cat;
  if (/(SUV|crossover)/i.test(extract)) return "SUV";
  if (/(battery electric|electric car|electric vehicle)/i.test(extract)) return "电动车";
  return null;
}

function isElectric(box, extract) {
  const power = [box.engine, box.motor, box.electric_motor, box.propulsion].filter(Boolean).map(plain).join(" ");
  return /electric/i.test(power) || /(battery electric|全电动|纯电)/i.test(extract) || (!box.engine && !!box.electric_range);
}

// 长名优先，避免「Alfa Romeo」被「Alfa」之类的短名抢先命中
const BRAND_KEYS = Object.keys(BRAND_ZH).sort((a, b) => b.length - a.length);

function matchBrand(text, prefixOnly) {
  const t = (text || "").toLowerCase().trim();
  if (!t) return null;
  for (const en of BRAND_KEYS) {
    const k = en.toLowerCase();
    if (prefixOnly ? t.startsWith(k) : t.includes(k)) {
      const zh = BRAND_ZH[en];
      return { brand: zh === en ? en : `${en} ${zh}`, zh };
    }
  }
  return null;
}

/**
 * 品牌优先看条目标题开头，其次才看信息框的 manufacturer。
 * 因为 manufacturer 常写成集团名（AUDI E7X 的制造商是「上汽大众」，
 * 直接采信就会把奥迪标成大众）。
 */
function pickBrand(box, title) {
  const maker = plain(box.manufacturer || box.aka || "").split(/[,(]/)[0].trim();
  return matchBrand(title, true) || matchBrand(maker, false) || { brand: maker || title.split(" ")[0], zh: "" };
}

function pickCountry(box, brandZh) {
  if (BRAND_COUNTRY[brandZh]) return BRAND_COUNTRY[brandZh];
  const assembly = plain(box.assembly || "");
  const hits = [
    [/china|中国/i, "中国"], [/japan/i, "日本"], [/germany/i, "德国"], [/italy/i, "意大利"],
    [/(united kingdom|england|britain)/i, "英国"], [/(united states|usa)/i, "美国"],
    [/(south korea|korea)/i, "韩国"], [/sweden/i, "瑞典"], [/france/i, "法国"], [/austria/i, "奥地利"],
  ];
  for (const [re, c] of hits) if (re.test(assembly)) return c;
  return null;
}

function pickYear(box, title) {
  const fromTitle = /\((\d{4})\)/.exec(title);
  if (fromTitle) return Number(fromTitle[1]);
  const m = /(\d{4})/.exec(plain(box.production || box.model_years || ""));
  return m ? Number(m[1]) : null;
}

/** 中文导语切成一句话简介 + 两三句正文 */
function chineseCopy(zhText) {
  const clean = (zhText || "")
    .replace(/（[^）]*）/g, "")
    .replace(/\([^)]*\)/g, "")
    .replace(/\s+/g, "")
    .trim();
  if (!clean) return { summary: "", description: "" };
  const sentences = clean.split(/(?<=[。！？])/).filter((s) => s.length > 4);
  const description = sentences.slice(0, 3).join("").slice(0, 220);
  let summary = sentences[0] || "";
  if (summary.length > 42) summary = summary.slice(0, 40) + "…";
  return { summary, description };
}

/**
 * 中文车名：取正文首句里的车名并去掉品牌前缀，避免「BYD Racco 比亚迪海獭」这种重复。
 * 条目标题不随 variant 转成简体，所以优先从简体正文里取。
 */
function chineseName(zh, brandZh) {
  const lead = (zh.extract || "").split(/[，。（(]/)[0].trim();
  const candidate = /^[\u4e00-\u9fa5A-Za-z0-9·\-\s]{2,20}$/.test(lead) ? lead : zh.title || "";
  const stripped = brandZh ? candidate.replace(brandZh, "").trim() : candidate;
  return stripped && stripped !== candidate ? stripped : "";
}

async function buildDraft(title, knownIds) {
  const details = (await pageDetails([title])).get(title);
  if (!details) throw new Error("维基上找不到这个条目");
  if (!details.image) throw new Error("条目没有首图");

  const id = slug(title);
  if (knownIds.has(id)) throw new Error(`id ${id} 已存在`);

  const wikitext = await sectionWikitext(title);
  const box = parseInfobox(wikitext);
  const zh = details.zhTitle ? await zhPage(details.zhTitle) : { title: "", extract: "" };
  const { summary, description } = chineseCopy(zh.extract);

  const { brand, zh: brandZh } = pickBrand(box, title);
  const electric = isElectric(box, details.extract);
  const category = electric ? "电动车" : pickCategory(box, details.extract);
  const power = toHorsepower(box.power || box.powerout || box.engine_power || box.motor);
  const nameZh = chineseName(zh, brandZh);

  const draft = {
    id,
    name: nameZh ? `${title.replace(/\s*\(.*?\)/, "")} ${nameZh}` : title.replace(/\s*\(.*?\)/, ""),
    brand,
    country: pickCountry(box, brandZh),
    category,
    year: pickYear(box, title),
    priceRMB: null,
    engine: electric ? "纯电驱动" : plain(box.engine || "").split(/[,;]/)[0].slice(0, 40) || null,
    power: power ? `${power} 马力` : null,
    topSpeed: null,
    accel: null,
    drivetrain: /(all-wheel|four-wheel|4wd|awd)/i.test(plain(box.layout || "")) ? "四驱"
      : /(rear-wheel|rwd|rear-engine)/i.test(plain(box.layout || "")) ? "后驱"
      : /(front-wheel|fwd)/i.test(plain(box.layout || "")) ? "前驱" : null,
    seats: null,
    accent: ACCENTS[[...id].reduce((s, ch) => s + ch.charCodeAt(0), 0) % ACCENTS.length],
    emoji: CATEGORY_EMOJI[category] || "🚗",
    summary,
    description,
    facts: [],
  };

  const todo = Object.entries(draft)
    .filter(([k, v]) => v === null || v === "" || (Array.isArray(v) && v.length === 0))
    .map(([k]) => k);
  if (draft.facts.length === 0 && !todo.includes("facts")) todo.push("facts");

  const image = await downloadCarImage(details.image, id);
  return {
    ...draft,
    _source: { wikiTitle: title, zhTitle: zh.title || details.zhTitle, image: details.image.source },
    _todo: todo,
    _imageBytes: image.bytes,
  };
}

async function main() {
  const cars = loadCars();
  const knownIds = new Set(cars.map((c) => c.id));
  const titles = argVal("titles", "")
    ? argVal("titles", "").split(",").map((s) => s.trim()).filter(Boolean)
    : (readJson("data/candidates.json", []) || []).map((c) => c.title);

  if (titles.length === 0) {
    console.log("没有待抓取的条目（先跑 npm run cars:discover）。");
    saveJson("data/incoming.json", []);
    return;
  }

  // 保留还没并入的旧草稿（可能有人正在补字段），不要被这次抓取覆盖掉
  const pending = (readJson("data/incoming.json", []) || []).filter((d) => !titles.includes(d._source && d._source.wikiTitle));
  const drafts = [];
  for (const title of titles) {
    try {
      const draft = await buildDraft(title, knownIds);
      drafts.push(draft);
      const miss = draft._todo.length ? `待补 ${draft._todo.join("/")}` : "字段齐全";
      console.log(`  OK   ${title.padEnd(30)} -> ${draft.id.padEnd(22)} ${miss}`);
    } catch (e) {
      console.log(`  SKIP ${title.padEnd(30)} ${e.message}`);
    }
  }

  saveJson("data/incoming.json", [...pending, ...drafts]);
  console.log(`\n共生成 ${drafts.length} 条草稿${pending.length ? `（另有 ${pending.length} 条此前待补的草稿保留）` : ""} -> data/incoming.json`);
  if (drafts.length) console.log("补全每条的 _todo 字段后，运行 npm run cars:merge 并入图鉴。");
}

main().catch((e) => {
  console.error("抓取失败：", e.message);
  process.exit(1);
});
