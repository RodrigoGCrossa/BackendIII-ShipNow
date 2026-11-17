import AppError from '../errors/AppError.js';
export function fail(code,message) {throw new AppError(code,message);}
export function id(value) { if (typeof value !== 'string' || !/^[a-f0-9]{24}$/i.test(value)) fail('INVALID_ID', 'El ID debe tener 24 caracteres hexadecimales'); return value; }
export function requiredText(value, field) { if (typeof value !== 'string' || !value.trim()) fail('INVALID_DATA', `El campo ${field} es obligatorio`); return value.trim(); }
export function enumValue(value, values, field) { if (!Object.values(values).includes(value)) fail('INVALID_STATE', `Valor inválido para ${field}`); return value; }
export function pagination(query = {}) {
 const page = Number(query.page ?? 1), limit = Number(query.limit ?? 20);
 if (!Number.isInteger(page) || page < 1 || !Number.isInteger(limit) || limit < 1 || limit > 100) fail('INVALID_DATA', 'page debe ser positivo y limit debe estar entre 1 y 100');
 return { skip: (page - 1) * limit, limit };
}
export function objectBody(data) { if (!data || typeof data !== 'object' || Array.isArray(data)) fail('INVALID_DATA', 'Se requiere un objeto JSON'); }
