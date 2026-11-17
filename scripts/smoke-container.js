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
const order = await json('/api/orders', {
  method: 'POST',
  body: JSON.stringify({ customer: create.body.payload._id, deliveryAddress: 'Av. Italia 1234', items: [{ name: 'Caja', quantity: 2, price: 100 }] }),
});
assert.equal(order.status, 201);
assert.equal(order.body.payload.shippingCost, 52);
assert.equal(order.body.payload.total, 252);
const imageAudit = execFileSync('docker', ['compose', 'exec', '-T', 'api', 'node', '--input-type=module', '-e', `
  import fs from 'node:fs';
  if (process.getuid() === 0) throw new Error('La API corre como root');
  for (const file of ['.env', '.env.test', '.git', 'tests', 'node_modules/mocha', 'node_modules/chai', 'node_modules/supertest']) {
    if (fs.existsSync(file)) throw new Error('Archivo ajeno al runtime: ' + file);
  }
  console.info('Imagen sin secretos/copias locales y usuario sin privilegios');
`], { encoding: 'utf8' });
console.info(imageAudit.trim());
console.info('Health, readiness, Swagger, negocio y restricciones productivas: verificados en contenedores reales');
