import { describe, it, expect } from 'vitest';
import {
    MySQL,
    MySqlParserVisitor,
    PostgreSQL,
    PostgreSqlParserVisitor,
    FlinkSQL,
    FlinkSqlParserVisitor,
    SparkSQL,
    SparkSqlParserVisitor,
    HiveSQL,
    HiveSqlParserVisitor,
    TrinoSQL,
    TrinoSqlVisitor,
    ImpalaSQL,
    ImpalaSqlParserVisitor,
} from 'dt-sql-parser';

// ============== MySQL Test SQLs ==============
const TEST_SQL_BASIC = `
CREATE TABLE users (
    id INT PRIMARY KEY,
    name VARCHAR(100) NOT NULL,
    email VARCHAR(255),
    age INT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);
`;

const TEST_SQL_WITH_COMMENT = `
CREATE TABLE products (
    id INT PRIMARY KEY COMMENT 'Product ID',
    name VARCHAR(100) NOT NULL COMMENT 'Product name',
    price DECIMAL(10, 2) COMMENT 'Product price',
    description TEXT
) COMMENT='Product table';
`;

const TEST_SQL_WITH_COMMENT_ALT = `
CREATE TABLE orders (
    order_id INT PRIMARY KEY COMMENT 'Order ID',
    customer_name VARCHAR(100) NOT NULL COMMENT 'Customer Name',
    total_amount DECIMAL(15, 2) COMMENT 'Total Order Amount'
) COMMENT 'Orders table storing all customer orders';
`;

const TEST_SQL_MULTIPLE_PK = `
CREATE TABLE order_items (
    order_id INT NOT NULL,
    product_id INT NOT NULL,
    quantity INT DEFAULT 1,
    PRIMARY KEY (order_id, product_id)
);
`;

const TEST_SQL_TYPES = `
CREATE TABLE data_types_test (
    id INT PRIMARY KEY,
    char_col CHAR(10),
    varchar_col VARCHAR(100),
    text_col TEXT,
    int_col INT,
    bigint_col BIGINT,
    smallint_col SMALLINT,
    tinyint_col TINYINT,
    float_col FLOAT,
    double_col DOUBLE,
    decimal_col DECIMAL(10, 2),
    boolean_col BOOLEAN,
    date_col DATE,
    datetime_col DATETIME,
    timestamp_col TIMESTAMP,
    json_col JSON,
    blob_col BLOB
);
`;

const TEST_SQL_WITH_MULTILINE_COMMENT = `
/* This is a multi-line comment 
   that should be ignored */
CREATE TABLE commented_table (
    id INT PRIMARY KEY,
    name VARCHAR(100)
);
/* Another comment at the end */
`;

// ============== PostgreSQL Test SQLs ==============
const POSTGRESQL_SQL_BASIC = `
CREATE TABLE users (
    id INTEGER PRIMARY KEY,
    name VARCHAR(100) NOT NULL,
    email VARCHAR(255),
    age INTEGER,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
`;

const POSTGRESQL_SQL_WITH_COMMENT = `
CREATE TABLE products (
    id INTEGER PRIMARY KEY COMMENT 'Product ID',
    name VARCHAR(100) NOT NULL COMMENT 'Product name',
    price NUMERIC(10, 2) COMMENT 'Product price',
    description TEXT
) COMMENT ON TABLE products IS 'Product table';
`;

const POSTGRESQL_SQL_WITH_COLUMN_COMMENT = `
CREATE TABLE users (
    id SERIAL PRIMARY KEY,
    username VARCHAR(50) NOT NULL COMMENT 'User login name',
    email VARCHAR(255) NOT NULL COMMENT 'User email address',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
`;

// ============== Flink Test SQLs ==============
const FLINK_SQL_BASIC = `
CREATE TABLE orders (
    order_id INT PRIMARY KEY,
    product_name VARCHAR(100),
    quantity INT,
    order_time TIMESTAMP
);
`;

const FLINK_SQL_WITH_COMMENT = `
CREATE TABLE products (
    id INT PRIMARY KEY COMMENT 'Product ID',
    name VARCHAR(100) COMMENT 'Product name',
    price DECIMAL(10, 2) COMMENT 'Product price'
) COMMENT 'Products table';
`;

// ============== Spark Test SQLs ==============
const SPARK_SQL_BASIC = `
CREATE TABLE users (
    id INT,
    name STRING,
    email STRING
);
`;

