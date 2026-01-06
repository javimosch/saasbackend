const Webhook = require('../models/Webhook');
const webhookService = require('../services/webhook.service');

const webhookController = {
  /**
   * Get all webhooks for the current organization
   */
  async getAll(req, res) {
    try {
      const organizationId = req.orgId || req.currentOrganization?._id || req.org?._id;
      
      // If superadmin (Basic Auth), allow fetching all webhooks if no org context
      const isBasicAuth = req.headers.authorization?.startsWith('Basic ');
      
      const query = {};
      if (organizationId) {
        query.organizationId = organizationId;
      } else if (!isBasicAuth) {
        return res.status(400).json({ error: 'Organization context required' });
      }

      const webhooks = await Webhook.find(query);
      res.json(webhooks);
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  },

  /**
   * Create a new webhook
   */
  async create(req, res) {
    try {
      const organizationId = req.orgId || req.currentOrganization?._id || req.org?._id || req.body.organizationId || null;
      const { name, targetUrl, events, metadata, timeout, isAsync } = req.body;

      const isBasicAuth = req.headers.authorization?.startsWith('Basic ');

      if (!organizationId && !isBasicAuth) {
        return res.status(400).json({ error: 'Organization context required' });
      }

      if (!targetUrl || !events || !Array.isArray(events)) {
        return res.status(400).json({ error: 'targetUrl and events (array) are required' });
      }

      // Check name uniqueness if provided
      if (name) {
        const existing = await Webhook.findOne({ name, organizationId });
        if (existing) {
          return res.status(400).json({ error: 'A webhook with this name already exists in this organization' });
        }
      }

      const webhook = new Webhook({
        name: name || undefined, // Let mongoose default trigger if name is empty
        targetUrl,
        events,
        organizationId,
        timeout: timeout || 5000,
        isAsync: isAsync === true,
        metadata: metadata || {}
      });

      await webhook.save();
      res.status(201).json(webhook);
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  },

  /**
   * Update a webhook
   */
  async update(req, res) {
    try {
      const { id } = req.params;
      const organizationId = req.orgId || req.currentOrganization?._id || req.org?._id;
      const isBasicAuth = req.headers.authorization?.startsWith('Basic ');
      const { name, targetUrl, events, status, metadata, timeout, isAsync } = req.body;

      const query = { _id: id };
      if (!isBasicAuth && organizationId) {
        query.organizationId = organizationId;
      }

      const webhook = await Webhook.findOne(query);
      if (!webhook) {
        return res.status(404).json({ error: 'Webhook not found' });
      }

      if (name && name !== webhook.name) {
        const existing = await Webhook.findOne({ name, organizationId: webhook.organizationId, _id: { $ne: id } });
        if (existing) {
          return res.status(400).json({ error: 'A webhook with this name already exists in this organization' });
        }
        webhook.name = name;
      }

      if (targetUrl) webhook.targetUrl = targetUrl;
      if (events && Array.isArray(events)) webhook.events = events;
      if (status) webhook.status = status;
      if (metadata) webhook.metadata = metadata;
      if (timeout !== undefined) webhook.timeout = timeout;
      if (isAsync !== undefined) webhook.isAsync = isAsync;

      await webhook.save();
      res.json(webhook);
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  },

  /**
   * Delete a webhook
   */
  async delete(req, res) {
    try {
      const { id } = req.params;
      const organizationId = req.orgId || req.currentOrganization?._id || req.org?._id;
      const isBasicAuth = req.headers.authorization?.startsWith('Basic ');

      const query = { _id: id };
      if (!isBasicAuth && organizationId) {
        query.organizationId = organizationId;
      }

      const result = await Webhook.deleteOne(query);
      if (result.deletedCount === 0) {
        return res.status(404).json({ error: 'Webhook not found' });
      }

      res.json({ message: 'Webhook deleted successfully' });
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  },

  /**
   * Test a webhook delivery
   */
  async test(req, res) {
    try {
      const { id } = req.params;
      const organizationId = req.orgId || req.currentOrganization?._id || req.org?._id;
      const isBasicAuth = req.headers.authorization?.startsWith('Basic ');

      const query = { _id: id };
      if (!isBasicAuth && organizationId) {
        query.organizationId = organizationId;
      }

      const webhook = await Webhook.findOne(query);
      if (!webhook) {
        return res.status(404).json({ error: 'Webhook not found' });
      }

      await webhookService.test(id);
      res.json({ message: 'Test payload dispatched' });
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  },

  /**
   * Get delivery history for a webhook
   */
  async getHistory(req, res) {
    try {
      const { id } = req.params;
      const organizationId = req.orgId || req.currentOrganization?._id || req.org?._id;
      const isBasicAuth = req.headers.authorization?.startsWith('Basic ');
      const AuditEvent = require('../models/AuditEvent');

      const query = { _id: id };
      if (!isBasicAuth && organizationId) {
        query.organizationId = organizationId;
      }

      const webhook = await Webhook.findOne(query);
      if (!webhook) {
        return res.status(404).json({ error: 'Webhook not found' });
      }

      const history = await AuditEvent.find({
        entityType: 'Webhook',
        entityId: id,
        action: { $in: ['WEBHOOK_DELIVERY_SUCCESS', 'WEBHOOK_DELIVERY_FAILURE'] }
      })
      .sort({ createdAt: -1 })
      .limit(50);

      res.json(history);
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  }
};

module.exports = webhookController;
