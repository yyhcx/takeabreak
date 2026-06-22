const http = require("node:http");
const fs = require("node:fs/promises");
const path = require("node:path");
const { URL } = require("node:url");

const PORT = Number(process.env.PORT || 4173);
const ROOT = __dirname;
const STATIC_ROOT = process.env.VERCEL ? path.join(ROOT, "public") : ROOT;
const CACHE_TTL_MS = 5 * 60 * 1000;
const REQUEST_TIMEOUT_MS = 8000;
const HN_STORY_LIMIT = 30;
const CORS_PROXY_URL = "https://api.allorigins.win/raw?url=";
const DAILY_CACHE_DIR = process.env.VERCEL
  ? path.join("/tmp", "takeabreak-cache")
  : path.join(ROOT, ".cache");
const PERSISTENT_CACHE_MAX_STALE_MS = 7 * 24 * 60 * 60 * 1000;
const DAILY_CACHE_TTL_MS = 24 * 60 * 60 * 1000;
const PRESENCE_ACTIVE_WINDOW_MS = 2 * 60 * 1000;
const PRESENCE_CAPACITY = 1500;
const REDIS_CLICK_TTL_SECONDS = 3 * 24 * 60 * 60;
const VERCEL_ANALYTICS_SCRIPT_URL = "https://va.vercel-scripts.com/v1/script.js";
const VERCEL_ANALYTICS_ENDPOINT = "https://vitals.vercel-insights.com/v1";
const ZHIHU_FALLBACK = {
  links: [
    ["知乎热榜今日快照", "Today", "https://www.zhihu.com/hot"],
    ["打开知乎热榜页面", "官网", "https://www.zhihu.com/hot"],
    ["搜索知乎今日热点", "搜索", "https://www.zhihu.com/search?type=content&q=%E7%83%AD%E6%A6%9C"],
  ],
};
const FARK_FALLBACK = {
  links: [
    ["Open Fark Main", "Main", "https://www.fark.com/"],
    ["Submit a link on Fark", "Fark", "https://www.fark.com/submit"],
    ["Browse Fark discussions", "Comments", "https://www.fark.com/comments"],
  ],
};
const BORED_PANDA_FALLBACK = {
  links: [
    ["Open Bored Panda Trending", "Trending", "https://www.boredpanda.com/trending/"],
    ["Open Bored Panda latest feed", "Latest", "https://www.boredpanda.com/feed/"],
  ],
};
const VARIETY_FALLBACK = {
  links: [
    ["Open Variety Most Popular", "Popular", "https://variety.com/vcategory/popular-on-variety/"],
    ["Open Variety homepage", "Variety", "https://variety.com/"],
    ["Open Variety latest feed", "Latest", "https://variety.com/feed/"],
  ],
};
const TMZ_FALLBACK = {
  links: [
    ["Open TMZ homepage", "TMZ", "https://www.tmz.com/"],
    ["Open TMZ latest feed", "Latest", "https://www.tmz.com/rss.xml"],
    ["Open TMZ Sports", "Sports", "https://www.tmz.com/sports/"],
  ],
};
const REDDIT_FALLBACK = {
  links: [
    ["Open Reddit Popular", "Reddit", "https://www.reddit.com/r/popular/"],
    ["Open old Reddit Popular", "old", "https://old.reddit.com/r/popular/"],
    ["Open Reddit RSS", "RSS", "https://www.reddit.com/r/popular/.rss"],
  ],
};
const HUPU_FALLBACK = {
  links: [
    ["打开虎扑步行街主干道", "官网", "https://bbs.hupu.com/topic-daily"],
    ["打开虎扑步行街 24 小时榜", "热榜", "https://bbs.hupu.com/topic-daily-hot"],
    ["打开虎扑步行街最新发布", "最新", "https://bbs.hupu.com/topic-daily-postdate"],
  ],
};
const HUXIU_FALLBACK = {
  links: [
    ["打开虎嗅资讯首页", "官网", "https://www.huxiu.com/"],
    ["虎嗅 24 小时", "资讯", "https://www.huxiu.com/channel/1.html"],
  ],
};

const cache = new Map();
let clickWriteQueue = Promise.resolve();
let presenceWriteQueue = Promise.resolve();

const mimeTypes = {
  ".html": "text/html; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".png": "image/png",
  ".svg": "image/svg+xml",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
};

function sendJson(res, data, status = 200) {
  res.writeHead(status, {
    "content-type": "application/json; charset=utf-8",
    "cache-control": "no-store",
  });
  res.end(JSON.stringify(data));
}

function sendText(res, text, contentType, status = 200) {
  res.writeHead(status, {
    "content-type": contentType,
    "cache-control": "no-store",
  });
  res.end(text);
}

function sendBuffer(res, buffer, contentType, status = 200, extraHeaders = {}) {
  res.writeHead(status, {
    "content-type": contentType,
    "cache-control": "no-store",
    ...extraHeaders,
  });
  res.end(buffer);
}

async function readRequestBody(req, limitBytes = 64 * 1024) {
  const chunks = [];
  let size = 0;
  for await (const chunk of req) {
    chunks.push(chunk);
    size += chunk.length;
    if (size > limitBytes) {
      throw new Error("Request body is too large");
    }
  }

  return Buffer.concat(chunks);
}

async function readRequestJson(req) {
  const body = (await readRequestBody(req, 32 * 1024)).toString("utf8");
  return body ? JSON.parse(body) : {};
}

