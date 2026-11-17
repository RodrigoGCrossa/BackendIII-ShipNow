import {Router} from 'express';
import DeliveryController from '../controllers/delivery.controller.js';
const router=Router();const controller=new DeliveryController();
router.get('/',controller.getAll);
router.get('/:id',controller.getById);
router.post('/',controller.create);
router.put('/:id',controller.update);
router.delete('/:id',controller.delete);
export default router;
