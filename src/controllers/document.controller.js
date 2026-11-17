import DocumentService from '../services/document.service.js';
import AppError from '../errors/AppError.js';
export default class DocumentController {
 constructor(resource) {this.service=new DocumentService(resource);}
 upload=async(req,res,next)=>{try{res.status(201).json({status:'success',payload:await this.service.upload(req.params.id,req.file,req.body?.documentType)});}catch(error){next(error);}};
 list=async(req,res,next)=>{try{res.json({status:'success',payload:await this.service.list(req.params.id)});}catch(error){next(error);}};
 download=async(req,res,next)=>{try{const {filename,metadata}=await this.service.download(req.params.id,req.params.documentId);res.type(metadata.mimeType);res.sendFile(filename,{dotfiles:'allow'},error=>{if(error) next(new AppError(error.code==='ENOENT'?'FILE_NOT_FOUND':'FILE_SAVE_ERROR'));});}catch(error){next(error);}};
}
