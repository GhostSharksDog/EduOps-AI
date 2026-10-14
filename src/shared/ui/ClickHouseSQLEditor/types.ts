// 表结构类型
export interface TableSchema {
  name: string;
  columns: ColumnSchema[];
}

// 列结构类型
export interface ColumnSchema {
  name: string;
  type: string;
  nullable?: boolean;
  default?: string;
  comment?: string;
}

// SQL 编辑器属性
export interface ClickHouseSQLEditorProps {
  // 值
  value?: string;
  onChange: (value: string) => void;

  // 表结构（用于自动补全）
  tables?: TableSchema[];

  // 错误回调
  onError?: (error: SQLValidationError | null) => void;

  // 占位符
  placeholder?: string;

  // 只读模式
  readOnly?: boolean;

  // 高度
  height?: string | number;

  // 主题：'light' 亮色，'dark' 暗色，'system' 跟随系统
  theme?: 'light' | 'dark' | 'system';
}

// SQL 校验错误
export interface SQLValidationError {
  message: string;
  line?: number;
  column?: number;
  offset?: number;
}

// 自动补全项类型
export interface CompletionItem {
  label: string;
  type: 'keyword' | 'function' | 'type' | 'table' | 'column';
  detail?: string;
  description?: string;
}