function decodeEntities(value = "") {
  return value
    .replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, "$1")
    .replace(/&#(\d+);/g, (_, code) => String.fromCharCode(Number(code)))
    .replace(/&#x([a-f0-9]+);/gi, (_, code) => String.fromCharCode(parseInt(code, 16)))
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .trim();
}

function compactNumber(value) {
  if (!Number.isFinite(value)) return "";
  if (value >= 100000000) return `${(value / 100000000).toFixed(1)}亿`;
  if (value >= 10000) return `${(value / 10000).toFixed(1)}万`;
  if (value >= 1000) return `${(value / 1000).toFixed(value >= 10000 ? 0 : 1)}k`;
  return `${value}`;
}

async function fetchUrl(url, responseType = "text", timeoutMs = REQUEST_TIMEOUT_MS, extraHeaders = {}) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const response = await fetch(url, {
      signal: controller.signal,
      headers: {
        "accept": responseType === "json" ? "application/json,text/plain,*/*" : "text/html,application/rss+xml,*/*",
        "accept-language": "zh-CN,zh;q=0.9,en;q=0.8",
        "referer": new URL(url).origin,
        "user-agent":
          "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0 Safari/537.36 Takeabreak/preview",
        ...extraHeaders,
      },
    });

    if (!response.ok) {
      throw new Error(`${url} returned ${response.status}`);
    }

    return responseType === "json" ? response.json() : response.text();
  } finally {
    clearTimeout(timeout);
  }
}

function todayCacheStamp() {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Shanghai",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());
}

async function readDailyCache(key) {
  try {
    const filePath = path.join(DAILY_CACHE_DIR, `${key}-${todayCacheStamp()}.json`);
    return JSON.parse(await fs.readFile(filePath, "utf8"));
  } catch (error) {
    return null;
  }
}

async function writeDailyCache(key, data) {
  await fs.mkdir(DAILY_CACHE_DIR, { recursive: true });
  const filePath = path.join(DAILY_CACHE_DIR, `${key}-${todayCacheStamp()}.json`);
  await fs.writeFile(filePath, JSON.stringify(data, null, 2));
}

async function readPersistentCache(key, maxAgeMs = Infinity) {
  try {
    const filePath = path.join(DAILY_CACHE_DIR, `${key}-latest.json`);
    const cachedData = JSON.parse(await fs.readFile(filePath, "utf8"));
    const age = Date.now() - Number(cachedData.savedAt || 0);
    if (cachedData?.data?.links?.length && age <= maxAgeMs) {
      return cachedData;
    }
  } catch (error) {
    return null;
  }

  return null;
}

async function writePersistentCache(key, data) {
  await fs.mkdir(DAILY_CACHE_DIR, { recursive: true });
  const filePath = path.join(DAILY_CACHE_DIR, `${key}-latest.json`);
  await fs.writeFile(
    filePath,
    JSON.stringify(
      {
        savedAt: Date.now(),
        data,
      },
      null,
      2,
    ),
  );
}

function clicksCachePath(dateStamp = todayCacheStamp()) {
  return path.join(DAILY_CACHE_DIR, `clicks-${dateStamp}.json`);
}

function presenceCachePath() {
  return path.join(DAILY_CACHE_DIR, "presence.json");
}

async function readClickStats(dateStamp = todayCacheStamp()) {
  try {
    const data = JSON.parse(await fs.readFile(clicksCachePath(dateStamp), "utf8"));
    return data?.date === dateStamp && data?.items ? data : { date: dateStamp, items: {} };
  } catch (error) {
    return { date: dateStamp, items: {} };
  }
}

async function writeClickStats(data) {
  await fs.mkdir(DAILY_CACHE_DIR, { recursive: true });
  await fs.writeFile(clicksCachePath(data.date), JSON.stringify(data, null, 2));
}

async function readPresenceStats() {
  try {
    const data = JSON.parse(await fs.readFile(presenceCachePath(), "utf8"));
    return data?.visitors ? data : { visitors: {} };
  } catch (error) {
    return { visitors: {} };
  }
}

async function writePresenceStats(data) {
  await fs.mkdir(DAILY_CACHE_DIR, { recursive: true });
  await fs.writeFile(presenceCachePath(), JSON.stringify(data, null, 2));
}

function vercelAnalyticsConfig() {
  const configString = process.env.REACT_APP_VERCEL_OBSERVABILITY_CLIENT_CONFIG;
  let analytics = {};

  if (configString) {
    try {
      analytics = JSON.parse(configString)?.analytics || {};
    } catch (error) {
      analytics = {};
    }
  }

  return {
    dsn:
      analytics.dsn ||
      process.env.VERCEL_ANALYTICS_DSN ||
      process.env.NEXT_PUBLIC_VERCEL_ANALYTICS_DSN ||
      "",
    basePath:
      analytics.basePath ||
      process.env.REACT_APP_VERCEL_OBSERVABILITY_BASEPATH ||
      "",
  };
}

async function serveVercelAnalyticsScript(res) {
  const response = await fetch(VERCEL_ANALYTICS_SCRIPT_URL);
  if (!response.ok) {
    sendText(res, "Not found", "text/plain; charset=utf-8", response.status);
    return;
  }

  const script = Buffer.from(await response.arrayBuffer());
  sendBuffer(res, script, "application/javascript; charset=utf-8", 200, {
    "cache-control": "public, max-age=86400",
  });
}

async function proxyVercelAnalytics(req, res, pathname) {
  const endpointName = pathname.split("/").pop();
  if (!["view", "event", "session"].includes(endpointName)) {
    sendText(res, "Not found", "text/plain; charset=utf-8", 404);
    return;
  }

  const target = new URL(`${VERCEL_ANALYTICS_ENDPOINT}/${endpointName}`);
  const { dsn } = vercelAnalyticsConfig();
  if (dsn) {
    target.searchParams.set("dsn", dsn);
  }

  const body = req.method === "GET" || req.method === "HEAD"
    ? undefined
    : await readRequestBody(req);

  const response = await fetch(target, {
    method: req.method,
    headers: {
      "content-type": req.headers["content-type"] || "application/json",
      "user-agent": req.headers["user-agent"] || "",
      "x-forwarded-for": req.headers["x-forwarded-for"] || req.socket.remoteAddress || "",
      "x-vercel-ip": req.headers["x-forwarded-for"] || req.socket.remoteAddress || "",
      "cookie": req.headers.cookie || "",
    },
    body,
  });
  const responseBody = Buffer.from(await response.arrayBuffer());

  sendBuffer(
    res,
    responseBody,
    response.headers.get("content-type") || "application/json; charset=utf-8",
    response.status,
  );
}

