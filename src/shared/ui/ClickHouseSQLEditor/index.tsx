import React, { useCallback, useMemo } from 'react';
import CodeMirror from '@uiw/react-codemirror';
import { sql } from '@codemirror/lang-sql';
import { autocompletion, type CompletionContext, type CompletionSource } from '@codemirror/autocomplete';
import { useSQLEditor, DEFAULT_BASIC_SETUP, getErrorStyles } from '@/shared/ui/SQLEditor/index';
import type { ClickHouseSQLEditorProps } from '@/shared/ui/ClickHouseSQLEditor/types';
import { CLICKHOUSE_KEYWORDS, CLICKHOUSE_FUNCTIONS, CLICKHOUSE_TYPES } from '@/shared/ui/ClickHouseSQLEditor/constants';

const ClickHouseSQLEditor: React.FC<ClickHouseSQLEditorProps> = ({
  value = '',
  onChange,
  tables = [],
  onError,
  placeholder = 'SELECT * FROM table_name WHERE condition',
  readOnly = false,
  height = 350,
  theme,
}) => {
  const {
    isDarkMode,
    validationError,
    schema,
    getCompletions,
    handleChange,
    highlightStyle,
    lightTheme,
    darkTheme,
  } = useSQLEditor(
    { value, onChange, tables, onError, placeholder, readOnly, height, theme },
    {
      databaseName: 'ClickHouse',
      keywords: CLICKHOUSE_KEYWORDS,
      functions: CLICKHOUSE_FUNCTIONS,
      types: CLICKHOUSE_TYPES,
    }
  );

  const clickhouseCompletions: CompletionSource = useCallback((context: CompletionContext) => {
    const word = context.matchBefore(/\w*/);
    if (!word) return null;

    const completions = getCompletions();
    const matching = completions.filter(c =>
      c.label.toLowerCase().startsWith(word.text.toLowerCase())
    );

    if (matching.length === 0) return null;

    return {
      from: word.from,
      options: matching.map(c => ({
        label: c.label,
        type: c.type,
        detail: c.detail,
        apply: c.label,
      })),
    };
  }, [getCompletions]);

  const editorStyle = useMemo(() => ({
    fontSize: '14px',
    border: isDarkMode ? '1px solid rgba(23, 125, 220, 0.3)' : '1px solid rgba(22, 119, 255, 0.2)',
    borderRadius: '6px',
  }), [isDarkMode]);

  return (
    <div className="clickhouse-sql-editor">
      <CodeMirror
        value={value}
        height={typeof height === 'number' ? `${height}px` : height}
        theme={isDarkMode ? darkTheme : lightTheme}
        extensions={[
          sql({ schema }),
          autocompletion({ override: [clickhouseCompletions] }),
          highlightStyle,
        ]}
        onChange={handleChange}
        readOnly={readOnly}
        placeholder={placeholder}
        basicSetup={DEFAULT_BASIC_SETUP}
        style={editorStyle}
        aria-label="ClickHouse SQL 编辑器"
      />
      {validationError && (
        <div style={getErrorStyles(isDarkMode)}>
          <span>❌</span>
          <span>{validationError.message}</span>
        </div>
      )}
    </div>
  );
};

export default ClickHouseSQLEditor;
export type { ClickHouseSQLEditorProps, TableSchema } from '@/shared/ui/ClickHouseSQLEditor/types';
export { CLICKHOUSE_KEYWORDS, CLICKHOUSE_FUNCTIONS, CLICKHOUSE_TYPES };
