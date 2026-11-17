import mongoose from 'mongoose';
import { PRODUCT_STATUS } from '../constants/index.js';
const schema = new mongoose.Schema({ name: {type: String, required:true, trim:true}, price: {type:Number,required:true,min:0}, stock:{type:Number,required:true,min:0}, status:{type:String,enum:Object.values(PRODUCT_STATUS),default:PRODUCT_STATUS.AVAILABLE} }, {timestamps:true});
schema.index({ createdAt: -1, _id: -1 });
export default mongoose.model('Product',schema);