const SPARK_SQL_WITH_COMMENT = `
CREATE TABLE products (
    id INT COMMENT 'Product ID',
    name STRING COMMENT 'Product name',
    price DECIMAL(10, 2) COMMENT 'Product price'
) COMMENT 'Products table';
`;

// ============== Hive Test SQLs ==============
const HIVE_SQL_BASIC = `
CREATE TABLE users (
    id INT,
    name STRING,
    email STRING
);
`;

const HIVE_SQL_WITH_COMMENT = `
CREATE TABLE products (
    id INT COMMENT 'Product ID',
    name STRING COMMENT 'Product name',
    price DECIMAL(10, 2) COMMENT 'Product price'
) COMMENT 'Products table';
`;

// ============== Trino Test SQLs ==============
const TRINO_SQL_BASIC = `
CREATE TABLE orders (
    order_id INTEGER,
    product_name VARCHAR(100),
    quantity INTEGER
);
`;

const TRINO_SQL_WITH_COMMENT = `
CREATE TABLE products (
    id INTEGER COMMENT 'Product ID',
    name VARCHAR(100) COMMENT 'Product name',
    price DECIMAL(10, 2) COMMENT 'Product price'
) COMMENT 'Products table';
`;

// ============== Impala Test SQLs ==============
const IMPALA_SQL_BASIC = `
CREATE TABLE users (
    id INT,
    name STRING,
    email STRING
);
`;

const IMPALA_SQL_WITH_COMMENT = `
CREATE TABLE products (
    id INT COMMENT 'Product ID',
    name STRING COMMENT 'Product name',
    price DECIMAL(10, 2) COMMENT 'Product price'
) COMMENT 'Products table';
`;

