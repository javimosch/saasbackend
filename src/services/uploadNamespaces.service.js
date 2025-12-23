const GlobalSetting = require('../models/GlobalSetting');
const globalSettingsService = require('./globalSettings.service');
const objectStorage = require('./objectStorage.service');

const UPLOAD_NAMESPACE_PREFIX = 'UPLOAD_NAMESPACE.';

const stripPrefix = (key) => {
  if (!key) return key;
  if (!key.startsWith(UPLOAD_NAMESPACE_PREFIX)) return key;
  return key.slice(UPLOAD_NAMESPACE_PREFIX.length);
};

const parseJson = (value) => {
  if (!value) return {};
  if (typeof value === 'object') return value;
  try {
    return JSON.parse(value);
  } catch {
    return {};
  }
};

const MAX_FILE_SIZE_HARD_CAP_SETTING_KEY = 'MAX_FILE_SIZE_HARD_CAP';

const DEFAULT_MAX_FILE_SIZE_BYTES = 10485760;

const getEnvHardCapMaxFileSizeBytes = () => {
  const raw = process.env.MAX_FILE_SIZE_HARD_CAP || process.env.MAX_FILE_SIZE || String(DEFAULT_MAX_FILE_SIZE_BYTES);
  const parsed = Number(raw);
  if (!Number.isFinite(parsed) || parsed <= 0) return DEFAULT_MAX_FILE_SIZE_BYTES;
  return parsed;
};

const getEffectiveHardCapMaxFileSizeBytes = async () => {
  const raw = await globalSettingsService.getSettingValue(MAX_FILE_SIZE_HARD_CAP_SETTING_KEY, null);
  if (raw === null || raw === undefined || raw === '') return getEnvHardCapMaxFileSizeBytes();

  const parsed = Number(raw);
  if (!Number.isFinite(parsed) || parsed <= 0) return getEnvHardCapMaxFileSizeBytes();

  return parsed;
};

const getConfiguredHardCapMaxFileSizeBytes = async () => {
  const raw = await globalSettingsService.getSettingValue(MAX_FILE_SIZE_HARD_CAP_SETTING_KEY, null);
  if (raw === null || raw === undefined || raw === '') return null;

  const parsed = Number(raw);
  if (!Number.isFinite(parsed) || parsed <= 0) return null;

  return parsed;
};

const normalizePayload = (namespaceKey, payload) => {
  const enabled = payload?.enabled === undefined ? true : Boolean(payload.enabled);

  let maxFileSizeBytes = payload?.maxFileSizeBytes;
  if (maxFileSizeBytes === undefined || maxFileSizeBytes === null || maxFileSizeBytes === '') {
    maxFileSizeBytes = undefined;
  }
  if (maxFileSizeBytes !== undefined) {
    maxFileSizeBytes = Number(maxFileSizeBytes);
    if (!Number.isFinite(maxFileSizeBytes) || maxFileSizeBytes <= 0) {
      maxFileSizeBytes = undefined;
    }
  }

  const normalizeArray = (value) => {
    if (value === undefined) return undefined;
    if (value === null) return [];
    if (Array.isArray(value)) return value.map(String).filter(Boolean);
    return [String(value)].filter(Boolean);
  };

  const allowedContentTypes = normalizeArray(payload?.allowedContentTypes);

  const defaultVisibility = payload?.defaultVisibility ? String(payload.defaultVisibility) : undefined;
  const enforceVisibility = payload?.enforceVisibility === undefined ? false : Boolean(payload.enforceVisibility);

  const keyPrefix = payload?.keyPrefix !== undefined ? String(payload.keyPrefix || '') : undefined;

  return {
    key: String(namespaceKey),
    enabled,
    maxFileSizeBytes,
    allowedContentTypes,
    keyPrefix,
    defaultVisibility,
    enforceVisibility,
  };
};

const getSettingKey = (namespaceKey) => `${UPLOAD_NAMESPACE_PREFIX}${namespaceKey}`;

