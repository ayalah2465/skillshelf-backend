import multer from 'multer';
import path from 'node:path';
import { AppError } from '../middleware/errors.js';
export const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 1024 * 1024, files: 1, fields: 8, fieldSize: 20000, parts: 9 },
});
export function validateFile(file: Express.Multer.File) {
  const fileName = file.originalname;
  const extension = path.extname(fileName).toLowerCase();
  if (!['.md', '.txt', '.json'].includes(extension)) {
    throw new AppError(415, 'UNSUPPORTED_FILE', 'ניתן להעלות קובצי md, txt או json בלבד');
  }
  if (!/^[a-zA-Z0-9][a-zA-Z0-9._-]{0,179}$/.test(fileName)) {
    throw new AppError(400, 'INVALID_FILE_NAME', 'שם הקובץ חייב להכיל אותיות באנגלית, ספרות, נקודה, מקף או קו תחתון');
  }
  if (file.size === 0) throw new AppError(400, 'EMPTY_FILE', 'הקובץ ריק');
  let text: string;
  try { text = new TextDecoder('utf-8', { fatal: true }).decode(file.buffer); }
  catch { throw new AppError(415, 'INVALID_FILE_CONTENT', 'הקובץ חייב להיות טקסט בקידוד UTF-8'); }
  if (!text.trim() || /[\u0000-\u0008\u000B\u000C\u000E-\u001F]/.test(text)) {
    throw new AppError(415, 'INVALID_FILE_CONTENT', 'הקובץ אינו קובץ טקסט נתמך');
  }
  if (extension === '.json') {
    try { JSON.parse(text); }
    catch { throw new AppError(400, 'INVALID_FILE_JSON', 'תוכן קובץ JSON אינו תקין'); }
  }
  return {
    fileName, fileData: new Uint8Array(file.buffer), fileSize: file.size,
    mimeType: extension === '.json' ? 'application/json' : 'text/plain; charset=utf-8',
  };
}
