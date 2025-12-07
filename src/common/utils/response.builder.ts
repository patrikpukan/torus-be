import {
  DataResponse,
  MutationResponse,
  PaginatedResponse,
  ValidatedResponse,
} from '../dto/responses/base.response';

/**
 * Helper utilities for building consistent response objects.
 * These ensure all responses follow the standardized pattern.
 */
export class ResponseBuilder {
  /**
   * Build a success mutation response with optional message and data.
   * Use for mutations that complete successfully.
   */
  static success<T>(data: T, message = 'Operation completed successfully'): DataResponse<T> {
    return {
      success: true,
      message,
      data,
    };
  }

  /**
   * Build a success response without data (for delete/soft operations).
   */
  static mutationSuccess(message = 'Operation completed successfully'): MutationResponse {
    return {
      success: true,
      message,
    };
  }

  /**
   * Build a business logic failure response (not an error).
   * Use when operation fails due to business rules, not system errors.
   */
  static businessLogicFailure<T>(message: string, data?: T): DataResponse<T | null> {
    return {
      success: false,
      message,
      data: data ?? null,
    };
  }

  /**
   * Build a validation failure response.
   */
  static validationFailure<T>(message: string, data?: T): DataResponse<T | null> {
    return {
      success: false,
      message,
      data: data ?? null,
    };
  }

  /**
   * Build a paginated response for list operations.
   */
  static paginated<T>(
    data: T[],
    total: number,
    page: number,
    pageSize: number,
    message = 'Data retrieved successfully'
  ): PaginatedResponse<T> {
    return {
      success: true,
      message,
      data,
      total,
      page,
      pageSize,
    };
  }

  /**
   * Build a validated response for validation operations.
   */
  static validated(isValid: boolean, message: string): ValidatedResponse {
    return {
      success: isValid,
      message,
      isValid,
    };
  }
}
