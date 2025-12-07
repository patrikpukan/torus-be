/**
 * Base response for mutations that don't return data,
 * just indicate success/failure with a message.
 */
export class MutationResponse {
  success!: boolean;
  message!: string;
}

/**
 * Generic response wrapper for mutations that return data.
 * Provides consistent structure with success indicator and optional message.
 */
export class DataResponse<T> {
  success!: boolean;
  message?: string;
  data!: T;
}

/**
 * Response for list operations with pagination support.
 */
export class PaginatedResponse<T> {
  success!: boolean;
  message?: string;
  data!: T[];
  total!: number;
  page!: number;
  pageSize!: number;
}

/**
 * Response for operations that validate or check conditions.
 * Indicates outcome of the validation/check.
 */
export class ValidatedResponse {
  success!: boolean;
  message!: string;
  isValid?: boolean;
}
