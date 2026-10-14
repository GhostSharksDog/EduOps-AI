import type { TablePaginationConfig } from 'antd/es/table/interface';
import { PAGINATION_DEFAULTS } from '@/shared/ui/dashboard/pagination/defaults';
import { getDynamicPageSize } from '@/shared/ui/dashboard/pagination/usePaginationDefaults';
import type { PaginationConfig } from '@/shared/ui/dashboard/pagination/types';

export function getTablePagination(config: PaginationConfig = {}): TablePaginationConfig {
  const {
    current = 1,
    pageSize = getDynamicPageSize(),
    total,
    onChange,
    showTotal = PAGINATION_DEFAULTS.showTotal,
    pageSizeOptions = [...PAGINATION_DEFAULTS.pageSizeOptions],
    hideTotal = false,
  } = config;

  return {
    current,
    pageSize,
    total,
    onChange,
    onShowSizeChange: onChange,
    showSizeChanger: PAGINATION_DEFAULTS.showSizeChanger,
    showQuickJumper: PAGINATION_DEFAULTS.showQuickJumper,
    showTotal: hideTotal ? undefined : showTotal,
    pageSizeOptions,
  };
}
