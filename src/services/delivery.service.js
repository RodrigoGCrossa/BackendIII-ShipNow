import logger from '../config/logger.js';
import DeliveryRepository from '../repositories/delivery.repository.js';
import OrderRepository from '../repositories/order.repository.js';
import OrderService from './order.service.js';
import UserService from './user.service.js';
import { DELIVERY_STATUS, ORDER_STATUS, ORDER_PRIORITY, USER_ROLES } from '../constants/index.js';
import { id,fail,enumValue,pagination,objectBody } from '../utils/validation.js';
export default class DeliveryService {
 constructor(repository=new DeliveryRepository()) {this.repository=repository;}
 getAll(query) {return this.repository.findAll({},pagination(query));}
 async getById(value) {const result=await this.repository.findById(id(value));if(!result) fail('DELIVERY_NOT_FOUND','Entrega no encontrada',404);return result;}
 async create(data) {
  objectBody(data);const order=await new OrderService().getById(id(data.order));
  if(order.delivery || await this.repository.findOne({order:order._id})) fail('CONFLICT','El pedido ya tiene una entrega',409);
  if(order.status!==ORDER_STATUS.CREATED) fail('INVALID_STATE','El pedido no permite una nueva entrega');
  if(data.driver) {const driver=await new UserService().getById(id(data.driver));if(driver.role!==USER_ROLES.DRIVER) fail('INVALID_DATA','El usuario no es repartidor');}
  const result=await this.repository.create({order:order._id,driver:data.driver||null,status:data.driver?DELIVERY_STATUS.ASSIGNED:DELIVERY_STATUS.PENDING,priority:enumValue(data.priority??order.priority,ORDER_PRIORITY,'priority'),assignedAt:data.driver?new Date():null});
  try {await new OrderRepository().update(order._id,{delivery:result._id,status:data.driver?ORDER_STATUS.ASSIGNED:ORDER_STATUS.CREATED});}
  catch(error) {await this.repository.delete(result._id);throw error;}
  logger.info('Entrega creada',{event:'delivery_created',id:String(result._id)});
  return result;
 }
 async update(value,data) {
  objectBody(data);const current=await this.getById(value);const clean={};
  if('driver' in data) {if(current.status===DELIVERY_STATUS.DELIVERED) fail('INVALID_STATE','No se puede cambiar el repartidor de una entrega completada');const driver=await new UserService().getById(id(data.driver));if(driver.role!==USER_ROLES.DRIVER) fail('INVALID_DATA','El usuario no es repartidor');clean.driver=driver._id;clean.assignedAt=new Date();if(current.status===DELIVERY_STATUS.PENDING) clean.status=DELIVERY_STATUS.ASSIGNED;}
  if('status' in data) {clean.status=enumValue(data.status,DELIVERY_STATUS,'status');const transitions={[DELIVERY_STATUS.PENDING]:[DELIVERY_STATUS.ASSIGNED],[DELIVERY_STATUS.ASSIGNED]:[DELIVERY_STATUS.IN_TRANSIT],[DELIVERY_STATUS.IN_TRANSIT]:[DELIVERY_STATUS.DELIVERED],[DELIVERY_STATUS.DELIVERED]:[]};if(clean.status!==current.status&&!transitions[current.status].includes(clean.status)) fail('INVALID_STATE','Transición de estado inválida');if(clean.status!==DELIVERY_STATUS.PENDING&&!clean.driver&&!current.driver) fail('INVALID_STATE','Debe asignarse un repartidor');if(clean.status===DELIVERY_STATUS.DELIVERED) clean.deliveredAt=new Date();}
  if(!Object.keys(clean).length) fail('INVALID_DATA','No hay campos actualizables');
  const result=await this.repository.update(value,clean);
  if(clean.status) {const map={[DELIVERY_STATUS.PENDING]:ORDER_STATUS.CREATED,[DELIVERY_STATUS.ASSIGNED]:ORDER_STATUS.ASSIGNED,[DELIVERY_STATUS.IN_TRANSIT]:ORDER_STATUS.IN_TRANSIT,[DELIVERY_STATUS.DELIVERED]:ORDER_STATUS.DELIVERED};await new OrderRepository().update(current.order,{status:map[clean.status]});}
  return result;
 }
 async delete(value) {const current=await this.getById(value);if(current.proofs?.length) fail('CONFLICT','La entrega tiene comprobantes asociados');if(current.status===DELIVERY_STATUS.DELIVERED) fail('INVALID_STATE','No se puede eliminar una entrega completada');await new OrderRepository().update(current.order,{delivery:null,status:ORDER_STATUS.CREATED});return this.repository.delete(value);}
}
