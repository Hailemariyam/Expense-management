import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import multer from 'multer';
import { env } from '../config/env.js';
import { AppError } from '../utils/AppError.js';

/**
 * Receipt upload — local disk storage for this milestone (README §Receipt
 * Upload). Swap the storage engine for S3/GCS later without touching callers.
 *
 * Files land in <UPLOAD_DIR>/ with a random name; the expense's receipt_url is
 * built from PUBLIC_BASE_URL + the static mount (/uploads/...).
 */
const uploadDir = path.resolve(process.cwd(), env.UPLOAD_DIR);
fs.mkdirSync(uploadDir, { recursive: true });

const ALLOWED_MIME = new Set([
  'image/jpeg',
  'image/png',
  'image/webp',
  'image/heic',
  'application/pdf',
]);

const storage = multer.diskStorage({
  destination: (_req, _file, cb) => cb(null, uploadDir),
  filename: (_req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase().slice(0, 10);
    cb(null, `${Date.now()}-${crypto.randomBytes(8).toString('hex')}${ext}`);
  },
});

export const uploadReceipt = multer({
  storage,
  limits: { fileSize: env.MAX_UPLOAD_BYTES, files: 1 },
  fileFilter: (_req, file, cb) => {
    if (!ALLOWED_MIME.has(file.mimetype)) {
      cb(AppError.badRequest(`Unsupported file type: ${file.mimetype}`));
      return;
    }
    cb(null, true);
  },
}).single('receipt');

/** Build the public URL stored in expenses.receipt_url. */
export function receiptUrlFor(filename: string): string {
  return `${env.PUBLIC_BASE_URL.replace(/\/$/, '')}/uploads/${filename}`;
}
