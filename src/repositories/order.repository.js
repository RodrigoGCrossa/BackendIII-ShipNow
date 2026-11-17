import Order from '../models/order.model.js';

export default class OrderRepository {
  async findAll(filter = {}, { skip = 0, limit = 20 } = {}) {
    return Order.find(filter).select('-__v -proofs -history').sort({ createdAt: -1, _id: -1 }).skip(skip).limit(limit).lean();
  }
  async findById(id) { return Order.findById(id).select('-__v').lean(); }
  async findOne(filter) { return Order.findOne(filter).select('-__v').lean(); }
  async findTracking(trackingCode) {
    return Order.findOne({ trackingCode }).select('trackingCode status history -_id').lean();
  }
  async create(data) { const result = await Order.create(data); return this.findById(result._id); }
  async update(id, data) {
    return Order.findByIdAndUpdate(id, { $set: data }, { new: true, runValidators: true }).select('-__v').lean();
  }
  async updateWithHistory(id, data, expectedStatus, timestamp = new Date()) {
    const update = { $set: data };
    if (data.status && data.status !== expectedStatus) update.$push = { history: { status: data.status, timestamp } };
    return Order.findOneAndUpdate({ _id: id, status: expectedStatus }, update, { new: true, runValidators: true }).select('-__v').lean();
  }
  async delete(id) { return Order.findByIdAndDelete(id).select('-__v').lean(); }
  async addDocument(id, field, metadata) {
    return Order.findByIdAndUpdate(id, { $push: { [field]: metadata } }, { new: true, runValidators: true }).select('-__v').lean();
  }
}
