import { Router } from 'express';
import OrderController from '../controllers/order.controller.js';
const router = Router();
const controller = new OrderController();
router.get('/:trackingCode', controller.tracking);
export default router;
