import LoggerService from '../services/logger.service.js';
const service=new LoggerService();
export const testLogger=(req,res)=>res.json({status:'success',payload:service.test()});
