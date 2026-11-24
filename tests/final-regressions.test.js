import { expect } from 'chai';
import { unlink } from 'node:fs/promises';
import path from 'node:path';
import config from '../src/config/index.js';
import DeliveryRepository from '../src/repositories/delivery.repository.js';
import OrderRepository from '../src/repositories/order.repository.js';
import Order from '../src/models/order.model.js';
import { api, createOrder, createUser, errorResponse } from './helpers.js';

const pdf = Buffer.from('%PDF-1.4\nRegresión de documento\n%%EOF');

async function assignedDelivery() {
  const order = await createOrder();
  const driver = await createUser('driver');
  const response = await api.post('/api/deliveries').send({ order: order._id, driver: driver._id });
  expect(response.status).to.equal(201);
  return { order, delivery: response.body.payload };
}

describe('Regresiones de integración final', () => {
  it('responde JSON uniforme cuando existe el metadato pero falta el archivo físico', async () => {
    const user = await createUser();
    const uploaded = await api.post(`/api/users/${user._id}/documents`)
      .field('documentType', 'user_document').attach('file', pdf, 'documento.pdf');
    expect(uploaded.status).to.equal(201);
    const metadata = uploaded.body.payload.documents[0];
    await unlink(path.join(config.uploadDir, metadata.path));
    const response = await api.get(`/api/users/${user._id}/documents/${metadata._id}/file`);
    expect(response.headers['content-type']).to.match(/^application\/json/);
    errorResponse(response, 404, 'FILE_NOT_FOUND');
  });

  it('trata una ruta con codificación inválida como error del cliente', async () => {
    errorResponse(await api.get('/api/users/%E0%A4%A'), 400, 'INVALID_DATA');
  });

  it('rechaza asignar un repartidor manteniendo explícitamente la entrega pendiente', async () => {
    const order = await createOrder();
    const driver = await createUser('driver');
    const created = await api.post('/api/deliveries').send({ order: order._id });
    expect(created.status).to.equal(201);
    errorResponse(await api.put(`/api/deliveries/${created.body.payload._id}`)
      .send({ driver: driver._id, status: 'pending' }), 400, 'INVALID_STATE');
    const unchanged = await api.get(`/api/deliveries/${created.body.payload._id}`);
    expect(unchanged.body.payload).to.include({ status: 'pending', driver: null });
  });

  it('conserva el vínculo y el historial si falla la eliminación de la entrega', async () => {
    const { order, delivery } = await assignedDelivery();
    const before = (await api.get(`/api/orders/${order._id}`)).body.payload;
    const original = DeliveryRepository.prototype.delete;
    DeliveryRepository.prototype.delete = async () => { throw new Error('Fallo de eliminación simulado'); };
    try {
      errorResponse(await api.delete(`/api/deliveries/${delivery._id}`), 500, 'INTERNAL_ERROR');
      const after = (await api.get(`/api/orders/${order._id}`)).body.payload;
      expect(after.delivery).to.equal(delivery._id);
      expect(after.status).to.equal(before.status);
      expect(after.history).to.deep.equal(before.history);
    } finally { DeliveryRepository.prototype.delete = original; }
  });

  it('restaura la entrega si falla la desvinculación del pedido', async () => {
    const { order, delivery } = await assignedDelivery();
    const original = OrderRepository.prototype.updateWithHistory;
    OrderRepository.prototype.updateWithHistory = async () => { throw new Error('Fallo de pedido simulado'); };
    try {
      errorResponse(await api.delete(`/api/deliveries/${delivery._id}`), 500, 'INTERNAL_ERROR');
      const restored = await api.get(`/api/deliveries/${delivery._id}`);
      expect(restored.status).to.equal(200);
      expect(restored.body.payload).to.include({ order: order._id, status: 'assigned' });
      expect((await api.get(`/api/orders/${order._id}`)).body.payload.delivery).to.equal(delivery._id);
    } finally { OrderRepository.prototype.updateWithHistory = original; }
  });

  it('compensa un seed parcialmente guardado sin borrar datos anteriores', async () => {
    const existing = await createOrder();
    const usersBefore = (await api.get('/api/users')).body.payload.map(user => user._id).sort();
    const original = Order.insertMany;
    Order.insertMany = async () => { throw new Error('Fallo simulado después de insertar usuarios'); };
    try {
      errorResponse(await api.post('/api/mocks/seed?qty=2').send({ resource: 'all' }), 503, 'MOCK_PERSISTENCE_ERROR');
      expect((await api.get('/api/users')).body.payload.map(user => user._id).sort()).to.deep.equal(usersBefore);
      expect((await api.get('/api/orders')).body.payload.map(order => order._id)).to.deep.equal([existing._id]);
      expect((await api.get('/api/deliveries')).body.payload).to.deep.equal([]);
    } finally { Order.insertMany = original; }
  });
});
