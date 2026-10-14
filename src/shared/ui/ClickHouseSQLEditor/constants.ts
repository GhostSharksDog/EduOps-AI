// ClickHouse DDL 关键字
export const CLICKHOUSE_KEYWORDS = [
  // DDL
  'CREATE', 'DROP', 'ALTER', 'ATTACH', 'DETACH', 'SHOW', 'DESCRIBE', 'DESC',
  'TABLE', 'DICTIONARY', 'VIEW', 'MATERIALIZED VIEW', 'DATABASE',
  'IF NOT EXISTS', 'IF EXISTS', 'ON CLUSTER',
  // DML
  'SELECT', 'INSERT', 'INTO', 'VALUES', 'FROM', 'WHERE',
  'UPDATE', 'DELETE', 'ALTER', 'OPTIMIZE',
  // Query modifiers
  'WITH', 'DISTINCT', 'ALL', 'UNION', 'UNION ALL', 'INTERSECT', 'EXCEPT',
  'ORDER BY', 'GROUP BY', 'HAVING', 'LIMIT', 'OFFSET',
  'ARRAY JOIN', 'LEFT ARRAY JOIN',
  // Joins
  'JOIN', 'LEFT JOIN', 'RIGHT JOIN', 'INNER JOIN', 'FULL JOIN', 'CROSS JOIN',
  'ASOF JOIN', 'ANY JOIN', 'ALL JOIN', 'GLOBAL JOIN',
  'ON', 'USING',
  // ClickHouse specific
  'SAMPLE', 'FINAL', 'SETTINGS', 'FORMAT',
  'PARTITION BY', 'ORDER BY', 'PRIMARY KEY', 'SAMPLE BY',
  'TTL', 'GRANULARITY', 'INDEX', 'PROJECTION',
  // Engines
  'ENGINE', 'MergeTree', 'ReplacingMergeTree', 'SummingMergeTree',
  'AggregatingMergeTree', 'CollapsingMergeTree', 'VersionedCollapsingMergeTree',
  'ReplicatedMergeTree', 'ReplicatedReplacingMergeTree',
  'ReplicatedSummingMergeTree', 'ReplicatedAggregatingMergeTree',
  'Distributed', 'Dictionary', 'Memory', 'TinyLog', 'StripeLog', 'Log',
  'File', 'Null', 'Set', 'Join', 'URL', 'View', 'MaterializedView',
  'Merge', 'Buffer', 'Kafka', 'RabbitMQ', 'MySQL', 'PostgreSQL',
  'S3', 'HDFS', 'Hive', 'MongoDB', 'Redis', 'ClickHouse',
  // Modifiers
  'DEFAULT', 'MATERIALIZED', 'ALIAS', 'CODEC', 'TTL',
  'NULLABLE', 'NOT NULL', 'NULL', 'LOWCARDINALITY',
  'SETTINGS', 'PARTITION', 'PARTITIONS',
  // Logical operators
  'AND', 'OR', 'NOT', 'IN', 'NOT IN', 'LIKE', 'ILIKE', 'NOT LIKE',
  'BETWEEN', 'IS NULL', 'IS NOT NULL', 'GLOBAL IN', 'GLOBAL NOT IN',
  // Other
  'AS', 'CASE', 'WHEN', 'THEN', 'ELSE', 'END', 'TRUE', 'FALSE',
  'CAST', 'EXISTS', 'ANY', 'ALL', 'SOME',
];

