const sources = [
  {
    name: "Google News",
    time: "3 min ago",
    color: "#5f9cff",
    icon: "google-news",
    links: [
      ["Productivity myths that won't go away", "2.8k"],
      ["A startup turned a side project into revenue", "2.3k"],
      ["The 4-day workweek pilot expands", "1.9k"],
      ["Designing a better note-taking habit", "1.6k"],
      ["Why boring tools win in the long run", "1.4k"],
      ["The case for offline thinking time", "1.2k"],
      ["Small changes that reduce mental clutter", "998"],
    ],
  },
  {
    name: "Reddit",
    time: "4 min ago",
    color: "#ff5a1f",
    icon: "reddit",
    links: [
      ["New rooftop park opens downtown", "2.7k"],
      ["The bike lane update people are cheering", "2.2k"],
      ["Best cheap eats according to locals", "1.8k"],
      ["Upcoming street fair full schedule", "1.5k"],
      ["Public library perks you might not know", "1.3k"],
      ["This neighborhood is having a moment", "1.1k"],
      ["The hidden trail that's trending again", "876"],
    ],
  },
  {
    name: "Hacker News",
    time: "2 min ago",
    color: "#ff6600",
    icon: "hn",
    links: [
      ["Why everyone is talking about shorter meetings", "3.6k"],
      ["The lunch spot map that went viral", "2.9k"],
      ["A tiny browser trick people keep sharing", "2.4k"],
      ["The office playlist debate returns", "2.1k"],
      ["Remote vs office: a new take", "1.7k"],
      ["This weekend travel thread is getting busy", "1.6k"],
      ["The thread about better coffee breaks keeps growing", "1.2k"],
    ],
  },
  {
    name: "GitHub Trending",
    time: "2 min ago",
    color: "#f0f6fc",
    icon: "github",
    links: [
      ["Manager mistakes that drain the team", "2.6k"],
      ["How to give feedback without the awkward", "2.1k"],
      ["The async update template everyone wants", "1.7k"],
      ["Handling too many meetings", "1.4k"],
      ["Career pivots from real people", "1.3k"],
      ["What to do when you feel stuck", "1.0k"],
      ["The case for saying no more often", "812"],
    ],
  },
  {
    name: "Fark Main",
    time: "loading",
    color: "#8a86c8",
    icon: "fark",
    links: [
      ["Waiting for Fark Main", ""],
    ],
  },
  {
    name: "Variety Most Popular",
    time: "loading",
    color: "#f5e94f",
    icon: "variety",
    links: [
      ["Waiting for Variety Most Popular", ""],
    ],
  },
  {
    name: "TMZ",
    time: "loading",
    color: "#ef3f35",
    icon: "tmz",
    links: [
      ["Waiting for TMZ", ""],
    ],
  },
  {
    name: "知乎 & 虎嗅",
    type: "compactPair",
    color: "#1772f6",
    items: [
      {
        name: "知乎热榜",
        label: "Today",
        color: "#1772f6",
        icon: "zhihu",
        link: ["打开知乎热榜页面", "知乎", "https://www.zhihu.com/hot"],
      },
      {
        name: "虎嗅资讯",
        label: "Home",
        color: "#f6c84c",
        icon: "huxiu",
        link: ["打开虎嗅资讯首页", "虎嗅", "https://www.huxiu.com/"],
      },
    ],
  },
  {
    name: "今日头条热榜",
    time: "loading",
    color: "#f04142",
    icon: "toutiao",
    links: [
      ["等待今日头条热榜更新", ""],
    ],
  },
  {
    name: "虎扑步行街",
    time: "loading",
    color: "#d43d2a",
    icon: "hupu",
    links: [
      ["等待虎扑步行街热帖更新", ""],
    ],
  },
];

