import multer from 'multer';
import path from 'node:path';
import {randomUUID} from 'node:crypto';
import {mkdir} from 'node:fs/promises';
import config from './index.js';
import AppError from '../errors/AppError.js';
export const UPLOAD_ROOT=path.resolve(config.uploadDir);
export const FILE_TYPES=Object.freeze({'application/pdf':'.pdf','image/png':'.png','image/jpeg':'.jpg'});
const storage=multer.diskStorage({
 destination:(req,file,callback)=>{const dir=path.join(UPLOAD_ROOT,'temporary');mkdir(dir,{recursive:true}).then(()=>callback(null,dir),callback);},
 filename:(req,file,callback)=>callback(null,`${randomUUID()}${FILE_TYPES[file.mimetype]||''}`)
});
const upload=multer({storage,limits:{fileSize:config.uploadMaxBytes,files:1,fields:2,fieldSize:1024},fileFilter:(req,file,callback)=>{
 const extension=path.extname(file.originalname).toLowerCase();const expected=FILE_TYPES[file.mimetype];
 if(!expected || !(extension===expected || file.mimetype==='image/jpeg'&&extension==='.jpeg')) return callback(new AppError('INVALID_FILE_TYPE'));
 callback(null,true);
}}).single('file');
export const receiveFile=(req,res,next)=>upload(req,res,error=>next(error));
