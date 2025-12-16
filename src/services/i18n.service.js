const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const I18nLocale = require('../models/I18nLocale');
const I18nEntry = require('../models/I18nEntry');
const { getSettingValue } = require('./globalSettings.service');
const { createAuditEvent } = require('./audit.service');

const cache = new Map();
const CACHE_TTL = 30000;

function stableStringify(value) {
  if (value === null || value === undefined) return '';
  if (typeof value === 'string') return value;
  return JSON.stringify(value);
}

function sha256Base64(value) {
  return crypto.createHash('sha256').update(String(value), 'utf8').digest('base64');
}

function flattenJson(obj, prefix = '', out = {}) {
  if (obj === null || obj === undefined) {
    return out;
  }

  if (typeof obj !== 'object' || Array.isArray(obj)) {
    out[prefix] = stableStringify(obj);
    return out;
  }

  for (const [k, v] of Object.entries(obj)) {
    const nextPrefix = prefix ? `${prefix}.${k}` : k;
    if (v !== null && typeof v === 'object' && !Array.isArray(v)) {
      flattenJson(v, nextPrefix, out);
    } else {
      out[nextPrefix] = stableStringify(v);
    }
  }

  return out;
}

function interpolate(template, vars = {}) {
  const str = String(template || '');
  return str.replace(/\{([a-zA-Z0-9_\-\.]+)\}/g, (match, key) => {
    if (Object.prototype.hasOwnProperty.call(vars, key)) {
      return String(vars[key]);
    }
    return match;
  });
}

async function getDefaultLocaleCode() {
  const envDefault = process.env.I18N_DEFAULT_LOCALE;
  if (envDefault) return envDefault;

  const fromSettings = await getSettingValue('i18n.defaultLocale', null);
  if (fromSettings) return fromSettings;

  const localeDoc = await I18nLocale.findOne({ isDefault: true }).lean();
  if (localeDoc?.code) return localeDoc.code;

  const anyEnabled = await I18nLocale.findOne({ enabled: true }).sort({ code: 1 }).lean();
  if (anyEnabled?.code) return anyEnabled.code;

  return 'en';
}

function resolveLocaleFromRequest(req) {
  const cookieHeader = req.headers?.cookie;
  if (typeof cookieHeader === 'string' && cookieHeader.length > 0) {
    const parts = cookieHeader.split(';').map((p) => p.trim());
    for (const part of parts) {
      const idx = part.indexOf('=');
      if (idx === -1) continue;
      const k = part.slice(0, idx).trim();
      const v = part.slice(idx + 1).trim();
      if (k === 'lang' && v) {
        try {
          return decodeURIComponent(v);
        } catch (e) {
          return v;
        }
      }
    }
  }

  const queryLocale = req.query?.lang;
  if (queryLocale) return queryLocale;

  const header = req.headers['accept-language'];
  if (typeof header === 'string' && header.length > 0) {
    const primary = header.split(',')[0].trim();
    if (primary) return primary.split(';')[0].trim();
  }

  return null;
}

async function getBundle(locale) {
  const effectiveLocale = locale || (await getDefaultLocaleCode());

  const cached = cache.get(`bundle:${effectiveLocale}`);
  if (cached && Date.now() - cached.timestamp < CACHE_TTL) {
    return cached.value;
  }

  const entries = await I18nEntry.find({ locale: effectiveLocale }).select('key value').lean();
  const map = {};
  for (const e of entries) {
    map[e.key] = e.value;
  }

  const value = {
    locale: effectiveLocale,
    defaultLocale: await getDefaultLocaleCode(),
    entries: map,
  };

  cache.set(`bundle:${effectiveLocale}`, { value, timestamp: Date.now() });
  return value;
}

async function t({ key, locale, vars, html, defaultValue }) {
  const effectiveLocale = locale || (await getDefaultLocaleCode());
  const defaultLocale = await getDefaultLocaleCode();

  const cacheKey = `entry:${effectiveLocale}:${key}`;
  const cached = cache.get(cacheKey);
  if (cached && Date.now() - cached.timestamp < CACHE_TTL) {
    const value = cached.value;
    const text = interpolate(value?.value ?? defaultValue ?? key, vars);
    return { text, html: html === true || value?.valueFormat === 'html' };
  }

  let entry = await I18nEntry.findOne({ key, locale: effectiveLocale }).lean();
  if (!entry && defaultLocale && defaultLocale !== effectiveLocale) {
    entry = await I18nEntry.findOne({ key, locale: defaultLocale }).lean();
  }

  cache.set(cacheKey, { value: entry || null, timestamp: Date.now() });
  const text = interpolate(entry?.value ?? defaultValue ?? key, vars);
  return { text, html: html === true || entry?.valueFormat === 'html' };
}