const getDefaultNamespaceConfig = (hardCapMaxFileSizeBytes) => {
  const hardCap = hardCapMaxFileSizeBytes ?? getEnvHardCapMaxFileSizeBytes();
  return {
    key: 'default',
    enabled: true,
    maxFileSizeBytes: hardCap,
    allowedContentTypes: objectStorage.getAllowedContentTypes(),
    keyPrefix: undefined,
    defaultVisibility: 'private',
    enforceVisibility: false,
  };
};

const mergeWithDefault = (config, fallback) => {
  const base = fallback || getDefaultNamespaceConfig();

  const allowedContentTypes =
    config.allowedContentTypes === undefined ? base.allowedContentTypes : config.allowedContentTypes;

  const keyPrefix = config.keyPrefix === undefined ? base.keyPrefix : config.keyPrefix;

  const defaultVisibility = config.defaultVisibility === undefined ? base.defaultVisibility : config.defaultVisibility;

  return {
    ...base,
    ...config,
    allowedContentTypes,
    keyPrefix,
    defaultVisibility,
  };
};

async function listNamespaces() {
  const settings = await GlobalSetting.find({
    key: { $regex: `^${UPLOAD_NAMESPACE_PREFIX}` },
    type: 'json',
  })
    .sort({ key: 1 })
    .lean();

  return settings.map((s) => {
    const namespaceKey = stripPrefix(s.key);
    const raw = parseJson(s.value);
    const normalized = normalizePayload(namespaceKey, raw);
    const merged = mergeWithDefault(normalized);

    return {
      ...merged,
      createdAt: s.createdAt,
      updatedAt: s.updatedAt,
    };
  });
}

async function resolveNamespace(namespaceKey) {
  const requested = namespaceKey ? String(namespaceKey).trim() : '';
  const key = requested || 'default';

  const effectiveHardCap = await getEffectiveHardCapMaxFileSizeBytes();

  if (key === 'default') {
    try {
      const value = await globalSettingsService.getSettingValue(getSettingKey('default'), null);
      if (!value) return getDefaultNamespaceConfig(effectiveHardCap);

      const raw = parseJson(value);
      const normalized = normalizePayload('default', raw);
      const merged = mergeWithDefault(normalized, getDefaultNamespaceConfig(effectiveHardCap));
      const clamped = {
        ...merged,
        maxFileSizeBytes: Math.min(merged.maxFileSizeBytes ?? effectiveHardCap, effectiveHardCap),
      };
      return clamped.enabled ? clamped : getDefaultNamespaceConfig(effectiveHardCap);
    } catch {
      return getDefaultNamespaceConfig(effectiveHardCap);
    }
  }

  const rawValue = await globalSettingsService.getSettingValue(getSettingKey(key), null);
  if (!rawValue) {
    return resolveNamespace('default');
  }

  const raw = parseJson(rawValue);
  const normalized = normalizePayload(key, raw);
  const merged = mergeWithDefault(normalized, getDefaultNamespaceConfig(effectiveHardCap));

  const clamped = {
    ...merged,
    maxFileSizeBytes: Math.min(merged.maxFileSizeBytes ?? effectiveHardCap, effectiveHardCap),
  };

  if (!clamped.enabled) {
    return resolveNamespace('default');
  }

  return clamped;
}

async function upsertNamespace(namespaceKey, payload) {
  const key = String(namespaceKey || '').trim();
  if (!key) {
    const err = new Error('namespaceKey is required');
    err.code = 'VALIDATION_ERROR';
    throw err;
  }

  const normalized = normalizePayload(key, payload || {});
  const settingKey = getSettingKey(key);

  const existing = await GlobalSetting.findOne({ key: settingKey, type: 'json' });

  const setting = existing
    ? await GlobalSetting.findOneAndUpdate(
        { key: settingKey, type: 'json' },
        { $set: { value: JSON.stringify(normalized) } },
        { new: true }
      )
    : await GlobalSetting.create({
        key: settingKey,
        type: 'json',
        public: false,
        description: `Upload namespace: ${key}`,
        value: JSON.stringify(normalized),
      });

  globalSettingsService.clearSettingsCache();

  const resolved = await resolveNamespace(key);
  return {
    ...resolved,
    createdAt: setting.createdAt,
    updatedAt: setting.updatedAt,
  };
}

