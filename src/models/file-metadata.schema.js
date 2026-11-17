import mongoose from 'mongoose';
import {DOCUMENT_TYPES} from '../constants/index.js';
export default new mongoose.Schema({originalName:{type:String,required:true},filename:{type:String,required:true},path:{type:String,required:true},mimeType:{type:String,required:true},size:{type:Number,required:true},documentType:{type:String,enum:Object.values(DOCUMENT_TYPES),required:true},uploadedAt:{type:Date,default:Date.now}});
