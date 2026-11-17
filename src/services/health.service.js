import config from '../config/index.js';
import { pingDatabase } from '../repositories/database.js';
import AppError from '../errors/AppError.js';

export default class HealthService {
  constructor(settings = config, ping = pingDatabase) { this.settings = settings; this.ping = ping; }
  health() {
    return { status: 'ok', environment: this.settings.nodeEnv, uptime: process.uptime(), timestamp: new Date().toISOString() };
  }
  async ready() {
    if (!await this.ping()) throw new AppError('DATABASE_UNAVAILABLE');
    return { ...this.health(), database: 'ready' };
  }
}
