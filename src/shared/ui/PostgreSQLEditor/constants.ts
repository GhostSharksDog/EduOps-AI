// PostgreSQL 关键字列表
export const POSTGRESQL_KEYWORDS = [
  // DDL 关键字
  'CREATE', 'DROP', 'ALTER', 'SHOW', 'DESCRIBE', 'EXISTS',
  'TABLE', 'INDEX', 'VIEW', 'SEQUENCE', 'SCHEMA', 'DATABASE',
  'TRIGGER', 'FUNCTION', 'PROCEDURE', 'TYPE', 'EXTENSION',
  // DML 关键字
  'SELECT', 'INSERT', 'UPDATE', 'DELETE', 'FROM', 'WHERE',
  // 查询修饰符
  'WITH', 'DISTINCT', 'ALL', 'UNION', 'INTERSECT', 'EXCEPT',
  'ORDER BY', 'GROUP BY', 'HAVING', 'LIMIT', 'OFFSET', 'FOR',
  'FETCH', 'NEXT', 'ROWS', 'ONLY', 'PERCENT', 'TIES',
  // 连接类型
  'JOIN', 'LEFT JOIN', 'RIGHT JOIN', 'INNER JOIN', 'FULL OUTER JOIN',
  'CROSS JOIN', 'NATURAL', 'LATERAL', 'ON', 'USING',
  // 窗口函数
  'OVER', 'PARTITION BY', 'ROWS BETWEEN', 'RANGE BETWEEN',
  'PRECEDING', 'FOLLOWING', 'UNBOUNDED', 'CURRENT ROW',
  // PostgreSQL 特有
  'RETURNING', 'WITHIN GROUP', 'FILTER', 'OVERLAPS', 'ILIKE',
  'SIMILAR TO', 'ESCAPE', 'COALESCE', 'GREATEST', 'LEAST',
  // 逻辑运算符
  'AND', 'OR', 'NOT', 'IN', 'NOT IN', 'LIKE', 'ILIKE', 'BETWEEN',
  'IS NULL', 'IS NOT NULL', 'IS DISTINCT FROM', 'IS NOT DISTINCT FROM',
  // 其他
  'AS', 'CASE', 'WHEN', 'THEN', 'ELSE', 'END', 'NULL', 'TRUE', 'FALSE',
  'EXISTS', 'BETWEEN', 'CAST', 'EXTRACT', 'INTERVAL',
];

// PostgreSQL 特有函数
export const POSTGRESQL_FUNCTIONS = [
  // 日期时间函数
  'now', 'current_timestamp', 'current_date', 'current_time',
  'age', 'date_trunc', 'date_part', 'date_add', 'date_sub',
  'extract', 'to_timestamp', 'to_date', 'to_char',
  'justify_days', 'justify_hours', 'justify_interval',
  // 字符串函数
  'length', 'lower', 'upper', 'trim', 'ltrim', 'rtrim',
  'substring', 'left', 'right', 'replace', 'position',
  'concat', 'concat_ws', 'format', 'initcap', 'reverse',
  'split_part', 'regexp_replace', 'regexp_match', 'quote_ident',
  // 数组函数
  'array', 'array_length', 'array_upper', 'array_lower',
  'array_cat', 'array_dims', 'array_fill', 'array_position',
  'array_remove', 'array_replace', 'unnest', 'array_agg',
  // JSON/JSONB 函数
  'json_build_object', 'json_build_array', 'json_object',
  'jsonb_build_object', 'jsonb_build_array', 'jsonb_object',
  'json_extract_path', 'jsonb_extract_path', 'to_json', 'to_jsonb',
  'json_agg', 'jsonb_agg', 'json_each', 'jsonb_each',
  // 聚合函数
  'count', 'sum', 'avg', 'min', 'max', 'array_agg', 'string_agg',
  'bool_and', 'bool_or', 'every', 'variance', 'stddev',
  'corr', 'covar_pop', 'covar_samp', 'regr_avgx', 'regr_avgy',
  'percentile_cont', 'percentile_disc', 'mode', 'rank',
  'dense_rank', 'row_number', 'ntile', 'lag', 'lead',
  'first_value', 'last_value', 'nth_value',
  // 类型转换函数
  'CAST', 'convert', 'to_char', 'to_number', 'to_date', 'to_timestamp',
  // 条件函数
  'if', 'case', 'coalesce', 'nullif', 'greatest', 'least',
  // 其他常用函数
  'generate_series', 'generate_subscripts', 'setseed', 'random',
  'md5', 'sha256', 'encode', 'decode', 'pg_column_size',
  'pg_typeof', 'pg_size_pretty', 'pg_relation_size',
];

// PostgreSQL 数据类型
export const POSTGRESQL_TYPES = [
  // 数值类型
  'smallint', 'integer', 'bigint', 'decimal', 'numeric',
  'real', 'double precision', 'smallserial', 'serial', 'bigserial',
  'int2', 'int4', 'int8', 'float4', 'float8',
  // 字符类型
  'character varying', 'varchar', 'character', 'char', 'text',
  // 日期时间类型
  'date', 'time', 'timestamp', 'timestamptz', 'timetz',
  'interval',
  // 布尔类型
  'boolean', 'bool',
  // UUID/JSON
  'uuid', 'json', 'jsonb', 'jsonpath',
  // 网络类型
  'inet', 'cidr', 'macaddr', 'macaddr8',
  // 几何类型
  'point', 'line', 'lseg', 'box', 'path', 'polygon', 'circle',
  // 其他类型
  'bytea', 'bit', 'varbit', 'tsvector', 'tsquery', 'oid',
  'regclass', 'regtype', 'regprocedure', 'regoperator', 'regnamespace',
];

// PostgreSQL 运算符
export const POSTGRESQL_OPERATORS = [
  '+', '-', '*', '/', '%', '^', // 算术运算符
  '=', '!=', '<>', '<', '>', '<=', '>=', // 比较运算符
  'AND', 'OR', 'NOT', // 逻辑运算符
  'LIKE', 'ILIKE', 'NOT LIKE', '~', '~*', '!~', '!~*', // 模式匹配
  'BETWEEN', 'BETWEEN SYMMETRIC', // 范围运算符
  'IS NULL', 'IS NOT NULL', 'IS TRUE', 'IS FALSE', 'IS UNKNOWN',
  'IS DISTINCT FROM', 'IS NOT DISTINCT FROM',
  '@>', '<@', '&&', '<<', '>>', '&<', '&>', // JSON/数组运算符
  '::', // PostgreSQL 显式类型转换
];
