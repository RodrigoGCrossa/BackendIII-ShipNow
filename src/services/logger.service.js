import logger,{LOG_LEVELS} from '../config/logger.js';
export default class LoggerService {
 test() {for(const level of Object.keys(LOG_LEVELS)) logger.log(level,`Prueba controlada del nivel ${level}`,{event:'logger_test'});return {levels:Object.keys(LOG_LEVELS),message:'Eventos de prueba generados'};}
}
