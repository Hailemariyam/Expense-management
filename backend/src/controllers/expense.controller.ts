import type { Request, Response } from 'express';
import { receiptUrlFor } from '../middleware/upload.js';
import { expenseService } from '../services/expense.service.js';
import { AppError } from '../utils/AppError.js';
import { asyncHandler } from '../utils/asyncHandler.js';
import { created, noContent, ok } from '../utils/http.js';
import { param } from '../utils/reqParams.js';

export const expenseController = {
  /** POST /api/expenses — multipart/form-data, optional `receipt` file. */
  create: asyncHandler(async (req: Request, res: Response) => {
    if (!req.auth) throw AppError.unauthenticated();
    const receiptUrl = req.file ? receiptUrlFor(req.file.filename) : null;
    const dto = await expenseService.create(req.auth, {
      amount: req.body.amount,
      category: req.body.category,
      expenseDate: req.body.expenseDate,
      comment: req.body.comment,
      receiptUrl,
    });
    return created(res, dto);
  }),

  list: asyncHandler(async (req: Request, res: Response) => {
    if (!req.auth) throw AppError.unauthenticated();
    const q = req.query as Record<string, string | undefined>;
    const page = Number(q.page ?? 1);
    const pageSize = Number(q.pageSize ?? 20);
    const { items, total } = await expenseService.list(req.auth, {
      scope: q.scope as 'me' | 'team' | undefined,
      status: q.status as never,
      category: q.category,
      dateFrom: q.dateFrom,
      dateTo: q.dateTo,
      page,
      pageSize,
    });
    return ok(res, items, 200, { page, pageSize, total });
  }),

  getById: asyncHandler(async (req: Request, res: Response) => {
    if (!req.auth) throw AppError.unauthenticated();
    return ok(res, await expenseService.getById(req.auth, param(req, 'id')));
  }),

  update: asyncHandler(async (req: Request, res: Response) => {
    if (!req.auth) throw AppError.unauthenticated();
    return ok(res, await expenseService.update(req.auth, param(req, 'id'), req.body));
  }),

  submit: asyncHandler(async (req: Request, res: Response) => {
    if (!req.auth) throw AppError.unauthenticated();
    return ok(res, await expenseService.submit(req.auth, param(req, 'id')));
  }),

  setStatus: asyncHandler(async (req: Request, res: Response) => {
    if (!req.auth) throw AppError.unauthenticated();
    return ok(res, await expenseService.setStatus(req.auth, param(req, 'id'), req.body.status));
  }),

  remove: asyncHandler(async (req: Request, res: Response) => {
    if (!req.auth) throw AppError.unauthenticated();
    await expenseService.remove(req.auth, param(req, 'id'));
    return noContent(res);
  }),
};
