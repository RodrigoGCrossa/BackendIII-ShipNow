import {Router} from 'express';
import MockController from '../controllers/mock.controller.js';
const router=Router();const controller=new MockController();
router.get('/:resource',controller.preview);
router.post('/seed',controller.seed);
export default router;
