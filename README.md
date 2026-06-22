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
- Vercel's `/tmp` storage is temporary, so "Most clicked today" works as a lightweight demo counter but is not durable across serverless instance resets.
- For production-grade click rankings, connect a persistent store such as Vercel KV, Upstash Redis, Supabase, or Neon.
- If you want Zhihu's API-based hot list, configure `ZHIHU_COOKIE` in Vercel environment variables. Without it, the app falls back to stable Zhihu links.
