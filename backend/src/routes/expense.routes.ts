import { Router } from 'express';
import { expenseController } from '../controllers/expense.controller.js';
import { authenticate } from '../middleware/authenticate.js';
import { authorize } from '../middleware/authorize.js';
import { uploadReceipt } from '../middleware/upload.js';
import { validate } from '../middleware/validate.js';
import { uuidParam } from '../validators/common.js';
import {
  createExpenseSchema,
  listExpensesQuery,
  setStatusSchema,
  updateExpenseSchema,
} from '../validators/expense.validators.js';

export const expenseRouter = Router();

expenseRouter.use(authenticate);

// Create — multipart: parse the optional file first, then validate text fields.
expenseRouter.post(
  '/',
  uploadReceipt,
  validate({ body: createExpenseSchema }),
  expenseController.create,
);

expenseRouter.get('/', validate({ query: listExpensesQuery }), expenseController.list);
expenseRouter.get('/:id', validate({ params: uuidParam }), expenseController.getById);

expenseRouter.patch(
  '/:id',
  validate({ params: uuidParam, body: updateExpenseSchema }),
  expenseController.update,
);

expenseRouter.post('/:id/submit', validate({ params: uuidParam }), expenseController.submit);

// Approve / reject — Manager or Admin only (SOW §2).
expenseRouter.patch(
  '/:id/status',
  authorize('manager', 'admin'),
  validate({ params: uuidParam, body: setStatusSchema }),
  expenseController.setStatus,
);

expenseRouter.delete('/:id', validate({ params: uuidParam }), expenseController.remove);
