import Delivery from '../models/delivery.model.js';
export default class DeliveryRepository {
 async findAll(filter = {}, {skip = 0, limit = 20} = {}) { return Delivery.find(filter).select('-__v -proofs').sort({createdAt:-1,_id:-1}).skip(skip).limit(limit).lean(); }
 async findById(id) { return Delivery.findById(id).select('-__v').lean(); }
 async findOne(filter) { return Delivery.findOne(filter).select('-__v').lean(); }
 async create(data) { const result = await Delivery.create(data); return this.findById(result._id); }
 async update(id, data) { return Delivery.findByIdAndUpdate(id, {$set:data}, {new:true,runValidators:true}).select('-__v').lean(); }
 async updateIfStatus(id,data,expectedStatus) { return Delivery.findOneAndUpdate({_id:id,status:expectedStatus},{$set:data},{new:true,runValidators:true}).select('-__v').lean(); }
 async delete(id) { return Delivery.findByIdAndDelete(id).select('-__v').lean(); }
 async addDocument(id, field, metadata) { return Delivery.findByIdAndUpdate(id, {$push:{[field]:metadata}}, {new:true,runValidators:true}).select('-__v').lean(); }
}
