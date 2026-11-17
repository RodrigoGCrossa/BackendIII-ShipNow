import dotenv from 'dotenv';

const envFile = process.env.ENV_FILE || (process.env.NODE_ENV === 'test' ? '.env.test' : '.env');
dotenv.config({ path: envFile, quiet: true });

function integer(value, name, minimum, maximum, fallback) {
  const number = Number(value ?? fallback);
  if (!Number.isSafeInteger(number) || number < minimum || number > maximum) {
    throw new Error(`${name} debe ser un entero entre ${minimum} y ${maximum}`);
  }
  return number;
}

function boolean(value, name, fallback) {
  if (value === undefined || value === '') return fallback;
  if (!['true', 'false'].includes(value)) throw new Error(`${name} debe ser true o false`);
  return value === 'true';
}

export function validateConfig(env) {
  for (const key of ['PORT', 'MONGODB_URI', 'NODE_ENV']) {
    if (typeof env[key] !== 'string' || !env[key].trim()) {
      throw new Error(`Falta configurar la variable de entorno: ${key}`);
    }
  }
  const port = integer(env.PORT, 'PORT', 1, 65535);
  if (!['development', 'test', 'production'].includes(env.NODE_ENV)) {
    throw new Error('NODE_ENV debe ser development, test o production');
  }
  if (!/^mongodb(\+srv)?:\/\/[^/\s]+/.test(env.MONGODB_URI)) {
    throw new Error('MONGODB_URI debe ser una URI de MongoDB');
  }
  const production = env.NODE_ENV === 'production';
  const logLevel = env.LOG_LEVEL || (production ? 'info' : env.NODE_ENV === 'test' ? 'info' : 'debug');
  if (!['fatal', 'error', 'warning', 'info', 'http', 'debug'].includes(logLevel)) {
    throw new Error('LOG_LEVEL inválido');
  }
  if (production && ['http', 'debug'].includes(logLevel)) {
    throw new Error('LOG_LEVEL en producción debe ser info, warning, error o fatal');
  }
  const apiBaseUrl = env.API_BASE_URL || `http://localhost:${port}`;
  let url;
  try { url = new URL(apiBaseUrl); } catch { throw new Error('API_BASE_URL debe ser una URL HTTP válida'); }
  if (!['http:', 'https:'].includes(url.protocol) || url.username || url.password || url.search || url.hash) {
    throw new Error('API_BASE_URL debe ser una URL HTTP sin credenciales, query ni fragmentos');
  }
  return Object.freeze({
    port,
    nodeEnv: env.NODE_ENV,
    mongoUri: env.MONGODB_URI.trim(),
    mongoBinary: env.MONGODB_BINARY || undefined,
    logLevel,
    logDir: env.LOG_DIR || 'logs',
    logMaxBytes: integer(env.LOG_MAX_BYTES, 'LOG_MAX_BYTES', 1024, 10485760, 1048576),
    logMaxFiles: integer(env.LOG_MAX_FILES, 'LOG_MAX_FILES', 2, 30, 5),
    uploadDir: env.UPLOAD_DIR || 'uploads',
    uploadMaxBytes: integer(env.UPLOAD_MAX_BYTES, 'UPLOAD_MAX_BYTES', 1, 10485760, 2097152),
    jsonLimitBytes: integer(env.JSON_LIMIT_BYTES, 'JSON_LIMIT_BYTES', 1024, 1048576, 102400),
    requestTimeoutMs: integer(env.REQUEST_TIMEOUT_MS, 'REQUEST_TIMEOUT_MS', 1000, 120000, 30000),
    internalEndpointsEnabled: boolean(env.ENABLE_INTERNAL_ENDPOINTS, 'ENABLE_INTERNAL_ENDPOINTS', !production),
    swaggerEnabled: boolean(env.ENABLE_SWAGGER, 'ENABLE_SWAGGER', true),
    apiBaseUrl: apiBaseUrl.replace(/\/$/, ''),
  });
}

export const config = validateConfig(process.env);
export default config;
