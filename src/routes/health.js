import { Router } from 'express';
import HealthController from '../controllers/health.controller.js';
export default function healthRouter(settings) {
  const router = Router();
  const controller = new HealthController(settings);
  router.get('/health', controller.health);
  router.get('/ready', controller.ready);
  return router;
}
