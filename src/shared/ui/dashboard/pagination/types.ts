import type { ReactNode } from 'react';

export interface PaginationConfig {
  /** Current page number (1-indexed) */
  current?: number;
  /** Number of items per page */
  pageSize?: number;
  /** Total number of items */
  total?: number;
  /** Callback when page or pageSize changes */
  onChange?: (page: number, pageSize: number) => void;
  /** Override default showTotal format */
  showTotal?: (total: number, range: [number, number]) => ReactNode;
  /** Override default pageSizeOptions */
  pageSizeOptions?: string[];
  /** Hide total display */
  hideTotal?: boolean;
}

export interface StandalonePaginationProps extends PaginationConfig {
  /** Container style */
  style?: React.CSSProperties;
  /** Container className */
  className?: string;
  /** Only show pagination when total > pageSize */
  showWhenNeeded?: boolean;
}