const HN_TOP_STORIES_URL = "https://hacker-news.firebaseio.com/v0/topstories.json";
const HN_ITEM_URL = "https://hacker-news.firebaseio.com/v0/item";
const HN_STORY_LIMIT = 30;
const GOOGLE_NEWS_TOP_URL = "https://news.google.com/rss?hl=en-US&gl=US&ceid=US:en";
const REDDIT_POPULAR_URL = "https://www.reddit.com/r/popular/top.json?t=day&limit=30&raw_json=1";
const GITHUB_TRENDING_URL = "https://github.com/trending?since=daily";
const CORS_PROXY_URL = "https://api.allorigins.win/raw?url=";
const REQUEST_TIMEOUT_MS = 6000;
const CACHE_PREFIX = "takeabreak:source:";
const CACHE_VERSION = 12;
const LOCAL_API_ORIGIN = "http://127.0.0.1:4173";
window.mostClickedToday = [];

const iconPaths = {
  chat: [
    '<path d="M7 9h18v11H12l-5 4V9Z" />',
    '<path d="M11 14h8M11 18h5" />',
  ],
  doc: [
    '<path d="M9 5h10l5 5v17H9V5Z" />',
    '<path d="M19 5v6h5M13 16h7M13 21h7" />',
  ],
  city: [
    '<path d="M7 26h18M9 26V11h7v15M17 26V7h7v19" />',
    '<path d="M12 15h1M12 20h1M20 12h1M20 17h1M20 22h1" />',
  ],
  bubble: [
    '<path d="M6 13a8 8 0 0 1 8-7h4a8 8 0 0 1 0 16h-6l-6 4v-8a8 8 0 0 1 0-5Z" />',
  ],
  trend: [
    '<path d="M6 22 13 15l5 5 8-10" />',
    '<path d="M20 10h6v6" />',
  ],
  ball: [
    '<circle cx="16" cy="16" r="10" />',
    '<path d="M6 16h20M16 6c3 3 4 7 0 20M16 6c-3 3-4 7 0 20" />',
  ],
  star: [
    '<path d="m16 5 3 7 8 .5-6 5 2 7.5-7-4-7 4 2-7.5-6-5 8-.5 3-7Z" />',
  ],
  globe: [
    '<circle cx="16" cy="16" r="10" />',
    '<path d="M6 16h20M16 6c3 3 4 7 0 20M16 6c-3 3-4 7 0 20" />',
  ],
  zhihu: [
    '<path d="M7 9h9M11.5 9c0 7-1.5 12-5.5 16" />',
    '<path d="M8 17h8M16 15c-1 5-3 8-7 11" />',
    '<path d="M19 8h7v15h-7V8Z" />',
  ],
  toutiao: [
    '<path d="M7 9h18M7 15h18M7 21h11" />',
    '<path d="M20 20l2 2 4-5" />',
  ],
  hupu: [
    '<path d="M8 21c4-8 10-12 16-13-1 8-5 14-13 17" />',
    '<path d="M12 24c0-5 2-9 7-13" />',
  ],
  huxiu: [
    '<path d="M7 24 11 8l5 9 5-9 4 16" />',
    '<path d="M10 20h12" />',
  ],
  fark: [
    '<path d="M8 8h16M8 8v17M8 16h13" />',
    '<path d="M20 22h4" />',
  ],
  panda: [
    '<circle cx="11" cy="11" r="4" />',
    '<circle cx="21" cy="11" r="4" />',
    '<path d="M8 16c0-5 4-9 8-9s8 4 8 9-4 9-8 9-8-4-8-9Z" />',
    '<path d="M13 17h.1M19 17h.1M14 21c1.2 1 2.8 1 4 0" />',
  ],
};

const officialIcons = {
  hn: {
    src: "https://news.ycombinator.com/y18.svg",
    label: "Y",
  },
  "google-news": {
    src: "https://www.gstatic.com/images/branding/product/2x/news_48dp.png",
    label: "G",
  },
  reddit: {
    src: "https://www.redditstatic.com/desktop2x/img/favicon/favicon-32x32.png",
    label: "R",
  },
  github: {
    src: "https://github.githubassets.com/favicons/favicon.svg",
    label: "GH",
  },
  fark: {
    src: "https://www.fark.com/favicon.ico",
    label: "F",
  },
  variety: {
    src: "https://variety.com/wp-content/uploads/2018/06/variety-favicon.png?w=32",
    label: "V",
  },
  tmz: {
    src: "https://static.tmz.com/tmz-web/icons/favicon-32x32-v1.png",
    label: "TMZ",
  },
  zhihu: {
    src: "https://static.zhihu.com/heifetz/favicon.ico",
    label: "知",
  },
  huxiu: {
    src: "https://www.huxiu.com/favicon.ico",
    label: "虎",
  },
  toutiao: {
    src: "https://www.toutiao.com/favicon.ico",
    label: "头",
  },
  hupu: {
    src: "https://w1.hoopchina.com.cn/images/pc/old/favicon.ico",
    label: "虎",
  },
};

