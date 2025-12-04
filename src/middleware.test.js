const createMiddleware = require('./middleware');
const express = require('express');
const request = require('supertest');

// Mock modules
jest.mock('mongoose', () => ({
  connection: { readyState: 0 },
  connect: jest.fn().mockResolvedValue(true),
}));

jest.mock('./controllers/billing.controller', () => ({
  handleWebhook: jest.fn((req, res) => res.json({ received: true }))
}));

jest.mock('./middleware/auth', () => ({
  basicAuth: jest.fn((req, res, next) => next())
}));

jest.mock('fs', () => ({
  readFile: jest.fn((path, encoding, callback) => {
    if (path.includes('admin-test.ejs')) {
      callback(null, '<html><body>Test Page: <%= baseUrl %></body></html>');
    } else if (path.includes('admin-global-settings.ejs')) {
      callback(null, '<html><body>Settings Page: <%= baseUrl %></body></html>');
    } else {
      callback(new Error('File not found'));
    }
  })
}));

// Mock all route modules
jest.mock('./routes/auth.routes', () => {
  const express = require('express');
  const router = express.Router();
  router.get('/test', (req, res) => res.json({ route: 'auth' }));
  return router;
});

jest.mock('./routes/billing.routes', () => {
  const express = require('express');
  const router = express.Router();
  router.get('/test', (req, res) => res.json({ route: 'billing' }));
  return router;
});

jest.mock('./routes/waitingList.routes', () => {
  const express = require('express');
  const router = express.Router();
  router.get('/test', (req, res) => res.json({ route: 'waitingList' }));
  return router;
});

jest.mock('./routes/admin.routes', () => {
  const express = require('express');
  const router = express.Router();
  router.get('/test', (req, res) => res.json({ route: 'admin' }));
  return router;
});

jest.mock('./routes/globalSettings.routes', () => {
  const express = require('express');
  const router = express.Router();
  router.get('/test', (req, res) => res.json({ route: 'globalSettings' }));
  return router;
});

jest.mock('./routes/notifications.routes', () => {
  const express = require('express');
  const router = express.Router();
  router.get('/test', (req, res) => res.json({ route: 'notifications' }));
  return router;
});

jest.mock('./routes/user.routes', () => {
  const express = require('express');
  const router = express.Router();
  router.get('/test', (req, res) => res.json({ route: 'user' }));
  return router;
});