function normalizeTrackedUrl(value = "") {
  try {
    const url = new URL(value);
    return ["http:", "https:"].includes(url.protocol) ? url.toString() : "";
  } catch (error) {
    return "";
  }
}

function topClickedLinks(data) {
  return Object.values(data.items || {})
    .sort((a, b) => b.count - a.count || b.lastClickedAt - a.lastClickedAt)
    .slice(0, 5)
    .map((item) => ({
      title: item.title,
      url: item.url,
      count: item.count,
    }));
}

function redisConfig() {
  const restUrl =
    process.env.UPSTASH_REDIS_REST_URL ||
    process.env.KV_REST_API_URL ||
    process.env.STORAGE_REST_API_URL ||
    process.env.STORAGE_KV_REST_API_URL ||
    process.env.STORAGE_URL;
  const restToken =
    process.env.UPSTASH_REDIS_REST_TOKEN ||
    process.env.KV_REST_API_TOKEN ||
    process.env.STORAGE_REST_API_TOKEN ||
    process.env.STORAGE_KV_REST_API_TOKEN ||
    process.env.STORAGE_TOKEN;

  if (!restUrl || !restToken || !/^https?:\/\//i.test(restUrl)) {
    return null;
  }

  return {
    restUrl: restUrl.replace(/\/$/, ""),
    restToken,
  };
}

async function redisCommand(command) {
  const config = redisConfig();
  if (!config) {
    throw new Error("Redis REST environment variables are not configured");
  }

  const response = await fetch(config.restUrl, {
    method: "POST",
    headers: {
      "authorization": `Bearer ${config.restToken}`,
      "content-type": "application/json",
    },
    body: JSON.stringify(command),
  });

  if (!response.ok) {
    throw new Error(`Redis command failed with ${response.status}`);
  }

  const data = await response.json();
  if (data?.error) {
    throw new Error(data.error);
  }

  return data?.result;
}

function redisClickKeys(dateStamp = todayCacheStamp()) {
  return {
    rankingKey: `takeabreak:clicks:${dateStamp}`,
    metaKey: `takeabreak:click-meta:${dateStamp}`,
  };
}

function parseClickMeta(value, fallbackUrl) {
  try {
    const meta = JSON.parse(value || "{}");
    return {
      title: String(meta.title || fallbackUrl),
      url: normalizeTrackedUrl(meta.url) || fallbackUrl,
    };
  } catch (error) {
    return {
      title: fallbackUrl,
      url: fallbackUrl,
    };
  }
}

async function redisTopClickedLinks(dateStamp = todayCacheStamp()) {
  const { rankingKey, metaKey } = redisClickKeys(dateStamp);
  const ranked = await redisCommand(["ZREVRANGE", rankingKey, 0, 4, "WITHSCORES"]);
  if (!Array.isArray(ranked) || !ranked.length) {
    return [];
  }

  const entries = [];
  for (let index = 0; index < ranked.length; index += 2) {
    const url = String(ranked[index] || "");
    const count = Number(ranked[index + 1] || 0);
    if (url) {
      entries.push({ url, count });
    }
  }

  if (!entries.length) {
    return [];
  }

  const metaValues = await redisCommand(["HMGET", metaKey, ...entries.map((entry) => entry.url)]);
  return entries.map((entry, index) => {
    const meta = parseClickMeta(Array.isArray(metaValues) ? metaValues[index] : "", entry.url);
    return {
      title: meta.title,
      url: meta.url,
      count: entry.count,
    };
  });
}

async function recordClickInRedis(title, url) {
  const date = todayCacheStamp();
  const { rankingKey, metaKey } = redisClickKeys(date);
  const metadata = JSON.stringify({ title, url });

  await redisCommand(["ZINCRBY", rankingKey, 1, url]);
  await redisCommand(["HSET", metaKey, url, metadata]);
  await redisCommand(["EXPIRE", rankingKey, REDIS_CLICK_TTL_SECONDS]);
  await redisCommand(["EXPIRE", metaKey, REDIS_CLICK_TTL_SECONDS]);

  return {
    date,
    links: await redisTopClickedLinks(date),
    storage: "redis",
  };
}

async function recordClick(req) {
  const body = await readRequestJson(req);
  const title = stripTags(String(body.title || "")).slice(0, 180);
  const url = normalizeTrackedUrl(body.url);
  if (!title || !url) {
    return { error: "Invalid click payload" };
  }

  if (redisConfig()) {
    try {
      return await recordClickInRedis(title, url);
    } catch (error) {
      console.warn("Redis click tracking failed; falling back to local cache", error);
    }
  }

  clickWriteQueue = clickWriteQueue.then(async () => {
    const stats = await readClickStats();
    const key = url;
    const existing = stats.items[key] || {
      title,
      url,
      count: 0,
      firstClickedAt: Date.now(),
    };

    stats.items[key] = {
      ...existing,
      title,
      url,
      count: Number(existing.count || 0) + 1,
      lastClickedAt: Date.now(),
    };

    await writeClickStats(stats);

    return {
      date: stats.date,
      links: topClickedLinks(stats),
    };
  });

  return clickWriteQueue;
}

async function mostClickedToday() {
  if (redisConfig()) {
    try {
      return {
        date: todayCacheStamp(),
        links: await redisTopClickedLinks(),
        storage: "redis",
      };
    } catch (error) {
      console.warn("Redis top clicked lookup failed; falling back to local cache", error);
    }
  }

  const stats = await readClickStats();
  return {
    date: stats.date,
    links: topClickedLinks(stats),
  };
}

function normalizeVisitorId(value = "") {
  return String(value).replace(/[^a-zA-Z0-9_-]/g, "").slice(0, 80);
}

function activePresenceCount(stats, now = Date.now()) {
  return Object.values(stats.visitors || {}).filter((lastSeenAt) => {
    return now - Number(lastSeenAt || 0) <= PRESENCE_ACTIVE_WINDOW_MS;
  }).length;
}

