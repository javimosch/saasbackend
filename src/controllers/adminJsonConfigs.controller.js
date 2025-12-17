const {
  listJsonConfigs,
  getJsonConfigById,
  createJsonConfig,
  updateJsonConfig,
  regenerateJsonConfigSlug,
  deleteJsonConfig,
  clearJsonConfigCache,
} = require('../services/jsonConfigs.service');

function handleServiceError(res, error) {
  const msg = error?.message || 'Operation failed';
  const code = error?.code;

  if (code === 'VALIDATION' || code === 'INVALID_JSON') {
    return res.status(400).json({ error: msg });
  }
  if (code === 'NOT_FOUND') {
    return res.status(404).json({ error: msg });
  }

  return res.status(500).json({ error: msg });
}

exports.list = async (req, res) => {
  try {
    const items = await listJsonConfigs();
    return res.json({ items });
  } catch (error) {
    console.error('Error listing JSON configs:', error);
    return handleServiceError(res, error);
  }
};

exports.get = async (req, res) => {
  try {
    const item = await getJsonConfigById(req.params.id);
    if (!item) return res.status(404).json({ error: 'JSON config not found' });
    return res.json({ item });
  } catch (error) {
    console.error('Error fetching JSON config:', error);
    return handleServiceError(res, error);
  }
};

exports.create = async (req, res) => {
  try {
    const item = await createJsonConfig(req.body || {});
    return res.status(201).json({ item });
  } catch (error) {
    console.error('Error creating JSON config:', error);
    return handleServiceError(res, error);
  }
};

exports.update = async (req, res) => {
  try {
    const item = await updateJsonConfig(req.params.id, req.body || {});
    return res.json({ item });
  } catch (error) {
    console.error('Error updating JSON config:', error);
    return handleServiceError(res, error);
  }
};

exports.regenerateSlug = async (req, res) => {
  try {
    const item = await regenerateJsonConfigSlug(req.params.id);
    return res.json({ item });
  } catch (error) {
    console.error('Error regenerating JSON config slug:', error);
    return handleServiceError(res, error);
  }
};

exports.clearCache = async (req, res) => {
  try {
    const item = await getJsonConfigById(req.params.id);
    if (!item) return res.status(404).json({ error: 'JSON config not found' });

    clearJsonConfigCache(item.slug);
    return res.json({ success: true });
  } catch (error) {
    console.error('Error clearing JSON config cache:', error);
    return handleServiceError(res, error);
  }
};

exports.remove = async (req, res) => {
  try {
    const result = await deleteJsonConfig(req.params.id);
    return res.json(result);
  } catch (error) {
    console.error('Error deleting JSON config:', error);
    return handleServiceError(res, error);
  }
};