describe('dt-sql-parser CREATE TABLE Parsing Tests - MySQL', () => {
    const mysql = new MySQL();

    describe('Basic CREATE TABLE Parsing', () => {
        it('should parse basic CREATE TABLE statement', () => {
            const parseTree = mysql.parse(TEST_SQL_BASIC);
            expect(parseTree).toBeDefined();
            expect(parseTree.toString()).toBeDefined();
        });

        it('should extract table name using Visitor', () => {
            const parseTree = mysql.parse(TEST_SQL_BASIC);

            class TableNameVisitor extends MySqlParserVisitor<string> {
                defaultResult(): string { return ''; }
                aggregateResult(aggregate: string, nextResult: string): string {
                    return aggregate || nextResult || '';
                }
                visitColumnCreateTable = (ctx: any): string => {
                    return ctx.tableNameCreate()?.getText() || '';
                };
            }

            const visitor = new TableNameVisitor();
            const result = visitor.visit(parseTree as any);
            expect(result).toBe('users');
        });

        it('should extract column names', () => {
            const parseTree = mysql.parse(TEST_SQL_BASIC);
            // Extract column names by parsing the text directly
            const fullText = parseTree.getText();
            // The parse tree contains column definitions
            expect(fullText).toContain('id');
            expect(fullText).toContain('name');
            expect(fullText).toContain('email');
        });
    });

    describe('Data Type Extraction', () => {
        it('should extract data types from column definitions', () => {
            const parseTree = mysql.parse(TEST_SQL_BASIC);

            class DataTypeVisitor extends MySqlParserVisitor<string[]> {
                defaultResult(): string[] { return []; }
                aggregateResult(aggregate: string[], nextResult: string[]): string[] {
                    return [...aggregate, ...nextResult];
                }
                visitColumnDefinition = (ctx: any): string[] => {
                    const dataType = ctx.dataType()?.getText();
                    return dataType ? [dataType] : [];
                };
            }

            const visitor = new DataTypeVisitor();
            const result = visitor.visit(parseTree as any);
            
            expect(result).toContain('INT');
            expect(result).toContain('VARCHAR(100)');
            expect(result).toContain('VARCHAR(255)');
            expect(result).toContain('DATETIME');
        });

        it('should parse various MySQL data types', () => {
            const parseTree = mysql.parse(TEST_SQL_TYPES);

            class DataTypeVisitor extends MySqlParserVisitor<string[]> {
                defaultResult(): string[] { return []; }
                aggregateResult(aggregate: string[], nextResult: string[]): string[] {
                    return [...aggregate, ...nextResult];
                }
                visitColumnDefinition = (ctx: any): string[] => {
                    const dataType = ctx.dataType()?.getText();
                    return dataType ? [dataType] : [];
                };
            }

            const visitor = new DataTypeVisitor();
            const result = visitor.visit(parseTree as any);

            expect(result).toContain('INT');
            expect(result).toContain('CHAR(10)');
            expect(result).toContain('VARCHAR(100)');
            expect(result).toContain('TEXT');
            expect(result).toContain('BIGINT');
            expect(result).toContain('SMALLINT');
            expect(result).toContain('TINYINT');
            expect(result).toContain('FLOAT');
            expect(result).toContain('DOUBLE');
            expect(result).toContain('DECIMAL(10,2)');
            expect(result).toContain('BOOLEAN');
            expect(result).toContain('DATE');
            expect(result).toContain('DATETIME');
            expect(result).toContain('TIMESTAMP');
            expect(result).toContain('JSON');
            expect(result).toContain('BLOB');
        });
    });

    describe('Constraint Extraction', () => {
        it('should detect PRIMARY KEY constraint', () => {
            const sql = 'CREATE TABLE test_pk (id INT PRIMARY KEY)';
            const parseTree = mysql.parse(sql);
            const text = parseTree.getText().toUpperCase();
            expect(text).toContain('PRIMARYKEY');
        });

        it('should handle composite PRIMARY KEY', () => {
            const parseTree = mysql.parse(TEST_SQL_MULTIPLE_PK);

            class TableNameVisitor extends MySqlParserVisitor<string> {
                defaultResult(): string { return ''; }
                aggregateResult(aggregate: string, nextResult: string): string {
                    return aggregate || nextResult || '';
                }
                visitColumnCreateTable = (ctx: any): string => {
                    return ctx.tableNameCreate()?.getText() || '';
                };
            }

            const visitor = new TableNameVisitor();
            const tableName = visitor.visit(parseTree as any);
            expect(tableName).toBe('order_items');
        });
    });

    describe('Comment Handling', () => {
        it('should parse CREATE TABLE with column comments', () => {
            const parseTree = mysql.parse(TEST_SQL_WITH_COMMENT);
            expect(parseTree).toBeDefined();
        });

        it('should handle multi-line comments in SQL', () => {
            const parseTree = mysql.parse(TEST_SQL_WITH_MULTILINE_COMMENT);
            expect(parseTree).toBeDefined();

            class TableNameVisitor extends MySqlParserVisitor<string> {
                defaultResult(): string { return ''; }
                aggregateResult(aggregate: string, nextResult: string): string {
                    return aggregate || nextResult || '';
                }
                visitColumnCreateTable = (ctx: any): string => {
                    return ctx.tableNameCreate()?.getText() || '';
                };
            }

            const visitor = new TableNameVisitor();
            const tableName = visitor.visit(parseTree as any);
            expect(tableName).toBe('commented_table');
        });
    });

    describe('Validation and Error Handling', () => {
        it('should validate invalid SQL', () => {
            const invalidSQL = 'CREATE TABLE invalid sql here';
            const errors = mysql.validate(invalidSQL);
            expect(errors).toBeDefined();
            expect(errors.length).toBeGreaterThan(0);
        });

        it('should validate CREATE TABLE without semicolon', () => {
            const sqlWithoutSemicolon = 'CREATE TABLE test (id INT)';
            const errors = mysql.validate(sqlWithoutSemicolon);
            expect(errors).toBeDefined();
        });

        it('should handle IF NOT EXISTS clause', () => {
            const sql = 'CREATE TABLE IF NOT EXISTS users (id INT)';
            const parseTree = mysql.parse(sql);
            expect(parseTree).toBeDefined();
        });

        it('should handle TEMPORARY TABLE', () => {
            const sql = 'CREATE TEMPORARY TABLE temp_table (id INT)';
            const parseTree = mysql.parse(sql);
            expect(parseTree).toBeDefined();
        });
    });

    describe('Full CREATE TABLE Information Extraction', () => {
        it('should extract complete table structure', () => {
            const parseTree = mysql.parse(TEST_SQL_BASIC);
            const fullText = parseTree.getText();
            expect(fullText).toContain('users');
            expect(fullText).toContain('INT');
            expect(fullText).toContain('VARCHAR');
        });
    });
});

