import mongoose from 'mongoose';

export const connectDatabase = uri => mongoose.connect(uri, {
  serverSelectionTimeoutMS: 5000,
  maxPoolSize: 10,
  minPoolSize: 0,
});
export const disconnectDatabase = () => mongoose.disconnect();
export async function pingDatabase() {
  if (mongoose.connection.readyState !== 1) return false;
  try {
    await mongoose.connection.db.admin().command({ ping: 1 }, { timeoutMS: 2000 });
    return true;
  } catch { return false; }
}
