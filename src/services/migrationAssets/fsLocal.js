const fs = require('fs');
const path = require('path');

function ensureDir(dirPath) {
  if (!fs.existsSync(dirPath)) {
    fs.mkdirSync(dirPath, { recursive: true });
  }
}

function resolveBaseDir(baseDir) {
  const raw = String(baseDir || '').trim();
  if (!raw) return path.join(process.cwd(), process.env.UPLOAD_DIR || 'uploads');
  if (path.isAbsolute(raw)) return raw;
  return path.join(process.cwd(), raw);
}

function buildPath(baseDirAbs, key) {
  return path.join(baseDirAbs, key);
}

function createFsLocalEndpoint({ baseDir } = {}) {
  const baseDirAbs = resolveBaseDir(baseDir);

  return {
    type: 'fs_local',
    baseDir: baseDirAbs,

    async testWritable() {
      ensureDir(baseDirAbs);
      const testFile = path.join(baseDirAbs, `.__migration_test__${Date.now()}_${Math.random().toString(16).slice(2)}`);
      fs.writeFileSync(testFile, Buffer.from('ok'));
      fs.unlinkSync(testFile);
      return { ok: true, baseDir: baseDirAbs };
    },

    async getObject({ key }) {
      const filePath = buildPath(baseDirAbs, key);
      if (!fs.existsSync(filePath)) return null;
      const body = fs.readFileSync(filePath);
      return { body, contentType: null };
    },

    async putObject({ key, body }) {
      const filePath = buildPath(baseDirAbs, key);
      ensureDir(path.dirname(filePath));
      fs.writeFileSync(filePath, body);
      return { ok: true, key };
    },
  };
}

module.exports = {
  createFsLocalEndpoint,
};
