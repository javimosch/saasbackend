const { getJsonConfigPublicPayload } = require('../services/jsonConfigs.service');

exports.getPublic = async (req, res) => {
  try {
    const slug = String(req.params.slug || '').trim();
    const raw = req.query?.raw === 'true' || req.query?.raw === '1';

    const payload = await getJsonConfigPublicPayload(slug, { raw });
    return res.json(payload);
  } catch (error) {
    const code = error?.code;
    if (code === 'NOT_FOUND') {
      return res.status(404).json({ error: 'Not found' });
    }

    console.error('Error fetching public JSON config:', error);
    return res.status(500).json({ error: error?.message || 'Failed to fetch config' });
  }
};
