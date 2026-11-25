import { Response } from 'express';
import { ApiResponse } from '../../shared/types';

export function sendSuccess<T>(
  res: Response,
  statusCode: number,
  message: string,
  data: T
): void {
  const payload: ApiResponse<T> = { success: true, message, data };
  res.status(statusCode).json(payload);
}

export function sendError(res: Response, statusCode: number, message: string): void {
  const payload: ApiResponse<null> = { success: false, message, data: null };
  res.status(statusCode).json(payload);
}

export function isNonEmptyString(value: unknown): value is string {
  return typeof value === 'string' && value.trim().length > 0;
}
