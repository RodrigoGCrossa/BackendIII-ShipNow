import logger from '../config/logger.js';
import DeliveryRepository from '../repositories/delivery.repository.js';
import OrderRepository from '../repositories/order.repository.js';
import OrderService from './order.service.js';
import UserService from './user.service.js';
import { DELIVERY_STATUS, ORDER_STATUS, ORDER_PRIORITY, USER_ROLES } from '../constants/index.js';
import { id, fail, enumValue, pagination, objectBody } from '../utils/validation.js';

const transitions = Object.freeze({
  [DELIVERY_STATUS.PENDING]: [DELIVERY_STATUS.ASSIGNED],
  [DELIVERY_STATUS.ASSIGNED]: [DELIVERY_STATUS.IN_TRANSIT],
  [DELIVERY_STATUS.IN_TRANSIT]: [DELIVERY_STATUS.DELIVERED],
  [DELIVERY_STATUS.DELIVERED]: [],
});
const orderStatus = Object.freeze({
  [DELIVERY_STATUS.PENDING]: ORDER_STATUS.CREATED,
  [DELIVERY_STATUS.ASSIGNED]: ORDER_STATUS.ASSIGNED,
  [DELIVERY_STATUS.IN_TRANSIT]: ORDER_STATUS.IN_TRANSIT,
  [DELIVERY_STATUS.DELIVERED]: ORDER_STATUS.DELIVERED,
});

export default class DeliveryService {
  constructor(repository = new DeliveryRepository()) { this.repository = repository; }
  getAll(query) { return this.repository.findAll({}, pagination(query)); }
  async getById(value) {
    const result = await this.repository.findById(id(value));
    if (!result) fail('DELIVERY_NOT_FOUND');
    return result;
  }
  async validateDriver(value) {
    const driver = await new UserService().getById(id(value));
    if (driver.role !== USER_ROLES.DRIVER) fail('INVALID_DATA', 'El usuario no es repartidor');
    return driver;
  }
  async create(data) {
    objectBody(data);
    const order = await new OrderService().getById(id(data.order));
    if (order.delivery || await this.repository.findOne({ order: order._id })) fail('CONFLICT', 'El pedido ya tiene una entrega');
    if (order.status !== ORDER_STATUS.CREATED) fail('INVALID_STATE', 'El pedido no permite una nueva entrega');
    if (data.driver) await this.validateDriver(data.driver);
    const result = await this.repository.create({
      order: order._id, driver: data.driver || null,
      status: data.driver ? DELIVERY_STATUS.ASSIGNED : DELIVERY_STATUS.PENDING,
      priority: enumValue(data.priority ?? order.priority, ORDER_PRIORITY, 'priority'),
      assignedAt: data.driver ? new Date() : null,
    });
    try {
      const linked = await new OrderRepository().updateWithHistory(order._id, {
        delivery: result._id, status: orderStatus[result.status],
      }, order.status);
      if (!linked) fail('CONFLICT', 'El pedido cambió mientras se asignaba la entrega');
    } catch (error) {
      await this.repository.delete(result._id);
      throw error;
    }
    logger.info('Entrega creada', { event: 'delivery_created', id: String(result._id) });
    return result;
  }
  async update(value, data) {
    objectBody(data);
    const current = await this.getById(value);
    const clean = {};
    if ('driver' in data) {
      if (current.status === DELIVERY_STATUS.DELIVERED) fail('INVALID_STATE', 'No se puede cambiar el repartidor de una entrega completada');
      const driver = await this.validateDriver(data.driver);
      clean.driver = driver._id;
      clean.assignedAt = new Date();
      if (current.status === DELIVERY_STATUS.PENDING) clean.status = DELIVERY_STATUS.ASSIGNED;
    }
    if ('status' in data) {
      clean.status = enumValue(data.status, DELIVERY_STATUS, 'status');
      if (clean.status === DELIVERY_STATUS.PENDING && (clean.driver || current.driver)) fail('INVALID_STATE', 'Una entrega con repartidor no puede permanecer pendiente');
      if (clean.status !== current.status && !transitions[current.status].includes(clean.status)) fail('INVALID_STATE', 'Transición de estado inválida');
      if (clean.status !== DELIVERY_STATUS.PENDING && !clean.driver && !current.driver) fail('INVALID_STATE', 'Debe asignarse un repartidor');
      if (clean.status === DELIVERY_STATUS.DELIVERED && current.status !== DELIVERY_STATUS.DELIVERED) clean.deliveredAt = new Date();
    }
    if (!Object.keys(clean).length) fail('INVALID_DATA', 'No hay campos actualizables');
    const order = await new OrderService().getById(String(current.order));
    if (String(order.delivery) !== String(current._id)) fail('CONFLICT', 'La entrega no está vinculada al pedido');
    const result = await this.repository.updateIfStatus(value, clean, current.status);
    if (!result) fail('CONFLICT', 'La entrega cambió mientras se actualizaba');
    if (clean.status) {
      try {
        const updated = await new OrderRepository().updateWithHistory(current.order, { status: orderStatus[clean.status] }, order.status);
        if (!updated) fail('CONFLICT', 'El pedido cambió mientras se actualizaba la entrega');
      } catch (error) {
        // Compensa únicamente los campos modificados por esta operación.
        const rollback = Object.fromEntries(Object.keys(clean).map(key => [key, current[key] ?? null]));
        await this.repository.updateIfStatus(value, rollback, result.status);
        throw error;
      }
    }
    logger.info('Entrega actualizada', { event: 'delivery_updated', id: value, status: result.status });
    return result;
  }
  async delete(value) {
    const current = await this.getById(value);
    if (current.proofs?.length) fail('CONFLICT', 'La entrega tiene comprobantes asociados');
    if (current.status === DELIVERY_STATUS.DELIVERED) fail('INVALID_STATE', 'No se puede eliminar una entrega completada');
    const order = await new OrderService().getById(String(current.order));
    if (String(order.delivery) !== String(current._id)) fail('CONFLICT', 'La entrega no está vinculada al pedido');
    const expected = { status: current.status };
    if (current.updatedAt) expected.updatedAt = current.updatedAt;
    const removed = await this.repository.delete(value, expected);
    if (!removed) fail('CONFLICT', 'La entrega cambió mientras se eliminaba');
    try {
      const unlinked = await new OrderRepository().updateWithHistory(current.order, { delivery: null, status: ORDER_STATUS.CREATED }, order.status);
      if (!unlinked) fail('CONFLICT', 'El pedido cambió mientras se eliminaba la entrega');
    } catch (error) {
      try { await this.repository.create(removed); }
      catch (restoreError) {
        logger.error('No se pudo restaurar una entrega tras fallar su desvinculación', { deliveryId: value, name: restoreError.name });
      }
      throw error;
    }
    logger.info('Entrega eliminada', { event: 'delivery_deleted', id: value });
    return removed;
  }
}
