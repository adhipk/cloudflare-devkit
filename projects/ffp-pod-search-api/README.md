# FFP Pod Research Search API

Cloudflare Worker that exposes a small JSON search API for the public research index at <https://ffppod.com/research>.

The source page currently lists 67 papers and links each item to a detail page with journal/date metadata, DOI, TL;DR, abstract, key takeaways, tags, and featured episode links when available.

## Endpoints

Base URL after deploy:

```txt
https://api.adhipk.dev/ffp-pod
```

### `GET /ffp-pod/health`

Health check.

### `GET /ffp-pod/research?limit=20&offset=0`

List indexed research papers.

### `GET /ffp-pod/search?q=ketamine&limit=10`

Search over title, journal, summary, and inferred tags.

Supported query params:

- `q`: keyword query
- `tag`: tag substring filter
- `journal`: journal substring filter
- `from`: ISO date lower bound, e.g. `2026-01-01`
- `to`: ISO date upper bound
- `limit`: `1..100`, default `20`
- `offset`: pagination offset
- `include=details`: fetch each matching detail page and include DOI, paper URL, abstract, takeaways, and featured episodes

### `GET /ffp-pod/research/:slug`

Fetch one detail page, e.g.

```txt
https://api.adhipk.dev/ffp-pod/research/bulk-hexagonal-diamond
```

### `GET /ffp-pod/openapi.json`

Minimal OpenAPI description.

## Local development

```bash
cd projects/ffp-pod-search-api
npm install
npm run dev
```

## Deploy

```bash
cd projects/ffp-pod-search-api
npm run deploy
```

The Worker route is configured for:

```txt
api.adhipk.dev/ffp-pod*
```

GitHub Actions deploy requires these repository secrets:

- `CLOUDFLARE_API_TOKEN`
- `CLOUDFLARE_ACCOUNT_ID`
