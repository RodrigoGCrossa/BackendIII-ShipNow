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
});
