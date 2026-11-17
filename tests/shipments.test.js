import { expect } from 'chai';
import { api, createUser, createOrder, errorResponse, missing } from './helpers.js';

const pdf = Buffer.from('%PDF-1.4\nComprobante de prueba\n%%EOF');
describe('Envíos y tracking', () => {
  it('completa creación, consulta, actualización, comprobante y tracking de un envío', async () => {
    const customer = await createUser();
    const driver = await createUser('driver');
    const created = await api.post('/api/shipments').send({ customer: customer._id, deliveryAddress: 'Av. Italia 1234', items: [{ name:'Paquete', quantity:2, price:100 }] });
    expect(created.status).to.equal(201);
    const shipment = created.body.payload;
    expect(shipment.trackingCode).to.match(/^SN-[A-F0-9]{32}$/);
    expect(shipment.history.map(event=>event.status)).to.deep.equal(['created']);
    expect((await api.get('/api/shipments')).body.payload).to.have.length(1);
    expect((await api.get(`/api/shipments/${shipment._id}`)).body.payload.trackingCode).to.equal(shipment.trackingCode);
    const delivery = await api.post('/api/deliveries').send({ order:shipment._id, driver:driver._id });
    expect(delivery.status).to.equal(201);
    for (const status of ['in_transit','delivered']) {
      const updated = await api.put(`/api/deliveries/${delivery.body.payload._id}`).send({ status });
      expect(updated.status).to.equal(200);
    }
    const proof = await api.post(`/api/shipments/${shipment._id}/proofs`).attach('file',pdf,'comprobante.pdf');
    expect(proof.status).to.equal(201);
    expect(proof.body.payload.proofs).to.have.length(1);
    const tracking = await api.get(`/api/tracking/${shipment.trackingCode}`);
    expect(tracking.status).to.equal(200);
    expect(tracking.body.payload).to.have.all.keys('trackingCode','status','history');
    expect(tracking.body.payload.status).to.equal('delivered');
    expect(tracking.body.payload.history.map(event=>event.status)).to.deep.equal(['created','assigned','in_transit','delivered']);
    expect(tracking.body.payload.history.every(event=>!Number.isNaN(Date.parse(event.timestamp)))).to.equal(true);
    expect(JSON.stringify(tracking.body)).not.to.include(customer.email);
    expect(JSON.stringify(tracking.body)).not.to.include('Av. Italia');
  });

  it('permite actualizar y eliminar un envío sin entrega ni comprobantes', async () => {
    const order = await createOrder();
    const updated = await api.put(`/api/shipments/${order._id}`).send({ priority:'high', status:'assigned' });
    expect(updated.status).to.equal(200);
    expect(updated.body.payload).to.include({ priority:'high',status:'assigned' });
    expect(updated.body.payload.history.map(event=>event.status)).to.deep.equal(['created','assigned']);
    expect((await api.delete(`/api/shipments/${order._id}`)).status).to.equal(200);
    errorResponse(await api.get(`/api/tracking/${order.trackingCode}`),404,'ORDER_NOT_FOUND');
  });

  it('no duplica eventos ante la misma transición y rechaza estados inválidos', async () => {
    const order = await createOrder();
    await api.put(`/api/shipments/${order._id}`).send({ status:'assigned' });
    const same = await api.put(`/api/shipments/${order._id}`).send({ status:'assigned' });
    expect(same.body.payload.history).to.have.length(2);
    errorResponse(await api.put(`/api/shipments/${order._id}`).send({ status:'delivered' }),400,'INVALID_STATE');
    errorResponse(await api.put(`/api/shipments/${order._id}`).send({ status:'bad' }),400,'INVALID_STATE');
  });

  it('valida tracking, IDs y datos requeridos en los endpoints finales', async () => {
    errorResponse(await api.get('/api/tracking/incorrecto'),400,'INVALID_TRACKING_CODE');
    errorResponse(await api.get('/api/tracking/SN-00000000000000000000000000000000'),404,'ORDER_NOT_FOUND');
    errorResponse(await api.get(`/api/shipments/${missing}`),404,'ORDER_NOT_FOUND');
    errorResponse(await api.post('/api/shipments').send({}),400,'INVALID_ID');
  });

  it('no permite borrar entidades con archivos asociados', async () => {
    const user = await createUser();
    await api.post(`/api/users/${user._id}/documents`).field('documentType','user_document').attach('file',pdf,'documento.pdf');
    errorResponse(await api.delete(`/api/users/${user._id}`),409,'CONFLICT');
    const order = await createOrder();
    await api.post(`/api/shipments/${order._id}/proofs`).attach('file',pdf,'proof.pdf');
    errorResponse(await api.delete(`/api/shipments/${order._id}`),409,'CONFLICT');
  });

  it('los mocks conservan códigos e historial coherentes', async () => {
    const response = await api.get('/api/mocks/all?qty=2');
    for(const order of response.body.orders) {
      expect(order.trackingCode).to.match(/^SN-[A-F0-9]{32}$/);
      expect(order.history.at(-1).status).to.equal(order.status);
    }
  });
});
