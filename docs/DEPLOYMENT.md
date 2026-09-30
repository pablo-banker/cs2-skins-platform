# Deployment

How to run this in production, and why it is shaped the way it is.

## The runtime

**A long-lived Node process**, through `@sveltejs/adapter-node`. Not a
serverless function, and that is a design decision rather than a default.

The architecture keeps three things in process memory:

- the **grouped catalog index** — 21k upstream weapon rows collapsed into 1,974
  products, built from one ~20MB request;
- **bounded TTL caches** for prices, providers, history and search;
- **in-flight deduplication**, so ten simultaneous requests for one skin make
  one upstream call.

Measured here: building that index takes **~3.9 seconds** and **~120MB**. On
ephemeral functions it would be rebuilt per cold instance — slow for visitors
and expensive against a metered quota. One container amortises it across every
request it ever serves.

Distributed caching (Redis, KV) is deliberately absent. It would only be worth
its operational cost once there is real traffic to measure.

|          |                                                                      |
| -------- | -------------------------------------------------------------------- |
| Node     | **24 LTS** (`.nvmrc`; `engines` allows 22.12+ for local development) |
| Build    | `pnpm install --frozen-lockfile && pnpm build`                       |
| Start    | `pnpm start` → `node build`                                          |
| Listens  | `HOST` (`0.0.0.0` in the image), `PORT` (host-supplied)              |
| Shutdown | adapter-node handles `SIGTERM`; no custom signal handling            |

TLS terminates at the hosting proxy. Nothing in the application implements
HTTPS, and it should not.

## Environment

Everything is in [`.env.example`](../.env.example). The short version:

| Variable                      | Required              | What it is                                                                  |
| ----------------------------- | --------------------- | --------------------------------------------------------------------------- |
| `CS2CAP_API_KEY`              | **yes**               | Server-only secret. Authenticates every catalog, price and history request. |
| `ORIGIN`                      | **yes** in production | The public URL, scheme included, no trailing slash.                         |
| `CS2CAP_BATCH_PRICES_ENABLED` | no (`false`)          | Whether this deployment may use `POST /prices/batch`.                       |
| `CS2CAP_BASE_URL`             | no                    | Overrides the upstream. Only the e2e stub uses it.                          |
| `PORT` / `HOST`               | no                    | Where to listen. Most hosts inject `PORT`.                                  |

### `ORIGIN` matters more than it looks

adapter-node sits behind a proxy and cannot infer the public URL. `ORIGIN` is
what canonical tags and **copied share links** are built from — set it wrong and
every shared loadout links to the wrong host.

```bash
ORIGIN=https://<production-domain>
```

No domain is baked into source anywhere.

### Trusted proxy

The application does **not** read `X-Forwarded-For`, `X-Forwarded-Host` or
`X-Forwarded-Proto`, and adapter-node ignores them unless told otherwise. That
is deliberate: a forwarded header is a header, and trusting one without knowing
which proxy sets it is how spoofable client IPs happen.

If a future feature needs the real client address, set adapter-node's
`ADDRESS_HEADER` **and** `XFF_DEPTH` to match the specific proxy in front of
it — never generically.

### The batch flag

```text
CS2CAP_BATCH_PRICES_ENABLED=false   one request per item, bounded concurrency 4
CS2CAP_BATCH_PRICES_ENABLED=true    one request per set of items
```

There is no probing: the mode is what the variable says. Choose it from the
actual CS2Cap plan — on a plan without batch, `true` produces a 403 and market
sections degrade.

**This is the single most consequential setting for Smart Loadout.** Generation
prices up to 48 candidates. As one batch request that is trivial; as 48
individual requests it can exhaust a free plan's per-minute quota, and
generation then reports prices as unavailable. See _Known limitations_.

## Running it

```bash
pnpm install --frozen-lockfile
pnpm build
CS2CAP_API_KEY=… ORIGIN=https://<production-domain> pnpm start
```

### Docker

```bash
docker build -t cs2-skins:latest .
docker run --rm -p 3000:3000 \
  -e CS2CAP_API_KEY="$CS2CAP_API_KEY" \
  -e ORIGIN="https://<production-domain>" \
  cs2-skins:latest
```

The image is **secret-independent**: no build arg carries a key, no `ENV` holds
one, `.env` is in `.dockerignore`, and nothing reads a file for it. Secrets
arrive at runtime or not at all.

Multi-stage, running as the image's own non-root `node` user, with only
production dependencies and the built server in the final layer. `node build`
runs as PID 1 so `SIGTERM` reaches it directly.

Verified against the built image: **378 MB** (396 MB on disk) on Node v24.21.0,
`uid=1000(node)`, `/proc/1/cmdline` is `node build`, `docker stop` exits 0
immediately rather than waiting out the kill timeout, every route answers 200,
every `/dev/*` and `/api/dev/*` answers 404, and nothing in the build history,
the image config or `/app` carries a key. In a 256 MB container with a 192 MB
heap cap it held flat at ~85 MB across 7,200 requests.

