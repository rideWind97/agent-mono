/**
 * Common API response type
 */
export interface ApiResponse<T = unknown> {
  success: boolean;
  data: T;
  message?: string;
  timestamp: number;
}

/**
 * Pagination parameters
 */
export interface PaginationParams {
  page: number;
  pageSize: number;
}

/**
 * Paginated response
 */
export interface PaginatedResponse<T> extends ApiResponse<T[]> {
  pagination: {
    page: number;
    pageSize: number;
    total: number;
    totalPages: number;
  };
}

/**
 * Common error type
 */
export interface AppError {
  code: string;
  message: string;
  details?: Record<string, unknown>;
}

/**
 * Make certain keys required
 */
export type RequireKeys<T, K extends keyof T> = T & Required<Pick<T, K>>;

/**
 * Make all properties optional recursively
 */
export type DeepPartial<T> = {
  [P in keyof T]?: T[P] extends object ? DeepPartial<T[P]> : T[P];
};
