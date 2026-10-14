import { describe, it, expect } from 'vitest';
import { PostgreSQL, PostgreSqlParserVisitor } from 'dt-sql-parser';
import { parseCreateView } from '@/platform/sql-parser/createTableParser';

const TEST_SQL_VIEW_BASIC = `
CREATE VIEW user_view AS
SELECT id, name, email
FROM users
WHERE status = 'active';
`;

const TEST_SQL_VIEW_WITH_COLUMNS = `
CREATE VIEW order_summary (order_id, customer_name, total_amount) AS
SELECT o.id, c.name, o.total
FROM orders o
JOIN customers c ON o.customer_id = c.id;
`;

const TEST_SQL_VIEW_RECURSIVE = `
CREATE RECURSIVE VIEW department_tree (department_id, department_name, parent_path) AS
SELECT department_id, department_name, department_name::text
FROM departments
UNION ALL
SELECT d.department_id, d.department_name, dt.parent_path || ' > ' || d.department_name
FROM departments d
JOIN department_tree dt ON d.parent_id = dt.department_id;
`;

describe('dt-sql-parser CREATE VIEW Parsing Tests - PostgreSQL', () => {
    const postgresql = new PostgreSQL();

    describe('Basic CREATE VIEW Parsing', () => {
        it('should parse basic CREATE VIEW statement', () => {
            const parseTree = postgresql.parse(TEST_SQL_VIEW_BASIC);
            expect(parseTree).toBeDefined();
            expect(parseTree.toString()).toBeDefined();
        });

        it('should extract view name using Visitor', () => {
            const parseTree = postgresql.parse(TEST_SQL_VIEW_BASIC);

            class ViewNameVisitor extends PostgreSqlParserVisitor<string> {
                defaultResult(): string { return ''; }
                aggregateResult(aggregate: string, nextResult: string): string {
                    return aggregate || nextResult || '';
                }
                visitCreateView = (ctx: any): string => {
                    return ctx.viewNameCreate()?.getText() || '';
                };
            }

            const visitor = new ViewNameVisitor();
            const result = visitor.visit(parseTree as any);
            expect(result).toBe('user_view');
        });

        it('should extract select statement from view', () => {
            const parseTree = postgresql.parse(TEST_SQL_VIEW_BASIC);

            class SelectVisitor extends PostgreSqlParserVisitor<string> {
                defaultResult(): string { return ''; }
                aggregateResult(aggregate: string, nextResult: string): string {
                    return aggregate || nextResult || '';
                }
                visitCreateView = (ctx: any): string => {
                    return ctx.selectStmt()?.getText() || '';
                };
            }

            const visitor = new SelectVisitor();
            const result = visitor.visit(parseTree as any);
            expect(result).toContain('SELECT');
            expect(result).toContain('users');
        });
    });

    describe('parseCreateView API', () => {
        it('should parse CREATE VIEW using API', () => {
            const result = parseCreateView(TEST_SQL_VIEW_BASIC, 'postgresql');
            expect(result).toBeDefined();
            expect(result.viewName).toBe('user_view');
        });

        it('should extract columns from CREATE VIEW', () => {
            const result = parseCreateView(TEST_SQL_VIEW_BASIC, 'postgresql');
            expect(result.columns).toBeDefined();
            expect(result.columns.length).toBeGreaterThan(0);
        });

        it('should extract SELECT statement', () => {
            const result = parseCreateView(TEST_SQL_VIEW_BASIC, 'postgresql');
            expect(result.selectStatement).toContain('SELECT');
            expect(result.selectStatement).toContain('users');
        });

        it('should parse CREATE VIEW with column list', () => {
            const result = parseCreateView(TEST_SQL_VIEW_WITH_COLUMNS, 'postgresql');
            expect(result.viewName).toBe('order_summary');
            expect(result.columns.length).toBe(3);
        });

        it('should parse RECURSIVE VIEW', () => {
            const result = parseCreateView(TEST_SQL_VIEW_RECURSIVE, 'postgresql');
            expect(result.viewName).toBe('department_tree');
            expect(result.selectStatement).toContain('UNION');
        });
    });

    describe('Error Handling', () => {
        it('should throw error for non-CREATE VIEW statements', () => {
            const sql = 'SELECT * FROM users';
            expect(() => parseCreateView(sql, 'postgresql')).toThrow('仅支持 CREATE VIEW 语句');
        });

        it('should throw error for empty SQL', () => {
            expect(() => parseCreateView('', 'postgresql')).toThrow('SQL 语句不能为空');
        });
    });
});
