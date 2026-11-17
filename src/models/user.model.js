import fileMetadata from './file-metadata.schema.js';
import mongoose from 'mongoose';
import { USER_ROLES } from '../constants/index.js';
const schema = new mongoose.Schema({
 documents:{type:[fileMetadata],default:[]},
 firstName: { type: String, required: true, trim: true }, lastName: { type: String, required: true, trim: true },
 email: { type: String, required: true, unique: true, lowercase: true, trim: true },
 password: { type: String, required: true, select: false },
 role: { type: String, enum: Object.values(USER_ROLES), default: USER_ROLES.CUSTOMER },
 isAvailable: { type: Boolean, default: false }
}, { timestamps: true });
export default mongoose.model('User', schema);