function iconSvg(name) {
  const officialIcon = officialIcons[name];
  if (officialIcon) {
    return `<span class="site-logo-badge site-logo-badge--${name}" aria-hidden="true">
      <img src="${officialIcon.src}" alt="" loading="lazy" referrerpolicy="no-referrer" onerror="this.hidden=true;this.nextElementSibling.hidden=false" />
      <span class="site-logo-fallback" hidden>${officialIcon.label}</span>
    </span>`;
  }

  const paths = iconPaths[name] ?? iconPaths.doc;
  return `<svg viewBox="0 0 32 32" aria-hidden="true">${paths.join("")}</svg>`;
}

function escapeAttribute(value = "") {
  return String(value)
    .replace(/&/g, "&amp;")
    .replace(/"/g, "&quot;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

function itemTemplate(item, index) {
  const [title, count, url] = item;
  const href = url ?? `https://example.com/${encodeURIComponent(title.toLowerCase().replaceAll(" ", "-"))}`;
  return `
    <li>
      <a href="${href}" target="_blank" rel="noreferrer" data-track-click="true" data-click-title="${escapeAttribute(title)}" data-click-url="${escapeAttribute(href)}">
        <span class="rank">${index + 1}</span>
        <span class="link-title"><span>${title}</span></span>
        <span class="count">${count}</span>
      </a>
    </li>
  `;
}

function compactPairTemplate(source, index) {
  return `
    <article class="hot-card compact-pair-card" data-source-index="${index}" style="--source: ${source.color}">
      ${source.items.map((item) => {
        const [title, count, url] = item.link;
        return `
          <a class="compact-source" href="${url}" target="_blank" rel="noreferrer" data-track-click="true" data-click-title="${escapeAttribute(title)}" data-click-url="${escapeAttribute(url)}" style="--source: ${item.color}">
            <div class="compact-source-head">
              <span class="source-icon">${iconSvg(item.icon)}</span>
              <div class="source-title">
                <h2>${item.name}</h2>
                <span>${item.label}</span>
              </div>
            </div>
            <div class="compact-link">
              <span>${title}</span>
              <small>${count}</small>
            </div>
          </a>
        `;
      }).join("")}
    </article>
  `;
}

function cardTemplate(source, index) {
  if (source.type === "compactPair") {
    return compactPairTemplate(source, index);
  }

  return `
    <article class="hot-card" data-source-index="${index}" style="--source: ${source.color}">
      <div class="card-head">
        <span class="source-icon">${iconSvg(source.icon)}</span>
        <div class="source-title">
          <h2>${source.name}</h2>
          <span>${source.time}</span>
        </div>
        <button class="card-refresh" type="button" data-refresh-source="${index}" aria-label="Refresh ${source.name}">
          <svg viewBox="0 0 24 24" aria-hidden="true">
            <path d="M20 12a8 8 0 1 1-2.35-5.65" />
            <path d="M20 4v5h-5" />
          </svg>
        </button>
      </div>
      <ol class="links">
        ${source.links.map(itemTemplate).join("")}
      </ol>
    </article>
  `;
}

function renderSources() {
  document.querySelector("#hot-grid").innerHTML = sources.map(cardTemplate).join("");
}

function renderSource(index) {
  const grid = document.querySelector("#hot-grid");
  const current = grid.querySelector(`[data-source-index="${index}"]`);
  if (!current) {
    renderSources();
    return;
  }

  current.outerHTML = cardTemplate(sources[index], index);
  const updated = grid.querySelector(`[data-source-index="${index}"]`);
  updated?.classList.add("is-updating");
}

function renderMostClicked() {
  const list = window.mostClickedToday || [];
  const target = document.querySelector("#most-clicked");

  if (!list.length) {
    target.innerHTML = `
      <li class="empty-clicks">
        <span>Click any link to start today's list.</span>
      </li>
    `;
    return;
  }

  target.innerHTML = list
  .map(({ title, count, url }, index) => {
    return `
      <li>
        <a href="${url}" target="_blank" rel="noreferrer" data-track-click="true" data-click-title="${escapeAttribute(title)}" data-click-url="${escapeAttribute(url)}">
          <span class="rank">${index + 1}</span>
          <span class="click-title">${title}</span>
          <span class="count">${count}</span>
        </a>
      </li>
    `;
  })
  .join("");
}

function cacheKey(index) {
  return `${CACHE_PREFIX}${CACHE_VERSION}:${index}`;
}

function readCachedSource(index) {
  try {
    const cached = JSON.parse(localStorage.getItem(cacheKey(index)));
    if (!cached?.source?.links?.length) return null;
    return cached.source;
  } catch (error) {
    return null;
  }
}

function writeCachedSource(index) {
  try {
    localStorage.setItem(
      cacheKey(index),
      JSON.stringify({
        savedAt: Date.now(),
        source: sources[index],
      }),
    );
  } catch (error) {
    console.warn("Could not cache source", index, error);
  }
}

function hydrateCachedSources() {
  sources.forEach((source, index) => {
    const cached = readCachedSource(index);
    if (cached) {
      sources[index] = {
        ...source,
        ...cached,
        color: cached.color || source.color,
        icon: cached.icon || source.icon,
        links: cached.links?.length ? cached.links : source.links,
        time: "cached",
      };
    }
  });
}

function setSourceLoading(index, name) {
  const hasCachedData = sources[index]?.time === "cached" || sources[index]?.links?.length > 7;
  sources[index] = {
    ...sources[index],
    name,
    time: hasCachedData ? "updating" : "loading",
  };
  renderSource(index);
}

function setSourceOffline(index, name) {
  const cached = readCachedSource(index);
  sources[index] = cached
    ? {
        ...sources[index],
        ...cached,
        color: cached.color || sources[index].color,
        icon: cached.icon || sources[index].icon,
        links: cached.links?.length ? cached.links : sources[index].links,
        time: "cached",
      }
    : {
        ...sources[index],
        name,
        time: "offline",
      };
  renderSource(index);
}

async function fetchWithTimeout(url, options = {}) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);

  try {
    return await fetch(url, {
      ...options,
      signal: controller.signal,
    });
  } finally {
    clearTimeout(timeout);
  }
}

