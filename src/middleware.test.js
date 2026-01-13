const createMiddleware = require('./middleware');
const express = require('express');
const request = require('supertest');

// Mock modules
jest.mock('mongoose', () => {
  const mockSchema = jest.fn().mockImplementation((definition) => ({
    definition,
    paths: {},
    methods: {},
    statics: {},
    index: jest.fn(),
    set: jest.fn(),
    pre: jest.fn(),
    post: jest.fn(),
    plugin: jest.fn()
  }));

  mockSchema.Types = {
    Mixed: 'Mixed',
    ObjectId: 'ObjectId',
    String: 'String',
    Number: 'Number',
    Boolean: 'Boolean',
    Date: 'Date',
    Buffer: 'Buffer'
  };

  return {
    connection: { readyState: 0 },
    connect: jest.fn().mockResolvedValue(true),
    Schema: mockSchema,
    Types: {
      Mixed: 'Mixed',
      ObjectId: 'ObjectId',
      String: 'String',
      Number: 'Number',
      Boolean: 'Boolean',
      Date: 'Date',
      Buffer: 'Buffer'
    },
    models: {},
    model: jest.fn().mockReturnValue({
      findOne: jest.fn(),
      findById: jest.fn(),
      find: jest.fn(),
      create: jest.fn(),
      save: jest.fn()
    })
  };
});

jest.mock('./controllers/billing.controller', () => ({
  handleWebhook: jest.fn((req, res) => res.json({ received: true }))
}));

jest.mock('./middleware/auth', () => ({
  basicAuth: jest.fn((req, res, next) => next())
}));

jest.mock('fs', () => ({
  readFileSync: jest.fn((path) => {
    if (path.includes('admin-test.ejs')) {
      return '<html><body>Test Page: <%= baseUrl %></body></html>';
    } else if (path.includes('admin-global-settings.ejs')) {
      return '<html><body>Settings Page: <%= baseUrl %></body></html>';
    } else {
      throw new Error('File not found');
    }
  }),
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

jest.mock('vm2', () => ({
  NodeVM: jest.fn().mockImplementation(() => ({
    run: jest.fn().mockResolvedValue({}),
    call: jest.fn().mockResolvedValue({})
  }))
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

jest.mock('./routes/workflows.routes', () => {
  const express = require('express');
  const router = express.Router();
  router.get('/test', (req, res) => res.json({ route: 'workflows' }));
  return router;
});

jest.mock('./services/workflow.service', () => ({
  executeWorkflow: jest.fn().mockResolvedValue({ success: true }),
  createWorkflow: jest.fn().mockResolvedValue({ id: 'workflow123' }),
  getWorkflow: jest.fn().mockResolvedValue({ id: 'workflow123', name: 'Test Workflow' })
}));

jest.mock('./models/WorkflowExecution', () => ({
  find: jest.fn().mockReturnValue({
    sort: jest.fn().mockReturnThis(),
    limit: jest.fn().mockReturnThis(),
    exec: jest.fn().mockResolvedValue([])
  }),
  findById: jest.fn().mockResolvedValue(null),
  create: jest.fn().mockResolvedValue({ id: 'exec123' })
}));

jest.mock('./routes/featureFlags.routes', () => {
  const express = require('express');
  const router = express.Router();
  router.get('/test', (req, res) => res.json({ route: 'featureFlags' }));
  return router;
});

jest.mock('./controllers/featureFlags.controller', () => ({
  getPublicFlags: jest.fn((req, res) => res.json({ flags: {} })),
  getEvaluatedFlags: jest.fn((req, res) => res.json({ flags: {} }))
}));

jest.mock('./routes/assets.routes', () => {
  const express = require('express');
  const router = express.Router();
  router.get('/test', (req, res) => res.json({ route: 'assets' }));
  return router;
});

jest.mock('./controllers/assets.controller', () => ({
  upload: jest.fn((req, res) => res.json({ message: 'Asset uploaded' })),
  list: jest.fn((req, res) => res.json({ assets: [] })),
  get: jest.fn((req, res) => res.json({ asset: {} })),
  download: jest.fn((req, res) => res.download('test.pdf'))
}));

jest.mock('multer', () => ({
  single: jest.fn(() => (req, res, next) => next()),
  memoryStorage: jest.fn(() => ({}))
}));

jest.mock('./services/auditLogger', () => ({
  auditMiddleware: jest.fn(() => (req, res, next) => next())
}));

jest.mock('./routes/adminAssets.routes', () => {
  const express = require('express');
  const router = express.Router();
  router.get('/test', (req, res) => res.json({ route: 'adminAssets' }));
  return router;
});

jest.mock('./controllers/adminAssets.controller', () => ({
  uploadAsset: jest.fn((req, res) => res.json({ message: 'Asset uploaded' })),
  getAssets: jest.fn((req, res) => res.json({ assets: [] })),
  getAsset: jest.fn((req, res) => res.json({ asset: {} })),
  deleteAsset: jest.fn((req, res) => res.json({ message: 'Asset deleted' }))
}));

jest.mock('./routes/org.routes', () => {
  const express = require('express');
  const router = express.Router();
  router.get('/test', (req, res) => res.json({ route: 'org' }));
  return router;
});

jest.mock('./controllers/org.controller', () => ({
  listPublicOrgs: jest.fn((req, res) => res.json({ orgs: [] })),
  listOrgs: jest.fn((req, res) => res.json({ orgs: [] })),
  createOrg: jest.fn((req, res) => res.json({ org: {} })),
  getOrgPublic: jest.fn((req, res) => res.json({ org: {} })),
  getOrg: jest.fn((req, res) => res.json({ org: {} })),
  updateOrg: jest.fn((req, res) => res.json({ org: {} })),
  deleteOrg: jest.fn((req, res) => res.json({ message: 'Org deleted' }))
}));

jest.mock('./routes/publicAssets.routes', () => {
  const express = require('express');
  const router = express.Router();
  router.get('/test', (req, res) => res.json({ route: 'publicAssets' }));
  return router;
});

jest.mock('./controllers/assets.controller', () => ({
  getPublicAsset: jest.fn((req, res) => res.json({ asset: {} })),
  upload: jest.fn((req, res) => res.json({ message: 'Asset uploaded' })),
  list: jest.fn((req, res) => res.json({ assets: [] })),
  get: jest.fn((req, res) => res.json({ asset: {} })),
  download: jest.fn((req, res) => res.download('test.pdf'))
}));

describe('Middleware', () => {
  let app;

  beforeEach(() => {
    app = express();
    jest.clearAllMocks();
    // Set NODE_ENV to development to get actual error messages
    process.env.NODE_ENV = 'development';
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
      // The response is HTML with the error message
      expect(response.text).toMatch(/Error rendering page/);
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
        error.statusCode = 400;  // Set both to be sure
        next(error);
      });
      
      const response = await request(app).get('/error-test');
      
      console.log('Response status:', response.status);
      console.log('Response body:', response.body);
      console.log('Response text:', response.text);
      
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