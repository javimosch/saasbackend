# Auth & JWT

## What it is

SaasBackend provides a simple JWT-based auth system for user-facing APIs.

- Public endpoints issue tokens (`/api/auth/*`).
- Protected endpoints require `Authorization: Bearer <access_token>`.

If you mount SaasBackend under a prefix (example `/saas`), all paths below become:

- `/saas/api/auth/*`

## Tokens

The backend issues:

- `token`: access token (JWT)
- `refreshToken`: refresh token (JWT)

Use the access token for API calls, and refresh when it expires.

Example header:

```bash
-H "Authorization: Bearer $TOKEN"
```

## Endpoints

### Register

```
POST /api/auth/register
```

Body:

```json
{ "email": "user@example.com", "password": "password123" }
```

Response includes `token`, `refreshToken`, and `user`.

Copy/paste:

```bash
curl -X POST http://localhost:3000/api/auth/register \
  -H 'Content-Type: application/json' \
  -d '{"email":"user@example.com","password":"password123"}'
```

### Login

```
POST /api/auth/login
```

Body:

```json
{ "email": "user@example.com", "password": "password123" }
```

Copy/paste:

```bash
curl -X POST http://localhost:3000/api/auth/login \
  -H 'Content-Type: application/json' \
  -d '{"email":"user@example.com","password":"password123"}'
```

### Refresh token

```
POST /api/auth/refresh-token
```

Body:

```json
{ "refreshToken": "..." }
```

Copy/paste:

```bash
curl -X POST http://localhost:3000/api/auth/refresh-token \
  -H 'Content-Type: application/json' \
  -d '{"refreshToken":"'"$REFRESH_TOKEN"'"}'
```

### Current user

```
GET /api/auth/me
Authorization: Bearer <token>
```

Copy/paste:

```bash
curl http://localhost:3000/api/auth/me \
  -H "Authorization: Bearer $TOKEN"
```

## Common integration flow

1. `POST /api/auth/register` or `POST /api/auth/login`
2. Store `token` (and `refreshToken`) in your app
3. Use `Authorization: Bearer <token>` for protected calls
4. When receiving `401` due to expiration, refresh and retry

Minimal refresh+retry pseudocode:

```js
async function fetchWithAuth(url, token, refreshToken) {
  const res = await fetch(url, { headers: { Authorization: `Bearer ${token}` } });
  if (res.status !== 401) return res;

  const refreshRes = await fetch('/api/auth/refresh-token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ refreshToken })
  });
  if (!refreshRes.ok) throw new Error('Refresh failed');
  const data = await refreshRes.json();

  return fetch(url, { headers: { Authorization: `Bearer ${data.token}` } });
}
```

## Troubleshooting

### Getting `401 No token provided`

- Ensure you are sending `Authorization: Bearer <token>`.

### Refresh token fails

- Ensure you are using the `refreshToken` returned by login/register.
- Ensure your JWT secrets are configured.
