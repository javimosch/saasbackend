const i18nService = require('../services/i18n.service');

exports.getBundle = async (req, res) => {
  try {
    const locale = req.query.locale;
    const bundle = await i18nService.getBundle(locale);
    res.json(bundle);
  } catch (error) {
    console.error('Error building i18n bundle:', error);
    res.status(500).json({ error: 'Failed to build i18n bundle' });
  }
};
