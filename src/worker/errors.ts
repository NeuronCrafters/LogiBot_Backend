export class HttpError extends Error {
  constructor(message: string, public readonly statusCode = 500) {
    super(message);
    this.name = "HttpError";
  }
}

export function getErrorPayload(error: unknown) {
  if (error instanceof HttpError) {
    return {
      status: error.statusCode,
      body: { success: false, message: error.message },
    };
  }

  if (error instanceof Error) {
    return {
      status: 500,
      body: { success: false, message: error.message || "erro interno no servidor" },
    };
  }

  return {
    status: 500,
    body: { success: false, message: "erro interno no servidor" },
  };
}