async function updatePresence(req) {
  const body = req.method === "POST" ? await readRequestJson(req) : {};
  const visitorId = normalizeVisitorId(body.visitorId);
  const isLeaving = body.offline === true;
  const now = Date.now();

  presenceWriteQueue = presenceWriteQueue.then(async () => {
    const stats = await readPresenceStats();
    const visitors = {};

    Object.entries(stats.visitors || {}).forEach(([id, lastSeenAt]) => {
      if (now - Number(lastSeenAt || 0) <= PRESENCE_ACTIVE_WINDOW_MS) {
        visitors[id] = Number(lastSeenAt);
      }
    });

    if (visitorId && isLeaving) {
      delete visitors[visitorId];
    } else if (visitorId) {
      visitors[visitorId] = now;
    }

    const nextStats = {
      updatedAt: now,
      visitors,
    };
    await writePresenceStats(nextStats);

    return {
      count: activePresenceCount(nextStats, now),
      capacity: PRESENCE_CAPACITY,
      activeWindowMs: PRESENCE_ACTIVE_WINDOW_MS,
      updatedAt: now,
    };
  });

  return presenceWriteQueue;
}

async function dailyCached(key, loader, fallbackData) {
  const daily = await readDailyCache(key);
  if (daily?.links?.length) {
    return {
      ...daily,
      cache: "daily",
    };
  }

  try {
    const data = await loader();
    if (data?.links?.length) {
      await writeDailyCache(key, data);
    }
    return {
      ...data,
      cache: "fresh-daily",
    };
  } catch (error) {
    return {
      ...fallbackData,
      cache: "fallback",
      warning: error.message,
    };
  }
}

async function persistentCached(
  key,
  loader,
  fallbackData = null,
  { ttlMs = CACHE_TTL_MS, maxStaleMs = PERSISTENT_CACHE_MAX_STALE_MS } = {},
) {
  const existing = cache.get(key);
  if (existing && Date.now() - existing.savedAt < ttlMs) {
    return {
      ...existing.data,
      cache: "hit",
    };
  }

  const diskFresh = await readPersistentCache(key, ttlMs);
  if (diskFresh) {
    cache.set(key, diskFresh);
    return {
      ...diskFresh.data,
      cache: "disk-hit",
    };
  }

  try {
    const data = await loader();
    if (!data?.links?.length) {
      throw new Error(`${key} returned no links`);
    }

    const entry = {
      savedAt: Date.now(),
      data,
    };
    cache.set(key, entry);
    await writePersistentCache(key, data);

    return {
      ...data,
      cache: "fresh",
    };
  } catch (error) {
    if (existing?.data?.links?.length) {
      return {
        ...existing.data,
        cache: "stale",
        warning: error.message,
      };
    }

    const diskStale = await readPersistentCache(key, maxStaleMs);
    if (diskStale) {
      cache.set(key, diskStale);
      return {
        ...diskStale.data,
        cache: "disk-stale",
        warning: error.message,
      };
    }

    if (fallbackData) {
      return {
        ...fallbackData,
        cache: "fallback",
        warning: error.message,
      };
    }

    throw error;
  }
}

function stripTags(value = "") {
  return decodeEntities(value.replace(/<[^>]+>/g, "").replace(/\s+/g, " "));
}

function absolutizeUrl(url, origin) {
  if (!url) return "";
  try {
    return new URL(decodeEntities(url), origin).toString();
  } catch (error) {
    return "";
  }
}

function parseRssItems(xml, fallbackSource = "") {
  return [...xml.matchAll(/<item>([\s\S]*?)<\/item>/g)]
    .map((match) => {
      const item = match[1];
      const title = decodeEntities(item.match(/<title>([\s\S]*?)<\/title>/)?.[1]);
      const link = decodeEntities(item.match(/<link>([\s\S]*?)<\/link>/)?.[1]);
      const source = decodeEntities(item.match(/<source[^>]*>([\s\S]*?)<\/source>/)?.[1]) || fallbackSource;

      return title && link ? [title, source, link] : null;
    })
    .filter(Boolean);
}

function parseRedditAtom(xml) {
  return [...xml.matchAll(/<entry>([\s\S]*?)<\/entry>/g)]
    .map((match) => {
      const entry = match[1];
      const title = decodeEntities(entry.match(/<title>([\s\S]*?)<\/title>/)?.[1]);
      const href = decodeEntities(entry.match(/<link[^>]+href="([^"]+)"/)?.[1]);
      const subreddit = decodeEntities(
        entry.match(/<category[^>]+(?:term|label)="([^"]+)"/)?.[1],
      ).replace(/^r\//i, "");

      return title && href ? [title, subreddit ? `r/${subreddit}` : "Reddit", href] : null;
    })
    .filter(Boolean)
    .filter((item, index, list) => list.findIndex((other) => other[2] === item[2]) === index);
}

function parseOldRedditHtml(html) {
  const things = [...html.matchAll(/<div[^>]+class="[^"]*\bthing\b[^"]*"[\s\S]*?(?=<div[^>]+class="[^"]*\bthing\b|<div class="nav-buttons"|<\/body>)/g)]
    .map((match) => match[0]);

  return things
    .map((thing) => {
      const titleAnchor = thing.match(/<a[^>]+class="[^"]*\btitle\b[^"]*"[^>]+href="([^"]+)"[^>]*>([\s\S]*?)<\/a>/);
      const subreddit = stripTags(thing.match(/<a[^>]+class="[^"]*\bsubreddit\b[^"]*"[^>]*>([\s\S]*?)<\/a>/)?.[1]);
      if (!titleAnchor) return null;

      const title = stripTags(titleAnchor[2]);
      const commentsUrl = thing.match(/<a[^>]+data-event-action="comments"[^>]+href="([^"]+)"/)?.[1];
      const href = commentsUrl || titleAnchor[1];
      if (!title || !href) return null;

      return [title, subreddit || "Reddit", absolutizeUrl(href, "https://old.reddit.com")];
    })
    .filter(Boolean)
    .filter((item, index, list) => list.findIndex((other) => other[2] === item[2]) === index);
}

