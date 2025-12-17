# Middleware quickstart

## What it is
Quick start guide for mounting SaasBackend into an existing Express app. This is the recommended integration path.

## Base URL / mount prefix
When mounted at `/saas`, all routes are prefixed:

- Health: `GET /saas/health`
- Auth: `POST /saas/api/auth/login`
- Admin: `GET /saas/admin/test`

## Configuration
- `mongodbUri` (optional): MongoDB connection string
- `corsOrigin` (optional): CORS origin(s) - supports `*`, single origin, or comma-separated

## API
### Public endpoints
- `POST /saas/api/auth/register`
- `POST /saas/api/auth/login`
- `GET /saas/health`

### JWT endpoints
- `GET /saas/api/auth/me`
- `POST /saas/api/billing/create-checkout-session`
- `GET /saas/api/notifications`

### Admin endpoints (Basic Auth)
- `GET /saas/admin/test`
- `GET /saas/admin/users`
- `GET /saas/admin/global-settings`

## Admin UI
- `/saas/admin/test` - API testing UI
- `/saas/admin/users` - User management
- `/saas/admin/global-settings` - Settings manager

## Common errors / troubleshooting
- **404 after mounting**: Ensure you're hitting the prefixed path (e.g., `/saas/health`)
- **CORS errors**: Set `corsOrigin` or disable CORS in middleware mode
- **DB connection errors**: Pass `mongodbUri` or set `MONGODB_URI` environment variable
