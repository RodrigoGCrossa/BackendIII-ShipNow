import {rm} from 'node:fs/promises';
import {randomUUID} from 'node:crypto';
import {MongoMemoryServer} from 'mongodb-memory-server-core';
import mongoose from 'mongoose';
import config from '../src/config/index.js';
import logger from '../src/config/logger.js';
let database;
const dbName=`shipnow_test_${randomUUID().replaceAll('-','')}`;
export const mochaHooks={
 async beforeAll() {
  this.timeout(90000);
  if(config.nodeEnv!=='test') throw new Error('Las pruebas requieren NODE_ENV=test');
  database=await MongoMemoryServer.create({binary:{version:'7.0.24',...(config.mongoBinary?{systemBinary:config.mongoBinary}:{})},instance:{dbName,ip:'127.0.0.1'}});
  await mongoose.connect(database.getUri(),{dbName});
 },
 async beforeEach() {
  if(mongoose.connection.name!==dbName) throw new Error('Se bloqueó la limpieza de una base ajena a la suite');
  await rm(config.uploadDir,{recursive:true,force:true});
  for(const collection of Object.values(mongoose.connection.collections)) await collection.deleteMany({});
 },
 async afterAll() {
  if(mongoose.connection.readyState && mongoose.connection.name===dbName) await mongoose.connection.dropDatabase();
  await rm(config.uploadDir,{recursive:true,force:true});
  await mongoose.disconnect(); if(database) await database.stop();
  await new Promise(resolve=>{logger.on('finish',resolve);logger.end();});
 }
};
