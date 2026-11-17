import {expect} from 'chai';
import {api,missing,errorResponse} from './helpers.js';
describe('Products',()=>{
 it('deriva estado del stock y conserva precio cero',async()=>{const r=await api.post('/api/products').send({name:'Caja',price:0,stock:2});expect(r.status).to.equal(201);expect(r.body.payload.status).to.equal('available');const id=r.body.payload._id;expect((await api.get(`/api/products/${id}`)).body.payload.price).to.equal(0);const u=await api.put(`/api/products/${id}`).send({stock:0});expect(u.body.payload.status).to.equal('out_of_stock');expect((await api.get('/api/products?available=true')).body.payload).to.deep.equal([]);expect((await api.delete(`/api/products/${id}`)).status).to.equal(200);});
 it('rechaza stock negativo, fracciones e inexistentes',async()=>{for(const stock of [-1,1.2]) errorResponse(await api.post('/api/products').send({name:'Caja',price:10,stock}),400,'INVALID_DATA');errorResponse(await api.get(`/api/products/${missing}`),404,'PRODUCT_NOT_FOUND');});
});
