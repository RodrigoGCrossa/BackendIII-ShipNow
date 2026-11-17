import {randomBytes,randomUUID} from 'node:crypto';
import { USER_ROLES, ORDER_STATUS, DELIVERY_STATUS, ORDER_PRIORITY } from '../constants/index.js';
import {fail,objectBody} from '../utils/validation.js';
import {hashPassword} from './user.service.js';
import MockRepository from '../repositories/mock.repository.js';
const objectId=()=>randomBytes(12).toString('hex');
export function quantity(value=10) {if(!/^[1-9]\d*$/.test(String(value))||Number(value)>100) fail('INVALID_MOCK_QUANTITY','qty debe ser un entero entre 1 y 100');return Number(value);}
export default class MockService {
 constructor(repository=new MockRepository()) {this.repository=repository;}
 async generate(resource,value) {
  const qty=quantity(value);if(!['users','drivers','orders','deliveries','all'].includes(resource)) fail('INVALID_DATA','Recurso de mocks inválido');
  const bundle={users:[],drivers:[],orders:[],deliveries:[]};
  const token=randomUUID();
  for(let i=0;i<qty;i++) {
   const user={_id:objectId(),firstName:`Usuario ${i+1}`,lastName:'Prueba',email:`user-${token}-${i}@example.test`,role:USER_ROLES.CUSTOMER};
   const driver={_id:objectId(),firstName:`Repartidor ${i+1}`,lastName:'Prueba',email:`driver-${token}-${i}@example.test`,role:USER_ROLES.DRIVER,isAvailable:true};
   if(resource!=='drivers') bundle.users.push(user);
   if(['drivers','deliveries','all'].includes(resource)) bundle.drivers.push(driver);
   if(['orders','deliveries','all'].includes(resource)) {
    const order={_id:objectId(),customer:user._id,items:[{name:'Paquete de prueba',quantity:2,price:100}],deliveryAddress:`Av. Italia ${1000+i}`,declaredValue:200,shippingCost:10,total:210,status:ORDER_STATUS.CREATED,priority:ORDER_PRIORITY.NORMAL,delivery:null};
    bundle.orders.push(order);
    if(['deliveries','all'].includes(resource)) {const delivery={_id:objectId(),order:order._id,driver:driver._id,status:DELIVERY_STATUS.ASSIGNED,priority:ORDER_PRIORITY.NORMAL,assignedAt:new Date(),deliveredAt:null};order.delivery=delivery._id;order.status=ORDER_STATUS.ASSIGNED;bundle.deliveries.push(delivery);}
   }
  }
  return bundle;
 }
 async preview(resource,qty) {const bundle=await this.generate(resource,qty);return ['users','drivers'].includes(resource)?bundle[resource]:bundle;}
 async seed(qty,body={}) {
  objectBody(body);const resource=body.resource??'users';const bundle=await this.generate(resource,qty);
  const password=await hashPassword(randomUUID());
  const users=[...bundle.users,...bundle.drivers].map(user=>({...user,password}));
  await this.repository.insertBundle({...bundle,users});
  return {insertados:resource==='users'?users.length:bundle[resource]?.length??bundle.orders.length,coleccion:resource==='users'?'usuarios':resource,totales:{usuarios:users.length,pedidos:bundle.orders.length,entregas:bundle.deliveries.length}};
 }
}
