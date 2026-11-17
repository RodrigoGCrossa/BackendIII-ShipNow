import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';

const base = 'http://127.0.0.1:8080';
async function json(path, options = {}) {
  const response = await fetch(base + path, {
    ...options,
    headers: { 'content-type': 'application/json', ...options.headers },
    signal: AbortSignal.timeout(10000),
  });
  return { status: response.status, body: await response.json() };
}
const health = await json('/api/health');
assert.equal(health.status, 200);
assert.equal(health.body.environment, 'production');
assert.equal((await json('/api/ready')).body.database, 'ready');
assert.equal((await fetch(base + '/api/docs/')).status, 200);
assert.equal((await json('/api/users')).status, 200);
assert.equal((await json('/api/mocks/users')).status, 404);
assert.equal((await json('/api/logger/test')).status, 404);
const schema = await json('/api/docs/openapi.json');
assert.equal(schema.body.openapi, '3.0.3');
const create = await json('/api/users', {
  method: 'POST',
  body: JSON.stringify({ firstName: 'Container', lastName: 'Test', email: `container-${Date.now()}@example.test`, password: 'prueba123' }),
});
assert.equal(create.status, 201);
assert.equal(create.body.payload.password, undefined);
const order = await json('/api/shipments', {
  method: 'POST',
  body: JSON.stringify({ customer: create.body.payload._id, deliveryAddress: 'Av. Italia 1234', items: [{ name: 'Caja', quantity: 2, price: 100 }] }),
});
assert.equal(order.status, 201);
assert.equal(order.body.payload.shippingCost, 52);
assert.equal(order.body.payload.total, 252);
const driver = await json('/api/users', {
  method: 'POST',
  body: JSON.stringify({ firstName:'Driver', lastName:'Test', email:`driver-${Date.now()}@example.test`, password:'prueba123', role:'driver' }),
});
assert.equal(driver.status, 201);
const delivery = await json('/api/deliveries', {
  method: 'POST', body: JSON.stringify({ order:order.body.payload._id, driver:driver.body.payload._id }),
});
assert.equal(delivery.status, 201);
for (const status of ['in_transit','delivered']) {
  const changed = await json(`/api/deliveries/${delivery.body.payload._id}`, { method:'PUT', body:JSON.stringify({status}) });
  assert.equal(changed.status, 200);
}
const pdf = '%PDF-1.4\nComprobante de contenedor\n%%EOF';
const form = new FormData();
form.append('file', new Blob([pdf], { type:'application/pdf' }), 'comprobante.pdf');
const uploaded = await fetch(`${base}/api/shipments/${order.body.payload._id}/proofs`, { method:'POST', body:form });
assert.equal(uploaded.status, 201);
const document = (await uploaded.json()).payload.proofs[0];
const downloadUrl = `/api/shipments/${order.body.payload._id}/proofs/${document._id}/file`;
assert.equal(await (await fetch(base + downloadUrl)).text(), pdf);
const trackingPath = `/api/tracking/${order.body.payload.trackingCode}`;
assert.deepEqual((await json(trackingPath)).body.payload.history.map(event=>event.status), ['created','assigned','in_transit','delivered']);
execFileSync('docker', ['compose','restart','api'], { stdio:'inherit' });
let ready = false;
for(let attempt=0;attempt<60;attempt++) {
  try { if((await json('/api/ready')).status===200) {ready=true;break;} } catch {}
  await new Promise(resolve=>setTimeout(resolve,500));
}
assert.equal(ready, true, 'La API debe volver a estar lista después del reinicio');
assert.equal((await json(trackingPath)).body.payload.status, 'delivered');
assert.equal(await (await fetch(base + downloadUrl)).text(), pdf, 'El volumen debe conservar el comprobante');
const imageAudit = execFileSync('docker', ['compose', 'exec', '-T', 'api', 'node', '--input-type=module', '-e', `
  import fs from 'node:fs';
  if (process.getuid() === 0) throw new Error('La API corre como root');
  for (const file of ['.env', '.env.test', '.git', 'tests', 'node_modules/mocha', 'node_modules/chai', 'node_modules/supertest']) {
    if (fs.existsSync(file)) throw new Error('Archivo ajeno al runtime: ' + file);
  }
  console.info('Imagen sin secretos/copias locales y usuario sin privilegios');
`], { encoding: 'utf8' });
console.info(imageAudit.trim());
console.info('Health, readiness, Swagger, envío, tracking, comprobante, reinicio y persistencia de volúmenes: verificados en contenedores reales');
