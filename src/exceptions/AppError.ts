import { isMessageKey, t, type LocalizedMessage, type MessageKey, type MessageParams } from "../i18n";

export class AppError extends Error {
  public readonly statusCode: number;
  public readonly cause?: unknown;
  public readonly code?: MessageKey;
  public readonly params: MessageParams;

  constructor(message: string | LocalizedMessage, statusCode = 400, cause?: unknown) {
    const key = typeof message === "string" ? message : message.key;
    const params = typeof message === "string" ? {} : message.params || {};
    const code = isMessageKey(key) ? key : undefined;
    super(code ? t(code, params) : key);
    this.statusCode = statusCode;
    this.cause = cause;
    this.code = code;
    this.params = params;
  }
}
