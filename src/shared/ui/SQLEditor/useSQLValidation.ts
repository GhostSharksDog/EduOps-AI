import { useCallback } from 'react';
import type { SQLValidationError } from '@/shared/ui/SQLEditor/types';

export const useSQLValidation = (
  onError?: (error: SQLValidationError | null) => void
) => {
  const validateSQL = useCallback((sql: string): boolean => {
    if (!sql || !sql.trim()) {
      onError?.(null);
      return true;
    }

    const trimmed = sql.trim();

    const validStartPatterns = [
      /^SELECT/i,
      /^INSERT/i,
      /^UPDATE/i,
      /^DELETE/i,
      /^WITH/i,
      /^CREATE/i,
      /^ALTER/i,
      /^DROP/i,
      /^TRUNCATE/i,
      /^EXPLAIN/i,
      /^SHOW/i,
      /^DESCRIBE/i,
      /^DESC\s/i,
      /^OPTIMIZE/i,
      /^SYSTEM/i,
      /^CHECK/i,
      /^ATTACH/i,
      /^DETACH/i,
      /^RENAME/i,
    ];

    const isValidStart = validStartPatterns.some(pattern => pattern.test(trimmed));

    if (!isValidStart) {
      const error: SQLValidationError = {
        message: 'SQL 语句格式无效，请检查语法',
        line: 1,
        column: 1,
      };
      onError?.(error);
      return false;
    }

    const openParens = (sql.match(/\(/g) || []).length;
    const closeParens = (sql.match(/\)/g) || []).length;
    if (openParens !== closeParens) {
      const error: SQLValidationError = {
        message: 'SQL 语法错误：括号不匹配',
      };
      onError?.(error);
      return false;
    }

    onError?.(null);
    return true;
  }, [onError]);

  const formatSQL = useCallback((sql: string): string => {
    return sql
      .replace(/\s+/g, ' ')
      .replace(/\s*([(),])\s*/g, '$1')
      .trim();
  }, []);

  return {
    validateSQL,
    formatSQL,
  };
};
