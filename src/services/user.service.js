import { randomBytes, scrypt } from 'node:crypto';
import { promisify } from 'node:util';
import UserRepository from '../repositories/user.repository.js';
import OrderRepository from '../repositories/order.repository.js';
import DeliveryRepository from '../repositories/delivery.repository.js';
import { USER_ROLES } from '../constants/index.js';
import { id, fail, requiredText, enumValue, pagination, objectBody } from '../utils/validation.js';
const derive = promisify(scrypt);
export async function hashPassword(value) { const salt=randomBytes(16).toString('hex'); const hash=await derive(value,salt,64); return `${salt}:${hash.toString('hex')}`; }
export default class UserService {
 constructor(repository=new UserRepository()) { this.repository=repository; }
 getAll(query) { return this.repository.findAll({}, pagination(query)); }
 async getById(value) { const result=await this.repository.findById(id(value)); if(!result) fail('USER_NOT_FOUND','Usuario no encontrado',404); return result; }
 async validate(data, creating) {
  objectBody(data); const clean={};
  for(const field of ['firstName','lastName','email']) if(creating || field in data) clean[field]=requiredText(data[field],field);
  if(clean.email) { clean.email=clean.email.toLowerCase(); if(!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(clean.email)) fail('INVALID_DATA','Email inválido'); }
  if(creating || 'password' in data) { const password=requiredText(data.password,'password'); if(password.length<6) fail('INVALID_DATA','La contraseña debe tener al menos 6 caracteres'); clean.password=await hashPassword(password); }
  if('role' in data) { clean.role=enumValue(data.role,USER_ROLES,'role'); if(clean.role===USER_ROLES.ADMIN) fail('FORBIDDEN','No se puede asignar el rol admin desde este endpoint',403); }
  return clean;
 }
 async create(data) { const clean=await this.validate(data,true); if(await this.repository.findOne({email:clean.email})) fail('DUPLICATE','El email ya existe',409); return this.repository.create(clean); }
 async update(value,data) { await this.getById(value); return this.repository.update(value,await this.validate(data,false)); }
 async delete(value) { const user=await this.getById(value); if(user.documents?.length) fail('CONFLICT','El usuario tiene documentos asociados'); if(await new OrderRepository().findOne({customer:value}) || await new DeliveryRepository().findOne({driver:value})) fail('CONFLICT','El usuario tiene operaciones asociadas',409); return this.repository.delete(value); }
}