async function fetchJson(url) {
  const response = await fetchWithTimeout(url);
  if (!response.ok) {
    throw new Error(`Request failed: ${response.status}`);
  }

  return response.json();
}

async function fetchLocalLinks(path) {
  const url = location.protocol === "file:" ? `${LOCAL_API_ORIGIN}${path}` : path;
  const data = await fetchJson(url);
  if (!Array.isArray(data.links) || !data.links.length) {
    throw new Error(`No links returned from ${path}`);
  }

  return data.links;
}

async function loadMostClickedToday() {
  try {
    const url = location.protocol === "file:" ? `${LOCAL_API_ORIGIN}/api/most-clicked-today` : "/api/most-clicked-today";
    const data = await fetchJson(url);
    window.mostClickedToday = Array.isArray(data.links) ? data.links : [];
    renderMostClicked();
  } catch (error) {
    console.warn("Could not load most clicked today", error);
  }
}

function reportLinkClick(anchor) {
  const title = anchor.dataset.clickTitle || anchor.textContent.trim();
  const url = anchor.dataset.clickUrl || anchor.href;
  if (!title || !url) return;

  const endpoint = location.protocol === "file:" ? `${LOCAL_API_ORIGIN}/api/clicks` : "/api/clicks";
  fetch(endpoint, {
    method: "POST",
    headers: {
      "content-type": "application/json",
    },
    body: JSON.stringify({ title, url }),
    keepalive: true,
  })
    .then(() => loadMostClickedToday())
    .catch((error) => console.warn("Could not report link click", error));
}

function proxiedUrl(url) {
  return `${CORS_PROXY_URL}${encodeURIComponent(url)}`;
}

