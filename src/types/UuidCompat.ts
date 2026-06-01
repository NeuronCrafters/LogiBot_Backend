export class UuidCompat {
  private readonly value: string;

  constructor(value?: string) {
    this.value = value || crypto.randomUUID();
  }

  static isValid(value: unknown) {
    return typeof value === "string" && /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value);
  }

  equals(other: unknown) {
    return String(other) === this.value;
  }

  toString() {
    return this.value;
  }

  valueOf() {
    return this.value;
  }
}

export namespace Types {
  export type Uuid = string;
  export const Uuid = UuidCompat;
}

export function isValidUuid(value: unknown) {
  return UuidCompat.isValid(value);
}

export type Model<T = any> = any;
export type Document = Record<string, any>;
export type Query<T = any, D = any> = any;

export class Schema<T = any> {
  static Types = { Uuid: UuidCompat };
  methods: Record<string, unknown> = {};

  constructor(_definition?: unknown, _options?: unknown) {}
  pre(..._args: unknown[]) {}
  index(..._args: unknown[]) {}
}

class ValidationError extends Error {
  errors: Record<string, { message: string }> = {};
}

class CastError extends Error {
  path = "";
  value: unknown;
}

const compat = {
  Types,
  Schema,
  Error: { ValidationError, CastError },
  model: () => ({}),
};

export default compat;
