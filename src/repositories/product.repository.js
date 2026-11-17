import Product from '../models/product.model.js';
export default class ProductRepository {
 async findAll(filter = {}, {skip = 0, limit = 20} = {}) { return Product.find(filter).select('-__v').sort({createdAt:-1,_id:-1}).skip(skip).limit(limit).lean(); }
 async findById(id) { return Product.findById(id).select('-__v').lean(); }
 async findOne(filter) { return Product.findOne(filter).select('-__v').lean(); }
 async create(data) { const result = await Product.create(data); return this.findById(result._id); }
 async update(id, data) { return Product.findByIdAndUpdate(id, {$set:data}, {new:true,runValidators:true}).select('-__v').lean(); }
 async delete(id) { return Product.findByIdAndDelete(id).select('-__v').lean(); }
}
