const crypto = require('crypto');
const GlobalSetting = require('../models/GlobalSetting');

const FEATURE_FLAG_PREFIX = 'FEATURE_FLAG.';

const stripPrefix = (key) => {
  if (!key) return key;
  return key.startsWith(FEATURE_FLAG_PREFIX) ? key.slice(FEATURE_FLAG_PREFIX.length) : key;
};

const normalizeArray = (value) => {
  if (!value) return [];
  if (Array.isArray(value)) return value.map(String);
  return [String(value)];
};

const normalizeDefinition = ({ key, raw }) => {
  const description = raw?.description ? String(raw.description) : '';
  const enabled = Boolean(raw?.enabled);

  let rolloutPercentage = Number(raw?.rolloutPercentage ?? 0);
  if (Number.isNaN(rolloutPercentage)) rolloutPercentage = 0;
  rolloutPercentage = Math.max(0, Math.min(100, rolloutPercentage));

  return {
    key,
    description,
    enabled,
    rolloutPercentage,
    allowListUserIds: normalizeArray(raw?.allowListUserIds),
    allowListOrgIds: normalizeArray(raw?.allowListOrgIds),
    denyListUserIds: normalizeArray(raw?.denyListUserIds),
    denyListOrgIds: normalizeArray(raw?.denyListOrgIds),
    payload: raw?.payload ?? null,
  };
};

const computeBucket = ({ flagKey, subjectId }) => {
  const input = `${flagKey}:${subjectId}`;
  const hash = crypto.createHash('sha256').update(input).digest('hex');
  const int = parseInt(hash.slice(0, 8), 16);
  return int % 100;
};

const evaluateDefinition = ({ def, userId, orgId, anonId }) => {
  const userIdStr = userId ? String(userId) : null;
  const orgIdStr = orgId ? String(orgId) : null;
  const anonIdStr = anonId ? String(anonId) : null;

  const deny =
    (userIdStr && def.denyListUserIds.includes(userIdStr)) ||
    (orgIdStr && def.denyListOrgIds.includes(orgIdStr));
  if (deny) {
    return { key: def.key, enabled: false };
  }

  const allow =
    (userIdStr && def.allowListUserIds.includes(userIdStr)) ||
    (orgIdStr && def.allowListOrgIds.includes(orgIdStr));
  if (allow) {
    return { key: def.key, enabled: true, payload: def.payload };
  }

  if (def.enabled) {
    return { key: def.key, enabled: true, payload: def.payload };
  }

  if (def.rolloutPercentage > 0) {
    const subjectId = orgIdStr || userIdStr || anonIdStr;
    if (!subjectId) {
      return { key: def.key, enabled: false };
    }

    const bucket = computeBucket({ flagKey: def.key, subjectId });
    const enabled = bucket < def.rolloutPercentage;
    return enabled
      ? { key: def.key, enabled: true, payload: def.payload }
      : { key: def.key, enabled: false };
  }

  return { key: def.key, enabled: false };
};

const loadAllDefinitions = async () => {
  const settings = await GlobalSetting.find({
    key: { $regex: `^${FEATURE_FLAG_PREFIX}` },
    type: 'json',
  })
    .sort({ key: 1 })
    .lean();

  return settings
    .map((s) => {
      let raw;
      try {
        raw = s?.value ? JSON.parse(s.value) : {};
      } catch {
        raw = {};
      }

      const key = stripPrefix(s.key);
      return normalizeDefinition({ key, raw: { ...raw, description: raw?.description ?? s.description } });
    });
};

const evaluateAllForRequest = async ({ userId, orgId, anonId }) => {
  const defs = await loadAllDefinitions();
  return defs.map((def) => evaluateDefinition({ def, userId, orgId, anonId }));
};

const flagsArrayToMap = (flagsArray) => {
  const out = {};
  (flagsArray || []).forEach((f) => {
    if (!f || !f.key) return;
    out[f.key] = {
      enabled: Boolean(f.enabled),
      ...(Object.prototype.hasOwnProperty.call(f, 'payload') ? { payload: f.payload } : {}),
    };
  });
  return out;
};

const parseCookies = (cookieHeader) => {
  const cookies = {};
  if (!cookieHeader) return cookies;

  cookieHeader.split(';').forEach((part) => {
    const idx = part.indexOf('=');
    if (idx === -1) return;
    const k = part.slice(0, idx).trim();
    const v = part.slice(idx + 1).trim();
    if (!k) return;
    cookies[k] = decodeURIComponent(v);
  });

  return cookies;
};

const ensureAnonIdCookie = (req, res) => {
  const cookies = parseCookies(req.headers?.cookie);
  const existing = cookies.saas_anon_id;
  if (existing) return existing;

  const generated = crypto.randomBytes(16).toString('hex');
  if (res && typeof res.setHeader === 'function') {
    const cookie = `saas_anon_id=${encodeURIComponent(generated)}; Path=/; Max-Age=31536000; SameSite=Lax`;
    res.setHeader('Set-Cookie', cookie);
  }
  return generated;
};

function createFeatureFlagsEjsMiddleware(opts = {}) {
  const enabled = opts.enabled !== false;
  const includeForApi = Boolean(opts.includeForApi);

  return async (req, res, next) => {
    try {
      if (!enabled) return next();

      const isApi = String(req.originalUrl || req.url || '').startsWith('/api/');
      if (isApi && !includeForApi) return next();

      const accept = String(req.headers?.accept || '');
      const isHtml = accept.includes('text/html') || accept.includes('*/*') || !accept;
      if (!isHtml) return next();

      const orgId = req.query.orgId || req.headers['x-org-id'] || null;
      const anonId =
        req.query.anonId ||
        req.headers['x-anon-id'] ||
        ensureAnonIdCookie(req, res);

      const flagsArray = await evaluateAllForRequest({ userId: null, orgId, anonId });
      const flags = flagsArrayToMap(flagsArray);

      res.locals.featureFlags = flags;
      res.locals.ff = (key, defaultValue = false) => {
        if (!key) return defaultValue;
        const entry = flags[String(key)];
        return typeof entry?.enabled === 'boolean' ? entry.enabled : defaultValue;
      };
      res.locals.ffPayload = (key, defaultValue = null) => {
        if (!key) return defaultValue;
        const entry = flags[String(key)];
        return Object.prototype.hasOwnProperty.call(entry || {}, 'payload') ? entry.payload : defaultValue;
      };

      next();
    } catch (e) {
      next(e);
    }
  };
}

module.exports = {
  FEATURE_FLAG_PREFIX,
  stripPrefix,
  loadAllDefinitions,
  evaluateAllForRequest,
  flagsArrayToMap,
  createFeatureFlagsEjsMiddleware,
};
