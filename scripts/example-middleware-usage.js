// Example of integrating the SaaS backend as middleware in a parent Express.js application

const express = require('express');
const { middleware } = require('./index'); // or require('notesyncer-landing') when installed as npm package

const app = express();

// Parent application's own middleware and routes
app.use(express.json());

// Example: Parent app's landing page
app.get('/', (req, res) => {
  res.send('<h1>Parent Application</h1><p>SaaS backend is mounted at <a href="/saas/health">/saas</a></p>');
});

// Mount the SaaS backend middleware at /saas
// All SaaS backend routes will be prefixed with /saas
app.use('/saas', middleware({
  // Optional: Pass MongoDB connection string
  mongodbUri: process.env.MONGODB_URI,
  
  // Optional: Configure CORS origin(s)
  corsOrigin: process.env.CORS_ORIGIN || '*',
  
  // Optional: Pass existing Mongoose connection
  // dbConnection: mongoose.connection,
  
  // Note: JWT_SECRET, STRIPE_SECRET_KEY, etc. should be set in process.env
}));

// Examples of accessing SaaS backend endpoints:
// - API: GET /saas/api/auth/me
// - Admin UI: GET /saas/admin/test (requires Basic Auth)
// - Health: GET /saas/health
// - Static assets: GET /saas/admin/assets/css/styles.css

// Start the parent application
const PORT = process.env.PORT || 3001;
app.listen(PORT, () => {
  console.log(`🚀 Parent application running on http://localhost:${PORT}`);
  console.log(`📦 SaaS backend mounted at http://localhost:${PORT}/saas`);
});
