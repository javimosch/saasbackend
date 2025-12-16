const crypto = require('crypto');
const { verifyAccessToken } = require('../utils/jwt');
const User = require('../models/User');
const FormSubmission = require('../models/FormSubmission');

function parseCookieHeader(cookieHeader) {
  const out = {};
  if (!cookieHeader) return out;
  const parts = cookieHeader.split(';');
  for (const p of parts) {
    const idx = p.indexOf('=');
    if (idx === -1) continue;
    const k = p.slice(0, idx).trim();
    const v = p.slice(idx + 1).trim();
    if (!k) continue;
    out[k] = decodeURIComponent(v);
  }
  return out;
}

async function tryAttachUser(req) {
  if (req.user?._id) return;
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) return;

  try {
    const token = authHeader.substring(7);
    const decoded = verifyAccessToken(token);
    const user = await User.findById(decoded.userId);
    if (user) req.user = user;
  } catch (e) {
  }
}

function getAnonId(req) {
  const headerAnon = req.get('x-anon-id');
  if (headerAnon) return String(headerAnon).trim();

  const cookies = parseCookieHeader(req.headers.cookie);
  if (cookies.enbauges_anon_id) return String(cookies.enbauges_anon_id).trim();

  const bodyAnon = req.body?.anonId;
  if (bodyAnon) return String(bodyAnon).trim();

  return null;
}

function normalizeEmail(email) {
  return String(email || '').trim().toLowerCase();
}

function isValidEmail(email) {
  if (!email) return false;
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

exports.submit = async (req, res) => {
  try {
    await tryAttachUser(req);

    const formKey = String(req.body?.formKey || '').trim();
    const fields = req.body?.fields;

    if (!formKey) {
      return res.status(400).json({ error: 'formKey is required' });
    }
    if (!fields || typeof fields !== 'object') {
      return res.status(400).json({ error: 'fields is required' });
    }

    if (formKey === 'contact') {
      const email = normalizeEmail(fields.email);
      const message = String(fields.message || '').trim();
      if (!isValidEmail(email)) {
        return res.status(400).json({ error: 'Email invalide', field: 'email' });
      }
      if (!message || message.length < 5) {
        return res.status(400).json({ error: 'Message trop court', field: 'message' });
      }
    }

    let actorType = 'anonymous';
    let actorId = getAnonId(req);
    let userId = null;

    if (req.user?._id) {
      actorType = 'user';
      actorId = String(req.user._id);
      userId = req.user._id;
    }

    if (!actorId) {
      actorId = crypto.randomUUID();
      res.cookie('enbauges_anon_id', actorId, {
        httpOnly: false,
        sameSite: 'lax',
        maxAge: 1000 * 60 * 60 * 24 * 365,
        path: '/',
      });
    }

    const meta = {
      ip: req.headers['x-forwarded-for'] || req.socket?.remoteAddress || null,
      userAgent: req.get('user-agent') || null,
      referer: req.get('referer') || null,
    };

    const doc = await FormSubmission.create({
      formKey,
      actorType,
      actorId,
      userId,
      fields,
      meta,
    });

    return res.status(201).json({ ok: true, id: String(doc._id) });
  } catch (error) {
    console.error('Form submit error:', error);
    return res.status(500).json({ error: 'Failed to submit' });
  }
};

exports.adminList = async (req, res) => {
  try {
    const { formKey, limit = 50, offset = 0 } = req.query;
    const query = {};
    if (formKey) query.formKey = formKey;

    const submissions = await FormSubmission.find(query)
      .sort({ createdAt: -1 })
      .limit(parseInt(limit))
      .skip(parseInt(offset))
      .lean();

    const total = await FormSubmission.countDocuments(query);

    return res.json({ submissions, pagination: { total, limit: parseInt(limit), offset: parseInt(offset) } });
  } catch (error) {
    console.error('Form admin list error:', error);
    return res.status(500).json({ error: 'Failed to list submissions' });
  }
};
