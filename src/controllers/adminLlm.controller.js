const GlobalSetting = require("../models/GlobalSetting");
const AuditEvent = require("../models/AuditEvent");
const llmService = require("../services/llm.service");
const { encryptString } = require("../utils/encryption");

const PROVIDERS_KEY = "llm.providers";
const PROMPTS_KEY = "llm.prompts";

async function getJsonSetting(key, defaultValue) {
  const doc = await GlobalSetting.findOne({ key }).lean();
  if (!doc || !doc.value) return defaultValue;
  try {
    const parsed = JSON.parse(doc.value);
    return parsed || defaultValue;
  } catch (e) {
    return defaultValue;
  }
}

async function setJsonSetting(key, value) {
  const descriptions = {
    [PROVIDERS_KEY]: "LLM providers configuration (JSON)",
    [PROMPTS_KEY]: "LLM prompts configuration (JSON)",
  };
  const description = descriptions[key] || `LLM setting ${key}`;
  const stringValue = JSON.stringify(value || {});
  const existing = await GlobalSetting.findOne({ key });
  if (existing) {
    existing.value = stringValue;
    existing.type = "json";
    if (!existing.description) {
      existing.description = description;
    }
    await existing.save();
    return existing;
  }
  const created = new GlobalSetting({
    key,
    value: stringValue,
    type: "json",
    description,
  });
  await created.save();
  return created;
}

async function getConfig(req, res) {
  try {
    const providers = await getJsonSetting(PROVIDERS_KEY, {});
    const prompts = await getJsonSetting(PROMPTS_KEY, {});
    const safeProviders = {};
    if (providers && typeof providers === "object") {
      for (const [key, value] of Object.entries(providers)) {
        if (!value || typeof value !== "object") continue;
        const { apiKey, ...rest } = value;
        safeProviders[key] = rest;
      }
    }
    res.json({ providers: safeProviders, prompts });
  } catch (error) {
    console.error("[adminLlm] getConfig error", error);
    res.status(500).json({ error: "Failed to load LLM configuration" });
  }
}

async function saveConfig(req, res) {
  try {
    const body = req.body || {};
    const providers = body.providers && typeof body.providers === "object" ? body.providers : {};
    const prompts = body.prompts && typeof body.prompts === "object" ? body.prompts : {};

    const storedProviders = {};
    for (const [key, value] of Object.entries(providers)) {
      if (!value || typeof value !== "object") continue;
      const clone = { ...value };
      const rawApiKey = typeof clone.apiKey === "string" ? clone.apiKey.trim() : "";
      delete clone.apiKey;
      storedProviders[key] = clone;

      if (rawApiKey) {
        const encrypted = encryptString(rawApiKey);
        const settingKey = `llm.provider.${key}.apiKey`;
        let doc = await GlobalSetting.findOne({ key: settingKey });
        if (!doc) {
          doc = new GlobalSetting({
            key: settingKey,
            description: `Encrypted API key for LLM provider ${key}`,
            type: "encrypted",
            value: JSON.stringify(encrypted),
          });
        } else {
          if (!doc.description) {
            doc.description = `Encrypted API key for LLM provider ${key}`;
          }
          doc.type = "encrypted";
          doc.value = JSON.stringify(encrypted);
        }
        await doc.save();
      }
    }

    await setJsonSetting(PROVIDERS_KEY, storedProviders);
    await setJsonSetting(PROMPTS_KEY, prompts);

    res.json({ success: true });
  } catch (error) {
    console.error("[adminLlm] saveConfig error", error);
    res.status(500).json({ error: "Failed to save LLM configuration" });
  }
}

async function testPrompt(req, res) {
  try {
    const promptKey = String(req.params.key || "");
    const { variables, options } = req.body || {};

    const result = await llmService.testPrompt(
      { key: promptKey },
      variables || {},
      options || {},
    );

    res.json({ result });
  } catch (error) {
    console.error("[adminLlm] testPrompt error", error);
    res.status(500).json({ error: error.message || "Failed to test prompt" });
  }
}

