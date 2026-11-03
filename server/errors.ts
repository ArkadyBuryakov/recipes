import type { z } from "zod";

export type ErrorCode = "validation" | "not_found" | "conflict" | "forbidden" | "unauthorized";

const STATUS: Record<ErrorCode, number> = {
  validation: 400,
  unauthorized: 401,
  forbidden: 403,
  not_found: 404,
  conflict: 409,
};

export class DomainError extends Error {
  constructor(
    readonly code: ErrorCode,
    message: string,
    readonly issues: string[] = [],
  ) {
    super(message);
  }

  get status() {
    return STATUS[this.code];
  }

  toJSON() {
    return { error: this.code, message: this.message, ...(this.issues.length && { issues: this.issues }) };
  }
}

/** Flatten zod issues into "path: message" lines that read well for humans and agents. */
export function formatIssues(error: z.ZodError): string[] {
  return error.issues.map((i) => (i.path.length ? `${i.path.join(".")}: ${i.message}` : i.message));
}

export function validationError(error: z.ZodError, message = "Recipe is invalid"): DomainError {
  return new DomainError("validation", message, formatIssues(error));
}
