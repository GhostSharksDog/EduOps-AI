import { MySQL, MySqlParserVisitor } from 'dt-sql-parser';
import type { ParseResult, ParseViewResult, SqlDialect } from '@/platform/sql-parser/types/index';
import type { IDialectParser } from '@/platform/sql-parser/interfaces/IDialectParser';
import { preprocessSQL } from '@/platform/sql-parser/utils/stripComments';
import { DataType } from '@/shared/enums/data-models/DataType';

function mapDataType(sqlType: string): DataType {
    const upperType = sqlType.toUpperCase();

    if (/\b(CHAR|VARCHAR|TEXT|TINYTEXT|MEDIUMTEXT|LONGTEXT|NVARCHAR|NCHAR|NVARCHAR)\b/.test(upperType)) {
        return DataType.STRING;
    }

    if (/\b(INT|INTEGER|BIGINT|SMALLINT|TINYINT|FLOAT|DOUBLE|DECIMAL|NUMERIC|REAL)\b/.test(upperType)) {
        return DataType.NUMBER;
    }

    if (/\b(BOOL|BOOLEAN|BIT)\b/.test(upperType)) {
        return DataType.BOOLEAN;
    }

    if (/\bDATE\b/.test(upperType) && !/\b(DATETIME|TIMESTAMP)\b/.test(upperType)) {
        return DataType.DATE;
    }

    if (/\b(DATETIME|TIMESTAMP|TIME)\b/.test(upperType)) {
        return DataType.DATETIME;
    }

    if (/\b(JSON|ARRAY)\b/.test(upperType)) {
        return DataType.ARRAY;
    }

    if (/\b(BLOB|BINARY|VARBINARY|GEOMETRY|OBJECT)\b/.test(upperType)) {
        return DataType.OBJECT;
    }

    return DataType.STRING;
}

function parseDataTypeLength(sqlType: string): { length?: number; precision?: number; scale?: number } {
    const result: { length?: number; precision?: number; scale?: number } = {};

    const lengthMatch = sqlType.match(/\((\d+)\)/);
    if (lengthMatch) {
        result.length = parseInt(lengthMatch[1], 10);
    }

    const decimalMatch = sqlType.match(/\((\d+),\s*(\d+)\)/);
    if (decimalMatch) {
        result.precision = parseInt(decimalMatch[1], 10);
        result.scale = parseInt(decimalMatch[2], 10);
    }

    return result;
}

