import Order from '../models/order.model.js';
export default class OrderRepository {
 async findAll(filter = {}, {skip = 0, limit = 20} = {}) { return Order.find(filter).select('-__v').sort({createdAt:-1,_id:-1}).skip(skip).limit(limit).lean(); }
 async findById(id) { return Order.findById(id).select('-__v').lean(); }
 async findOne(filter) { return Order.findOne(filter).select('-__v').lean(); }
 async create(data) { const result = await Order.create(data); return this.findById(result._id); }
 async update(id, data) { return Order.findByIdAndUpdate(id, {$set:data}, {new:true,runValidators:true}).select('-__v').lean(); }
 async delete(id) { return Order.findByIdAndDelete(id).select('-__v').lean(); }
 async addDocument(id, field, metadata) { return Order.findByIdAndUpdate(id, {$push:{[field]:metadata}}, {new:true,runValidators:true}).select('-__v').lean(); }
}
