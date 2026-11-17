import request from 'supertest';
import {expect} from 'chai';
import {randomUUID} from 'node:crypto';
import app from '../src/app.js';
export const api=request(app);
export const missing='000000000000000000000000';
export function errorResponse(response,status,code) {expect(response.status).to.equal(status);expect(response.body).to.have.property('status','error');expect(response.body.error).to.have.all.keys('code','message');expect(response.body.error.code).to.equal(code);expect(response.body.error.message).to.be.a('string').and.not.empty;}
export async function createUser(role='customer') {const result=await api.post('/api/users').send({firstName:'Ana',lastName:'Prueba',email:`${randomUUID()}@example.test`,password:'prueba123',role});expect(result.status).to.equal(201);return result.body.payload;}
export async function createOrder() {const user=await createUser();const result=await api.post('/api/orders').send({customer:user._id,deliveryAddress:'Av. Italia 1234',items:[{name:'Caja',quantity:2,price:100}]});expect(result.status).to.equal(201);return result.body.payload;}
