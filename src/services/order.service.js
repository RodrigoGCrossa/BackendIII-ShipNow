import { randomUUID } from 'node:crypto';
import logger from '../config/logger.js';
import config from '../config/index.js';
import OrderRepository from '../repositories/order.repository.js';
import UserService from './user.service.js';
import { ORDER_STATUS, ORDER_PRIORITY, USER_ROLES } from '../constants/index.js';
import { id, fail, requiredText, enumValue, pagination, objectBody } from '../utils/validation.js';

const transitions = Object.freeze({
  [ORDER_STATUS.CREATED]: [ORDER_STATUS.ASSIGNED, ORDER_STATUS.CANCELLED],
  [ORDER_STATUS.ASSIGNED]: [ORDER_STATUS.PICKED_UP, ORDER_STATUS.CANCELLED],
  [ORDER_STATUS.PICKED_UP]: [ORDER_STATUS.IN_TRANSIT],
  [ORDER_STATUS.IN_TRANSIT]: [ORDER_STATUS.DELIVERED],
  [ORDER_STATUS.DELIVERED]: [],
  [ORDER_STATUS.CANCELLED]: [],
});
export const newTrackingCode = () => `SN-${randomUUID().replaceAll('-', '').toUpperCase()}`;

export default class OrderService {
  constructor(repository = new OrderRepository()) { this.repository = repository; }

  getAll(query = {}) {
    const filter = {};
    if (query.status) filter.status = enumValue(query.status, ORDER_STATUS, 'status');
    return this.repository.findAll(filter, pagination(query));
  }

  async getById(value) {
    const result = await this.repository.findById(id(value));
    if (!result) fail('ORDER_NOT_FOUND');
    return result;
  }

  async tracking(value) {
    if (typeof value !== 'string' || !/^SN-[A-F0-9]{32}$/.test(value)) fail('INVALID_TRACKING_CODE');
    const result = await this.repository.findTracking(value);
    if (!result) fail('ORDER_NOT_FOUND');
    return result;
  }

  async create(data) {
    objectBody(data);
    const customer = await new UserService().getById(id(data.customer));
    if (![USER_ROLES.CUSTOMER, USER_ROLES.USER].includes(customer.role)) fail('INVALID_DATA', 'El usuario debe tener rol de cliente');
    const deliveryAddress = requiredText(data.deliveryAddress, 'deliveryAddress');
    if (!Array.isArray(data.items) || data.items.length < 1 || data.items.length > 100) fail('INVALID_DATA', 'El pedido debe tener entre 1 y 100 items');
    const items = data.items.map(item => {
      objectBody(item);
      const name = requiredText(item.name, 'name');
      if (!Number.isSafeInteger(item.quantity) || item.quantity < 1 || typeof item.price !== 'number' || !Number.isFinite(item.price) || item.price < 0) {
        fail('INVALID_DATA', 'Cantidad o precio inválido');
      }
      return { name, quantity: item.quantity, price: item.price };
    });
    const declaredValue = Math.round(items.reduce((sum, item) => sum + item.quantity * item.price, 0) * 100) / 100;
    if (!Number.isFinite(declaredValue) || declaredValue > Number.MAX_SAFE_INTEGER / 100) fail('INVALID_DATA', 'El total excede el rango permitido');
    const shippingCost = config.nodeEnv === 'production' ? Math.round((50 + declaredValue * 0.01) * 100) / 100 : 10;
    const priority = enumValue(data.priority ?? ORDER_PRIORITY.NORMAL, ORDER_PRIORITY, 'priority');
    const result = await this.repository.create({
      customer: customer._id, deliveryAddress, items, declaredValue, shippingCost,
      total: Math.round((declaredValue + shippingCost) * 100) / 100,
      status: ORDER_STATUS.CREATED, priority, trackingCode: newTrackingCode(),
      history: [{ status: ORDER_STATUS.CREATED, timestamp: new Date() }],
    });
    logger.info('Pedido creado', { event: 'order_created', id: String(result._id) });
    return result;
  }

  async update(value, data) {
    objectBody(data);
    const current = await this.getById(value);
    const clean = {};
    if ('status' in data) {
      clean.status = enumValue(data.status, ORDER_STATUS, 'status');
      if (current.delivery && clean.status !== current.status) fail('INVALID_STATE', 'Actualizá el estado desde la entrega asociada');
      if (clean.status !== current.status && !transitions[current.status].includes(clean.status)) fail('INVALID_STATE', 'Transición de estado inválida');
    }
    if ('priority' in data) clean.priority = enumValue(data.priority, ORDER_PRIORITY, 'priority');
    if ('deliveryAddress' in data) {
      if ([ORDER_STATUS.DELIVERED, ORDER_STATUS.CANCELLED].includes(current.status)) fail('INVALID_STATE', 'No se puede cambiar la dirección de un pedido cerrado');
      clean.deliveryAddress = requiredText(data.deliveryAddress, 'deliveryAddress');
    }
    if (!Object.keys(clean).length) fail('INVALID_DATA', 'No hay campos actualizables');
    const result = await this.repository.updateWithHistory(value, clean, current.status);
    if (!result) fail('CONFLICT', 'El pedido cambió mientras se actualizaba');
    logger.info('Pedido actualizado', { event: 'order_updated', id: value, status: result.status });
    return result;
  }

  async delete(value) {
    const current = await this.getById(value);
    if (current.proofs?.length) fail('CONFLICT', 'El pedido tiene comprobantes asociados');
    if (current.delivery) fail('CONFLICT', 'El pedido tiene una entrega asociada');
    return this.repository.delete(value);
  }
}