function extractBalancedJsonArray(text, startIndex) {
  let depth = 0;
  let inString = false;
  let escaped = false;

  for (let index = startIndex; index < text.length; index += 1) {
    const char = text[index];

    if (inString) {
      if (escaped) {
        escaped = false;
      } else if (char === "\\") {
        escaped = true;
      } else if (char === '"') {
        inString = false;
      }
      continue;
    }

    if (char === '"') {
      inString = true;
      continue;
    }

    if (char === "[") {
      depth += 1;
    } else if (char === "]") {
      depth -= 1;
      if (depth === 0) {
        return text.slice(startIndex, index + 1);
      }
    }
  }

  return "";
}

function parseHupuEmbeddedThreads(html) {
  const threadsIndex = html.indexOf('"threads":{"count"');
  const listIndex = threadsIndex >= 0 ? html.indexOf('"list":[', threadsIndex) : -1;
  if (listIndex < 0) return [];

  const arrayStart = html.indexOf("[", listIndex);
  const arraySource = extractBalancedJsonArray(html, arrayStart);
  if (!arraySource) return [];

  try {
    const posts = JSON.parse(arraySource);
    return posts
      .map((post) => {
        const title = stripTags(post?.title || "");
        const url = absolutizeUrl(post?.url, "https://bbs.hupu.com");
        const replies = Number(post?.replies);
        const read = Number(post?.read);
        const lights = Number(post?.lights);
        const metric = Number.isFinite(replies) && replies > 0
          ? `${compactNumber(replies)}回`
          : Number.isFinite(lights) && lights > 0
            ? `${compactNumber(lights)}亮`
            : Number.isFinite(read) && read > 0
              ? `${compactNumber(read)}读`
              : "热帖";

        return title && url ? [title, metric, url] : null;
      })
      .filter(Boolean)
      .filter((item, index, list) => list.findIndex((other) => other[2] === item[2]) === index);
  } catch (error) {
    return [];
  }
}

function parseHupuAnchorLinks(html) {
  return [...html.matchAll(/<a[^>]+href="([^"]+)"[^>]*>([\s\S]*?)<\/a>/g)]
    .map((match) => {
      const href = match[1];
      const title = stripTags(match[2]);
      if (!title || title.length < 6 || !/(\/\d+\.html|\/topic-daily)/.test(href)) return null;
      return [title, "热帖", absolutizeUrl(href, "https://bbs.hupu.com")];
    })
    .filter(Boolean)
    .filter((item, index, list) => list.findIndex((other) => other[0] === item[0]) === index);
}

function isVerificationPage(content = "") {
  return /Access Verification|访问验证|aliyun_waf|cdn-cgi|challenge-platform|安全验证|人机验证/i.test(content);
}

function parseHuxiuHtml(html) {
  return [...html.matchAll(/<a[^>]+href="([^"]*\/article\/[^"]+)"[^>]*>([\s\S]*?)<\/a>/g)]
    .map((match) => {
      const title = stripTags(match[2]);
      const url = absolutizeUrl(match[1], "https://www.huxiu.com");
      if (!title || title.length < 6 || /虎嗅|登录|注册|更多/.test(title)) return null;
      return [title, "虎嗅", url];
    })
    .filter(Boolean)
    .filter((item, index, list) => list.findIndex((other) => other[2] === item[2] || other[0] === item[0]) === index);
}

function parseBoredPandaHtml(html) {
  const articleBlocks = [...html.matchAll(/<article\b[\s\S]*?<\/article>/g)].map((match) => match[0]);
  return articleBlocks
    .map((article) => {
      const titleAnchor =
        article.match(/<div[^>]+class="[^"]*rec-title[^"]*"[\s\S]*?<a[^>]+href="([^"]+)"[^>]*>([\s\S]*?)<\/a>/) ||
        article.match(/<a[^>]+href="([^"]+)"[^>]*>\s*<img[^>]+alt="([^"]+)"/);
      if (!titleAnchor) return null;

      const href = titleAnchor[1];
      const title = stripTags(titleAnchor[2]);
      const points = stripTags(article.match(/<span[^>]+class="[^"]*points-count[^"]*"[^>]*>([\s\S]*?)<\/span>/)?.[1]);
      if (!title || title.length < 8) return null;

      return [title, points || "Bored Panda", absolutizeUrl(href, "https://www.boredpanda.com")];
    })
    .filter(Boolean)
    .filter((item, index, list) => list.findIndex((other) => other[0] === item[0]) === index);
}

function parseVarietyMostPopularHtml(html) {
  const sectionStart = html.indexOf("most-popular-sidebar");
  if (sectionStart < 0) return [];

  const nextSection = html.indexOf("</section>", sectionStart);
  const section = html.slice(sectionStart, nextSection > sectionStart ? nextSection : sectionStart + 60000);
  const articles = [...section.matchAll(/<article\b[\s\S]*?<\/article>/g)].map((match) => match[0]);

  return articles
    .map((article) => {
      const anchor = article.match(/<a[^>]+href="([^"]+)"[^>]*class="[^"]*\bc-title__link\b[^"]*"[^>]*>([\s\S]*?)<\/a>/)
        || article.match(/<a[^>]+class="[^"]*\bc-title__link\b[^"]*"[^>]+href="([^"]+)"[^>]*>([\s\S]*?)<\/a>/);
      if (!anchor) return null;

      const title = stripTags(anchor[2]);
      const url = absolutizeUrl(anchor[1], "https://variety.com");
      if (!title || !url || !url.includes("variety.com")) return null;

      const pathname = new URL(url).pathname;
      if (!/\/20\d{2}\//.test(pathname) && !pathname.startsWith("/lists/")) return null;

      return [title, "Popular", url];
    })
    .filter(Boolean)
    .filter((item, index, list) => list.findIndex((other) => other[2] === item[2]) === index);
}