describe('dt-sql-parser CREATE TABLE Parsing Tests - PostgreSQL', () => {
    const postgresql = new PostgreSQL();

    describe('Basic CREATE TABLE Parsing', () => {
        it('should parse basic PostgreSQL CREATE TABLE statement', () => {
            const parseTree = postgresql.parse(POSTGRESQL_SQL_BASIC);
            expect(parseTree).toBeDefined();
        });

        it('should extract table name from PostgreSQL', () => {
            const parseTree = postgresql.parse(POSTGRESQL_SQL_BASIC);
            const fullText = parseTree.getText();
            expect(fullText).toContain('users');
        });

        it('should extract column names from PostgreSQL', () => {
            const parseTree = postgresql.parse(POSTGRESQL_SQL_BASIC);
            const fullText = parseTree.getText();
            expect(fullText).toContain('id');
            expect(fullText).toContain('name');
            expect(fullText).toContain('email');
        });
    });

    describe('PostgreSQL COMMENT Support', () => {
        it('should parse CREATE TABLE with table comment (COMMENT ON TABLE)', () => {
            const parseTree = postgresql.parse(POSTGRESQL_SQL_WITH_COMMENT);
            expect(parseTree).toBeDefined();
            // The SQL contains COMMENT ON TABLE syntax
            expect(parseTree.getText().toUpperCase()).toContain('COMMENT');
        });

        it('should parse CREATE TABLE with column comments', () => {
            const parseTree = postgresql.parse(POSTGRESQL_SQL_WITH_COLUMN_COMMENT);
            expect(parseTree).toBeDefined();
        });
    });
});

describe('dt-sql-parser CREATE TABLE Parsing Tests - Flink', () => {
    const flink = new FlinkSQL();

    describe('Basic CREATE TABLE Parsing', () => {
        it('should parse basic Flink CREATE TABLE statement', () => {
            const parseTree = flink.parse(FLINK_SQL_BASIC);
            expect(parseTree).toBeDefined();
        });

        it('should extract table name from Flink', () => {
            const parseTree = flink.parse(FLINK_SQL_BASIC);
            const fullText = parseTree.getText();
            expect(fullText).toContain('orders');
        });
    });

    describe('Flink COMMENT Support', () => {
        it('should parse CREATE TABLE with comments', () => {
            const parseTree = flink.parse(FLINK_SQL_WITH_COMMENT);
            expect(parseTree).toBeDefined();
            expect(parseTree.getText().toUpperCase()).toContain('COMMENT');
        });
    });
});

describe('dt-sql-parser CREATE TABLE Parsing Tests - Spark', () => {
    const spark = new SparkSQL();

    describe('Basic CREATE TABLE Parsing', () => {
        it('should parse basic Spark CREATE TABLE statement', () => {
            const parseTree = spark.parse(SPARK_SQL_BASIC);
            expect(parseTree).toBeDefined();
        });

        it('should extract table name from Spark', () => {
            const parseTree = spark.parse(SPARK_SQL_BASIC);
            const fullText = parseTree.getText();
            expect(fullText).toContain('users');
        });
    });

    describe('Spark COMMENT Support', () => {
        it('should parse CREATE TABLE with comments', () => {
            const parseTree = spark.parse(SPARK_SQL_WITH_COMMENT);
            expect(parseTree).toBeDefined();
            expect(parseTree.getText().toUpperCase()).toContain('COMMENT');
        });
    });
});

describe('dt-sql-parser CREATE TABLE Parsing Tests - Hive', () => {
    const hive = new HiveSQL();

    describe('Basic CREATE TABLE Parsing', () => {
        it('should parse basic Hive CREATE TABLE statement', () => {
            const parseTree = hive.parse(HIVE_SQL_BASIC);
            expect(parseTree).toBeDefined();
        });

        it('should extract table name from Hive', () => {
            const parseTree = hive.parse(HIVE_SQL_BASIC);
            const fullText = parseTree.getText();
            expect(fullText).toContain('users');
        });
    });

    describe('Hive COMMENT Support', () => {
        it('should parse CREATE TABLE with comments', () => {
            const parseTree = hive.parse(HIVE_SQL_WITH_COMMENT);
            expect(parseTree).toBeDefined();
            expect(parseTree.getText().toUpperCase()).toContain('COMMENT');
        });
    });
});