async function firstSuccessful(requests) {
  const errors = [];

  return new Promise((resolve, reject) => {
    let pending = requests.length;

    requests.forEach((request) => {
      request()
        .then(resolve)
        .catch((error) => {
          errors.push(error);
          pending -= 1;

          if (pending === 0) {
            reject(errors[0]);
          }
        });
    });
  });
}

async function fetchText(url) {
  const response = await fetchWithTimeout(url);
  if (!response.ok) {
    throw new Error(`Request failed: ${response.status}`);
  }

  return response.text();
}

async function fetchTextFast(url) {
  return firstSuccessful([
    () => fetchText(url),
    () => fetchText(proxiedUrl(url)),
  ]);
}

async function fetchJsonFast(url) {
  const text = await fetchTextFast(url);

  try {
    return JSON.parse(text);
  } catch (error) {
    const data = await fetchJson(url);
    return data;
  }
}

async function fetchTextWithProxyFallback(url) {
  try {
    return await fetchTextFast(url);
  } catch (error) {
    const proxyResponse = await fetchWithTimeout(proxiedUrl(url));
    if (!proxyResponse.ok) {
      throw error;
    }

    return proxyResponse.text();
  }
}

function cleanGoogleNewsTitle(title, source) {
  if (!source) return title;

  const suffix = ` - ${source}`;
  return title.endsWith(suffix) ? title.slice(0, -suffix.length) : title;
}

function formatCompactNumber(value) {
  if (!Number.isFinite(value)) return "";
  if (value >= 1000) return `${(value / 1000).toFixed(value >= 10000 ? 0 : 1)}k`;
  return `${value}`;
}

async function loadReddit() {
  try {
    setSourceLoading(1, "Reddit");

    let links;

    try {
      links = await fetchLocalLinks("/api/reddit");
    } catch (error) {
      const data = await fetchJsonFast(REDDIT_POPULAR_URL);
      const posts = data?.data?.children ?? [];
      links = posts
        .map(({ data: post }) => {
          if (!post?.title || !post?.permalink) return null;
          return [
            post.title,
            formatCompactNumber(post.ups),
            `https://www.reddit.com${post.permalink}`,
          ];
        })
        .filter(Boolean);
    }

    if (links.length) {
      sources[1] = {
        name: "Reddit",
        time: "live",
        color: "#ff5a1f",
        icon: "reddit",
        links,
      };
      writeCachedSource(1);
      renderSource(1);
    }
  } catch (error) {
    console.warn("Could not load Reddit ranking", error);
    setSourceOffline(1, "Reddit");
  }
}

async function loadGitHubTrending() {
  try {
    setSourceLoading(3, "GitHub Trending");

    let links;

    try {
      links = await fetchLocalLinks("/api/github-trending");
    } catch (error) {
      const htmlText = await fetchTextWithProxyFallback(GITHUB_TRENDING_URL);
      const doc = new DOMParser().parseFromString(htmlText, "text/html");
      const repos = [...doc.querySelectorAll("article.Box-row")];
      links = repos
        .map((repo) => {
          const anchor = repo.querySelector("h2 a");
          const title = anchor?.textContent?.replace(/\s+/g, " ").trim();
          const href = anchor?.getAttribute("href");
          const starsToday = repo.querySelector("span.d-inline-block.float-sm-right")?.textContent?.trim();

          if (!title || !href) return null;

          return [
            title.replace(" / ", "/"),
            starsToday?.replace(" stars today", "") ?? "",
            `https://github.com${href}`,
          ];
        })
        .filter(Boolean);
    }

    if (links.length) {
      sources[3] = {
        name: "GitHub Trending",
        time: "live",
        color: "#f0f6fc",
        icon: "github",
        links,
      };
      writeCachedSource(3);
      renderSource(3);
    }
  } catch (error) {
    console.warn("Could not load GitHub Trending", error);
    setSourceOffline(3, "GitHub Trending");
  }
}

