export * from './zendesk';
export * from './sentiment';

// Add any other shared types here
export interface ApiResponse<T> {
  data: T;
  error?: string;
}
