# SAM.gov Relay (Cloudflare Worker)

## Why this exists

Hostinger's outbound connections to `api.sam.gov` time out completely (confirmed
via `/diagnostics/network-check` — Google, Grants.gov, and USASpending all
connect fine from the same server; only SAM.gov doesn't). This is very likely
SAM.gov's API gateway blocking/throttling Hostinger's shared IP range, not
anything wrong with the app, your API key, or your account.

Confirmed via a live test: a Cloudflare Worker reached `api.sam.gov`
successfully in under 500ms, while Hostinger times out at the full 10 seconds
every time. So the fix is to route SAM.gov Search through a small relay
running on Cloudflare's network instead of calling SAM.gov directly from
Hostinger.

## How it works

`routes/sam_search.js` calls `SAM_RELAY_URL` (if set) instead of
`api.sam.gov` directly. The relay is a small Cloudflare Worker that:
1. Receives the search request from your app
2. Injects your real SAM.gov API key (stored as a Cloudflare secret, never
   sent from Hostinger)
3. Calls `api.sam.gov` from Cloudflare's network
4. Returns SAM.gov's response back to your app unchanged

A shared secret header (`x-relay-secret`) stops random internet traffic from
using your relay (and burning your SAM.gov rate limit) — only requests
carrying the secret your app also knows are forwarded.

## Worker code

Deploy this as a Cloudflare Worker (Workers & Pages → Create → "Start with
Hello World!" → Edit code → paste this in, replacing the default code →
Save and Deploy):

```js
export default {
  async fetch(request, env) {
    const url = new URL(request.url);

    if (env.RELAY_SECRET && request.headers.get('x-relay-secret') !== env.RELAY_SECRET) {
      return new Response('Forbidden', { status: 403 });
    }

    const upstream = new URL('https://api.sam.gov/opportunities/v2/search');
    for (const [key, value] of url.searchParams) {
      upstream.searchParams.set(key, value);
    }
    upstream.searchParams.set('api_key', env.SAM_API_KEY);

    try {
      const resp = await fetch(upstream.toString(), {
        headers: { Accept: 'application/json' },
        signal: AbortSignal.timeout(15000)
      });
      const body = await resp.text();
      return new Response(body, {
        status: resp.status,
        headers: { 'content-type': 'application/json' }
      });
    } catch (err) {
      return new Response(JSON.stringify({ error: err.message }), {
        status: 502,
        headers: { 'content-type': 'application/json' }
      });
    }
  }
};
```

## Cloudflare setup

In the Worker's **Settings → Variables and Secrets** (names must match
exactly, add both as **Secret** type, not plain text):
- `SAM_API_KEY` — your real SAM.gov API key
- `RELAY_SECRET` — any random string you make up (e.g. generate one with
  `node -e "console.log(require('crypto').randomBytes(24).toString('hex'))"`)

Save/deploy after adding these — the Worker's code reads them via
`env.SAM_API_KEY` and `env.RELAY_SECRET`.

## Hostinger setup

In your Node.js app's environment variables panel, add:
- `SAM_RELAY_URL` — your Worker's URL, e.g.
  `https://sam-relay.your-subdomain.workers.dev`
- `SAM_RELAY_SECRET` — the **same value** you set as `RELAY_SECRET` in
  Cloudflare above

Restart the app. `SAM_API_KEY` in Hostinger's environment is no longer used
once `SAM_RELAY_URL` is set (the key now lives only in Cloudflare) — safe to
remove it from Hostinger, or leave it, it's just ignored.

## Verifying it worked

Search SAM.gov Search on your site. If it returns results (or a clean "no
results found" for an obscure query) instead of the "fetch failed" error,
it's working.
