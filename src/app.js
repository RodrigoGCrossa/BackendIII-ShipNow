import express from 'express';
import swaggerUi from 'swagger-ui-express';
import specification from './config/swagger.js';
import config from './config/index.js';
import loggerRouter from './routes/logger.js';
import requestLogger from './middlewares/request-logger.middleware.js';
import mocks from './routes/mocks.js';
import users from './routes/users.js';
import products from './routes/products.js';
import orders from './routes/orders.js';
import deliveries from './routes/deliveries.js';
import healthRouter from './routes/health.js';
import AppError from './errors/AppError.js';
import errorHandler from './middlewares/error.middleware.js';

export function createApp(settings = config) {
  const app = express();
  app.disable('x-powered-by');
  app.use(requestLogger);
  app.use(express.json({ limit: settings.jsonLimitBytes }));
  if (settings.swaggerEnabled) {
    app.get('/api/docs/openapi.json', (req, res) => res.json(specification));
    app.use('/api/docs', swaggerUi.serve, swaggerUi.setup(specification));
  }
  if (settings.internalEndpointsEnabled) {
    app.use('/api/logger', loggerRouter);
    app.use('/api/mocks', mocks);
  }
  app.use('/api/users', users);
  app.use('/api/products', products);
  app.use('/api/orders', orders);
  app.use('/api/deliveries', deliveries);
  app.use('/api', healthRouter(settings));
  app.use((req, res, next) => next(new AppError('ROUTE_NOT_FOUND')));
  app.use(errorHandler);
  return app;
}

export default createApp();