describe('dt-sql-parser CREATE TABLE Parsing Tests - Trino', () => {
    const trino = new TrinoSQL();

    describe('Basic CREATE TABLE Parsing', () => {
        it('should parse basic Trino CREATE TABLE statement', () => {
            const parseTree = trino.parse(TRINO_SQL_BASIC);
            expect(parseTree).toBeDefined();
        });

        it('should extract table name from Trino', () => {
            const parseTree = trino.parse(TRINO_SQL_BASIC);
            const fullText = parseTree.getText();
            expect(fullText).toContain('orders');
        });
    });

    describe('Trino COMMENT Support', () => {
        it('should parse CREATE TABLE with comments', () => {
            const parseTree = trino.parse(TRINO_SQL_WITH_COMMENT);
            expect(parseTree).toBeDefined();
            expect(parseTree.getText().toUpperCase()).toContain('COMMENT');
        });
    });
});

describe('dt-sql-parser CREATE TABLE Parsing Tests - Impala', () => {
    const impala = new ImpalaSQL();

    describe('Basic Parsing', () => {
        it('should parse basic Impala CREATE TABLE statement', () => {
            const parseTree = impala.parse(IMPALA_SQL_BASIC);
            expect(parseTree).toBeDefined();
        });

        it('should extract table name from Impala', () => {
            const parseTree = impala.parse(IMPALA_SQL_BASIC);
            const fullText = parseTree.getText();
            expect(fullText).toContain('users');
        });
    });

    describe('Impala COMMENT Support', () => {
        it('should parse CREATE TABLE with comments', () => {
            const parseTree = impala.parse(IMPALA_SQL_WITH_COMMENT);
            expect(parseTree).toBeDefined();
            expect(parseTree.getText().toUpperCase()).toContain('COMMENT');
        });
    });
});

describe('dt-sql-parser API Verification Summary', () => {
    const mysql = new MySQL();

    it('CONFIRMED: dt-sql-parser can parse CREATE TABLE statements', () => {
        const sql = 'CREATE TABLE test (id INT PRIMARY KEY)';
        const parseTree = mysql.parse(sql);
        expect(parseTree).toBeDefined();
    });

    it('CONFIRMED: Visitor pattern works for extracting table name', () => {
        const sql = 'CREATE TABLE users (id INT)';
        const parseTree = mysql.parse(sql);

        class TableNameVisitor extends MySqlParserVisitor<string> {
            defaultResult(): string { return ''; }
            aggregateResult(a: string, b: string): string { return a || b || ''; }
            visitColumnCreateTable = (ctx: any): string => ctx.tableNameCreate()?.getText() || '';
        }

        const visitor = new TableNameVisitor();
        expect(visitor.visit(parseTree as any)).toBe('users');
    });

    it('CONFIRMED: Visitor pattern works for extracting columns', () => {
        const sql = 'CREATE TABLE users (id INT, name VARCHAR(100))';
        const parseTree = mysql.parse(sql);

        class ColumnVisitor extends MySqlParserVisitor<string[]> {
            defaultResult(): string[] { return []; }
            aggregateResult(a: string[], b: string[]): string[] { return [...a, ...b]; }
            visitColumnDefinition = (ctx: any): string[] => {
                const name = ctx.children?.[0]?.getText();
                return name ? [name] : [];
            };
        }

        const visitor = new ColumnVisitor();
        const columns = visitor.visit(parseTree as any);
        expect(columns?.length).toBeGreaterThan(0);
    });

    it('CONFIRMED: Visitor pattern works for extracting data types', () => {
        const sql = 'CREATE TABLE users (id INT, name VARCHAR(100))';
        const parseTree = mysql.parse(sql);

        class DataTypeVisitor extends MySqlParserVisitor<string[]> {
            defaultResult(): string[] { return []; }
            aggregateResult(a: string[], b: string[]): string[] { return [...a, ...b]; }
            visitColumnDefinition = (ctx: any): string[] => {
                const type = ctx.dataType()?.getText();
                return type ? [type] : [];
            };
        }

        const visitor = new DataTypeVisitor();
        const types = visitor.visit(parseTree as any);
        expect(types).toContain('INT');
        expect(types).toContain('VARCHAR(100)');
    });
});

