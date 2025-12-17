const Asset = require('../models/Asset');
const objectStorage = require('./objectStorage.service');

async function getAssetById(id, { status = 'uploaded' } = {}) {
  const asset = await Asset.findById(id);
  if (!asset) {
    const err = new Error('Asset not found');
    err.code = 'NOT_FOUND';
    throw err;
  }

  if (status && asset.status !== status) {
    const err = new Error('Asset not found');
    err.code = 'NOT_FOUND';
    throw err;
  }

  return asset.toObject();
}

async function getAssetByKey(key, { status = 'uploaded' } = {}) {
  const asset = await Asset.findOne({ key: String(key || '').trim() });
  if (!asset) {
    const err = new Error('Asset not found');
    err.code = 'NOT_FOUND';
    throw err;
  }

  if (status && asset.status !== status) {
    const err = new Error('Asset not found');
    err.code = 'NOT_FOUND';
    throw err;
  }

  return asset.toObject();
}

async function listAssets({
  namespace,
  tag,
  visibility,
  status = 'uploaded',
  page = 1,
  limit = 50,
} = {}) {
  const normalizedLimit = Math.min(100, Math.max(1, Number(limit) || 50));
  const normalizedPage = Math.max(1, Number(page) || 1);
  const skip = (normalizedPage - 1) * normalizedLimit;

  const filter = {};
  if (status) filter.status = status;
  if (namespace) filter.namespace = String(namespace);
  if (visibility) filter.visibility = String(visibility);
  if (tag) filter.tags = String(tag).trim().toLowerCase();

  const [assets, total] = await Promise.all([
    Asset.find(filter).sort({ createdAt: -1 }).skip(skip).limit(normalizedLimit).lean(),
    Asset.countDocuments(filter),
  ]);

  return {
    assets,
    pagination: {
      page: normalizedPage,
      limit: normalizedLimit,
      total,
      pages: Math.ceil(total / normalizedLimit),
    },
  };
}

async function getAssetBytesById(id, { status = 'uploaded' } = {}) {
  const asset = await getAssetById(id, { status });
  const result = await objectStorage.getObject({ key: asset.key });
  if (!result || !result.body) {
    const err = new Error('File not found in storage');
    err.code = 'NOT_FOUND';
    throw err;
  }

  return {
    asset,
    contentType: result.contentType || asset.contentType,
    body: result.body,
  };
}

async function getAssetBytesByKey(key, { status = 'uploaded' } = {}) {
  const asset = await getAssetByKey(key, { status });
  const result = await objectStorage.getObject({ key: asset.key });
  if (!result || !result.body) {
    const err = new Error('File not found in storage');
    err.code = 'NOT_FOUND';
    throw err;
  }

  return {
    asset,
    contentType: result.contentType || asset.contentType,
    body: result.body,
  };
}

module.exports = {
  getAssetById,
  getAssetByKey,
  listAssets,
  getAssetBytesById,
  getAssetBytesByKey,
};
