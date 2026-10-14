/**
 * Common types for SQL Editors
 */

export interface TableSchema {
  name: string;
  columns: ColumnSchema[];
}

export interface ColumnSchema {
  name: string;
  type: string;
  nullable?: boolean;
  default?: string;
  comment?: string;
}

export interface SQLValidationError {
  message: string;
  line?: number;
  column?: number;
  offset?: number;
}

export interface CompletionItem {
  label: string;
  type: 'keyword' | 'function' | 'type' | 'table' | 'column';
  detail?: string;
  description?: string;
}

export interface SQLEditorProps {
  value?: string;
  onChange: (value: string) => void;
  tables?: TableSchema[];
  onError?: (error: SQLValidationError | null) => void;
  placeholder?: string;
  readOnly?: boolean;
  height?: string | number;
  theme?: 'light' | 'dark' | 'system';
}
