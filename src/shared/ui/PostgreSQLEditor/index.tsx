import React, { useCallback } from 'react';
import CodeMirror from '@uiw/react-codemirror';
import { sql } from '@codemirror/lang-sql';
import { basicSetup } from 'codemirror';
import { autocompletion, type CompletionContext, type CompletionSource } from '@codemirror/autocomplete';
import { useSQLEditor, DEFAULT_BASIC_SETUP, getErrorStyles } from '@/shared/ui/SQLEditor/index';
import type { PostgreSQLEditorProps } from '@/shared/ui/PostgreSQLEditor/types';
import { POSTGRESQL_KEYWORDS, POSTGRESQL_FUNCTIONS, POSTGRESQL_TYPES } from '@/shared/ui/PostgreSQLEditor/constants';

const PostgreSQLEditor: React.FC<PostgreSQLEditorProps> = ({
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
      databaseName: 'PostgreSQL',
      keywords: POSTGRESQL_KEYWORDS,
      functions: POSTGRESQL_FUNCTIONS,
      types: POSTGRESQL_TYPES,
    }
  );

  const postgresqlCompletions: CompletionSource = useCallback((context: CompletionContext) => {
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

  return (
    <div className="postgresql-sql-editor">
      <CodeMirror
        value={value}
        height={typeof height === 'number' ? `${height}px` : height}
        theme={isDarkMode ? darkTheme : lightTheme}
        extensions={[
          basicSetup,
          sql({ schema }),
          autocompletion({ override: [postgresqlCompletions] }),
          highlightStyle,
        ]}
        onChange={handleChange}
        readOnly={readOnly}
        placeholder={placeholder}
        basicSetup={DEFAULT_BASIC_SETUP}
        style={{
          fontSize: '14px',
          border: isDarkMode ? '1px solid rgba(23, 125, 220, 0.3)' : '1px solid rgba(22, 119, 255, 0.2)',
          borderRadius: '6px',
        }}
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

export default PostgreSQLEditor;
export type { PostgreSQLEditorProps } from '@/shared/ui/PostgreSQLEditor/types';
export { POSTGRESQL_KEYWORDS, POSTGRESQL_FUNCTIONS, POSTGRESQL_TYPES };
