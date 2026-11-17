import logger from '../config/logger.js';
import AppError from '../errors/AppError.js';
export function normalizeError(error) {
 if(error instanceof AppError) return error;
 if(error.name==='MulterError') return new AppError(error.code==='LIMIT_FILE_SIZE'?'FILE_TOO_LARGE':error.code==='LIMIT_UNEXPECTED_FILE'?'UNEXPECTED_FILE':'INVALID_DATA');
 if(error.type==='entity.parse.failed') return new AppError('INVALID_JSON');
 if(error.type==='entity.too.large') return new AppError('PAYLOAD_TOO_LARGE');
 if(error.name==='ValidationError' || error.name==='CastError' || error.name==='StrictModeError') return new AppError('INVALID_DATA');
 if(error.code===11000) return new AppError('DUPLICATE');
 return new AppError('INTERNAL_ERROR');
}
export default function errorHandler(error,req,res,next) {
 if(res.headersSent) return next(error);
 const normalized=normalizeError(error);
 logger.log(normalized.statusCode>=500?'error':'warning',normalized.message,{code:normalized.code,method:req.method,path:req.path});
 res.status(normalized.statusCode).json({status:'error',error:{code:normalized.code,message:normalized.message}});
}