function extractColumnComment(ctx: unknown): string | undefined {
    if (!ctx || typeof ctx !== 'object') return undefined;
    const ctxObj = ctx as { children?: unknown[] };
    if (!ctxObj.children) return undefined;

    for (const child of ctxObj.children) {
        if (!child || typeof child !== 'object') continue;
        const childObj = child as { getText?: () => string };
        const text = childObj.getText?.() || '';
        if (text.toUpperCase().startsWith('COMMENT')) {
            const commentMatch = text.match(/COMMENT\s+['"](.*?)['"]/i);
            if (commentMatch) {
                return commentMatch[1];
            }
            const simpleMatch = text.match(/COMMENT\s+['"]([^'"]+)['"]/i);
            if (simpleMatch) {
                return simpleMatch[1];
            }
        }
    }
    return undefined;
}

function extractTableComment(ctx: unknown): string | undefined {
    if (!ctx || typeof ctx !== 'object') return undefined;
    const ctxObj = ctx as { children?: unknown[] };
    if (!ctxObj.children) return undefined;

    for (const child of ctxObj.children) {
        if (!child || typeof child !== 'object') continue;
        const childObj = child as { getText?: () => string };
        const text = childObj.getText?.() || '';
        if (text.toUpperCase().startsWith('COMMENT')) {
            const commentMatch = text.match(/COMMENT\s*=\s*['"](.*?)['"]/i)
                || text.match(/COMMENT\s+['"](.*?)['"]/i);
            if (commentMatch) {
                return commentMatch[1];
            }
        }
    }
    return undefined;
}

export class MySQLParserStrategy implements IDialectParser {
    readonly dialect: SqlDialect = 'mysql';

    parse(sql: string): ParseResult {
        const mysql = new MySQL();
        const processedSQL = preprocessSQL(sql);
        const parseTree = mysql.parse(processedSQL);

        class TableNameVisitor extends MySqlParserVisitor<string> {
            defaultResult(): string {
                return '';
            }

            aggregateResult(aggregate: string, nextResult: string): string {
                return aggregate || nextResult || '';
            }

            visitColumnCreateTable = (ctx: unknown): string => {
                const ctxObj = ctx as { tableNameCreate?: () => { getText: () => string } };
                return ctxObj.tableNameCreate?.()?.getText() || '';
            };
        }

        class TableCommentVisitor extends MySqlParserVisitor<string> {
            defaultResult(): string {
                return '';
            }

            aggregateResult(aggregate: string, nextResult: string): string {
                return aggregate || nextResult || '';
            }

            visitCreateTable = (ctx: unknown): string => {
                return extractTableComment(ctx) || '';
            };
        }

        class ColumnVisitor extends MySqlParserVisitor<import('@/platform/sql-parser/types/index').ParsedColumn[]> {
            private primaryKeys: Set<string> = new Set();

            defaultResult(): import('@/platform/sql-parser/types/index').ParsedColumn[] {
                return [];
            }

            aggregateResult(aggregate: import('@/platform/sql-parser/types/index').ParsedColumn[], nextResult: import('@/platform/sql-parser/types/index').ParsedColumn[]): import('@/platform/sql-parser/types/index').ParsedColumn[] {
                return [...aggregate, ...nextResult];
            }

            visitColumnCreateTable = (ctx: unknown): import('@/platform/sql-parser/types/index').ParsedColumn[] => {
                const ctxObj = ctx as {
                    createDefinitions?: () => {
                        createDefinition?: () => {
                            getText: () => string;
                            columnDefinition?: () => {
                                dataType?: () => { getText: () => string };
                                columnConstraint?: () => { getText: () => string }[];
                            };
                            columnNameCreate?: () => { getText: () => string };
                        }[];
                    };
                };
                if (!ctxObj) return [];

                // Two-pass approach: First, collect table-level constraints
                const defsCtx = ctxObj.createDefinitions?.();
                if (!defsCtx) return [];
                const definitions = defsCtx.createDefinition?.() || [];

                // Collect PRIMARY KEY columns from table-level constraints
                for (const element of definitions) {
                    const elementText = element.getText().toUpperCase();
                    // MySQL stores PRIMARY KEY inline in the definition (e.g., "PRIMARY KEY (id)")
                    // Handle both "PRIMARY KEY" (with space) and "PRIMARYKEY" (without space)
                    const pkMatch = elementText.match(/PRIMARY\s*KEY\s*\(([^)]+)\)/);
                    if (pkMatch) {
                        const pkColumns = pkMatch[1].split(',').map((col: string) => col.trim().replace(/[`"]/g, ''));
                        pkColumns.forEach((col: string) => this.primaryKeys.add(col.toLowerCase()));
                    }
                }

                // Process column definitions directly
                return this.processCreateDefinitions(definitions);
            };

            /**
             * Process column definitions - extracted to avoid type issues with visitor pattern
             */
            private processCreateDefinitions = (definitions: {
                getText: () => string;
                columnDefinition?: () => {
                    dataType?: () => { getText: () => string };
                    columnConstraint?: () => { getText: () => string }[];
                };
                columnNameCreate?: () => { getText: () => string };
            }[]): import('@/platform/sql-parser/types/index').ParsedColumn[] => {
                const columns: import('@/platform/sql-parser/types/index').ParsedColumn[] = [];

                definitions.forEach((element, index) => {
                    const elementText = element.getText().toUpperCase();

                    // Skip constraint definitions (PRIMARY KEY, FOREIGN KEY, etc.)
                    if (elementText.startsWith('PRIMARY KEY') ||
                        elementText.startsWith('FOREIGN KEY') ||
                        elementText.startsWith('UNIQUE') ||
                        elementText.startsWith('CHECK') ||
                        elementText.startsWith('CONSTRAINT')) {
                        return;
                    }

                    const columnDef = element.columnDefinition?.();
                    if (!columnDef) return;

                    const columnName = element.columnNameCreate?.()?.getText() || '';
                    if (!columnName) return;

                    const dataTypeCtx = columnDef.dataType?.();
                    const sqlType = dataTypeCtx?.getText() || '';
                    const { length, precision, scale } = parseDataTypeLength(sqlType);

                    const columnConstraints = columnDef.columnConstraint?.() || [];
                    let isNullable = true;
                    let isPrimaryKey = this.primaryKeys.has(columnName.toLowerCase());

                    for (const constraint of columnConstraints) {
                        const constraintText = constraint.getText().toUpperCase().replace(/\s+/g, '');
                        if (constraintText.includes('NOTNULL')) {
                            isNullable = false;
                        }
                        if (constraintText.includes('PRIMARYKEY')) {
                            isPrimaryKey = true;
                        }
                    }

                    const description = extractColumnComment(columnDef);

                    columns.push({
                        name: columnName,
                        dataType: sqlType,
                        mappedDataType: mapDataType(sqlType),
                        length,
                        precision,
                        scale,
                        isNullable,
                        isPrimaryKey,
                        description,
                        orderIndex: index,
                    });
                });

                return columns;
            };

            visitColumnDefinition = (_ctx: unknown): import('@/platform/sql-parser/types/index').ParsedColumn[] => {
                return [];
            };
        }

        const tableNameVisitor = new TableNameVisitor();
        const tableCommentVisitor = new TableCommentVisitor();
        const columnVisitor = new ColumnVisitor();

        const tableName = (tableNameVisitor.visit(parseTree)) || '';
        const tableComment = (tableCommentVisitor.visit(parseTree)) || '';
        const columns = (columnVisitor.visit(parseTree)) || [];

        return {
            tableName,
            tableComment: tableComment || undefined,
            columns,
        };
    }

    validate(sql: string): string[] {
        try {
            const mysql = new MySQL();
            const errors = mysql.validate(sql);
            return errors.map(err => err.message);
        } catch (error) {
            return [error instanceof Error ? error.message : 'Unknown validation error'];
        }
    }

    parseView(sql: string): ParseViewResult {
        const mysql = new MySQL();
        const processedSQL = preprocessSQL(sql);
        const parseTree = mysql.parse(processedSQL);

        class ViewNameVisitor extends MySqlParserVisitor<string> {
            defaultResult(): string {
                return '';
            }

            aggregateResult(aggregate: string, nextResult: string): string {
                return aggregate || nextResult || '';
            }

            visitCreateView = (ctx: unknown): string => {
                const ctxObj = ctx as { viewNameCreate?: () => { getText: () => string } };
                return ctxObj.viewNameCreate?.()?.getText() || '';
            };
        }

        class ViewColumnVisitor extends MySqlParserVisitor<import('@/platform/sql-parser/types/index').ParsedColumn[]> {
            defaultResult(): import('@/platform/sql-parser/types/index').ParsedColumn[] {
                return [];
            }

            aggregateResult(aggregate: import('@/platform/sql-parser/types/index').ParsedColumn[], nextResult: import('@/platform/sql-parser/types/index').ParsedColumn[]): import('@/platform/sql-parser/types/index').ParsedColumn[] {
                return [...aggregate, ...nextResult];
            }

            visitCreateView = (ctx: unknown): import('@/platform/sql-parser/types/index').ParsedColumn[] => {
                const ctxObj = ctx as { 
                    columnNameCreate?: () => { getText: () => string }[];
                    selectStatement?: () => { getText: () => string };
                };
                
                const explicitColumns = ctxObj.columnNameCreate?.() || [];
                if (explicitColumns.length > 0) {
                    return explicitColumns.map((col, index) => ({
                        name: col.getText(),
                        dataType: 'UNKNOWN',
                        mappedDataType: DataType.STRING,
                        isNullable: true,
                        isPrimaryKey: false,
                        orderIndex: index,
                    }));
                }

                const selectText = ctxObj.selectStatement?.()?.getText() || '';
                const columnMatches = selectText.match(/SELECT\s+(.+?)\s+FROM/i);
                if (columnMatches) {
                    const selectColumns = columnMatches[1].split(',').map((col: string) => {
                        const trimmed = col.trim();
                        const aliasMatch = trimmed.match(/\s+AS\s+(\w+)$/i) || trimmed.match(/\s+(\w+)$/i);
                        return aliasMatch ? aliasMatch[1] : trimmed;
                    });
                    return selectColumns.map((colName: string, index: number) => ({
                        name: colName.trim(),
                        dataType: 'UNKNOWN',
                        mappedDataType: DataType.STRING,
                        isNullable: true,
                        isPrimaryKey: false,
                        orderIndex: index,
                    }));
                }

                const simpleColumnMatch = selectText.match(/SELECT(.+?)FROM/i);
                if (simpleColumnMatch) {
                    const columnsStr = simpleColumnMatch[1].replace(/\s+/g, ' ').trim();
                    const selectColumns = columnsStr.split(',').map((col: string) => col.trim());
                    return selectColumns.map((colName: string, index: number) => ({
                        name: colName,
                        dataType: 'UNKNOWN',
                        mappedDataType: DataType.STRING,
                        isNullable: true,
                        isPrimaryKey: false,
                        orderIndex: index,
                    }));
                }

                return [];
            };
        }

        class SelectStatementVisitor extends MySqlParserVisitor<string> {
            defaultResult(): string {
                return '';
            }

            aggregateResult(aggregate: string, nextResult: string): string {
                return aggregate || nextResult || '';
            }

            visitCreateView = (ctx: unknown): string => {
                const ctxObj = ctx as { selectStatement?: () => { getText: () => string } };
                return ctxObj.selectStatement?.()?.getText() || '';
            };
        }

        const viewNameVisitor = new ViewNameVisitor();
        const columnVisitor = new ViewColumnVisitor();
        const selectVisitor = new SelectStatementVisitor();

        const viewName = viewNameVisitor.visit(parseTree) || '';
        const columns = columnVisitor.visit(parseTree) || [];
        const selectStatement = selectVisitor.visit(parseTree) || '';

        return {
            viewName,
            columns,
            selectStatement,
        };
    }
}