async function loadGoogleNews() {
  try {
    setSourceLoading(0, "Google News");

    let links;

    try {
      links = await fetchLocalLinks("/api/google-news");
    } catch (error) {
      const xmlText = await fetchTextWithProxyFallback(GOOGLE_NEWS_TOP_URL);
      const doc = new DOMParser().parseFromString(xmlText, "application/xml");
      const items = [...doc.querySelectorAll("item")];
      links = items
        .map((item) => {
          const source = item.querySelector("source")?.textContent?.trim() ?? "news";
          const title = item.querySelector("title")?.textContent?.trim();
          const url = item.querySelector("link")?.textContent?.trim();

          if (!title || !url) return null;

          return [cleanGoogleNewsTitle(title, source), source, url];
        })
        .filter(Boolean);
    }

    if (links.length) {
      sources[0] = {
        name: "Google News",
        time: "live",
        color: "#5f9cff",
        icon: "google-news",
        links,
      };
      writeCachedSource(0);
      renderSource(0);
    }
  } catch (error) {
    console.warn("Could not load Google News ranking", error);
    setSourceOffline(0, "Google News");
  }
}

async function loadHackerNews() {
  try {
    setSourceLoading(2, "Hacker News");

    let links;

    try {
      links = await fetchLocalLinks("/api/hacker-news");
    } catch (error) {
      const storyIds = await fetchJson(HN_TOP_STORIES_URL);
      const items = await Promise.all(
        storyIds.slice(0, HN_STORY_LIMIT).map((id) => fetchJson(`${HN_ITEM_URL}/${id}.json`)),
      );
      links = items
        .filter((item) => item?.title)
        .map((item) => [
          item.title,
          item.score ? `${item.score}` : "",
          item.url ?? `https://news.ycombinator.com/item?id=${item.id}`,
        ]);
    }

    if (links.length) {
      sources[2] = {
        name: "Hacker News",
        time: "live",
        color: "#ff6600",
        icon: "hn",
        links,
      };
      writeCachedSource(2);
      renderSource(2);
    }
  } catch (error) {
    console.warn("Could not load Hacker News ranking", error);
    setSourceOffline(2, "Hacker News");
  }
}

async function loadFarkMain() {
  try {
    setSourceLoading(4, "Fark Main");
    const links = await fetchLocalLinks("/api/fark-main");

    sources[4] = {
      name: "Fark Main",
      time: links.length > 3 ? "live" : "fallback",
      color: "#8a86c8",
      icon: "fark",
      links,
    };
    writeCachedSource(4);
    renderSource(4);
  } catch (error) {
    console.warn("Could not load Fark Main", error);
    setSourceOffline(4, "Fark Main");
  }
}

async function loadVarietyMostPopular() {
  try {
    setSourceLoading(5, "Variety Most Popular");
    const links = await fetchLocalLinks("/api/variety-most-popular");

    sources[5] = {
      name: "Variety Most Popular",
      time: "live",
      color: "#f5e94f",
      icon: "variety",
      links,
    };
    writeCachedSource(5);
    renderSource(5);
  } catch (error) {
    console.warn("Could not load Variety Most Popular", error);
    setSourceOffline(5, "Variety Most Popular");
  }
}

async function loadTmzLatest() {
  try {
    setSourceLoading(6, "TMZ");
    const links = await fetchLocalLinks("/api/tmz-latest");

    sources[6] = {
      name: "TMZ",
      time: "live",
      color: "#ef3f35",
      icon: "tmz",
      links,
    };
    writeCachedSource(6);
    renderSource(6);
  } catch (error) {
    console.warn("Could not load TMZ", error);
    setSourceOffline(6, "TMZ");
  }
}

async function loadChineseSource(index, name, path, displayTime = "live") {
  try {
    setSourceLoading(index, name);
    const links = await fetchLocalLinks(path);

    sources[index] = {
      ...sources[index],
      name,
      time: displayTime,
      links,
    };
    writeCachedSource(index);
    renderSource(index);
  } catch (error) {
    console.warn(`Could not load ${name}`, error);
    setSourceOffline(index, name);
  }
}

function loadToutiaoHot() {
  return loadChineseSource(8, "今日头条热榜", "/api/toutiao-hot");
}

function loadHupuBxj() {
  return loadChineseSource(9, "虎扑步行街", "/api/hupu-bxj");
}

hydrateCachedSources();
renderSources();
renderMostClicked();
loadMostClickedToday();