async function listAudit(req, res) {
  try {
    const page = Math.max(parseInt(req.query.page, 10) || 1, 1);
    const pageSize = Math.min(Math.max(parseInt(req.query.pageSize, 10) || 20, 1), 200);
    const promptKey = String(req.query.promptKey || "").trim();
    const providerKey = String(req.query.providerKey || "").trim();
    const status = String(req.query.status || "").trim();

    const query = { action: "llm.completion" };

    if (status === "success" || status === "failure") {
      query.outcome = status;
    }

    if (promptKey) {
      query["meta.promptKey"] = promptKey;
    }

    if (providerKey) {
      query["meta.providerKey"] = providerKey;
    }

    const total = await AuditEvent.countDocuments(query);
    const items = await AuditEvent.find(query)
      .sort({ createdAt: -1 })
      .skip((page - 1) * pageSize)
      .limit(pageSize)
      .lean();

    res.json({
      page,
      pageSize,
      total,
      items,
    });
  } catch (error) {
    console.error("[adminLlm] listAudit error", error);
    res.status(500).json({ error: "Failed to load LLM audit entries" });
  }
}

function computeCostFromPricing({ prompt_tokens, completion_tokens }, modelPricing) {
  if (!modelPricing || typeof modelPricing !== "object") return null;

  const promptTokens = Number(prompt_tokens);
  const completionTokens = Number(completion_tokens);
  if (!Number.isFinite(promptTokens) && !Number.isFinite(completionTokens)) return null;

  const inRate = Number(modelPricing.costPerMillionIn);
  const outRate = Number(modelPricing.costPerMillionOut);
  if (!Number.isFinite(inRate) && !Number.isFinite(outRate)) return null;

  const costIn = Number.isFinite(promptTokens) && Number.isFinite(inRate)
    ? (promptTokens / 1_000_000) * inRate
    : 0;
  const costOut = Number.isFinite(completionTokens) && Number.isFinite(outRate)
    ? (completionTokens / 1_000_000) * outRate
    : 0;

  const total = costIn + costOut;
  return Number.isFinite(total) ? total : null;
}

async function listCosts(req, res) {
  try {
    const page = Math.max(parseInt(req.query.page, 10) || 1, 1);
    const pageSize = Math.min(Math.max(parseInt(req.query.pageSize, 10) || 20, 1), 200);
    const promptKey = String(req.query.promptKey || "").trim();
    const providerKey = String(req.query.providerKey || "").trim();
    const model = String(req.query.model || "").trim();

    const query = { action: "llm.completion", outcome: "success" };
    if (promptKey) query["meta.promptKey"] = promptKey;
    if (providerKey) query["meta.providerKey"] = providerKey;
    if (model) query["meta.model"] = model;

    const providers = await getJsonSetting(PROVIDERS_KEY, {});

    const total = await AuditEvent.countDocuments(query);
    const items = await AuditEvent.find(query)
      .sort({ createdAt: -1 })
      .skip((page - 1) * pageSize)
      .limit(pageSize)
      .lean();

    const normalizedItems = (items || []).map((ev) => {
      const meta = ev.meta || {};
      const usage = meta.usage && typeof meta.usage === "object" ? { ...meta.usage } : null;

      const promptTokens = usage ? usage.prompt_tokens : null;
      const completionTokens = usage ? usage.completion_tokens : null;
      const totalTokens = usage ? usage.total_tokens : null;
      const existingCost = usage ? usage.cost : undefined;

      let cost = existingCost;
      let costSource = usage ? usage.cost_source : undefined;

      if ((cost === undefined || cost === null) && usage) {
        const p = providers && typeof providers === "object" ? providers[meta.providerKey] : null;
        const modelPricing = p && typeof p === "object" && p.modelPricing && typeof p.modelPricing === "object"
          ? p.modelPricing[meta.model]
          : null;
        const computed = modelPricing
          ? computeCostFromPricing(usage, modelPricing)
          : null;
        if (computed !== null) {
          cost = computed;
          costSource = costSource || "computed_current";
        }
      }

      return {
        id: ev._id,
        createdAt: ev.createdAt,
        promptKey: meta.promptKey,
        providerKey: meta.providerKey,
        model: meta.model,
        prompt_tokens: promptTokens,
        completion_tokens: completionTokens,
        total_tokens: totalTokens,
        cost,
        cost_source: costSource,
      };
    });

    res.json({
      page,
      pageSize,
      total,
      items: normalizedItems,
    });
  } catch (error) {
    console.error("[adminLlm] listCosts error", error);
    res.status(500).json({ error: "Failed to load LLM cost entries" });
  }
}

module.exports = {
  getConfig,
  saveConfig,
  testPrompt,
  listAudit,
  listCosts,
};
