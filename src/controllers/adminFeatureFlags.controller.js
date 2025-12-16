const GlobalSetting = require('../models/GlobalSetting');
const { FEATURE_FLAG_PREFIX, stripPrefix } = require('../services/featureFlags.service');

const getSettingKey = (key) => `${FEATURE_FLAG_PREFIX}${key}`;

const parseJson = (value) => {
  if (!value) return {};
  if (typeof value === 'object') return value;
  try {
    return JSON.parse(value);
  } catch {
    return {};
  }
};

const normalizePayload = (payload) => {
  const enabled = Boolean(payload?.enabled);

  let rolloutPercentage = Number(payload?.rolloutPercentage ?? 0);
  if (Number.isNaN(rolloutPercentage)) rolloutPercentage = 0;
  rolloutPercentage = Math.max(0, Math.min(100, rolloutPercentage));

  const normalizeArray = (value) => {
    if (!value) return [];
    if (Array.isArray(value)) return value.map(String);
    return [String(value)];
  };

  return {
    description: payload?.description ? String(payload.description) : '',
    enabled,
    rolloutPercentage,
    allowListUserIds: normalizeArray(payload?.allowListUserIds),
    allowListOrgIds: normalizeArray(payload?.allowListOrgIds),
    denyListUserIds: normalizeArray(payload?.denyListUserIds),
    denyListOrgIds: normalizeArray(payload?.denyListOrgIds),
    payload: payload?.payload ?? null,
  };
};

const mapSettingToFlag = (setting) => {
  const raw = parseJson(setting?.value);
  const def = normalizePayload({ ...raw, description: raw?.description ?? setting?.description });

  return {
    key: stripPrefix(setting.key),
    ...def,
    createdAt: setting.createdAt,
    updatedAt: setting.updatedAt,
  };
};

exports.listFlags = async (req, res) => {
  try {
    const settings = await GlobalSetting.find({
      key: { $regex: `^${FEATURE_FLAG_PREFIX}` },
      type: 'json',
    })
      .sort({ key: 1 })
      .lean();

    res.json(settings.map(mapSettingToFlag));
  } catch (error) {
    console.error('Error listing feature flags:', error);
    res.status(500).json({ error: 'Failed to list feature flags' });
  }
};

exports.getFlag = async (req, res) => {
  try {
    const key = String(req.params.key);
    const setting = await GlobalSetting.findOne({ key: getSettingKey(key), type: 'json' }).lean();

    if (!setting) {
      return res.status(404).json({ error: `Feature flag '${key}' not found` });
    }

    res.json(mapSettingToFlag(setting));
  } catch (error) {
    console.error('Error fetching feature flag:', error);
    res.status(500).json({ error: 'Failed to fetch feature flag' });
  }
};

exports.createFlag = async (req, res) => {
  try {
    const key = req.body?.key ? String(req.body.key).trim() : '';
    if (!key) {
      return res.status(400).json({ error: 'key is required' });
    }

    const existing = await GlobalSetting.findOne({ key: getSettingKey(key) }).lean();
    if (existing) {
      return res.status(409).json({ error: `Feature flag '${key}' already exists` });
    }

    const def = normalizePayload(req.body || {});

    const setting = await GlobalSetting.create({
      key: getSettingKey(key),
      type: 'json',
      public: false,
      description: `Feature flag: ${key}`,
      value: JSON.stringify(def),
    });

    res.status(201).json(mapSettingToFlag(setting.toObject()));
  } catch (error) {
    console.error('Error creating feature flag:', error);
    res.status(500).json({ error: 'Failed to create feature flag' });
  }
};

exports.updateFlag = async (req, res) => {
  try {
    const key = String(req.params.key);
    const setting = await GlobalSetting.findOne({ key: getSettingKey(key), type: 'json' });

    if (!setting) {
      return res.status(404).json({ error: `Feature flag '${key}' not found` });
    }

    const current = parseJson(setting.value);
    const merged = {
      ...current,
      ...req.body,
    };

    const def = normalizePayload(merged);

    setting.value = JSON.stringify(def);
    await setting.save();

    res.json(mapSettingToFlag(setting.toObject()));
  } catch (error) {
    console.error('Error updating feature flag:', error);
    res.status(500).json({ error: 'Failed to update feature flag' });
  }
};

exports.deleteFlag = async (req, res) => {
  try {
    const key = String(req.params.key);
    const setting = await GlobalSetting.findOneAndDelete({ key: getSettingKey(key), type: 'json' }).lean();

    if (!setting) {
      return res.status(404).json({ error: `Feature flag '${key}' not found` });
    }

    res.json({ success: true });
  } catch (error) {
    console.error('Error deleting feature flag:', error);
    res.status(500).json({ error: 'Failed to delete feature flag' });
  }
};
