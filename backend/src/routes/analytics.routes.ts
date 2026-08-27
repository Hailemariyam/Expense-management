import { Router } from 'express';
import { analyticsController } from '../controllers/analytics.controller.js';
import { authenticate } from '../middleware/authenticate.js';
import { authorize } from '../middleware/authorize.js';
import { validate } from '../middleware/validate.js';
import { byCategoryQuery, monthlyQuery } from '../validators/expense.validators.js';

export const analyticsRouter = Router();

// Company-wide figures → Manager or Admin only.
analyticsRouter.use(authenticate, authorize('manager', 'admin'));

analyticsRouter.get('/monthly', validate({ query: monthlyQuery }), analyticsController.monthly);
analyticsRouter.get(
  '/by-category',
  validate({ query: byCategoryQuery }),
  analyticsController.byCategory,
);
analyticsRouter.get('/dashboard', analyticsController.dashboard);