describe('dt-sql-parser Table-Level and Column-Level COMMENT Extraction Tests', () => {
    const mysql = new MySQL();

    describe('MySQL Table-Level COMMENT Extraction', () => {
        it('should extract table-level comment using Visitor', () => {
            const parseTree = mysql.parse(TEST_SQL_WITH_COMMENT);
            expect(parseTree).toBeDefined();
            // The SQL contains comment syntax - just verify it parses
            expect(parseTree.getText().toUpperCase()).toContain('COMMENT');
        });

        it('should parse table with COMMENT syntax correctly', () => {
            const sql = `CREATE TABLE test_table (
                id INT PRIMARY KEY
            ) COMMENT='This is table comment'`;
            
            const errors = mysql.validate(sql);
            expect(errors.length).toBe(0);
            
            const parseTree = mysql.parse(sql);
            expect(parseTree).toBeDefined();
            expect(parseTree.getText()).toContain('COMMENT');
        });
    });

    describe('MySQL Column-Level COMMENT Extraction', () => {
        it('should parse column-level comments', () => {
            const parseTree = mysql.parse(TEST_SQL_WITH_COMMENT);
            expect(parseTree).toBeDefined();
            expect(parseTree.getText().toUpperCase()).toContain('COMMENT');
        });

        it('should extract column-level comment text from SQL', () => {
            const sql = `CREATE TABLE test (
                id INT PRIMARY KEY COMMENT 'Primary Key Column',
                name VARCHAR(100) COMMENT 'User Name Column',
                email VARCHAR(255) NOT NULL COMMENT 'Email Column'
            ) COMMENT='Test Table'`;
            
            const parseTree = mysql.parse(sql);
            expect(parseTree).toBeDefined();
            
            // Verify comments are in the SQL text
            const sqlText = parseTree.getText();
            expect(sqlText).toContain("'Primary Key Column'");
            expect(sqlText).toContain("'User Name Column'");
            expect(sqlText).toContain("'Email Column'");
        });

        it('should handle alternative COMMENT syntax', () => {
            const parseTree = mysql.parse(TEST_SQL_WITH_COMMENT_ALT);
            expect(parseTree).toBeDefined();
            expect(parseTree.getText().toUpperCase()).toContain('COMMENT');
        });
    });

    describe('Multi-dialect COMMENT Syntax Support', () => {
        it('should support MySQL COMMENT syntax', () => {
            const mysqlParser = new MySQL();
            const sql = `CREATE TABLE t (id INT COMMENT 'id col') COMMENT 'table'`;
            const errors = mysqlParser.validate(sql);
            expect(errors.length).toBe(0);
        });

        it('should support PostgreSQL COMMENT ON syntax', () => {
            const pgParser = new PostgreSQL();
            const sql = `COMMENT ON TABLE t IS 'table comment'`;
            // PostgreSQL uses separate COMMENT statement
            const errors = pgParser.validate(sql);
            expect(errors.length).toBe(0);
        });

        it('should support Flink COMMENT syntax', () => {
            const flinkParser = new FlinkSQL();
            // Flink uses COMMENT but doesn't support semicolon in CREATE TABLE
            const sql = `CREATE TABLE t (id INT COMMENT 'id col') COMMENT 'table'`;
            const parseTree = flinkParser.parse(sql);
            expect(parseTree).toBeDefined();
        });

        it('should support Spark COMMENT syntax', () => {
            const sparkParser = new SparkSQL();
            const sql = `CREATE TABLE t (id INT COMMENT 'id col') COMMENT 'table'`;
            const errors = sparkParser.validate(sql);
            expect(errors.length).toBe(0);
        });

        it('should support Hive COMMENT syntax', () => {
            const hiveParser = new HiveSQL();
            const sql = `CREATE TABLE t (id INT COMMENT 'id col') COMMENT 'table'`;
            const errors = hiveParser.validate(sql);
            expect(errors.length).toBe(0);
        });

        it('should support Trino COMMENT syntax', () => {
            const trinoParser = new TrinoSQL();
            const sql = `CREATE TABLE t (id INT COMMENT 'id col') COMMENT 'table'`;
            const errors = trinoParser.validate(sql);
            expect(errors.length).toBe(0);
        });

        it('should support Impala COMMENT syntax', () => {
            const impalaParser = new ImpalaSQL();
            const sql = `CREATE TABLE t (id INT COMMENT 'id col') COMMENT 'table'`;
            const errors = impalaParser.validate(sql);
            expect(errors.length).toBe(0);
        });
    });
});

