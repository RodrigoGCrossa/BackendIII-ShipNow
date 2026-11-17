import User from '../models/user.model.js';
import Order from '../models/order.model.js';
import Delivery from '../models/delivery.model.js';
export default class MockRepository {
 async insertBundle(bundle) {
  try {
   if(bundle.users.length) await User.insertMany(bundle.users);
   if(bundle.orders.length) await Order.insertMany(bundle.orders);
   if(bundle.deliveries.length) await Delivery.insertMany(bundle.deliveries);
  } catch(error) {
   // Compensación limitada a los IDs generados para esta carga; nunca borra datos previos.
   await Promise.all([Delivery.deleteMany({_id:{$in:bundle.deliveries.map(x=>x._id)}}),Order.deleteMany({_id:{$in:bundle.orders.map(x=>x._id)}}),User.deleteMany({_id:{$in:bundle.users.map(x=>x._id)}})]);
   throw error;
  }
 }
}
