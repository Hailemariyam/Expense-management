import { Router } from 'express';
import { userController } from '../controllers/user.controller.js';
import { authenticate } from '../middleware/authenticate.js';
import { authorize } from '../middleware/authorize.js';
import { validate } from '../middleware/validate.js';
import { uuidParam } from '../validators/common.js';
import { listUsersQuery, updateUserSchema } from '../validators/user.validators.js';

export const userRouter = Router();

// SOW §2: "Manage company users" is Admin-only. Whole router is admin-gated.
userRouter.use(authenticate, authorize('admin'));

userRouter.get('/', validate({ query: listUsersQuery }), userController.list);
userRouter.get('/:id', validate({ params: uuidParam }), userController.getById);
userRouter.patch(
  '/:id',
  validate({ params: uuidParam, body: updateUserSchema }),
  userController.update,
);
userRouter.delete('/:id', validate({ params: uuidParam }), userController.remove);
