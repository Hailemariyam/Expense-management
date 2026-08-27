import { Router } from 'express';
import { companyController } from '../controllers/company.controller.js';
import { authenticate } from '../middleware/authenticate.js';
import { authorize } from '../middleware/authorize.js';
import { validate } from '../middleware/validate.js';
import {
  createCompanySchema,
  renameCompanySchema,
} from '../validators/company.validators.js';

export const companyRouter = Router();

companyRouter.use(authenticate);

companyRouter.get('/me', companyController.getMine);
companyRouter.patch(
  '/me',
  authorize('admin'),
  validate({ body: renameCompanySchema }),
  companyController.rename,
);

// Present for API-contract completeness; real create/join is via /api/auth/register.
companyRouter.post('/', validate({ body: createCompanySchema }), companyController.create);
companyRouter.post('/join', companyController.join);
