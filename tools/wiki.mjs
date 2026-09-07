/**
 * 维基百科 / Wikimedia 取数封装。
 *
 * 网络说明：维基百科在中国大陆无法直接访问。
 *   - 在 GitHub Actions 里跑：直连即可，无需配置。
 *   - 在国内本机跑：设环境变量 WIKI_PROXY 指定一个 CORS 代理模板，例如
 *       $env:WIKI_PROXY = "https://api.allorigins.win/raw?url={url}"
 *     模板里的 {url} 会被替换为经过 URL 编码的目标地址。
 * 车图始终经 images.weserv.nl 代理下载（它同时负责缩放与转 WebP）。
 */

import fs from "node:fs";
import path from "node:path";
import { createRequire } from "node:module";
import { execFile } from "node:child_process";
import { promisify } from "node:util";

const execFileAsync = promisify(execFile);

const PROXY = process.env.WIKI_PROXY || "";
const TIMEOUT = Number(process.env.WIKI_TIMEOUT || 30000);
// auto：优先用 Node 自带 fetch，遇到证书问题自动退回系统 curl；也可显式指定 fetch / curl
const TRANSPORT = process.env.WIKI_TRANSPORT || "auto";
const ROOT = path.join(import.meta.dirname, "..");

const viaProxy = (url) => (PROXY ? PROXY.replace("{url}", encodeURIComponent(url)) : url);
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const chunk = (arr, n) => Array.from({ length: Math.ceil(arr.length / n) }, (_, i) => arr.slice(i * n, i * n + n));

// 装了会拦截 TLS 的企业代理或杀毒软件时，Node 不认它签发的根证书，而系统 curl 认。
const isCertError = (e) => /certificate|self-signed|unable to (get|verify)/i.test(String((e.cause && e.cause.message) || e.message));

async function curlBuffer(url) {
  const { stdout } = await execFileAsync(
    "curl",
    ["-sSL", "--max-time", String(Math.ceil(TIMEOUT / 1000)), "-A", "global-car-encyclopedia/1.0", url],
    { encoding: "buffer", maxBuffer: 64 * 1024 * 1024 }
  );
  if (stdout.length === 0) throw new Error("响应为空");
  return stdout;
}

