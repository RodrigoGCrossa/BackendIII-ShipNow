import OrderRepository from '../repositories/order.repository.js';
import UserService from './user.service.js';
import { ORDER_STATUS, ORDER_PRIORITY, USER_ROLES } from '../constants/index.js';
import config from '../config/index.js';
import { id,fail,requiredText,enumValue,pagination,objectBody } from '../utils/validation.js';
const transitions={created:['assigned','cancelled'],assigned:['picked_up','cancelled'],picked_up:['in_transit'],in_transit:['delivered'],delivered:[],cancelled:[]};
export default class OrderService {
 constructor(repository=new OrderRepository()) {this.repository=repository;}
 getAll(query={}) {const filter={};if(query.status) filter.status=enumValue(query.status,ORDER_STATUS,'status');return this.repository.findAll(filter,pagination(query));}
 async getById(value) {const result=await this.repository.findById(id(value));if(!result) fail('ORDER_NOT_FOUND','Pedido no encontrado',404);return result;}
 async create(data) {
  objectBody(data);const customer=await new UserService().getById(id(data.customer));
  if(![USER_ROLES.CUSTOMER,USER_ROLES.USER].includes(customer.role)) fail('INVALID_DATA','El usuario debe tener rol de cliente');
  const deliveryAddress=requiredText(data.deliveryAddress,'deliveryAddress');
  if(!Array.isArray(data.items)||data.items.length<1||data.items.length>100) fail('INVALID_DATA','El pedido debe tener entre 1 y 100 items');
  const items=data.items.map(item=>{objectBody(item);const name=requiredText(item.name,'name');if(!Number.isInteger(item.quantity)||item.quantity<1||typeof item.price!=='number'||!Number.isFinite(item.price)||item.price<0) fail('INVALID_DATA','Cantidad o precio inválido');return {name,quantity:item.quantity,price:item.price};});
  const declaredValue=Math.round(items.reduce((sum,item)=>sum+item.quantity*item.price,0)*100)/100;
  if(!Number.isFinite(declaredValue)) fail('INVALID_DATA','El total excede el rango permitido');
  const shippingCost=config.nodeEnv==='production'?Math.round((50+declaredValue*0.01)*100)/100:10;
  const priority=enumValue(data.priority??ORDER_PRIORITY.NORMAL,ORDER_PRIORITY,'priority');
  return this.repository.create({customer:customer._id,deliveryAddress,items,declaredValue,shippingCost,total:declaredValue+shippingCost,status:ORDER_STATUS.CREATED,priority});
 }
 async update(value,data) {
  objectBody(data);const current=await this.getById(value);const clean={};
  if('status' in data) {clean.status=enumValue(data.status,ORDER_STATUS,'status');if(clean.status!==current.status&&!transitions[current.status].includes(clean.status)) fail('INVALID_STATE','Transición de estado inválida');}
  if('priority' in data) clean.priority=enumValue(data.priority,ORDER_PRIORITY,'priority');
  if('deliveryAddress' in data) clean.deliveryAddress=requiredText(data.deliveryAddress,'deliveryAddress');
  if(!Object.keys(clean).length) fail('INVALID_DATA','No hay campos actualizables');
  return this.repository.update(value,clean);
 }
 async delete(value) {const current=await this.getById(value);if(current.delivery) fail('CONFLICT','El pedido tiene una entrega asociada',409);return this.repository.delete(value);}
}
