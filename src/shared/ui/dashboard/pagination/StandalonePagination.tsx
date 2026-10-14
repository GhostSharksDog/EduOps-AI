'use client';

import { Pagination } from 'antd';
import { PAGINATION_DEFAULTS } from '@/shared/ui/dashboard/pagination/defaults';
import { usePaginationDefaults } from '@/shared/ui/dashboard/pagination/usePaginationDefaults';
import type { StandalonePaginationProps } from '@/shared/ui/dashboard/pagination/types';

export function StandalonePagination({
  current = 1,
  pageSize: pageSizeProp,
  total = 0,
  onChange,
  showTotal = PAGINATION_DEFAULTS.showTotal,
  pageSizeOptions,
  hideTotal = false,
  showWhenNeeded = true,
  style,
  className,
}: StandalonePaginationProps) {
  const { defaultPageSize } = usePaginationDefaults();
  const pageSize = pageSizeProp ?? defaultPageSize;
  
  if (showWhenNeeded && total <= pageSize) {
    return null;
  }

  return (
    <div
      className={className}
      style={{
        padding: '16px 24px',
        borderTop: '1px solid #f0f0f0',
        display: 'flex',
        justifyContent: 'flex-end',
        ...style,
      }}
    >
      <Pagination
        current={current}
        pageSize={pageSize}
        total={total}
        onChange={onChange}
        onShowSizeChange={onChange}
        showSizeChanger={PAGINATION_DEFAULTS.showSizeChanger}
        showQuickJumper={PAGINATION_DEFAULTS.showQuickJumper}
        showTotal={hideTotal ? undefined : showTotal}
        pageSizeOptions={pageSizeOptions ?? [...PAGINATION_DEFAULTS.pageSizeOptions]}
      />
    </div>
  );
}
