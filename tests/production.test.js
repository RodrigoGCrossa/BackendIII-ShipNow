import { expect } from 'chai';
import request from 'supertest';
import { api, createUser, errorResponse } from './helpers.js';
import { createApp } from '../src/app.js';
import config, { validateConfig } from '../src/config/index.js';
import HealthService from '../src/services/health.service.js';
import { buildLogger } from '../src/config/logger.js';

const productionSettings = () => validateConfig({ PORT:'8080', NODE_ENV:'production', MONGODB_URI:'mongodb://127.0.0.1:27017/shipnow', LOG_DIR:'.cache/production-test-logs' });

describe('Producción y performance', () => {
  it('health incluye entorno, uptime y timestamp sin secretos', async () => {
    const response = await api.get('/api/health');
    expect(response.status).to.equal(200);
    expect(response.body).to.have.all.keys('status','environment','uptime','timestamp');
    expect(response.body.environment).to.equal('test');
    expect(response.body.uptime).to.be.a('number').and.at.least(0);
    expect(JSON.stringify(response.body)).not.to.include('mongodb');
    const ready = await api.get('/api/ready');
    expect(ready.status).to.equal(200);
    expect(ready.body.database).to.equal('ready');
  });

  it('reporta indisponibilidad de la base sin filtrar información interna', async () => {
    const service = new HealthService(config, async () => false);
    try { await service.ready(); throw new Error('Se esperaba error'); }
    catch(error) { expect(error.code).to.equal('DATABASE_UNAVAILABLE'); expect(error.statusCode).to.equal(503); }
  });

  it('deshabilita mocks/logger en producción y conserva Swagger y negocio', async () => {
    const production = request(createApp(productionSettings()));
    errorResponse(await production.get('/api/mocks/users'),404,'ROUTE_NOT_FOUND');
    errorResponse(await production.post('/api/mocks/seed').send({}),404,'ROUTE_NOT_FOUND');
    errorResponse(await production.get('/api/logger/test'),404,'ROUTE_NOT_FOUND');
    expect((await production.get('/api/docs/')).status).to.equal(200);
    expect((await production.get('/api/users')).status).to.equal(200);
    expect((await production.get('/api/health')).body.environment).to.equal('production');
  });

  it('permite desactivar Swagger y activar explícitamente endpoints internos', async () => {
    const app = request(createApp({ ...productionSettings(), swaggerEnabled:false, internalEndpointsEnabled:true }));
    errorResponse(await app.get('/api/docs/'),404,'ROUTE_NOT_FOUND');
    errorResponse(await app.get('/api/docs/openapi.json'),404,'ROUTE_NOT_FOUND');
    expect((await app.get('/api/mocks/users?qty=1')).body).to.have.length(1);
  });

  it('valida límites y configuración productiva', () => {
    const valid={PORT:'8080',NODE_ENV:'production',MONGODB_URI:'mongodb://127.0.0.1:27017/shipnow'};
    for(const level of ['debug','http']) expect(()=>validateConfig({...valid,LOG_LEVEL:level})).to.throw('LOG_LEVEL');
    for(const [field,value] of [['ENABLE_INTERNAL_ENDPOINTS','yes'],['JSON_LIMIT_BYTES','-1'],['UPLOAD_MAX_BYTES','0'],['REQUEST_TIMEOUT_MS','0'],['API_BASE_URL','file:///tmp/file']]) {
      expect(()=>validateConfig({...valid,[field]:value})).to.throw(field);
    }
  });

  it('pagina de manera estable y rechaza límites y desplazamientos excesivos', async () => {
    for(let i=0;i<3;i++) await createUser();
    const first=await api.get('/api/users?page=1&limit=2');
    const second=await api.get('/api/users?page=2&limit=2');
    expect(first.body.payload).to.have.length(2);
    expect(second.body.payload).to.have.length(1);
    expect(new Set([...first.body.payload,...second.body.payload].map(user=>user._id)).size).to.equal(3);
    for(const query of ['limit=101','limit=-1','page=0','page=100000000000000000000']) {
      errorResponse(await api.get(`/api/users?${query}`),400,'INVALID_DATA');
    }
  });

  it('el logger de producción usa archivos y excluye la consola', async () => {
    const logger=await buildLogger(productionSettings());
    expect(logger.transports.every(transport=>transport.constructor.name!=='Console')).to.equal(true);
    await new Promise(resolve=>{logger.once('finish',resolve);logger.end();});
  });

  it('mantiene las herramientas internas activas por defecto fuera de producción', () => {
    for (const nodeEnv of ['development', 'test']) {
      const settings = validateConfig({ PORT:'8080', NODE_ENV:nodeEnv, MONGODB_URI:'mongodb://127.0.0.1:27017/shipnow' });
      expect(settings.internalEndpointsEnabled).to.equal(true);
      expect(settings.swaggerEnabled).to.equal(true);
    }
  });

  it('aplica paginación y límites a usuarios, pedidos y entregas', async () => {
    const customer = await createUser();
    await createUser();
    await createUser();
    for (let index=0; index<3; index++) {
      const order = await api.post('/api/orders').send({
        customer:customer._id,
        deliveryAddress:`Av. Italia ${1234 + index}`,
        items:[{name:'Caja',quantity:1,price:100}],
      });
      expect(order.status).to.equal(201);
      expect((await api.post('/api/deliveries').send({order:order.body.payload._id})).status).to.equal(201);
    }
    for (const resource of ['users', 'orders', 'deliveries']) {
      const first = await api.get(`/api/${resource}?page=1&limit=2`);
      const second = await api.get(`/api/${resource}?page=2&limit=2`);
      expect(first.status).to.equal(200);
      expect(second.status).to.equal(200);
      expect(first.body.payload).to.have.length(2);
      expect(second.body.payload).to.have.length(1);
      expect(new Set([...first.body.payload, ...second.body.payload].map(item=>item._id)).size).to.equal(3);
      errorResponse(await api.get(`/api/${resource}?limit=101`),400,'INVALID_DATA');
    }
  });

  it('respeta un límite JSON configurado sin consultar la persistencia', async () => {
    const limited = request(createApp({...productionSettings(), jsonLimitBytes:2048}));
    errorResponse(await limited.post('/api/users').send({firstName:'x'.repeat(3000)}),413,'PAYLOAD_TOO_LARGE');
  });
});
