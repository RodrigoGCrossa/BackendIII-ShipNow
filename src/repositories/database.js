import mongoose from 'mongoose';
export const connectDatabase = uri => mongoose.connect(uri, { serverSelectionTimeoutMS: 5000 });
export const disconnectDatabase = () => mongoose.disconnect();