function parseTmzHomepageHtml(html) {
  const blogrollStart = html.indexOf("<section class=\"blogroll\"");
  const searchSpace = blogrollStart >= 0 ? html.slice(blogrollStart) : html;
  const articles = [...searchSpace.matchAll(/<article\b[\s\S]*?<\/article>/g)].map((match) => match[0]);

  return articles
    .map((article) => {
      const anchor = article.match(/<a[^>]+class="[^"]*\barticle__header-link\b[^"]*"[^>]+href="([^"]+)"[^>]*>([\s\S]*?)<\/a>/)
        || article.match(/<a[^>]+href="([^"]+)"[^>]+class="[^"]*\barticle__header-link\b[^"]*"[^>]*>([\s\S]*?)<\/a>/);
      if (!anchor) return null;

      const url = absolutizeUrl(anchor[1], "https://www.tmz.com");
      const fragments = [...anchor[2].matchAll(/<span[^>]+class="[^"]*\barticle__header--hf\d+\b[^"]*"[^>]*>([\s\S]*?)<\/span>/g)]
        .map((match) => stripTags(match[1]))
        .filter(Boolean);
      const title = fragments.length ? fragments.join(" ") : stripTags(anchor[2]);

      if (!title || !url || !url.includes("tmz.com")) return null;
      return [title, "TMZ", url];
    })
    .filter(Boolean)
    .filter((item, index, list) => list.findIndex((other) => other[2] === item[2] || other[0] === item[0]) === index);
}

function proxiedUrl(url) {
  return `${CORS_PROXY_URL}${encodeURIComponent(url)}`;
}

async function fetchUrlWithProxyFallback(url, responseType = "text", timeoutMs = REQUEST_TIMEOUT_MS) {
  try {
    return await fetchUrl(url, responseType, timeoutMs);
  } catch (error) {
    return fetchUrl(proxiedUrl(url), responseType, timeoutMs);
  }
}

async function cached(key, loader, fallbackData = null) {
  const existing = cache.get(key);
  if (existing && Date.now() - existing.savedAt < CACHE_TTL_MS) {
    return {
      ...existing.data,
      cache: "hit",
    };
  }

  try {
    const data = await loader();
    cache.set(key, {
      savedAt: Date.now(),
      data,
    });

    return {
      ...data,
      cache: "fresh",
    };
  } catch (error) {
    if (existing) {
      return {
        ...existing.data,
        cache: "stale",
        warning: error.message,
      };
    }

    if (fallbackData) {
      return {
        ...fallbackData,
        cache: "fallback",
        warning: error.message,
      };
    }

    throw error;
  }
}

async function hackerNews() {
  return cached("hacker-news", async () => {
    const ids = await fetchUrl("https://hacker-news.firebaseio.com/v0/topstories.json", "json");
    const items = await Promise.all(
      ids.slice(0, HN_STORY_LIMIT).map((id) =>
        fetchUrl(`https://hacker-news.firebaseio.com/v0/item/${id}.json`, "json").catch(() => null),
      ),
    );
    const links = items
      .filter((item) => item?.title)
      .map((item) => [
        item.title,
        item.score ? `${item.score}` : "",
        item.url || `https://news.ycombinator.com/item?id=${item.id}`,
      ]);

    return { links };
  });
}

async function googleNews() {
  return cached("google-news", async () => {
    const xml = await fetchUrl("https://news.google.com/rss?hl=en-US&gl=US&ceid=US:en");
    const items = [...xml.matchAll(/<item>([\s\S]*?)<\/item>/g)].map((match) => match[1]);
    const links = items
      .map((item) => {
        const rawTitle = decodeEntities(item.match(/<title>([\s\S]*?)<\/title>/)?.[1]);
        const source = decodeEntities(item.match(/<source[^>]*>([\s\S]*?)<\/source>/)?.[1]) || "news";
        const url = decodeEntities(item.match(/<link>([\s\S]*?)<\/link>/)?.[1]);
        const suffix = ` - ${source}`;
        const title = rawTitle.endsWith(suffix) ? rawTitle.slice(0, -suffix.length) : rawTitle;

        return title && url ? [title, source, url] : null;
      })
      .filter(Boolean);

    return { links };
  });
}

async function reddit() {
  return cached("reddit", async () => {
    const rss = await fetchUrl("https://www.reddit.com/r/popular/.rss", "text", 3000);
    const rssLinks = parseRedditAtom(rss);
    if (rssLinks.length) {
      return { links: rssLinks.slice(0, 30), source: "reddit-rss" };
    }

    const oldHtml = await fetchUrl("https://old.reddit.com/r/popular/", "text", 4500);
    const oldLinks = parseOldRedditHtml(oldHtml);
    if (oldLinks.length) {
      return { links: oldLinks.slice(0, 30), source: "old-reddit-html" };
    }

    const data = await fetchUrlWithProxyFallback(
      "https://www.reddit.com/r/popular/top.json?t=day&limit=30&raw_json=1",
      "json",
      2500,
    );
    const posts = data?.data?.children || [];
    const links = posts
      .map(({ data: post }) => {
        if (!post?.title || !post?.permalink) return null;
        return [
          post.title,
          compactNumber(post.ups),
          `https://www.reddit.com${post.permalink}`,
        ];
      })
      .filter(Boolean);

    if (!links.length) {
      throw new Error("No Reddit links parsed");
    }

    return { links, source: "reddit-json" };
  }, REDDIT_FALLBACK);
}

async function githubTrending() {
  return cached("github-trending", async () => {
    const html = await fetchUrl("https://github.com/trending?since=daily");
    const articles = [...html.matchAll(/<article[\s\S]*?<\/article>/g)].map((match) => match[0]);
    const links = articles
      .map((article) => {
        const anchor = article.match(/<h2[\s\S]*?<a[^>]+href="([^"]+)"[^>]*>([\s\S]*?)<\/a>/);
        if (!anchor) return null;

        const href = anchor[1];
        const title = decodeEntities(anchor[2].replace(/<[^>]+>/g, "").replace(/\s+/g, " ")).replace(" / ", "/");
        const starsToday = decodeEntities(
          article.match(/<span[^>]*class="[^"]*d-inline-block[^"]*float-sm-right[^"]*"[^>]*>([\s\S]*?)<\/span>/)?.[1]
            ?.replace(/<[^>]+>/g, "")
            ?.replace(/\s+/g, " "),
        ).replace(" stars today", "");

        return title && href ? [title, starsToday, `https://github.com${href}`] : null;
      })
      .filter(Boolean);

    return { links };
  });
}