function validateUpload({ namespaceConfig, contentType, sizeBytes, hardCapMaxFileSizeBytes }) {
  const errors = [];

  const hardCap = hardCapMaxFileSizeBytes ?? getEnvHardCapMaxFileSizeBytes();
  const maxSize = Math.min(namespaceConfig?.maxFileSizeBytes ?? hardCap, hardCap);
  if (typeof sizeBytes === 'number' && sizeBytes > maxSize) {
    errors.push({ field: 'sizeBytes', reason: 'File too large', maxFileSizeBytes: maxSize });
  }

  const normalizeAllowedEntry = (entry) => {
    if (entry === undefined || entry === null) return '';
    return String(entry).trim().toLowerCase();
  };

  const matchesAllowedContentType = (allowedEntry, actualContentType) => {
    const allowedNormalized = normalizeAllowedEntry(allowedEntry);
    const actualNormalized = normalizeAllowedEntry(actualContentType);

    if (!allowedNormalized || !actualNormalized) return false;

    // Exact match: image/png
    if (allowedNormalized === actualNormalized) return true;

    // Wildcard match: image/*
    if (allowedNormalized.endsWith('/*')) {
      const prefix = allowedNormalized.slice(0, -1); // keep trailing '/'
      return actualNormalized.startsWith(prefix);
    }

    // Shorthand: image, video, audio, application
    if (!allowedNormalized.includes('/')) {
      return actualNormalized.startsWith(`${allowedNormalized}/`);
    }

    return false;
  };

  const allowed = namespaceConfig?.allowedContentTypes;
  if (Array.isArray(allowed) && allowed.length > 0) {
    const ok = allowed.some((entry) => matchesAllowedContentType(entry, contentType));
    if (!ok) {
      errors.push({ field: 'contentType', reason: 'Invalid file type', allowedContentTypes: allowed });
    }
  }

  return {
    ok: errors.length === 0,
    errors,
  };
}

function computeVisibility({ namespaceConfig, requestedVisibility }) {
  const requested = requestedVisibility === 'public' ? 'public' : requestedVisibility === 'private' ? 'private' : null;

  const defaultVis = namespaceConfig?.defaultVisibility === 'public' ? 'public' : 'private';

  if (namespaceConfig?.enforceVisibility) {
    return defaultVis;
  }

  return requested || defaultVis;
}

function computeKeyPrefix(namespaceConfig) {
  const prefix = namespaceConfig?.keyPrefix;
  const namespaceKey = namespaceConfig?.key ? String(namespaceConfig.key).trim() : 'default';
  const safeNamespaceKey = namespaceKey ? namespaceKey.replace(/^\/+/, '').replace(/\/+$/, '') : 'default';

  if (prefix === undefined || prefix === null) return `assets/${safeNamespaceKey}`;
  const trimmed = String(prefix).trim();
  return trimmed ? trimmed.replace(/^\/+/, '').replace(/\/+$/, '') : `assets/${safeNamespaceKey}`;
}

function generateObjectKey({ namespaceConfig, originalName }) {
  const prefix = computeKeyPrefix(namespaceConfig);
  return objectStorage.generateKey(originalName, prefix);
}

module.exports = {
  UPLOAD_NAMESPACE_PREFIX,
  MAX_FILE_SIZE_HARD_CAP_SETTING_KEY,
  DEFAULT_MAX_FILE_SIZE_BYTES,
  getEnvHardCapMaxFileSizeBytes,
  getEffectiveHardCapMaxFileSizeBytes,
  getConfiguredHardCapMaxFileSizeBytes,
  getDefaultNamespaceConfig,
  normalizePayload,
  getSettingKey,
  listNamespaces,
  resolveNamespace,
  upsertNamespace,
  validateUpload,
  computeVisibility,
  generateObjectKey,
  computeKeyPrefix,
};
