import AppError from '../errors/AppError.js';
export function fail(code,message) {throw new AppError(code,message);}
export function id(value) { if (typeof value !== 'string' || !/^[a-f0-9]{24}$/i.test(value)) fail('INVALID_ID', 'El ID debe tener 24 caracteres hexadecimales'); return value; }
export function requiredText(value, field) { if (typeof value !== 'string' || !value.trim()) fail('INVALID_DATA', `El campo ${field} es obligatorio`); return value.trim(); }
export function enumValue(value, values, field) { if (!Object.values(values).includes(value)) fail('INVALID_STATE', `Valor inválido para ${field}`); return value; }
export function pagination(query = {}) {
 const page = Number(query.page ?? 1), limit = Number(query.limit ?? 20);
 if (!Number.isSafeInteger(page) || page < 1 || !Number.isSafeInteger(limit) || limit < 1 || limit > 100 || !Number.isSafeInteger((page - 1) * limit) || (page - 1) * limit > 100000) fail('INVALID_DATA', 'page debe ser positivo, limit debe estar entre 1 y 100 y el desplazamiento no puede superar 100000');
 return { skip: (page - 1) * limit, limit };
}
export function objectBody(data) { if (!data || typeof data !== 'object' || Array.isArray(data)) fail('INVALID_DATA', 'Se requiere un objeto JSON'); }