async function fetchBuffer(url) {
  if (TRANSPORT === "curl") return curlBuffer(url);
  try {
    const res = await fetch(url, {
      signal: AbortSignal.timeout(TIMEOUT),
      headers: { "user-agent": "global-car-encyclopedia/1.0 (educational static site)" },
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return Buffer.from(await res.arrayBuffer());
  } catch (e) {
    if (TRANSPORT === "auto" && isCertError(e)) return curlBuffer(url);
    throw e;
  }
}

// 公共代理通常有限流（Cloudflare 1015），走代理时请求之间留出间隔；直连（CI 上）不需要
const PROXY_DELAY = Number(process.env.WIKI_DELAY || (PROXY ? 1500 : 0));
let lastRequestAt = 0;

async function getJson(url, tries = 5) {
  let lastErr;
  for (let i = 0; i < tries; i++) {
    const wait = lastRequestAt + PROXY_DELAY - Date.now();
    if (wait > 0) await sleep(wait);
    lastRequestAt = Date.now();
    try {
      return JSON.parse((await fetchBuffer(viaProxy(url))).toString("utf8"));
    } catch (e) {
      lastErr = e;
      if (i < tries - 1) await sleep(2000 * 2 ** i);
    }
  }
  throw new Error(`请求失败 ${url} -> ${lastErr.message}`);
}

/** 调用 MediaWiki API，自动处理 continue 分页（合并 list 结果） */
async function api(lang, params, listKey) {
  const merged = [];
  let cont = {};
  for (let guard = 0; guard < 20; guard++) {
    const qs = new URLSearchParams({ action: "query", format: "json", formatversion: "2", ...params, ...cont });
    const data = await getJson(`https://${lang}.wikipedia.org/w/api.php?${qs}`);
    if (!listKey) return data;
    merged.push(...((data.query && data.query[listKey]) || []));
    if (!data.continue) break;
    cont = data.continue;
  }
  return merged;
}

/** 某个分类下的所有条目（只取正文页） */
export async function categoryMembers(category, lang = "en") {
  return api(lang, { list: "categorymembers", cmtitle: `Category:${category}`, cmtype: "page", cmlimit: "500" }, "categorymembers");
}

/** 各条目最近 ~60 天的访问量总和，用来衡量「热门」程度 */
export async function pageviewTotals(titles, lang = "en") {
  const out = new Map();
  for (const group of chunk(titles, 50)) {
    const data = await api(lang, { prop: "pageviews", titles: group.join("|") });
    for (const p of data.query.pages) {
      const views = Object.values(p.pageviews || {}).reduce((s, v) => s + (v || 0), 0);
      out.set(p.title, views);
    }
  }
  return out;
}

/** 条目详情：首图、英文导语、中文条目名 */
export async function pageDetails(titles, lang = "en") {
  const out = new Map();
  for (const group of chunk(titles, 20)) {
    const data = await api(lang, {
      prop: "pageimages|extracts|langlinks",
      piprop: "original",
      pilicense: "any",
      exintro: "1",
      explaintext: "1",
      lllang: "zh",
      redirects: "1",
      titles: group.join("|"),
    });
    for (const p of data.query.pages) {
      if (p.missing) continue;
      out.set(p.title, {
        title: p.title,
        extract: p.extract || "",
        zhTitle: (p.langlinks && p.langlinks[0] && p.langlinks[0].title) || "",
        image: p.original || null,
      });
    }
  }
  return out;
}

/**
 * 中文维基条目的导语与简体标题，用来生成中文科普正文。
 * langlinks 给出的中文标题可能是繁体，这里用 variant=zh-cn 让维基转成简体。
 */
export async function zhPage(zhTitle) {
  const data = await api("zh", { prop: "extracts", exintro: "1", explaintext: "1", redirects: "1", variant: "zh-cn", titles: zhTitle });
  const page = (data.query.pages || []).find((p) => !p.missing && p.extract);
  return page ? { title: page.title, extract: page.extract } : { title: zhTitle, extract: "" };
}

/** 首图地址转成 Wikimedia 缩略图（原图常有 10MB 以上，代理拉取容易超时） */
export function thumbUrl(image) {
  const clean = image.source.split("?")[0].replace(/^https?:\/\//, "");
  if (image.width && image.width < 960) return clean;
  const file = clean.slice(clean.lastIndexOf("/") + 1);
  return clean.replace("/commons/", "/commons/thumb/") + `/960px-${file}`;
}

/** 经 images.weserv.nl 下载并转成 900px 宽的 WebP，与仓库现有车图同规格 */
export async function downloadCarImage(image, id) {
  const dest = path.join(ROOT, "images", `${id}.webp`);
  const url = `https://images.weserv.nl/?url=${thumbUrl(image)}&w=900&output=webp&q=72`;
  const buf = await fetchBuffer(url);
  const isWebp = buf.slice(0, 4).toString("ascii") === "RIFF" && buf.slice(8, 12).toString("ascii") === "WEBP";
  if (!isWebp || buf.length < 8000) throw new Error(`图片内容异常（${buf.length} 字节）`);
  fs.writeFileSync(dest, buf);
  return { path: `images/${id}.webp`, bytes: buf.length };
}

/** 读取 js/data.js 里已收录的车型（复用浏览器脚本，避免两份数据源） */
export function loadCars() {
  const require = createRequire(import.meta.url);
  globalThis.window = globalThis.window || {};
  delete require.cache[require.resolve("../js/data.js")];
  require("../js/data.js");
  return globalThis.window.CARS;
}

/** 已处理过的维基条目：维基条目名 -> 车型 id（"-" 表示看过但决定不收录） */
export function loadSeen() {
  const file = path.join(ROOT, "tools", "seen.json");
  return { file, data: JSON.parse(fs.readFileSync(file, "utf8")) };
}

export function saveJson(relPath, data) {
  const file = path.join(ROOT, relPath);
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, JSON.stringify(data, null, 2) + "\n");
  return file;
}

export function readJson(relPath, fallback = null) {
  const file = path.join(ROOT, relPath);
  if (!fs.existsSync(file)) return fallback;
  return JSON.parse(fs.readFileSync(file, "utf8"));
}

/** 维基条目名 -> 车型 id */
export const slug = (title) =>
  title
    .toLowerCase()
    .replace(/\(.*?\)/g, "")
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");

/** 条目首段的 wikitext，用于解析 Infobox 参数 */
export async function sectionWikitext(title, lang = "en") {
  const data = await api(lang, { action: "parse", page: title, prop: "wikitext", section: "0" });
  return (data.parse && data.parse.wikitext) || "";
}

export { ROOT };
