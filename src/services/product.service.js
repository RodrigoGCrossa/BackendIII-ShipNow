import ProductRepository from '../repositories/product.repository.js';
import { PRODUCT_STATUS } from '../constants/index.js';
import { id,fail,requiredText,pagination,objectBody } from '../utils/validation.js';
export default class ProductService {
 constructor(repository=new ProductRepository()) {this.repository=repository;}
 getAll(query={}) { const filter={}; if(query.available==='true') filter.stock={$gt:0}; return this.repository.findAll(filter,pagination(query)); }
 async getById(value) { const result=await this.repository.findById(id(value)); if(!result) fail('PRODUCT_NOT_FOUND','Producto no encontrado',404); return result; }
 validate(data,current={}) {objectBody(data); const clean={name:requiredText(data.name??current.name,'name'),price:data.price??current.price,stock:data.stock??current.stock}; if(typeof clean.price!=='number'||!Number.isFinite(clean.price)||clean.price<0||!Number.isInteger(clean.stock)||clean.stock<0) fail('INVALID_DATA','Precio y stock deben ser válidos y no negativos'); clean.status=clean.stock>0?PRODUCT_STATUS.AVAILABLE:PRODUCT_STATUS.OUT_OF_STOCK; return clean;}
 create(data) {return this.repository.create(this.validate(data));}
 async update(value,data) {const current=await this.getById(value);return this.repository.update(value,this.validate(data,current));}
 async delete(value) {await this.getById(value);return this.repository.delete(value);}
}