Portable to anything that runs a container — Railway, Render, Fly.io, a VPS.
No provider SDK is in the code.

## Health

```text
GET /api/health  →  200 {"status":"ok"}   Cache-Control: no-store
```

**Liveness only, and it touches nothing.** No catalog, no prices, no providers,
no key check — a test enforces that the file imports none of them.

That is the whole point. A health check that reaches upstream turns a CS2Cap
outage into a restart loop, killing a process that could still serve the
homepage, the kits, the builder and every cached page. The application degrades
honestly on its own; this endpoint's job is to stay alive while it does.

There is no readiness endpoint. The catalog warms in the background and loads
lazily regardless, so "not warm yet" is a slower first response, not an
unhealthy process.

## Catalog warmup

`src/hooks.server.ts` builds the index once at startup, **not awaited**. The
process listens immediately and health answers immediately; a request arriving
mid-warm joins the in-flight request the cache already deduplicates.

Measured, production build, real API:

|             | Before warmup | After warmup           |
| ----------- | ------------- | ---------------------- |
| First `/`   | 3.2 s         | **0.03 s**             |
| Warm `/`    | 0.004 s       | 0.004 s                |
| Index build | —             | 3.96 s, 1,974 products |

A failure logs one line and changes nothing — the next request loads the
catalog lazily. Skipped during build, prerender and development.

## Memory

Measured against a production build and the real catalog of 1,974 products:

| Point                        | RSS         |
| ---------------------------- | ----------- |
| Boot                         | ~97 MB      |
| After catalog warm           | ~251 MB     |
| Transient peak under load    | ~281 MB     |
| Steady state, 1,800 requests | ~211–218 MB |

It settles rather than climbing: the peak is heap slack, and once the collector
runs the process holds flat. The TTL cache is capped at 500 entries with LRU
eviction, so repeated price, history and search traffic replaces entries rather
than accumulating them.

**Provision at least 512 MB**; 1 GB is comfortable.

### The leak that was here

Worth recording, because the shape of it is easy to reintroduce.

Every SSR render creates its own `QueryClient` — correct, since a shared one
would leak one visitor's cache into another's render. But the header mounts
global search on every page, so every render also created a `Query`, and a
`Query` schedules a `gcTime` timer. **A live timer is a GC root**: it held the
Query, which held the QueryCache, the QueryClient, the observer and the request
that produced them. Nothing unmounts a client on the server, so each render
stayed reachable for the full five minutes.

A heap snapshot after 1,500 requests was unambiguous — 1,503 live
`QueryClient`s, 1,503 `QueryCache`s, 1,503 `QueryObserver`s and 1,503 sockets,
against 4 `TtlCache`s. The application's own caches were never the problem.

A 256 MB container died of `Ineffective mark-compacts near heap limit` at
roughly 7,200 requests. The root layout now clears the client on destroy, on
the server only; the same container then held flat at 50–55 MB across 9,000.
`src/routes/layout.server-lifecycle.spec.ts` pins it.

The general rule: **anything on the server holding a timer, a listener or an
abort signal past the end of a render is a leak**, however small it looks per
request.

## Security

- **Secrets stay server-side.** `CS2CAP_API_KEY` is read only under
  `$lib/server/**`, which SvelteKit refuses to bundle for the browser. The
  client bundle was searched for the real key, `CS2CAP_API_KEY`,
  `api.cs2c.app`, `market_hash_name`, `lowest_ask` and `Bearer` — zero matches,
  and an e2e test keeps it that way with a sentinel.
- **Development surfaces 404 in production.** `/dev/*` and `/api/dev/*`,
  including the one endpoint that can write to the repository, are tested
  against the real production build rather than trusted from a `dev` check.
- **CSP** is configured in `vite.config.ts` with SvelteKit's `auto` mode.
  `script-src 'self'` with no inline escape; `img-src` allows only this origin,
  `data:` and `cdn.cs2c.app`; `connect-src 'self'`, because the browser talks to
  this application and the server talks to CS2Cap. `frame-ancestors 'none'`.
  `style-src` allows inline for one reason: SvelteKit's own screen-reader
  announcer uses a `style` attribute, which cannot be hashed.
- **Same-origin APIs.** No CORS headers are set on anything under `/api`.
  Nothing here is a public API.
- **Headers**: `X-Content-Type-Options: nosniff`,
  `Referrer-Policy: strict-origin-when-cross-origin`, and a `Permissions-Policy`
  that turns off camera, microphone and geolocation.
- **No HSTS from the application.** It belongs at the proxy, once the
  production domain and certificate behaviour are confirmed.
