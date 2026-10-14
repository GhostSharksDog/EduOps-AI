export interface TableInfo {
  name: string;
  rowCount: number | null;
  comment: string | null;
}

export interface PreviewData {
  columns: string[];
  rows: Record<string, unknown>[];
}

export interface IDbBrowserService {
  getTables(schema: string): Promise<TableInfo[]>;
  getPreview(schema: string, table: string): Promise<PreviewData>;
  truncateTable(schema: string, table: string): Promise<void>;
}