const sourceLoaders = [
  loadGoogleNews,
  loadReddit,
  loadHackerNews,
  loadGitHubTrending,
  loadFarkMain,
  loadVarietyMostPopular,
  loadTmzLatest,
  null,
  loadToutiaoHot,
  loadHupuBxj,
];

function loadAllSources() {
  sourceLoaders.forEach((loader) => loader?.());
}

loadAllSources();

const hotGrid = document.querySelector("#hot-grid");
const browsingCount = document.querySelector("#live-browsing-count");
const browsingMeter = document.querySelector(".meter-progress");
const BROWSING_CAPACITY = 1500;
const PRESENCE_HEARTBEAT_MS = 30 * 1000;

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

function formatBrowsingCount(value) {
  return `${value.toLocaleString("en-US")} people browsing`;
}

function updateBrowsingMeter(value) {
  if (!browsingMeter) return;

  const progress = clamp(value, 0, BROWSING_CAPACITY) / BROWSING_CAPACITY;
  const filled = Math.round(progress * 1000) / 10;
  const empty = Math.max(0, Math.round((100 - filled) * 10) / 10);
  browsingMeter.style.strokeDasharray = `${filled} ${empty}`;
}

function updateBrowsingDisplay(value) {
  browsingCount.textContent = formatBrowsingCount(value);
  updateBrowsingMeter(value);
}

function getVisitorId() {
  const storageKey = "takeabreak:visitor-id";
  try {
    const existing = localStorage.getItem(storageKey);
    if (existing) return existing;

    const id = globalThis.crypto?.randomUUID
      ? globalThis.crypto.randomUUID()
      : `${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}`;
    localStorage.setItem(storageKey, id);
    return id;
  } catch (error) {
    return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}`;
  }
}

async function syncPresence(visitorId) {
  const endpoint = location.protocol === "file:" ? `${LOCAL_API_ORIGIN}/api/presence` : "/api/presence";
  const response = await fetchWithTimeout(endpoint, {
    method: "POST",
    headers: {
      "content-type": "application/json",
    },
    body: JSON.stringify({ visitorId }),
    keepalive: true,
  });

  if (!response.ok) {
    throw new Error(`Presence request failed: ${response.status}`);
  }

  return response.json();
}

function reportPresenceOffline(visitorId) {
  const endpoint = location.protocol === "file:" ? `${LOCAL_API_ORIGIN}/api/presence` : "/api/presence";
  const payload = JSON.stringify({ visitorId, offline: true });

  if (navigator.sendBeacon) {
    navigator.sendBeacon(endpoint, new Blob([payload], { type: "application/json" }));
    return;
  }

  fetch(endpoint, {
    method: "POST",
    headers: {
      "content-type": "application/json",
    },
    body: payload,
    keepalive: true,
  }).catch(() => {});
}

function startBrowsingCounter() {
  if (!browsingCount) return;

  const visitorId = getVisitorId();
  let lastKnownCount = null;

  const heartbeat = async () => {
    try {
      const data = await syncPresence(visitorId);
      const count = Math.max(0, Number(data.count || 0));
      lastKnownCount = count;
      updateBrowsingDisplay(count);
    } catch (error) {
      console.warn("Could not update live browsing count", error);
      if (lastKnownCount !== null) {
        updateBrowsingDisplay(lastKnownCount);
      }
    }
  };

  heartbeat();
  setInterval(heartbeat, PRESENCE_HEARTBEAT_MS);

  document.addEventListener("visibilitychange", () => {
    if (!document.hidden) {
      heartbeat();
    }
  });

  window.addEventListener("pagehide", () => {
    reportPresenceOffline(visitorId);
  });
}

startBrowsingCounter();

document.addEventListener("click", (event) => {
  const anchor = event.target.closest('a[data-track-click="true"]');
  if (!anchor) return;
  reportLinkClick(anchor);
});

hotGrid.addEventListener("click", (event) => {
  const button = event.target.closest("[data-refresh-source]");
  if (!button) return;

  const index = Number(button.dataset.refreshSource);
  const loader = sourceLoaders[index];
  if (!loader) return;

  button.animate(
    [
      { transform: "rotate(0deg)" },
      { transform: "rotate(180deg)" },
      { transform: "rotate(360deg)" },
    ],
    { duration: 420, easing: "ease-out" },
  );

  loader();
});
