import dotenv from 'dotenv';
dotenv.config({ path: process.env.ENV_FILE || (process.env.NODE_ENV==='test'?'.env.test':'.env'), quiet: true });
export function validateConfig(env) {
  for (const key of ['PORT', 'MONGODB_URI', 'NODE_ENV']) {
    if (!env[key]?.trim()) throw new Error(`Falta configurar la variable de entorno: ${key}`);
  }
  const port = Number(env.PORT);
  if (!Number.isInteger(port) || port < 1 || port > 65535) throw new Error('PORT debe ser un entero entre 1 y 65535');
  if (!['development', 'test', 'production'].includes(env.NODE_ENV)) throw new Error('NODE_ENV debe ser development, test o production');
  if (!/^mongodb(\+srv)?:\/\//.test(env.MONGODB_URI)) throw new Error('MONGODB_URI debe ser una URI de MongoDB');
  const logLevel=env.LOG_LEVEL || (env.NODE_ENV==='development'?'debug':'info');
  if(!['fatal','error','warning','info','http','debug'].includes(logLevel)) throw new Error('LOG_LEVEL inválido');
  const uploadMaxBytes=Number(env.UPLOAD_MAX_BYTES || 2097152);
  if(!Number.isInteger(uploadMaxBytes)||uploadMaxBytes<1||uploadMaxBytes>10485760) throw new Error('UPLOAD_MAX_BYTES debe estar entre 1 y 10485760');
  return Object.freeze({ uploadDir: env.UPLOAD_DIR || 'uploads', uploadMaxBytes, port, mongoUri: env.MONGODB_URI, nodeEnv: env.NODE_ENV, logLevel, logDir: env.LOG_DIR || 'logs', mongoBinary: env.MONGODB_BINARY || undefined });
}
export const config = validateConfig(process.env);
export default config;
