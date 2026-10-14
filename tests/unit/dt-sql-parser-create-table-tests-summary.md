# dt-sql-parser CREATE TABLE 测试用例总结（按测试目的精简版）

## 概述

本文档按**测试目的**对 `dt-sql-parser` 库中 CREATE TABLE 语句解析的测试用例进行精简总结。原始 52 个测试用例可归纳为 **12 个核心测试目的**，覆盖 7 种 SQL 方言：MySQL、PostgreSQL、Flink、Spark、Hive、Trino 和 Impala。

---

## 测试目的分类

### 目的1：基础 CREATE TABLE 语句解析

**测试目标**：验证解析器能正确解析各种 SQL 方言的 CREATE TABLE 语句

| 核心测试 | MySQL | PostgreSQL | Flink | Spark | Hive | Trino | Impala |
|----------|-------|------------|-------|-------|------|-------|--------|
| 解析基本 CREATE TABLE | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ |

**合计**：7 个测试 → 1 个测试目的

---

### 目的2：表名提取（Visitor 模式）

**测试目标**：验证 Visitor 模式能正确提取表名

| 核心测试 | MySQL | PostgreSQL | Flink | Spark | Hive | Trino | Impala |
|----------|-------|------------|-------|-------|------|-------|--------|
| 提取表名 | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ |

**合计**：7 个测试 → 1 个测试目的

---

### 目的3：列信息提取

**测试目标**：验证能正确提取列名和数据类型

| 核心测试 | MySQL | PostgreSQL |
|----------|-------|------------|
| 提取列名 | ✓ | ✓ |
| 提取数据类型 | ✓ | ✓ |

**合计**：4 个测试 → 1 个测试目的

---

### 目的4：约束处理

**测试目标**：验证能检测和处理各种约束

| 核心测试 | 覆盖方言 |
|----------|----------|
| 检测 PRIMARY KEY | MySQL |
| 处理复合主键 | MySQL |

**合计**：2 个测试 → 1 个测试目的

---

### 目的5：注释（COMMENT）处理

**测试目标**：验证能正确解析各种 COMMENT 语法

#### 5.1 表级注释
| 核心测试 | MySQL | PostgreSQL | Flink | Spark | Hive | Trino | Impala |
|----------|-------|------------|-------|-------|------|-------|--------|
| 解析带表注释的 CREATE TABLE | ✓ | ✓(COMMENT ON) | ✓ | ✓ | ✓ | ✓ | ✓ |

#### 5.2 列级注释
| 核心测试 | 覆盖方言 |
|----------|----------|
| 解析列级注释 | MySQL |
| 提取列级注释文本 | MySQL |
| 处理备用 COMMENT 语法 | MySQL |

**合计**：9 个测试 → 2 个测试目的（表级注释 + 列级注释）

---

### 目的6：验证和错误处理

**测试目标**：验证无效 SQL 的处理能力

| 核心测试 | 覆盖方言 |
|----------|----------|
| 验证无效 SQL | MySQL |
| 验证不带分号的 CREATE TABLE | MySQL |
| 处理 IF NOT EXISTS 子句 | MySQL |
| 处理 TEMPORARY TABLE | MySQL |

**合计**：4 个测试 → 1 个测试目的

---

### 目的7：完整表结构提取

**测试目标**：验证能提取完整的表结构信息

| 核心测试 | 覆盖方言 |
|----------|----------|
| 提取完整表结构 | MySQL |

**合计**：1 个测试 → 1 个测试目的

---

### 目的8：多行注释处理

**测试目标**：验证能处理 SQL 中的多行注释

| 核心测试 | 覆盖方言 |
|----------|----------|
| 处理多行注释 | MySQL |

**合计**：1 个测试 → 1 个测试目的

---

### 目的9：API 功能验证

**测试目标**：确认核心 API 功能正常工作

| 核心测试 |
|----------|
| 确认可以解析 CREATE TABLE |
| 确认 Visitor 模式可提取表名 |
| 确认 Visitor 模式可提取列 |
| 确认 Visitor 模式可提取数据类型 |

**合计**：4 个测试 → 1 个测试目的

---

### 目的10：不支持的方言验证

**测试目标**：确认某些方言不被支持

| 核心测试 |
|----------|
| 确认 ClickHouse 不被支持 |
| 验证 ClickHouse 导入不可用 |

**合计**：2 个测试 → 1 个测试目的

---

## 精简对比

| 维度 | 原始 | 精简后 |
|------|------|--------|
| 测试用例数 | 52 | 12 |
| 分类方式 | 按方言分组 | 按测试目的分组 |

## 核心发现

1. **重复测试**：7 个方言 × 2 个基础测试（解析 + 表名）= 14 个重复测试
2. **方言差异有限**：大部分方言的 CREATE TABLE 解析逻辑相同，仅 COMMENT 语法有差异
3. **测试冗余**：MySQL 测试最全面（17 个），但很多是其他方言的重复验证

---

## 测试 SQL 样本

### MySQL/PostgreSQL 样本
```sql
CREATE TABLE users (
    id INT PRIMARY KEY,
    name VARCHAR(100) NOT NULL,
    email VARCHAR(255),
    age INT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);
```

### Flink 样本
```sql
CREATE TABLE orders (
    order_id INT PRIMARY KEY,
    product_name VARCHAR(100),
    quantity INT,
    order_time TIMESTAMP
);
```

### Spark/Hive/Trino/Impala 样本
```sql
CREATE TABLE users (
    id INT,
    name STRING,
    email STRING
);
```

---

## 方言特性对比

| 特性 | MySQL | PostgreSQL | Flink | Spark | Hive | Trino | Impala |
|------|-------|------------|-------|-------|------|-------|--------|
| 基础解析 | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ |
| 表名提取 | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ |
| 列提取 | ✓ | ✓ | - | - | - | - | - |
| PRIMARY KEY | ✓ | - | - | - | - | - | - |
| 表注释 | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ |
| 列注释 | ✓ | ✓ | - | - | - | - | - |
| COMMENT 语法 | 内联 | COMMENT ON | 内联 | 内联 | 内联 | 内联 | 内联 |

**注**："-" 表示该测试用例未覆盖，但不代表功能不支持
