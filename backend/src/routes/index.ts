import { Router } from 'express';
import { analyticsRouter } from './analytics.routes.js';
import { authRouter } from './auth.routes.js';
import { companyRouter } from './company.routes.js';
import { expenseRouter } from './expense.routes.js';
import { userRouter } from './user.routes.js';

export const apiRouter = Router();

apiRouter.get('/health', (_req, res) => {
  res.json({ data: { status: 'ok', ts: new Date().toISOString() } });
});

apiRouter.use('/auth', authRouter);
apiRouter.use('/companies', companyRouter);
apiRouter.use('/users', userRouter);
apiRouter.use('/expenses', expenseRouter);
apiRouter.use('/analytics', analyticsRouter);
