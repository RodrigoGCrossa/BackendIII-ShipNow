import HealthService from '../services/health.service.js';
export default class HealthController {
  constructor(settings) { this.service = new HealthService(settings); }
  health = (req, res) => res.json(this.service.health());
  ready = async (req, res, next) => {
    try { res.json(await this.service.ready()); } catch (error) { next(error); }
  };
}
