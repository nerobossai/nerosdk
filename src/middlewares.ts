import { NextFunction, Request, Response } from "express";

import ErrorResponse from "./interfaces/ErrorResponse";
import { logger } from "./logger";
import { ERROR_TYPES } from "./utils/constants";

export function validateApiKey(
  req: Request,
  res: Response,
  next: NextFunction
) {
  const apiKey = req.headers["x-api-key"];

  if (!apiKey) {
    // log invalid api key error
    logger.error({
      message: "api key not provided",
      type: "API_KEY_NOT_PROVIDED",
    });
    res.sendStatus(401);
    return;
  }

  if (apiKey !== process.env.API_KEY) {
    // log invalid api key error
    logger.error({
      message: "invalid api key",
      type: "INVALID_API_KEY",
    });
    res.sendStatus(401);
    return;
  }

  next();
}

export function notFound(req: Request, res: Response, next: NextFunction) {
  res.status(404);
  const error = new Error(`Not Found - ${req.originalUrl}`);
  next(error);
}

// eslint-disable-next-line @typescript-eslint/no-unused-vars
export function errorHandler(
  err: any,
  req: Request,
  res: Response<ErrorResponse>,
  next: NextFunction
) {
  const statusCode =
    res.statusCode !== 200
      ? res.statusCode
      : err.statusCode
      ? err.statusCode
      : 500;
  res.status(statusCode);
  res.json({
    message: err.message,
    code: err.type ? err.type : ERROR_TYPES.INTERNAL,
  });
}
