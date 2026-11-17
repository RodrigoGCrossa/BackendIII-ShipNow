import { expect } from 'chai';
import { readdir } from 'node:fs/promises';
import path from 'node:path';
import { api, createUser, errorResponse } from './helpers.js';
import config from '../src/config/index.js';
import UserRepository from '../src/repositories/user.repository.js';
import MockRepository from '../src/repositories/mock.repository.js';

const pdf=Buffer.from('%PDF-1.4\nPrueba de limpieza\n%%EOF');
describe('Fallos simulados de dependencias por HTTP',()=>{
  it('normaliza un error inesperado sin revelar el diagnóstico',async()=>{
    const original=UserRepository.prototype.findAll;
    UserRepository.prototype.findAll=async()=>{throw new Error('DIAGNOSTICO_PRIVADO');};
    try {
      const response=await api.get('/api/users');
      errorResponse(response,500,'INTERNAL_ERROR');
      expect(response.body.error.message).to.equal('Error interno del servidor');
      expect(JSON.stringify(response.body)).not.to.include('DIAGNOSTICO_PRIVADO');
    } finally { UserRepository.prototype.findAll=original; }
  });
  it('responde 503 ante fallo del seed sin declarar una inserción exitosa',async()=>{
    const original=MockRepository.prototype.insertBundle;
    MockRepository.prototype.insertBundle=async()=>{throw new Error('Falla simulada');};
    try {
      const response=await api.post('/api/mocks/seed?qty=1').send({resource:'users'});
      errorResponse(response,503,'MOCK_PERSISTENCE_ERROR');
      expect((await api.get('/api/users')).body.payload).to.deep.equal([]);
    } finally { MockRepository.prototype.insertBundle=original; }
  });
  it('limpia el archivo si falla el guardado de sus metadatos',async()=>{
    const user=await createUser();
    const original=UserRepository.prototype.addDocument;
    UserRepository.prototype.addDocument=async()=>{throw new Error('Falla simulada');};
    try {
      const response=await api.post(`/api/users/${user._id}/documents`).field('documentType','user_document').attach('file',pdf,'documento.pdf');
      errorResponse(response,500,'FILE_SAVE_ERROR');
      expect((await api.get(`/api/users/${user._id}/documents`)).body.payload).to.deep.equal([]);
      expect(await readdir(path.join(config.uploadDir,'user-documents'))).to.deep.equal([]);
    } finally { UserRepository.prototype.addDocument=original; }
  });
});
