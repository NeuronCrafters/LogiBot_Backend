export class AppError extends Error {
  public readonly statusCode: number;
  public readonly cause?: unknown;

  constructor(message: string, statusCode = 400, cause?: unknown) {
    super(message);
    this.statusCode = statusCode;
    this.cause = cause;
  }
}
