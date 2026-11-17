import app from './app.js';
import config from './config/index.js';
import logger from './config/logger.js';
import {connectDatabase,disconnectDatabase} from './repositories/database.js';
try {
 await connectDatabase(config.mongoUri);logger.info('Conexión a MongoDB establecida');
 const server=app.listen(config.port,()=>logger.info(`Servidor ShipNow escuchando en el puerto ${config.port}`));
 server.on('error',error=>{logger.fatal('No se pudo abrir el puerto',{code:error.code});disconnectDatabase().finally(()=>{process.exitCode=1;});});
 for(const signal of ['SIGINT','SIGTERM']) process.once(signal,()=>{server.close(async()=>{await disconnectDatabase();logger.end();});});
} catch(error) {logger.fatal('No se pudo iniciar ShipNow: revisá la conexión a MongoDB',{name:error.name});await disconnectDatabase();logger.end();process.exitCode=1;}
