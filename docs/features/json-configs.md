# JSON configs

Serve small JSON payloads by slug (feature flags, remote settings, app config). Admins manage configs via Basic Auth; clients fetch configs via a public endpoint.

## Base URL / mount prefix

If mounted under a prefix (recommended), all routes below are prefixed.

Example: mounted at `/saas` => `GET /saas/api/json-configs/:slug`

## Data model (stored)

- `title` (string)
- `slug` (string, unique, generated from title + random suffix)
- `publicEnabled` (boolean)
- `cacheTtlSeconds` (number; `0` disables in-memory caching)
- `jsonRaw` (string containing JSON)
- `jsonHash` (sha256 of `jsonRaw`)

## Public API (no auth)

### Get config by slug

- `GET /api/json-configs/:slug`

Returns the JSON payload (parsed from `jsonRaw`). If not found or `publicEnabled !== true`, returns `404`.

Optional query:

- `raw=true|1` returns metadata + payload:
  - `{ slug, title, publicEnabled, cacheTtlSeconds, updatedAt, data }`

Examples:

```bash
curl -sS "${BASE_URL}/api/json-configs/app-config-1a2b" | jq
```

```bash
curl -sS "${BASE_URL}/api/json-configs/app-config-1a2b?raw=true" | jq
```

## Admin API (Basic Auth)

All admin endpoints require HTTP Basic Auth.

### List

- `GET /api/admin/json-configs`

### Get by id

- `GET /api/admin/json-configs/:id`

### Create

- `POST /api/admin/json-configs`

Body:

- `title` (required)
- `jsonRaw` (required; must be valid JSON string)
- `publicEnabled` (optional; default `false`)
- `cacheTtlSeconds` (optional; default `0`)

Example:

```bash
curl -sS -u "${ADMIN_USERNAME}:${ADMIN_PASSWORD}" \
  -H 'Content-Type: application/json' \
  -d '{"title":"App config","jsonRaw":"{\"theme\":\"dark\"}","publicEnabled":true,"cacheTtlSeconds":60}' \
  "${BASE_URL}/api/admin/json-configs" | jq
```

### Update

- `PUT /api/admin/json-configs/:id`

Patch body supports any of:

- `title`
- `jsonRaw` (must be valid JSON string)
- `publicEnabled`
- `cacheTtlSeconds`

### Regenerate slug

- `POST /api/admin/json-configs/:id/regenerate-slug`

### Clear in-memory cache for a slug

- `POST /api/admin/json-configs/:id/clear-cache`

### Delete

- `DELETE /api/admin/json-configs/:id`

## Caching semantics

- Public reads use an in-memory cache keyed by `slug`.
- `cacheTtlSeconds` controls TTL:
  - `0` => no caching
  - `> 0` => cache payload for that many seconds
- Admin create/update/regenerate/delete clears cache for the affected slug(s).
- `POST /api/admin/json-configs/:id/clear-cache` clears cache for the config’s current `slug`.

## Typical frontend usage

```js
// Example: fetch JSON config at runtime
export async function getJsonConfig(baseUrl, slug) {
  const res = await fetch(`${baseUrl}/api/json-configs/${encodeURIComponent(slug)}`);
  if (!res.ok) throw new Error(`Failed to load config: ${res.status}`);
  return await res.json();
}
```
