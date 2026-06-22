# Takeabreak

A lightweight trend board for quick browsing breaks.

## Local Preview

```bash
npm run dev
```

Open `http://127.0.0.1:4173/`.

## Checks

```bash
npm run check
```

## Deploy To Vercel

1. Push this folder to a GitHub repository.
2. In Vercel, import the GitHub repository.
3. Use the default project settings. There is no build command required.
4. Deploy.

The `api/*.js` files expose the same API routes used locally, while `index.html`, `styles.css`, `script.js`, and `assets/` are served as static files.

## Notes

- Server-side cache uses `.cache/` locally and `/tmp/takeabreak-cache` on Vercel.
- "Most clicked today" uses Upstash Redis when Redis REST environment variables are available. It automatically checks common Vercel names including `UPSTASH_REDIS_REST_URL`, `KV_REST_API_URL`, and `STORAGE_REST_API_URL`.
- Vercel's `/tmp` storage is temporary, so if Redis is not connected the click ranking falls back to a lightweight demo counter that is not durable across serverless instance resets.
- If you want Zhihu's API-based hot list, configure `ZHIHU_COOKIE` in Vercel environment variables. Without it, the app falls back to stable Zhihu links.
