import app from './app.js';
import config from './config/index.js';
import {connectDatabase} from './repositories/database.js';
try { await connectDatabase(config.mongoUri); app.listen(config.port,()=>console.info(`ShipNow en puerto ${config.port}`)); }
catch { console.error('No se pudo iniciar ShipNow: revisá la configuración y la conexión a MongoDB'); process.exitCode=1; }