function clearI18nCache() {
  cache.clear();
}

async function ensureLocalesExist(locales) {
  const existing = await I18nLocale.find({ code: { $in: locales } }).lean();
  const existingSet = new Set(existing.map((l) => l.code));

  const toCreate = locales
    .filter((c) => !existingSet.has(c))
    .map((code) => ({ code, name: code.toUpperCase(), enabled: true, isDefault: false }));

  if (toCreate.length > 0) {
    await I18nLocale.insertMany(toCreate);
  }

  const hasDefault = await I18nLocale.findOne({ isDefault: true }).lean();
  if (!hasDefault) {
    const first = locales[0];
    if (first) {
      await I18nLocale.updateOne({ code: first }, { $set: { isDefault: true } });
      await I18nLocale.updateMany({ code: { $ne: first } }, { $set: { isDefault: false } });
    }
  }
}

async function seedFromJsonFiles({
  baseDir,
  locales,
  seedVersion,
  actorType = 'system',
  actorId = null,
}) {
  if (!baseDir) {
    throw new Error('baseDir is required');
  }
  if (!Array.isArray(locales) || locales.length === 0) {
    throw new Error('locales is required');
  }

  await ensureLocalesExist(locales);

  const summary = {
    inserted: 0,
    updated: 0,
    skippedEdited: 0,
    skippedExists: 0,
    locales: {},
  };

  for (const locale of locales) {
    const filePath = path.join(baseDir, `${locale}.json`);
    const raw = fs.readFileSync(filePath, 'utf8');
    const json = JSON.parse(raw);
    const flat = flattenJson(json);

    summary.locales[locale] = { inserted: 0, updated: 0, skippedEdited: 0, skippedExists: 0 };

    for (const [key, value] of Object.entries(flat)) {
      const nextSeedHash = sha256Base64(value);
      const existing = await I18nEntry.findOne({ key, locale });

      if (!existing) {
        await I18nEntry.create({
          key,
          locale,
          value,
          valueFormat: 'text',
          source: 'seed',
          seeded: true,
          seedHash: nextSeedHash,
          seedVersion: seedVersion || null,
          edited: false,
        });
        summary.inserted += 1;
        summary.locales[locale].inserted += 1;
        continue;
      }

      if (existing.edited === true) {
        summary.skippedEdited += 1;
        summary.locales[locale].skippedEdited += 1;
        continue;
      }

      if (existing.seeded === true) {
        existing.value = value;
        existing.seedHash = nextSeedHash;
        existing.seedVersion = seedVersion || existing.seedVersion || null;
        existing.source = 'seed';
        await existing.save();
        summary.updated += 1;
        summary.locales[locale].updated += 1;
        continue;
      }

      summary.skippedExists += 1;
      summary.locales[locale].skippedExists += 1;
    }

    clearI18nCache();
  }

  await createAuditEvent({
    actorType,
    actorId,
    action: 'i18n.seed',
    entityType: 'I18nEntry',
    entityId: null,
    before: null,
    after: summary,
    meta: { locales, seedVersion: seedVersion || null },
  });

  return summary;
}

function createI18nMiddleware() {
  return async (req, res, next) => {
    try {
      const resolved = resolveLocaleFromRequest(req);
      const defaultLocale = await getDefaultLocaleCode();
      const locale = resolved || defaultLocale;

      res.locals.locale = locale;
      res.locals.defaultLocale = defaultLocale;

      const bundle = await getBundle(locale);
      const defaultBundle =
        defaultLocale && defaultLocale !== locale
          ? await getBundle(defaultLocale)
          : bundle;

      res.locals.t = (key, vars, opts) => {
        const useLocale = opts?.locale || locale;
        const useBundle = useLocale === locale ? bundle : null;
        const useDefaultBundle =
          defaultLocale && useLocale !== defaultLocale ? defaultBundle : defaultBundle;

        const raw =
          useBundle?.entries?.[key] ??
          useDefaultBundle?.entries?.[key] ??
          opts?.defaultValue ??
          key;

        return interpolate(raw, vars || {});
      };

      next();
    } catch (e) {
      next(e);
    }
  };
}

module.exports = {
  getDefaultLocaleCode,
  resolveLocaleFromRequest,
  getBundle,
  t,
  clearI18nCache,
  seedFromJsonFiles,
  createI18nMiddleware,
  interpolate,
  flattenJson,
  sha256Base64,
};
