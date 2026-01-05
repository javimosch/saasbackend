const objectStorage = require('../objectStorage.service');

const { createFsLocalEndpoint } = require('./fsLocal');
const { createS3Endpoint } = require('./s3');
const { createSftpEndpoint } = require('./sftp');

function normalizeType(raw) {
  return String(raw || '').trim().toLowerCase();
}

async function resolveSourceEndpoint() {
  const active = await objectStorage.getActiveBackend();
  if (active === 's3') {
    const cfg = await objectStorage.getS3Config();
    if (!cfg) {
      const err = new Error('Source S3 is not configured');
      err.code = 'SOURCE_S3_NOT_CONFIGURED';
      throw err;
    }
    return createS3Endpoint(cfg);
  }

  return createFsLocalEndpoint({ baseDir: process.env.UPLOAD_DIR || 'uploads' });
}

async function resolveTargetEndpointFromEnvConfig(envCfg) {
  const target = envCfg?.assets?.target || null;
  if (!target) return null;

  const type = normalizeType(target.type);
  if (type === 'fs_local') {
    return createFsLocalEndpoint({ baseDir: target?.fs?.baseDir || process.env.UPLOAD_DIR || 'uploads' });
  }
  if (type === 'fs_remote') {
    return createSftpEndpoint({
      host: target?.ssh?.host,
      port: target?.ssh?.port,
      username: target?.ssh?.username,
      privateKeyPem: target?.ssh?.privateKeyPem,
      passphrase: target?.ssh?.passphrase,
      baseDir: target?.ssh?.baseDir,
    });
  }
  if (type === 's3') {
    return createS3Endpoint({
      endpoint: target?.s3?.endpoint,
      region: target?.s3?.region,
      bucket: target?.s3?.bucket,
      accessKeyId: target?.s3?.accessKeyId,
      secretAccessKey: target?.s3?.secretAccessKey,
      forcePathStyle: target?.s3?.forcePathStyle,
    });
  }

  const err = new Error('Unsupported assets target type');
  err.code = 'UNSUPPORTED_ASSETS_TARGET';
  throw err;
}

function normalizeKey(key) {
  let s = String(key || '').trim();
  while (s.startsWith('/')) s = s.slice(1);
  if (s.startsWith('uploads/')) s = s.slice('uploads/'.length);
  return s;
}

async function copyKeys({ keys, sourceEndpoint, targetEndpoint, dryRun = false, batchSize = 10 } = {}) {
  const list = Array.isArray(keys) ? keys.map((k) => normalizeKey(k)).filter(Boolean) : [];

  const result = {
    ok: true,
    requested: list.length,
    copied: 0,
    skipped: 0,
    failed: [],
    dryRun: Boolean(dryRun),
    targetType: targetEndpoint?.type || null,
    sourceType: sourceEndpoint?.type || null,
    details: [],
  };

  for (let i = 0; i < list.length; i += batchSize) {
    const slice = list.slice(i, i + batchSize);
    await Promise.all(slice.map(async (key) => {
      try {
        const obj = await sourceEndpoint.getObject({ key });
        if (!obj?.body) {
          result.failed.push({
            key,
            error: 'Source object not found',
            sourcePath: sourceEndpoint.describeKey ? sourceEndpoint.describeKey(key) : null,
            targetPath: targetEndpoint.describeKey ? targetEndpoint.describeKey(key) : null,
          });
          result.ok = false;
          return;
        }
        if (dryRun) {
          result.skipped += 1;
          result.details.push({
            key,
            status: 'skipped',
            sourcePath: sourceEndpoint.describeKey ? sourceEndpoint.describeKey(key) : null,
            targetPath: targetEndpoint.describeKey ? targetEndpoint.describeKey(key) : null,
          });
          return;
        }
        await targetEndpoint.putObject({ key, body: obj.body, contentType: obj.contentType || null });
        result.copied += 1;
        result.details.push({
          key,
          status: 'copied',
          sourcePath: sourceEndpoint.describeKey ? sourceEndpoint.describeKey(key) : null,
          targetPath: targetEndpoint.describeKey ? targetEndpoint.describeKey(key) : null,
        });
      } catch (e) {
        result.failed.push({
          key,
          error: e?.message ? String(e.message) : 'Copy failed',
          sourcePath: sourceEndpoint.describeKey ? sourceEndpoint.describeKey(key) : null,
          targetPath: targetEndpoint.describeKey ? targetEndpoint.describeKey(key) : null,
        });
        result.ok = false;
      }
    }));
  }

  return result;
}

module.exports = {
  resolveSourceEndpoint,
  resolveTargetEndpointFromEnvConfig,
  copyKeys,
};
