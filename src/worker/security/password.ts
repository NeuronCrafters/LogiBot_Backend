import { compare, hash } from "bcryptjs";

export function hashPassword(password: string) {
  return hash(password, 10);
}

export function verifyPassword(password: string, hashedPassword: string) {
  return compare(password, hashedPassword);
}
