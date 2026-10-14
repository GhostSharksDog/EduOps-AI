export const PAGINATION_DEFAULTS = {
  pageSizeOptions: ['10', '20', '50', '100'],
  showTotal: (total: number) => `共 ${total} 条`,
  showSizeChanger: true,
  showQuickJumper: true,
  defaultPageSize: 10,
} as const;