// ClickHouse 函数
export const CLICKHOUSE_FUNCTIONS = [
  // Date/time functions
  'now', 'today', 'yesterday', 'tomorrow',
  'toDate', 'toDateTime', 'toDateTime64', 'toDate32',
  'toTime', 'toTimeZone', 'timeZone', 'timeSlots',
  'toYear', 'toQuarter', 'toMonth', 'toDayOfMonth', 'toDayOfWeek',
  'toHour', 'toMinute', 'toSecond', 'toUnixTimestamp',
  'fromUnixTimestamp', 'fromUnixTimestamp64Milli', 'fromUnixTimestamp64Micro', 'fromUnixTimestamp64Nano',
  'formatDateTime', 'formatDateTimeInJodaSyntax', 'dateName',
  'dateDiff', 'timestampDiff', 'dateDiffWithin', 'addDays', 'addWeeks',
  'addMonths', 'addYears', 'addHours', 'addMinutes', 'addSeconds',
  'addQuarters', 'subtractDays', 'subtractWeeks', 'subtractMonths', 'subtractYears',
  // String functions
  'length', 'lengthUTF8', 'char_length', 'characterLength', 'lower', 'upper',
  'lowerUTF8', 'upperUTF8', 'isValidUTF8', 'toValidUTF8',
  'trim', 'trimLeft', 'trimRight', 'trimBoth',
  'ltrim', 'rtrim', 'substring', 'substr', 'mid',
  'concat', 'concatAssumeInjective', 'concatWithSeparator',
  'left', 'right', 'padLeft', 'padRight',
  'empty', 'notEmpty', 'startsWith', 'endsWith',
  'position', 'positionCaseInsensitive', 'positionUTF8', 'positionCaseInsensitiveUTF8',
  'multiSearchFirstPosition', 'multiSearchFirstPositionCaseInsensitive',
  'replaceOne', 'replaceAll', 'replaceRegexpOne', 'replaceRegexpAll',
  'repeat', 'space', 'reverse', 'reverseUTF8',
  'splitByString', 'splitByChar', 'splitByRegexp',
  'match', 'extract', 'extractAll', 'extractAllGroupsHorizontal', 'extractAllGroupsVertical',
  'like', 'ilike', 'notLike', 'regexpQuoteMeta',
  // Math functions
  'abs', 'ceil', 'ceiling', 'floor', 'round', 'roundToExp2', 'roundDuration', 'roundAge',
  'trunc', 'truncate', 'sign', 'negate', 'positive', 'negative',
  'sqrt', 'cbrt', 'exp', 'exp2', 'exp10', 'log', 'log2', 'log10',
  'pow', 'power', 'intExp2', 'intExp10',
  'sin', 'cos', 'tan', 'asin', 'acos', 'atan', 'atan2',
  'sinh', 'cosh', 'tanh', 'asinh', 'acosh', 'atanh',
  'pi', 'e', 'gamma', 'tgamma', 'lgamma',
  'gcd', 'lcm', 'max2', 'min2', 'mul', 'intDiv', 'intDivOrZero', 'intMod',
  'modulo', 'moduloOrZero', 'moduloOrOne',
  'rand', 'randCanonical', 'randConstant', 'randExponential', 'randNormal', 'randLogNormal', 'randPoisson',
  // Aggregate functions
  'count', 'sum', 'sumWithOverflow', 'sumMap', 'min', 'max', 'avg', 'quantile',
  'quantiles', 'quantileExact', 'quantileExactLow', 'quantileExactHigh',
  'quantileTiming', 'quantileTimingWeighted', 'quantileDeterministic',
  'quantileTDigest', 'quantileTDigestWeighted', 'quantileBFloat16',
  'median', 'quantileExactExclusive', 'quantileExactInclusive',
  'varSamp', 'varPop', 'stddevSamp', 'stddevPop', 'covarSamp', 'covarPop',
  'corr', 'groupArray', 'groupArrayInsertAt', 'groupArrayMovingSum', 'groupArrayMovingAvg',
  'groupUniqArray', 'groupBitAnd', 'groupBitOr', 'groupBitXor',
  'groupBitmap', 'groupBitmapAnd', 'groupBitmapOr', 'groupBitmapXor',
  'sumCount', 'uniq', 'uniqExact', 'uniqCombined', 'uniqCombined64',
  'uniqHLL12', 'uniqTheta', 'any', 'anyHeavy', 'anyLast',
  'argMin', 'argMax', 'minMap', 'maxMap', 'skewSamp', 'skewPop', 'kurtSamp', 'kurtPop',
  'topK', 'topKWeighted', 'deltaSum', 'deltaSumTimestamp',
  // Array functions
  'array', 'arrayConcat', 'arrayElement', 'arrayElements', 'arraySlice',
  'arrayMap', 'arrayFilter', 'arrayFill', 'arrayReverseFill',
  'arrayExists', 'arrayAll', 'arrayAny', 'arrayFirst', 'arrayFirstIndex',
  'arrayLast', 'arrayLastIndex', 'arrayMin', 'arrayMax', 'arraySum', 'arrayAvg',
  'arrayProduct', 'arraySort', 'arrayReverseSort', 'arrayReverse',
  'arrayUniq', 'arrayJoin', 'arrayDifference', 'arrayCumSum', 'arrayCumSumNonNegative',
  'arrayEnumerate', 'arrayEnumerateUniq', 'arrayEnumerateDense',
  'arrayPopBack', 'arrayPopFront', 'arrayPushBack', 'arrayPushFront',
  'arrayResize', 'arrayCompact', 'arrayZip', 'arrayAuc', 'arrayIntersect',
  'arrayDistinct', 'arrayCount', 'arrayFlatten', 'arrayReduce', 'has', 'hasAll', 'hasAny', 'hasSubstr',
  'indexOf', 'arrayIndexOf', 'countEqual', 'arrayCountEqual',
  // Map functions
  'map', 'mapKeys', 'mapValues', 'mapContains', 'mapGet', 'mapPopulateSeries',
  // Type conversion
  'toInt8', 'toInt16', 'toInt32', 'toInt64', 'toInt128', 'toInt256',
  'toUInt8', 'toUInt16', 'toUInt32', 'toUInt64', 'toUInt128', 'toUInt256',
  'toFloat32', 'toFloat64', 'toDecimal32', 'toDecimal64', 'toDecimal128', 'toDecimal256',
  'toString', 'toFixedString', 'toUUID', 'toIPv4', 'toIPv6',
  'toBool', 'toNullable', 'toLowCardinality', 'toColumnTypeName',
  // JSON functions
  'JSONExtract', 'JSONExtractRaw', 'JSONExtractArrayRaw', 'JSONExtractKeysAndValues',
  'JSONExtractKeys', 'JSONExtractValues', 'JSONExtractString', 'JSONExtractInt',
  'JSONExtractFloat', 'JSONExtractBool', 'JSONExtractUInt', 'JSONExtractKeysAndValuesRaw',
  'JSON_EXISTS', 'JSON_VALUE', 'JSON_QUERY',
  // Conditional functions
  'if', 'multiIf', 'ifNull', 'nullIf', 'coalesce', 'assumeNotNull',
  // Bit functions
  'bitAnd', 'bitOr', 'bitXor', 'bitNot', 'bitShiftLeft', 'bitShiftRight',
  'bitRotateLeft', 'bitRotateRight', 'bitTest', 'bitTestAll', 'bitTestAny',
  // Encoding functions
  'hex', 'unhex', 'bin', 'base64Encode', 'base64Decode', 'tryBase64Decode',
  'encodeXMLComponent', 'decodeXMLComponent',
  // Hash functions
  'halfMD5', 'MD4', 'MD5', 'SHA1', 'SHA224', 'SHA256', 'SHA512', 'SHA512_256',
  'xxHash32', 'xxHash64', 'xxh3', 'sipHash64', 'sipHash128',
  'cityHash64', 'farmHash64', 'metroHash64', 'murmurHash2_32', 'murmurHash2_64',
  'intHash32', 'intHash64', 'SHA1', 'BLAKE3',
  // IP functions
  'IPv4NumToString', 'IPv4StringToNum', 'IPv6NumToString', 'IPv6StringToNum',
  'IPv4ToIPv6', 'cutIPv6', 'IPv4CIDRToRange', 'IPv6CIDRToRange',
  'toIPv4', 'toIPv6', 'isIPv4', 'isIPv6', 'IPv4StringToNumOrDefault', 'IPv6StringToNumOrDefault',
  // UUID functions
  'generateUUIDv4', 'UUIDStringToNum', 'UUIDNumToString', 'empty', 'notEmpty',
  // Other functions
  'hostName', 'fqdn', 'benchmark', 'sleep', 'isConstant', 'ignore',
  'currentDatabase', 'currentUser', 'isDecimalOverflow', 'countDigits',
  'normalizeQuery', 'normalizedQueryHash', 'getTypeSerializationStreams',
  'blockNumber', 'blockSerializedSize', 'rowNumberInAllBlocks',
  'runningAccumulate', 'runningDifference', 'runningDifferenceStartingWithFirstValue',
  'maxIntersections', 'maxIntersectionsPosition',
];

// ClickHouse 数据类型
export const CLICKHOUSE_TYPES = [
  // Integer types
  'Int8', 'Int16', 'Int32', 'Int64', 'Int128', 'Int256',
  'UInt8', 'UInt16', 'UInt32', 'UInt64', 'UInt128', 'UInt256',
  // Float types
  'Float32', 'Float64',
  // Decimal types
  'Decimal', 'Decimal32', 'Decimal64', 'Decimal128', 'Decimal256',
  // String types
  'String', 'FixedString',
  // Date types
  'Date', 'Date32',
  // DateTime types
  'DateTime', 'DateTime64',
  // Boolean
  'Bool', 'Boolean',
  // UUID
  'UUID',
  // IP types
  'IPv4', 'IPv6',
  // Complex types
  'Array', 'Map', 'Tuple', 'Nested',
  // Special types
  'Enum', 'Enum8', 'Enum16',
  'LowCardinality', 'Nullable',
  'AggregateFunction', 'SimpleAggregateFunction',
  'Object', 'Variant', 'Dynamic',
];
