import User from '../models/user.model.js';
export default class UserRepository {
 async findAll(filter = {}, {skip = 0, limit = 20} = {}) { return User.find(filter).select('-password -documents').sort({createdAt:-1,_id:-1}).skip(skip).limit(limit).lean(); }
 async findById(id) { return User.findById(id).select('-password').lean(); }
 async findOne(filter) { return User.findOne(filter).select('-password').lean(); }
 async create(data) { const result = await User.create(data); return this.findById(result._id); }
 async update(id, data) { return User.findByIdAndUpdate(id, {$set:data}, {new:true,runValidators:true}).select('-password').lean(); }
 async delete(id) { return User.findByIdAndDelete(id).select('-password').lean(); }
 async addDocument(id, field, metadata) { return User.findByIdAndUpdate(id, {$push:{[field]:metadata}}, {new:true,runValidators:true}).select('-password').lean(); }
}
