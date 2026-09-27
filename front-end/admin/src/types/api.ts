export interface ApiSuccess<T> {
  success: true;
  data: T;
}

export interface ApiFailure {
  success: false;
  error?: {
    code?: string;
    message?: string;
  };
  message?: string;
}

export type ApiResponse<T> = ApiSuccess<T> | ApiFailure;
