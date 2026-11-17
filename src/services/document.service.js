import path from 'node:path';
import {rename,mkdir,unlink,open} from 'node:fs/promises';
import UserService from './user.service.js';
import OrderService from './order.service.js';
import DeliveryService from './delivery.service.js';
import UserRepository from '../repositories/user.repository.js';
import OrderRepository from '../repositories/order.repository.js';
import DeliveryRepository from '../repositories/delivery.repository.js';
import {UPLOAD_ROOT} from '../config/multer.js';
import {DOCUMENT_TYPES,USER_ROLES} from '../constants/index.js';
import {id,fail} from '../utils/validation.js';
import AppError from '../errors/AppError.js';
import logger from '../config/logger.js';
const definitions={users:{service:UserService,repository:UserRepository,field:'documents'},orders:{service:OrderService,repository:OrderRepository,field:'proofs'},deliveries:{service:DeliveryService,repository:DeliveryRepository,field:'proofs'}};
async function validSignature(file) {
 const handle=await open(file.path,'r');try {const bytes=Buffer.alloc(8);await handle.read(bytes,0,8,0);return file.mimetype==='application/pdf'?bytes.subarray(0,5).toString()==='%PDF-':file.mimetype==='image/png'?bytes.equals(Buffer.from([137,80,78,71,13,10,26,10])):bytes[0]===255&&bytes[1]===216&&bytes[2]===255;}finally{await handle.close();}
}
export default class DocumentService {
 constructor(resource) {this.resource=resource;this.definition=definitions[resource];}
 async list(value) {const entity=await new this.definition.service().getById(value);return entity[this.definition.field]||[];}
 async upload(value,file,documentType) {
  let currentPath=file?.path;
  try {
   const entity=await new this.definition.service().getById(value);
   if(!file) fail('FILE_REQUIRED');
   const type=this.resource==='users'?documentType:DOCUMENT_TYPES.DELIVERY_PROOF;
   if(this.resource==='users'&&![DOCUMENT_TYPES.USER_DOCUMENT,DOCUMENT_TYPES.DRIVER_LICENSE].includes(type)) fail('INVALID_DOCUMENT_TYPE');
   if(this.resource!=='users'&&documentType&&documentType!==DOCUMENT_TYPES.DELIVERY_PROOF) fail('INVALID_DOCUMENT_TYPE');
   if(type===DOCUMENT_TYPES.DRIVER_LICENSE&&entity.role!==USER_ROLES.DRIVER) fail('INVALID_DOCUMENT_TYPE','Solo un repartidor puede adjuntar una licencia');
   if(!await validSignature(file)) fail('INVALID_FILE_TYPE','El contenido del archivo no coincide con su formato');
   const folder=type===DOCUMENT_TYPES.DRIVER_LICENSE?'licenses':this.resource==='users'?'user-documents':`${this.resource}-proofs`;
   const destination=path.join(UPLOAD_ROOT,folder);await mkdir(destination,{recursive:true});
   const target=path.join(destination,file.filename);await rename(file.path,target);currentPath=target;
   const metadata={originalName:path.basename(file.originalname).replace(/[\x00-\x1f]/g,''),filename:file.filename,path:path.relative(UPLOAD_ROOT,target),mimeType:file.mimetype,size:file.size,documentType:type,uploadedAt:new Date()};
   const result=await new this.definition.repository().addDocument(value,this.definition.field,metadata);
   if(!result) fail('FILE_SAVE_ERROR');
   logger.info('Archivo asociado a entidad',{resource:this.resource,entityId:value,documentType:type});return result;
  } catch(error) {
   if(currentPath) await unlink(currentPath).catch(cleanup=>{if(cleanup.code!=='ENOENT') logger.error('No se pudo limpiar un archivo de carga',{code:cleanup.code});});
   if(error instanceof AppError) throw error;
   throw new AppError('FILE_SAVE_ERROR');
  }
 }
 async download(value,documentId) {
  id(documentId);const documents=await this.list(value);const metadata=documents.find(item=>String(item._id)===documentId);
  if(!metadata) fail('FILE_NOT_FOUND');
  const filename=path.resolve(UPLOAD_ROOT,metadata.path);
  if(!filename.startsWith(UPLOAD_ROOT+path.sep)) fail('FILE_NOT_FOUND');
  return {filename,metadata};
 }
}