async function farkMain() {
  return cached("fark-main", async () => {
    const candidates = [
      "https://www.fark.com/fark.rss",
      "https://www.fark.com/rss",
      "https://www.fark.com/",
    ];

    let content = "";
    let lastError = null;

    for (const url of candidates) {
      try {
        content = await fetchUrl(url, "text", 4500);
        if (!/403 Forbidden|cdn-cgi|challenge-platform/i.test(content)) break;
        throw new Error(`${url} blocked by Cloudflare`);
      } catch (error) {
        lastError = error;
      }
    }

    if (!content || /403 Forbidden|cdn-cgi|challenge-platform/i.test(content)) {
      throw lastError || new Error("Fark blocked the request");
    }

    const rssLinks = parseRssItems(content, "Fark");
    if (rssLinks.length) {
      return { links: rssLinks };
    }

    const links = [...content.matchAll(/<a[^>]+href="([^"]+)"[^>]*>([\s\S]*?)<\/a>/g)]
      .map((match) => {
        const href = match[1];
        const title = stripTags(match[2]);
        if (!title || title.length < 12 || /submit a link|login|sign up|advertise/i.test(title)) return null;
        return [title, "Fark", absolutizeUrl(href, "https://www.fark.com")];
      })
      .filter(Boolean)
      .filter((item, index, list) => list.findIndex((other) => other[0] === item[0]) === index)
      .slice(0, 40);

    if (!links.length) {
      throw new Error("No Fark links parsed");
    }

    return { links };
  }, FARK_FALLBACK);
}

async function boredPandaTrending() {
  return cached("bored-panda-trending", async () => {
    const html = await fetchUrl("https://www.boredpanda.com/trending/", "text", 6000);
    const htmlLinks = parseBoredPandaHtml(html);
    if (htmlLinks.length) {
      return { links: htmlLinks.slice(0, 40) };
    }

    const rss = await fetchUrl("https://www.boredpanda.com/feed/", "text", 6000);
    const rssLinks = parseRssItems(rss, "Bored Panda");
    if (rssLinks.length) {
      return { links: rssLinks.slice(0, 40) };
    }

    throw new Error("No Bored Panda Trending links parsed");
  }, BORED_PANDA_FALLBACK);
}

async function varietyMostPopular() {
  return persistentCached("variety-most-popular-v2", async () => {
    const html = await fetchUrl("https://variety.com/", "text", 4500);
    if (isVerificationPage(html)) {
      throw new Error("Variety returned a verification page");
    }

    const htmlLinks = parseVarietyMostPopularHtml(html);
    if (htmlLinks.length) {
      return {
        links: htmlLinks.slice(0, 30),
        source: "variety-home-most-popular",
      };
    }

    const rss = await fetchUrl("https://variety.com/feed/", "text", 3500);
    const rssLinks = parseRssItems(rss, "Latest");
    if (rssLinks.length) {
      return {
        links: rssLinks.slice(0, 30),
        source: "variety-rss-fallback",
      };
    }

    throw new Error("No Variety Most Popular links parsed");
  }, VARIETY_FALLBACK);
}

async function tmzLatest() {
  return persistentCached("tmz-latest", async () => {
    const html = await fetchUrl("https://www.tmz.com/", "text", 4500);
    if (isVerificationPage(html)) {
      throw new Error("TMZ returned a verification page");
    }

    const htmlLinks = parseTmzHomepageHtml(html);
    if (htmlLinks.length) {
      return {
        links: htmlLinks.slice(0, 40),
        source: "tmz-homepage",
      };
    }

    const rss = await fetchUrl("https://www.tmz.com/rss.xml", "text", 3500);
    const rssLinks = parseRssItems(rss, "TMZ");
    if (rssLinks.length) {
      return {
        links: rssLinks.slice(0, 40),
        source: "tmz-rss-fallback",
      };
    }

    throw new Error("No TMZ links parsed");
  }, TMZ_FALLBACK);
}

async function zhihuHot() {
  return persistentCached("zhihu-hot", async () => {
    if (!process.env.ZHIHU_COOKIE) {
      throw new Error("ZHIHU_COOKIE is not configured");
    }

    const zhihuHeaders = process.env.ZHIHU_COOKIE
      ? {
          "cookie": process.env.ZHIHU_COOKIE,
          "x-requested-with": "fetch",
        }
      : {};
    const data = await fetchUrl(
      "https://www.zhihu.com/api/v3/feed/topstory/hot-lists/total?limit=50&desktop=true",
      "json",
      3000,
      zhihuHeaders,
    );
    const links = (data?.data || [])
      .map((item) => {
        const target = item?.target || item;
        const title = target?.title_area?.text || target?.title || target?.question?.title;
        const metrics = target?.metrics_area?.text || target?.excerpt_area?.text || "";
        const rawUrl = target?.link?.url || target?.url || target?.question?.url;
        const url = rawUrl
          ? rawUrl.replace("api.zhihu.com/questions", "www.zhihu.com/question")
          : `https://www.zhihu.com/search?type=content&q=${encodeURIComponent(title || "")}`;

        return title ? [stripTags(title), stripTags(metrics), url] : null;
      })
      .filter(Boolean);

    return { links, source: "zhihu-api" };
  }, ZHIHU_FALLBACK, {
    ttlMs: DAILY_CACHE_TTL_MS,
    maxStaleMs: PERSISTENT_CACHE_MAX_STALE_MS,
  });
}

