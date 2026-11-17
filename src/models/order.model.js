import mongoose from 'mongoose';
import fileMetadata from './file-metadata.schema.js';
import { ORDER_STATUS, ORDER_PRIORITY } from '../constants/index.js';

const itemSchema = new mongoose.Schema({
  name: { type: String, required: true },
  quantity: { type: Number, required: true, min: 1 },
  price: { type: Number, required: true, min: 0 },
}, { _id: false });
const historySchema = new mongoose.Schema({
  status: { type: String, enum: Object.values(ORDER_STATUS), required: true },
  timestamp: { type: Date, required: true },
}, { _id: false });
const schema = new mongoose.Schema({
  customer: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  items: { type: [itemSchema], required: true, validate: items => items.length > 0 },
  deliveryAddress: { type: String, required: true, trim: true },
  declaredValue: { type: Number, min: 0, default: 0 },
  shippingCost: { type: Number, min: 0, default: 0 },
  total: { type: Number, min: 0, default: 0 },
  status: { type: String, enum: Object.values(ORDER_STATUS), default: ORDER_STATUS.CREATED },
  priority: { type: String, enum: Object.values(ORDER_PRIORITY), default: ORDER_PRIORITY.NORMAL },
  delivery: { type: mongoose.Schema.Types.ObjectId, ref: 'Delivery', default: null },
  trackingCode: { type: String, unique: true, sparse: true },
  history: { type: [historySchema], default: [] },
  proofs: { type: [fileMetadata], default: [] },
}, { timestamps: true });
schema.index({ createdAt: -1, _id: -1 });
schema.index({ customer: 1 });
schema.index({ status: 1, createdAt: -1, _id: -1 });
export default mongoose.model('Order', schema);