- **Quota is the exposed resource.** Every market-touching endpoint is bounded
  (see below), but bounds are not rate limiting.

### Rate limiting: a deployment requirement

There is **no in-process rate limiter**, deliberately. Behind a proxy,
`getClientAddress()` returns the proxy's address, and configuring
`ADDRESS_HEADER` without knowing which proxy sets it produces a spoofable
limiter — worse than none, because it looks like protection.

What protects the quota today:

| Endpoint                                                          | Max upstream cost per request    |
| ----------------------------------------------------------------- | -------------------------------- |
| `POST /api/smart-loadout/generate`                                | 48 item prices + 1 provider list |
| `POST /api/wishlist/resolve`                                      | 50 item prices + 1 provider list |
| `POST /api/build/prices`                                          | 37 item prices (one per slot)    |
| `GET /knife-gloves`                                               | 7 item prices                    |
| `GET /api/search/skins`, `/api/build/skins`, `/api/build/resolve` | **0** — cached catalog only      |

Every one is schema-bounded, rejects unknown fields, rejects duplicates, and
takes application identity only — a client cannot name an upstream item id. The
5-minute price cache and in-flight deduplication absorb repeats.

**Configure rate limiting at the edge** (the host's proxy, or a CDN) before
exposing this publicly.

## SEO

- `/robots.txt` — crawlable, `Disallow: /api/` and `/dev/`, points at the
  sitemap.
- `/sitemap.xml` — canonical product URLs only. **1,984 entries** against the
  live catalog: 1,974 skins, 4 kits, 6 static routes. No query state, no
  `/wishlist`, no `/api`. Costs zero market requests. If the catalog is
  unavailable it serves the stable routes rather than malformed XML.
- **Canonical everywhere.** A filtered `/explore`, a skin variant, a shared
  `/build?loadout=` and a chosen `/knife-gloves?skin=` all canonicalise to their
  bare route — otherwise faceted queries would multiply 2,000 real pages into
  tens of thousands.
- `/wishlist` is `noindex`: its server-rendered content is the same empty frame
  for everybody.

## Smoke test

After deploying, against the real host:

```bash
BASE=https://<production-domain>

for path in / /explore /kits /build /smart-loadout /knife-gloves /wishlist \
            /robots.txt /sitemap.xml /api/health; do
  printf '%-18s %s\n' "$path" "$(curl -s -o /dev/null -w '%{http_code}' "$BASE$path")"
done

# Development surfaces must be gone.
for path in /dev/components /api/dev/cs2cap /api/dev/visual-metadata; do
  printf '%-28s %s (expect 404)\n' "$path" "$(curl -s -o /dev/null -w '%{http_code}' "$BASE$path")"
done

# One real market journey.
curl -s "$BASE/skins/ak-47-redline" | grep -c 'Best price'
```

## Rollback

The image is stateless — no database, no migrations, no persisted server state.
Redeploy the previous tag and it is done; the catalog rebuilds itself within
four seconds of startup. Nothing a visitor saved is on the server, so nothing
is lost: builder loadouts and wishlists live in their own browser.

## Known limitations

- **Smart Loadout on a free plan.** With batch disabled, generation issues up to
  48 individual price requests and can exhaust a per-minute quota; it then
  reports prices unavailable, honestly, rather than showing wrong numbers. This
  was observed against the live API. Enable batch on a plan that supports it.
- **No rate limiting in the application.** See above — it belongs at the edge.
- **Source maps ship for the server bundle only.** 164 maps, 5.5 MB, under
  `build/server` — they make a production stack trace readable and are not
  served over HTTP (verified: 404). The client bundle has none, so nothing
  discloses source to a visitor.
- **No favicon and no brand mark.** The framework's default Svelte logo was
  removed rather than left to brand the product as something it is not. A real
  mark is a branding decision, not an engineering one.
- **The product name `CS2 Skins` is a working label**, and the production domain
  is undecided. Both are business decisions still outstanding.

## Launch checklist

```text
[ ] CS2CAP_API_KEY set in the host's secret store, never in a file or an image
[ ] ORIGIN set to the real production URL, scheme included, no trailing slash
[ ] CS2CAP_BATCH_PRICES_ENABLED matches the actual CS2Cap plan
[ ] pnpm install --frozen-lockfile && pnpm build green on a clean checkout
[ ] docker build && docker run green, container answers on the host's PORT
[ ] GET /api/health returns 200 {"status":"ok"}
[ ] HTTPS terminated at the proxy; HSTS configured there, not here
[ ] Rate limiting configured at the edge for /api/*
[ ] /robots.txt and /sitemap.xml reachable and correct for the real domain
[ ] /dev/* and /api/dev/* return 404
[ ] One real market journey checked end to end on the deployed host
[ ] Share link copied from /build opens on the production host
```