async function toutiaoHot() {
  return cached("toutiao-hot", async () => {
    const data = await fetchUrl("https://www.toutiao.com/hot-event/hot-board/?origin=toutiao_pc", "json");
    const links = (data?.data || data?.fixed_top_data || [])
      .map((item) => {
        const title = item?.Title || item?.title || item?.word;
        const hot = item?.HotValue || item?.hot_value || item?.LabelDesc || "";
        const rawUrl = item?.Url || item?.url || item?.Schema;
        const url = rawUrl || `https://www.toutiao.com/search/?keyword=${encodeURIComponent(title || "")}`;

        return title ? [stripTags(title), compactNumber(Number(hot)) || stripTags(String(hot)), url] : null;
      })
      .filter(Boolean);

    return { links };
  }, {
    links: [
      ["打开今日头条热榜", "官网", "https://www.toutiao.com/hot-event/hot-board/?origin=toutiao_pc"],
    ],
  });
}

async function hupuBxj() {
  return persistentCached("hupu-bxj", async () => {
    const html = await fetchUrl("https://bbs.hupu.com/topic-daily", "text", 3500);
    if (isVerificationPage(html)) {
      throw new Error("Hupu returned a verification page");
    }

    const embeddedLinks = parseHupuEmbeddedThreads(html);
    const links = embeddedLinks.length
      ? embeddedLinks.slice(0, 50)
      : parseHupuAnchorLinks(html).slice(0, 50);

    if (!links.length) {
      throw new Error("No Hupu links parsed");
    }

    return { links, source: "hupu-topic-daily" };
  }, HUPU_FALLBACK);
}

async function huxiuNews() {
  return persistentCached("huxiu-news", async () => {
    const candidates = [
      {
        url: "https://www.huxiu.com/rss/0.xml",
        type: "rss",
      },
      {
        url: "https://www.huxiu.com/channel/1.html",
        type: "html",
      },
      {
        url: "https://www.huxiu.com/",
        type: "html",
      },
    ];

    const attempts = await Promise.allSettled(
      candidates.map(async (candidate) => {
        const content = await fetchUrl(candidate.url, "text", 2500);
        if (isVerificationPage(content)) {
          throw new Error(`${candidate.url} requires access verification`);
        }

        const links = candidate.type === "rss"
          ? parseRssItems(content, "虎嗅")
          : parseHuxiuHtml(content);

        if (!links.length) {
          throw new Error(`No Huxiu links parsed from ${candidate.url}`);
        }

        return {
          links: links.slice(0, 50),
          source: candidate.type === "rss" ? "huxiu-rss" : "huxiu-html",
        };
      }),
    );

    const success = attempts.find((attempt) => attempt.status === "fulfilled");
    if (success) {
      return success.value;
    }

    const firstFailure = attempts.find((attempt) => attempt.status === "rejected");
    throw firstFailure?.reason || new Error("No Huxiu source responded");
  }, HUXIU_FALLBACK);
}

async function serveStatic(req, res) {
  const url = new URL(req.url, `http://${req.headers.host}`);
  const pathname = decodeURIComponent(url.pathname === "/" ? "/index.html" : url.pathname);
  const filePath = path.resolve(STATIC_ROOT, `.${pathname}`);

  if (!filePath.startsWith(STATIC_ROOT)) {
    sendText(res, "Not found", "text/plain; charset=utf-8", 404);
    return;
  }

  try {
    const content = await fs.readFile(filePath);
    sendText(res, content, mimeTypes[path.extname(filePath)] || "application/octet-stream");
  } catch (error) {
    sendText(res, "Not found", "text/plain; charset=utf-8", 404);
  }
}

async function handleRequest(req, res) {
  try {
    const url = new URL(req.url, `http://${req.headers.host}`);

    if (url.pathname === "/_vercel/insights/script.js") {
      await serveVercelAnalyticsScript(res);
      return;
    }

    if (url.pathname.startsWith("/_vercel/insights/")) {
      await proxyVercelAnalytics(req, res, url.pathname);
      return;
    }

    if (url.pathname === "/api/most-clicked-today") {
      sendJson(res, await mostClickedToday());
      return;
    }

    if (url.pathname === "/api/clicks" && req.method === "POST") {
      const data = await recordClick(req);
      sendJson(res, data, data.error ? 400 : 200);
      return;
    }

    if (url.pathname === "/api/presence") {
      sendJson(res, await updatePresence(req));
      return;
    }

    if (url.pathname === "/api/hacker-news") {
      sendJson(res, await hackerNews());
      return;
    }

    if (url.pathname === "/api/google-news") {
      sendJson(res, await googleNews());
      return;
    }

    if (url.pathname === "/api/reddit") {
      sendJson(res, await reddit());
      return;
    }

    if (url.pathname === "/api/github-trending") {
      sendJson(res, await githubTrending());
      return;
    }

    if (url.pathname === "/api/fark-main") {
      sendJson(res, await farkMain());
      return;
    }

    if (url.pathname === "/api/bored-panda-trending") {
      sendJson(res, await boredPandaTrending());
      return;
    }

    if (url.pathname === "/api/variety-most-popular") {
      sendJson(res, await varietyMostPopular());
      return;
    }

    if (url.pathname === "/api/tmz-latest") {
      sendJson(res, await tmzLatest());
      return;
    }

    if (url.pathname === "/api/zhihu-hot") {
      sendJson(res, await zhihuHot());
      return;
    }

    if (url.pathname === "/api/toutiao-hot") {
      sendJson(res, await toutiaoHot());
      return;
    }

    if (url.pathname === "/api/hupu-bxj") {
      sendJson(res, await hupuBxj());
      return;
    }

    if (url.pathname === "/api/huxiu-news") {
      sendJson(res, await huxiuNews());
      return;
    }

    await serveStatic(req, res);
  } catch (error) {
    sendJson(res, { error: error.message }, 502);
  }
}

const server = http.createServer(handleRequest);

if (require.main === module) {
  server.listen(PORT, "127.0.0.1", () => {
    console.log(`Takeabreak preview running at http://127.0.0.1:${PORT}/`);
  });
}

module.exports = handleRequest;
