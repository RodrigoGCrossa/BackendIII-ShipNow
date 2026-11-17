import logger from '../config/logger.js';
export default function requestLogger(req,res,next) {
 const start=performance.now();res.on('finish',()=>logger.http('Petición HTTP',{method:req.method,path:req.path,status:res.statusCode,durationMs:Math.round(performance.now()-start)}));next();
}
