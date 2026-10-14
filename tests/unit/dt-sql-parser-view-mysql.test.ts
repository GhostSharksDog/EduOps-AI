import { describe, it, expect } from 'vitest';
import { MySQL, MySqlParserVisitor } from 'dt-sql-parser';
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

const TEST_SQL_VIEW_WITH_ALIAS = `
CREATE VIEW active_users AS
SELECT u.id AS user_id, u.name AS user_name, u.email
FROM users u
WHERE u.active = true;
`;

describe('dt-sql-parser CREATE VIEW Parsing Tests - MySQL', () => {
    const mysql = new MySQL();

    describe('Basic CREATE VIEW Parsing', () => {
        it('should parse basic CREATE VIEW statement', () => {
            const parseTree = mysql.parse(TEST_SQL_VIEW_BASIC);
            expect(parseTree).toBeDefined();
            expect(parseTree.toString()).toBeDefined();
        });

        it('should extract view name using Visitor', () => {
            const parseTree = mysql.parse(TEST_SQL_VIEW_BASIC);

            class ViewNameVisitor extends MySqlParserVisitor<string> {
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
            const parseTree = mysql.parse(TEST_SQL_VIEW_BASIC);

            class SelectVisitor extends MySqlParserVisitor<string> {
                defaultResult(): string { return ''; }
                aggregateResult(aggregate: string, nextResult: string): string {
                    return aggregate || nextResult || '';
                }
                visitCreateView = (ctx: any): string => {
                    return ctx.selectStatement()?.getText() || '';
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
            const result = parseCreateView(TEST_SQL_VIEW_BASIC, 'mysql');
            expect(result).toBeDefined();
            expect(result.viewName).toBe('user_view');
        });

        it('should extract columns from CREATE VIEW', () => {
            const result = parseCreateView(TEST_SQL_VIEW_BASIC, 'mysql');
            expect(result.columns).toBeDefined();
            expect(result.columns.length).toBeGreaterThan(0);
            expect(result.columns[0].name).toBe('id');
        });

        it('should extract SELECT statement', () => {
            const result = parseCreateView(TEST_SQL_VIEW_BASIC, 'mysql');
            expect(result.selectStatement).toContain('SELECT');
            expect(result.selectStatement).toContain('users');
        });

        it('should parse CREATE VIEW with column list', () => {
            const result = parseCreateView(TEST_SQL_VIEW_WITH_COLUMNS, 'mysql');
            expect(result.viewName).toBe('order_summary');
            expect(result.columns.length).toBe(3);
        });

        it('should parse CREATE VIEW with column aliases', () => {
            const result = parseCreateView(TEST_SQL_VIEW_WITH_ALIAS, 'mysql');
            expect(result.viewName).toBe('active_users');
            expect(result.selectStatement).toContain('AS');
        });
    });

    describe('Error Handling', () => {
        it('should throw error for non-CREATE VIEW statements', () => {
            const sql = 'SELECT * FROM users';
            expect(() => parseCreateView(sql, 'mysql')).toThrow('仅支持 CREATE VIEW 语句');
        });

        it('should throw error for empty SQL', () => {
            expect(() => parseCreateView('', 'mysql')).toThrow('SQL 语句不能为空');
        });
    });
});
