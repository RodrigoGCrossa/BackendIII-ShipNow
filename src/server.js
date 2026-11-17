import app from './app.js';
import config from './config/index.js';
import logger from './config/logger.js';
import { connectDatabase, disconnectDatabase } from './repositories/database.js';

try {
  await connectDatabase(config.mongoUri);
  logger.info('Conexión a MongoDB establecida');
  const server = app.listen(config.port, () => logger.info(`Servidor ShipNow escuchando en el puerto ${config.port}`));
  server.requestTimeout = config.requestTimeoutMs;
  server.headersTimeout = Math.min(config.requestTimeoutMs, 10000);
  let shuttingDown = false;
  async function shutdown(signal) {
    if (shuttingDown) return;
    shuttingDown = true;
    logger.info('Cierre del servidor', { signal });
    const deadline = setTimeout(() => { server.closeAllConnections(); }, 10000);
    deadline.unref();
    server.close(async () => {
      clearTimeout(deadline);
      await disconnectDatabase();
      logger.end();
    });
  }
  server.on('error', async error => {
    logger.fatal('No se pudo abrir el puerto', { code: error.code });
    await disconnectDatabase();
    logger.end();
    process.exitCode = 1;
  });
  for (const signal of ['SIGINT', 'SIGTERM']) process.once(signal, () => shutdown(signal));
} catch (error) {
  logger.fatal('No se pudo iniciar ShipNow: revisá la conexión a MongoDB', { name: error.name });
  await disconnectDatabase();
  logger.end();
  process.exitCode = 1;
}
