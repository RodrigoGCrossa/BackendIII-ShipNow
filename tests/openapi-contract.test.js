import { expect } from 'chai';
import specification from '../src/config/swagger.js';
import { api, createUser, createOrder, missing } from './helpers.js';

function resolve(reference) {
  expect(reference).to.match(/^#\//);
  return reference.slice(2).split('/').reduce((value, key) => {
    expect(value, reference).to.have.property(key);
    return value[key];
  }, specification);
}

// Valida las restricciones usadas por esta especificación sobre respuestas reales.
function matchesSchema(value, schema, location = 'response') {
  if (schema.$ref) return matchesSchema(value, resolve(schema.$ref), location);
  if (value === null && schema.nullable) return;
  if (schema.allOf) for (const part of schema.allOf) matchesSchema(value, part, location);
  if (schema.enum) expect(schema.enum, location).to.include(value);
  if (schema.type === 'object' || schema.properties) {
    expect(value, location).to.be.an('object').and.not.an('array');
    for (const key of schema.required || []) expect(value, `${location}.${key}`).to.have.property(key);
    for (const [key, child] of Object.entries(schema.properties || {})) {
      if (Object.hasOwn(value, key)) matchesSchema(value[key], child, `${location}.${key}`);
    }
  } else if (schema.type === 'array') {
    expect(value, location).to.be.an('array');
    for (const [index, item] of value.entries()) matchesSchema(item, schema.items, `${location}[${index}]`);
    if (schema.minItems !== undefined) expect(value.length, location).to.be.at.least(schema.minItems);
    if (schema.maxItems !== undefined) expect(value.length, location).to.be.at.most(schema.maxItems);
  } else if (schema.type === 'integer') {
    expect(Number.isSafeInteger(value), location).to.equal(true);
  } else if (schema.type) {
    expect(value, location).to.be.a(schema.type);
  }
  if (schema.pattern) expect(value, location).to.match(new RegExp(schema.pattern));
  if (schema.minimum !== undefined) expect(value, location).to.be.at.least(schema.minimum);
  if (schema.maximum !== undefined) expect(value, location).to.be.at.most(schema.maximum);
  if (schema.format === 'date-time') expect(Number.isNaN(Date.parse(value)), location).to.equal(false);
  if (schema.format === 'email') expect(value, location).to.match(/^[^\s@]+@[^\s@]+\.[^\s@]+$/);
}

function matchesOperation(response, route, method = 'get') {
  const operation = specification.paths[route]?.[method];
  expect(operation, `${method.toUpperCase()} ${route}`).to.be.an('object');
  const documented = operation.responses[String(response.status)];
  expect(documented, `${method.toUpperCase()} ${route}: HTTP ${response.status}`).to.be.an('object');
  const contentType = response.headers['content-type']?.split(';')[0];
  const content = documented.content?.[contentType];
  expect(content, `${route}: Content-Type ${contentType}`).to.have.property('schema');
  matchesSchema(response.body, content.schema, `${method.toUpperCase()} ${route}`);
}

describe('Coherencia de OpenAPI con la API real', () => {
  it('resuelve las referencias y declara los parámetros de ruta y tags utilizados', () => {
    function inspect(value) {
      if (!value || typeof value !== 'object') return;
      if (value.$ref) resolve(value.$ref);
      for (const child of Object.values(value)) inspect(child);
    }
    inspect(specification);
    const tags = specification.tags.map(tag => tag.name);
    for (const [route, item] of Object.entries(specification.paths)) {
      for (const [method, operation] of Object.entries(item)) {
        if (!['get', 'post', 'put', 'delete'].includes(method)) continue;
        expect(operation.tags.every(tag => tags.includes(tag)), route).to.equal(true);
        const parameters = [...(item.parameters || []), ...(operation.parameters || [])];
        for (const [, parameter] of route.matchAll(/\{([^}]+)\}/g)) {
          expect(parameters.some(value => value.in === 'path' && value.name === parameter && value.required), route).to.equal(true);
        }
      }
    }
  });

  it('valida usuarios, productos, envíos, entregas y tracking contra sus schemas', async () => {
    const user = await createUser();
    matchesOperation(await api.get('/api/users'), '/api/users');
    matchesOperation(await api.get(`/api/users/${user._id}`), '/api/users/{id}');
    matchesOperation(await api.post('/api/products').send({ name:'Caja', price:100, stock:3 }), '/api/products', 'post');
    matchesOperation(await api.get('/api/products'), '/api/products');
    const order = await api.post('/api/shipments').send({ customer:user._id, deliveryAddress:'Av. Italia 1234', items:[{name:'Caja',quantity:1,price:100}] });
    matchesOperation(order, '/api/shipments', 'post');
    matchesOperation(await api.get('/api/orders'), '/api/orders');
    matchesOperation(await api.get(`/api/shipments/${order.body.payload._id}`), '/api/shipments/{id}');
    const delivery = await api.post('/api/deliveries').send({ order:order.body.payload._id });
    matchesOperation(delivery, '/api/deliveries', 'post');
    matchesOperation(await api.get('/api/deliveries'), '/api/deliveries');
    matchesOperation(await api.get(`/api/tracking/${order.body.payload.trackingCode}`), '/api/tracking/{trackingCode}');
  });

  it('valida mocks, seed, logger, health y documentos contra los contratos publicados', async () => {
    for (const resource of ['users', 'drivers', 'orders', 'deliveries', 'all']) {
      matchesOperation(await api.get(`/api/mocks/${resource}?qty=1`), `/api/mocks/${resource}`);
    }
    matchesOperation(await api.post('/api/mocks/seed?qty=1').send({resource:'all'}), '/api/mocks/seed', 'post');
    matchesOperation(await api.get('/api/logger/test'), '/api/logger/test');
    matchesOperation(await api.get('/api/health'), '/api/health');
    matchesOperation(await api.get('/api/ready'), '/api/ready');
    const user = await createUser();
    matchesOperation(await api.post(`/api/users/${user._id}/documents`)
      .field('documentType','user_document').attach('file',Buffer.from('%PDF-1.4\nPrueba\n%%EOF'),'documento.pdf'), '/api/users/{id}/documents', 'post');
    matchesOperation(await api.get(`/api/users/${user._id}/documents`), '/api/users/{id}/documents');
  });

  it('valida respuestas de error reales contra los errores documentados', async () => {
    matchesOperation(await api.post('/api/users').send({}), '/api/users', 'post');
    matchesOperation(await api.get(`/api/shipments/${missing}`), '/api/shipments/{id}');
    matchesOperation(await api.get('/api/tracking/incorrecto'), '/api/tracking/{trackingCode}');
    matchesOperation(await api.get('/api/mocks/users?qty=-1'), '/api/mocks/users');
    const order = await createOrder();
    matchesOperation(await api.put(`/api/orders/${order._id}`).send({status:'incorrecto'}), '/api/orders/{id}', 'put');
  });
});
