export default function errorHandler(error,req,res,next) {
 if(res.headersSent) return next(error);
 res.status(error.statusCode||500).json({status:'error',error:{code:error.code||'INTERNAL_ERROR',message:error.statusCode?error.message:'Error interno del servidor'}});
}
