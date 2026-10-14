// MySQL 关键字列表
export const MYSQL_KEYWORDS = [
  // DDL 关键字
  'CREATE', 'DROP', 'ALTER', 'SHOW', 'DESCRIBE', 'EXISTS',
  'TABLE', 'INDEX', 'VIEW', 'DATABASE', 'SCHEMA',
  'TRIGGER', 'FUNCTION', 'PROCEDURE', 'EVENT', 'TABLESPACE',
  // DML 关键字
  'SELECT', 'INSERT', 'UPDATE', 'DELETE', 'FROM', 'WHERE',
  // 查询修饰符
  'WITH', 'DISTINCT', 'ALL', 'UNION', 'INTERSECT', 'EXCEPT',
  'STRAIGHT_JOIN', 'HIGH_PRIORITY', 'LOW_PRIORITY', 'DELAYED',
  'ORDER BY', 'GROUP BY', 'HAVING', 'LIMIT', 'OFFSET',
  // 连接类型
  'JOIN', 'LEFT JOIN', 'RIGHT JOIN', 'INNER JOIN', 'FULL OUTER JOIN',
  'CROSS JOIN', 'NATURAL', 'ON', 'USING',
  // MySQL 特有
  'ON DUPLICATE KEY', 'ON DELETE', 'ON UPDATE', 'SET NULL', 'CASCADE',
  'RESTRICT', 'NO ACTION', 'DEFAULT', 'AUTO_INCREMENT',
  'REPLACE', 'IGNORE', 'INTO OUTFILE', 'LOAD DATA',
  // 锁和事务
  'LOCK', 'UNLOCK', 'TABLES', 'BEGIN', 'COMMIT', 'ROLLBACK',
  'START TRANSACTION', 'SAVEPOINT', 'RELEASE SAVEPOINT',
  'SET TRANSACTION', 'ISOLATION LEVEL', 'READ', 'WRITE',
  // 逻辑运算符
  'AND', 'OR', 'NOT', 'IN', 'NOT IN', 'LIKE', 'NOT LIKE', 'BETWEEN',
  'IS NULL', 'IS NOT NULL', 'REGEXP', 'RLIKE',
  // 其他
  'AS', 'CASE', 'WHEN', 'THEN', 'ELSE', 'END', 'NULL', 'TRUE', 'FALSE',
  'EXISTS', 'CAST', 'CONVERT', 'BINARY', 'COLLATE',
];

// MySQL 特有函数
export const MYSQL_FUNCTIONS = [
  // 日期时间函数
  'now', 'current_timestamp', 'current_date', 'current_time',
  'date', 'time', 'timestamp', 'year', 'month', 'day',
  'hour', 'minute', 'second', 'microsecond',
  'date_add', 'date_sub', 'adddate', 'subdate',
  'datediff', 'timediff', 'timestampdiff', 'timestampadd',
  'date_format', 'time_format', 'str_to_date',
  'from_unixtime', 'unix_timestamp', 'utc_date', 'utc_time',
  'last_day', 'monthname', 'dayname', 'dayofweek', 'dayofmonth',
  'dayofyear', 'week', 'weekday', 'quarter', 'yearweek',
  // 字符串函数
  'length', 'char_length', 'character_length', 'lower', 'upper',
  'trim', 'ltrim', 'rtrim', 'substring', 'substr', 'mid',
  'left', 'right', 'replace', 'instr', 'locate', 'position',
  'concat', 'concat_ws', 'format', 'elt', 'field', 'find_in_set',
  'make_set', 'quote', 'repeat', 'reverse', 'space',
  'soundex', 'substring_index', 'weight_string',
  // 数值函数
  'abs', 'ceil', 'ceiling', 'floor', 'round', 'truncate',
  'pow', 'power', 'mod', 'exp', 'log', 'ln', 'log10', 'log2',
  'sqrt', 'sign', 'sin', 'cos', 'tan', 'acos', 'asin', 'atan',
  'conv', 'rand', 'random_bytes',
  // 聚合函数
  'count', 'sum', 'avg', 'min', 'max', 'group_concat',
  'bit_and', 'bit_or', 'bit_xor',
  // 条件函数
  'if', 'ifnull', 'nullif', 'isnull', 'coalesce',
  'case', 'cast', 'convert',
  // 类型转换函数
  'cast', 'convert', 'binary', 'char', 'date', 'datetime',
  'time', 'signed', 'unsigned', 'signed integer', 'unsigned integer',
  // JSON 函数 (MySQL 5.7+)
  'json_array', 'json_object', 'json_quote', 'json_extract',
  'json_unquote', 'json_set', 'json_insert', 'json_replace',
  'json_remove', 'json_keys', 'json_search', 'json_contains',
  'json_valid', 'json_depth', 'json_type', 'json_length',
  // 信息函数
  'connection_id', 'current_user', 'database', 'schema',
  'last_insert_id', 'row_count', 'found_rows', 'version',
  // 加密函数
  'md5', 'sha1', 'sha2', 'password', 'encode', 'decode',
  'encrypt', 'decrypt', 'aes_encrypt', 'aes_decrypt',
  // 其他函数
  'greatest', 'least', 'interval', 'format', 'inet_aton',
  'inet_ntoa', 'inet6_aton', 'inet6_ntoa', 'is_ipv4',
  'is_ipv6', 'is_ipv4_compat', 'is_ipv6_mapped',
  'benchmark', 'sleep', 'get_lock', 'release_lock',
];

// MySQL 数据类型
export const MYSQL_TYPES = [
  // 数值类型
  'tinyint', 'smallint', 'mediumint', 'int', 'integer', 'bigint',
  'float', 'double', 'real', 'decimal', 'numeric', 'fixed',
  'bool', 'boolean', 'serial',
  // 字符类型
  'char', 'varchar', 'tinytext', 'text', 'mediumtext', 'longtext',
  'binary', 'varbinary', 'tinyblob', 'blob', 'mediumblob', 'longblob',
  'enum', 'set',
  // 日期时间类型
  'date', 'datetime', 'timestamp', 'time', 'year',
  // JSON 类型
  'json',
  // 空间类型
  'geometry', 'point', 'linestring', 'polygon',
  'multipoint', 'multilinestring', 'multipolygon', 'geometrycollection',
];

// MySQL 运算符
export const MYSQL_OPERATORS = [
  '+', '-', '*', '/', '%', 'div', // 算术运算符
  '=', '!=', '<>', '<', '>', '<=', '>=', // 比较运算符
  'AND', '&&', 'OR', '||', 'NOT', '!', // 逻辑运算符
  'LIKE', 'NOT LIKE', 'REGEXP', 'NOT REGEXP', 'RLIKE', // 模式匹配
  'BETWEEN', 'NOT BETWEEN', // 范围运算符
  'IS NULL', 'IS NOT NULL', 'IS TRUE', 'IS FALSE', 'IS UNKNOWN',
  'IN', 'NOT IN',
  '<=>', // NULL-safe equal
  '<<', '>>', '|', '&', '~', '^', // 位运算符
  '::', '->', '->>', // MySQL 类型转换/JSON 操作符
];
