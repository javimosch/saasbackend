# Middleware Mode for SaaS Backend

This document outlines the plan to enable a middleware mode for the SaaS backend application. In this mode, the application will function as an Express.js middleware, allowing it to be integrated into an existing Node.js application. This mode will primarily expose the API endpoints and admin views, omitting the standalone landing page.

## Goals

1.  **Enable Middleware Integration:** Allow the SaaS backend to be mounted as a sub-application within another Express.js application.
2.  **Isolate Functionality:** In middleware mode, only expose the API routes and admin-related views/functionality.
3.  **Avoid Route Conflicts:** Ensure the middleware does not interfere with the parent application's routes, especially the root route (`/`).
4.  **Manage Static Assets:** Handle static assets for admin views in a way that prevents conflicts with the parent application's static files.
5.  **Clear Documentation:** Provide clear instructions on how to configure and use the middleware mode.

## Proposed Changes

### 1. `saasbackend` NPM Package Structure

The application will be published as an npm package named `saasbackend`. This package will expose two primary ways to use the backend:

*   **Standalone Server:** A function to start the full SaaS backend application, including the landing page and its own static asset serving.
*   **Express Middleware:** A function that returns an `express.Router()` instance, exposing only the API routes and admin views, suitable for mounting within another Express.js application.

### 2. Package Entry Points

The `package.json` `main` entry will point to a file (e.g., `index.js`) that exports these two functionalities.

*   **`saasbackend.server(options)`:** A function that initializes and starts the standalone server. `options` can include configuration like port, database connection, etc.
*   **`saasbackend.middleware(options)`:** A function that returns an `express.Router()` instance. `options` can include configuration like database connection, CORS origin, JWT secret, etc.

### 3. Internal Logic

The internal implementation will still leverage conditional logic based on an internal `mode` parameter or environment variable if needed, but the external interface will be through the exported functions.

*   **Conditional Root Route & Static Files:** The landing page route and the primary static file serving will only be registered when `saasbackend.server()` is used.
*   **Admin Static Assets:** When `saasbackend.middleware()` is used, static assets for admin views will be served under a configurable path (defaulting to `/admin/assets`) within the returned router.

### 5. Documentation (`docs/middleware-mode.md`)

This document will be updated with:

*   Instructions on how to enable and use the middleware mode.
*   Details on the `MIDDLEWARE_MODE` environment variable.
*   Information about the exposed routes and the new static asset path for admin views (`/admin/assets`).
*   An example of how to integrate the middleware into a parent Express.js application.

## Example Usage (Parent Application)

```javascript
// parent-app.js
const express = require('express');
const saasBackendMiddleware = require('./path/to/saas-backend/src/middleware');

const app = express();

// ... other parent application middleware and routes ...

// Mount the SaaS backend middleware
app.use('/saas', saasBackendMiddleware({/* options such as dbConnection, corsOrigin, jwtSecret, etc */})); // All SaaS backend routes will be prefixed with /saas

// Example: Accessing a SaaS backend API endpoint
// GET /saas/api/auth/me

// Example: Accessing a SaaS backend admin view
// GET /saas/admin/test

// Example: Accessing a SaaS backend admin static asset
// GET /saas/admin/assets/css/styles.css

// ... start parent application server ...
app.listen(3001, () => {
  console.log('Parent app listening on port 3001');
});
```

## Open Questions / Considerations

*   **Database Connection:** The middleware will try to connect to a database connection passed from the parent application and fallback to process.env.MONGODB_URI if provided. If neither is available, an error will be thrown.
*   **Environment Variables:** All necessary environment variables (e.g., `MONGODB_URI`, `CORS_ORIGIN`, `JWT_SECRET`) should be set in the environment where the parent application runs. The middleware will use `process.env` to access these. Default values will be used if not provided (e.g., `CORS_ORIGIN='*'`). A warning will be logged for missing `MONGODB_URI` and not passed by the parent application.
*   **View Engine Configuration:** To prevent conflicts with the parent application's view engine, the admin views (`admin-test.ejs`, `admin-global-settings.ejs`) will be rendered directly within the middleware by reading and compiling the EJS templates manually. This means the middleware will not use `app.set('view engine', 'ejs')` or `app.set('views', ...)` for its own views, ensuring isolation from the parent application's view rendering setup.