describe('Middleware', () => {
  let app;

  beforeEach(() => {
    app = express();
    jest.clearAllMocks();
  });

  describe('createMiddleware', () => {
    test('should create middleware with default options', () => {
      const middleware = createMiddleware();
      expect(middleware).toBeDefined();
      expect(typeof middleware).toBe('function');
    });

    test('should handle CORS configuration with wildcard origin', async () => {
      const middleware = createMiddleware({ corsOrigin: '*' });
      app.use(middleware);
      
      const response = await request(app).get('/health');
      expect(response.status).toBe(200);
      expect(response.body.status).toBe('ok');
    });

    test('should handle CORS configuration with multiple origins', async () => {
      const middleware = createMiddleware({ corsOrigin: 'http://localhost:3000,http://localhost:3001' });
      app.use(middleware);
      
      const response = await request(app).get('/health');
      expect(response.status).toBe(200);
    });

    test('should handle CORS configuration with single origin', async () => {
      const middleware = createMiddleware({ corsOrigin: 'http://localhost:3000' });
      app.use(middleware);
      
      const response = await request(app).get('/health');
      expect(response.status).toBe(200);
    });

    test('should disable CORS when specified', async () => {
      const middleware = createMiddleware({ corsOrigin: false });
      app.use(middleware);
      
      const response = await request(app).get('/health');
      expect(response.status).toBe(200);
    });

    test('should skip body parser when specified', async () => {
      const middleware = createMiddleware({ skipBodyParser: true });
      app.use(middleware);
      
      const response = await request(app).get('/health');
      expect(response.status).toBe(200);
    });

    test('should handle MongoDB connection', async () => {
      const mongoose = require('mongoose');
      const middleware = createMiddleware({ mongodbUri: 'mongodb://test' });
      
      expect(mongoose.connect).toHaveBeenCalledWith('mongodb://test', {
        serverSelectionTimeoutMS: 5000,
        maxPoolSize: 10,
      });
    });

    test('should handle existing MongoDB connection', () => {
      const mongoose = require('mongoose');
      mongoose.connection.readyState = 1;
      
      const middleware = createMiddleware();
      expect(middleware).toBeDefined();
    });

    test('should handle custom mongoose options', () => {
      const customOptions = { maxPoolSize: 20 };
      const middleware = createMiddleware({ 
        mongodbUri: 'mongodb://test',
        mongooseOptions: customOptions 
      });
      
      const mongoose = require('mongoose');
      expect(mongoose.connect).toHaveBeenCalledWith('mongodb://test', customOptions);
    });
  });

  describe('Routes', () => {
    let middleware;

    beforeEach(() => {
      middleware = createMiddleware();
      app.use(middleware);
    });

    test('should handle health check endpoint', async () => {
      const response = await request(app).get('/health');
      
      expect(response.status).toBe(200);
      expect(response.body).toEqual({
        status: 'ok',
        mode: 'middleware',
        database: 'disconnected'
      });
    });

    test('should handle stripe webhook endpoint', async () => {
      const response = await request(app)
        .post('/api/stripe-webhook')
        .send('webhook-data');
      
      expect(response.status).toBe(200);
      expect(response.body.received).toBe(true);
    });

    test('should handle alternative stripe webhook endpoint', async () => {
      const response = await request(app)
        .post('/api/stripe/webhook')
        .send('webhook-data');
      
      expect(response.status).toBe(200);
      expect(response.body.received).toBe(true);
    });

    test('should serve admin test page', async () => {
      const response = await request(app).get('/admin/test');
      
      expect(response.status).toBe(200);
      expect(response.text).toContain('Test Page:');
    });

    test('should serve admin global settings page', async () => {
      const response = await request(app).get('/admin/global-settings');
      
      expect(response.status).toBe(200);
      expect(response.text).toContain('Settings Page:');
    });

    test('should handle template read error for admin test page', async () => {
      const fs = require('fs');
      fs.readFile.mockImplementationOnce((path, encoding, callback) => {
        callback(new Error('File not found'));
      });

      const response = await request(app).get('/admin/test');
      
      expect(response.status).toBe(500);
      expect(response.text).toBe('Error loading page');
    });

    test('should handle template render error for admin test page', async () => {
      const fs = require('fs');
      fs.readFile.mockImplementationOnce((path, encoding, callback) => {
        callback(null, '<% invalid syntax %>');
      });

      const response = await request(app).get('/admin/test');
      
      expect(response.status).toBe(500);
      expect(response.text).toBe('Error rendering page');
    });
  });

  describe('Error handling', () => {
    test('should handle errors with error middleware', async () => {
      const middleware = createMiddleware();
      app.use(middleware);
      
      // Add a route that throws an error
      app.get('/error-test', (req, res, next) => {
        const error = new Error('Test error');
        error.status = 400;
        next(error);
      });
      
      const response = await request(app).get('/error-test');
      
      expect(response.status).toBe(400);
      expect(response.body.error).toBe('Test error');
    });

    test('should handle errors without status', async () => {
      const middleware = createMiddleware();
      app.use(middleware);
      
      // Add a route that throws an error without status
      app.get('/error-test', (req, res, next) => {
        const error = new Error('Test error without status');
        next(error);
      });
      
      const response = await request(app).get('/error-test');
      
      expect(response.status).toBe(500);
      expect(response.body.error).toBe('Test error without status');
    });
  });
});