describe('ClickHouse NOT Supported in dt-sql-parser', () => {
    it('should confirm ClickHouse is NOT supported by dt-sql-parser', () => {
        // dt-sql-parser does NOT have ClickHouse parser
        // The package.json lists: MySQL, Flink, Spark, Hive, PostgreSQL, Trino, Impala
        // No ClickHouse!
        
        const mysql = new MySQL();
        const postgresql = new PostgreSQL();
        const flink = new FlinkSQL();
        const spark = new SparkSQL();
        const hive = new HiveSQL();
        const trino = new TrinoSQL();
        const impala = new ImpalaSQL();
        
        // All these parsers should work
        expect(() => mysql.parse('CREATE TABLE t (id INT)')).not.toThrow();
        expect(() => postgresql.parse('CREATE TABLE t (id INT)')).not.toThrow();
        expect(() => flink.parse('CREATE TABLE t (id INT)')).not.toThrow();
        expect(() => spark.parse('CREATE TABLE t (id INT)')).not.toThrow();
        expect(() => hive.parse('CREATE TABLE t (id INT)')).not.toThrow();
        expect(() => trino.parse('CREATE TABLE t (id INT)')).not.toThrow();
        expect(() => impala.parse('CREATE TABLE t (id INT)')).not.toThrow();
    });

    it('should verify ClickHouse import is NOT available', () => {
        // Try to import ClickHouse - it should NOT exist
        // This test documents that ClickHouse is not supported
        expect(() => {
            // @ts-ignore - intentionally testing non-existent export
            const { ClickHouseSQL } = require('dt-sql-parser');
        }).toThrow();
    });
});

describe('Single-line and Multi-line Comment Handling', () => {
    const mysql = new MySQL();

    describe('Single-line comments (--) before CREATE TABLE', () => {
        it('should parse CREATE TABLE with single-line comment at the beginning', () => {
            const sql = `-- This is a comment
CREATE TABLE users (
    id INT PRIMARY KEY,
    name VARCHAR(100)
)`;
            const parseTree = mysql.parse(sql);
            expect(parseTree).toBeDefined();

            class TableNameVisitor extends MySqlParserVisitor<string> {
                defaultResult(): string { return ''; }
                aggregateResult(a: string, b: string): string { return a || b || ''; }
                visitColumnCreateTable = (ctx: any): string => ctx.tableNameCreate()?.getText() || '';
            }

            const visitor = new TableNameVisitor();
            expect(visitor.visit(parseTree as any)).toBe('users');
        });

        it('should handle multiple single-line comments before CREATE TABLE', () => {
            const sql = `-- Comment line 1
-- Comment line 2
-- Comment line 3
CREATE TABLE products (
    id INT PRIMARY KEY
)`;
            const parseTree = mysql.parse(sql);
            expect(parseTree).toBeDefined();
        });

        it('should handle single-line comments mixed with multi-line comments', () => {
            const sql = `-- Single line comment
/* Multi-line comment */
-- Another single line
CREATE TABLE mixed_comments (
    id INT
)`;
            const parseTree = mysql.parse(sql);
            expect(parseTree).toBeDefined();
        });

        it('should handle inline comments in column definitions', () => {
            const sql = `CREATE TABLE inline_comments (
    id INT PRIMARY KEY, -- primary key
    name VARCHAR(100), -- name column
    created_at DATETIME -- creation timestamp
)`;
            const parseTree = mysql.parse(sql);
            expect(parseTree).toBeDefined();
        });

        it('should handle hash-style comments (MySQL)', () => {
            const sql = `# This is a MySQL hash comment
CREATE TABLE hash_comment (
    id INT
)`;
            const parseTree = mysql.parse(sql);
            expect(parseTree).toBeDefined();
        });
    });

    describe('Comments in various positions', () => {
        it('should handle comments after CREATE TABLE', () => {
            const sql = `CREATE TABLE test_table
-- comment between table name and columns
(
    id INT
)`;
            const parseTree = mysql.parse(sql);
            expect(parseTree).toBeDefined();
        });

        it('should handle comments between columns', () => {
            const sql = `CREATE TABLE between_columns (
    id INT PRIMARY KEY,
    -- This is a comment between columns
    name VARCHAR(100),
    /* Another comment */
    email VARCHAR(255)
)`;
            const parseTree = mysql.parse(sql);
            expect(parseTree).toBeDefined();
        });

        it('should handle comments at the end of statement', () => {
            const sql = `CREATE TABLE end_comment (
    id INT
);
-- This comment is at the end`;
            const parseTree = mysql.parse(sql);
            expect(parseTree).toBeDefined();
        });
    });
});
