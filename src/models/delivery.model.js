import fileMetadata from './file-metadata.schema.js';
import mongoose from 'mongoose';
import { DELIVERY_STATUS, ORDER_PRIORITY } from '../constants/index.js';
const schema = new mongoose.Schema({
 proofs:{type:[fileMetadata],default:[]},
 order:{type:mongoose.Schema.Types.ObjectId,ref:'Order',required:true,unique:true},driver:{type:mongoose.Schema.Types.ObjectId,ref:'User',default:null},
 status:{type:String,enum:Object.values(DELIVERY_STATUS),default:DELIVERY_STATUS.PENDING},priority:{type:String,enum:Object.values(ORDER_PRIORITY),default:ORDER_PRIORITY.NORMAL},
 assignedAt:{type:Date,default:null},deliveredAt:{type:Date,default:null}
},{timestamps:true});
schema.index({ createdAt: -1, _id: -1 });
schema.index({ driver: 1 });
export default mongoose.model('Delivery',schema);
