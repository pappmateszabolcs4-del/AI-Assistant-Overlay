function normalizeEnv(value) {
  return String(value || '').trim().toLowerCase();
}

function getAppEnv() {
  const raw = normalizeEnv(process.env.APP_ENV || process.env.NODE_ENV);
  if (raw === 'development' || raw === 'dev') return 'development';
  if (raw === 'production' || raw === 'prod') return 'production';
  return 'production';
}

function isDev() {
  return getAppEnv() === 'development';
}

function isProd() {
  return getAppEnv() === 'production';
}

module.exports = {
  getAppEnv,
  isDev,
  isProd
};
