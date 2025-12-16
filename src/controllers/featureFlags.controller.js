const {
  evaluateAllForRequest,
  flagsArrayToMap,
} = require('../services/featureFlags.service');

exports.getEvaluatedFlags = async (req, res) => {
  try {
    const userId = req.user?._id;
    const orgId = req.query.orgId || req.headers['x-org-id'] || null;
    const anonId = req.query.anonId || req.headers['x-anon-id'] || null;

    const flagsArray = await evaluateAllForRequest({ userId, orgId, anonId });
    const flags = flagsArrayToMap(flagsArray);

    res.json({ flags });
  } catch (error) {
    console.error('Error evaluating feature flags:', error);
    res.status(500).json({ error: 'Failed to evaluate feature flags' });
  }
};

exports.getPublicFlags = async (req, res) => {
  try {
    const orgId = req.query.orgId || req.headers['x-org-id'] || null;
    const anonId = req.query.anonId || req.headers['x-anon-id'] || null;

    const flagsArray = await evaluateAllForRequest({ userId: null, orgId, anonId });
    const flags = flagsArrayToMap(flagsArray);

    res.json({ flags });
  } catch (error) {
    console.error('Error evaluating public feature flags:', error);
    res.status(500).json({ error: 'Failed to evaluate feature flags' });
  }
};
