import { useState, useCallback, useMemo, useEffect, useRef } from 'react';
import { useTheme } from '@/shared/ui/ThemeProvider';
import type { SQLEditorProps, CompletionItem } from '@/shared/ui/SQLEditor/types';
import { useSQLValidation } from '@/shared/ui/SQLEditor/useSQLValidation';
import { lightEditorTheme, darkEditorTheme, lightHighlightStyle, darkHighlightStyle } from '@/shared/ui/SQLEditor/themes';
import type { Extension } from '@codemirror/state';
import { syntaxHighlighting } from '@codemirror/language';

const VALIDATION_DEBOUNCE_MS = 300;

export interface UseSQLEditorOptions {
  databaseName: string;
  keywords: string[];
  functions: string[];
  types: string[];
}

export interface UseSQLEditorReturn {
  isDarkMode: boolean;
  validationError: { message: string } | null;
  schema: Record<string, string[]>;
  getCompletions: () => CompletionItem[];
  handleChange: (val: string) => void;
  highlightStyle: Extension;
  lightTheme: typeof lightEditorTheme;
  darkTheme: typeof darkEditorTheme;
}

export const useSQLEditor = (
  props: SQLEditorProps,
  options: UseSQLEditorOptions
): UseSQLEditorReturn => {
  const {
    onChange,
    tables = [],
    onError,
    theme: themeProp,
  } = props;

  const [validationError, setValidationError] = useState<{ message: string } | null>(null);
  const [isSystemDark, setIsSystemDark] = useState(false);

  const { isDarkMode: isAppDarkMode } = useTheme();

  useEffect(() => {
    const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
    
    const initTheme = () => {
      setIsSystemDark(mediaQuery.matches);
    };
    initTheme();

    const handler = (e: MediaQueryListEvent) => {
      setIsSystemDark(e.matches);
    };

    mediaQuery.addEventListener('change', handler);
    return () => mediaQuery.removeEventListener('change', handler);
  }, []);

  const isDarkMode = themeProp === 'system'
    ? isSystemDark
    : themeProp === 'dark' || (themeProp === undefined && isAppDarkMode);

  const { validateSQL } = useSQLValidation((error) => {
    if (error) {
      setValidationError({ message: error.message });
      onError?.(error);
    } else {
      setValidationError(null);
      onError?.(null);
    }
  });

  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const debouncedValidate = useCallback((sql: string) => {
    if (debounceRef.current) {
      clearTimeout(debounceRef.current);
    }
    debounceRef.current = setTimeout(() => {
      validateSQL(sql);
    }, VALIDATION_DEBOUNCE_MS);
  }, [validateSQL]);

  useEffect(() => {
    return () => {
      if (debounceRef.current) {
        clearTimeout(debounceRef.current);
      }
    };
  }, []);

  const schema = useMemo(() => {
    return tables.reduce((acc, table) => {
      acc[table.name] = table.columns.map(col => col.name);
      return acc;
    }, {} as Record<string, string[]>);
  }, [tables]);

  const staticCompletions = useMemo((): CompletionItem[] => {
    const { keywords, functions, types, databaseName } = options;
    return [
      ...keywords.map(k => ({
        label: k,
        type: 'keyword' as const,
      })),
      ...functions.map(f => ({
        label: f,
        type: 'function' as const,
        detail: databaseName,
      })),
      ...types.map(t => ({
        label: t,
        type: 'type' as const,
      })),
    ];
  }, [options]);

  const tableCompletions = useMemo((): CompletionItem[] => {
    const completions: CompletionItem[] = [];
    tables.forEach(table => {
      completions.push({
        label: table.name,
        type: 'table' as const,
        detail: 'Table',
      });
      table.columns.forEach(col => {
        completions.push({
          label: col.name,
          type: 'column' as const,
          detail: `${table.name}.${col.name}`,
        });
      });
    });
    return completions;
  }, [tables]);

  const getCompletions = useCallback((): CompletionItem[] => {
    return [...tableCompletions, ...staticCompletions];
  }, [tableCompletions, staticCompletions]);

  const handleChange = useCallback((val: string) => {
    onChange(val);
    debouncedValidate(val);
  }, [onChange, debouncedValidate]);

  const highlightStyle = useMemo(
    () => syntaxHighlighting(isDarkMode ? darkHighlightStyle : lightHighlightStyle),
    [isDarkMode]
  );

  return {
    isDarkMode,
    validationError,
    schema,
    getCompletions,
    handleChange,
    highlightStyle,
    lightTheme: lightEditorTheme,
    darkTheme: darkEditorTheme,
  };
};

export const DEFAULT_BASIC_SETUP = {
  lineNumbers: true,
  highlightActiveLineGutter: true,
  highlightActiveLine: true,
  foldGutter: true,
  dropCursor: true,
  allowMultipleSelections: true,
  indentOnInput: true,
  syntaxHighlighting: true,
  bracketMatching: true,
  closeBrackets: true,
  autocompletion: true,
  rectangularSelection: true,
  crosshairCursor: true,
  highlightSelectionMatches: true,
  closeBracketsKeymap: true,
  defaultKeymap: true,
  searchKeymap: true,
  historyKeymap: true,
  foldKeymap: true,
  completionKeymap: true,
  lintKeymap: true,
};

export const getErrorStyles = (isDark: boolean) => ({
  color: isDark ? '#ff7875' : '#ff4d4f',
  fontSize: '12px',
  marginTop: '4px',
  padding: '4px 8px',
  background: isDark ? 'rgba(211, 32, 41, 0.1)' : '#fff2f0',
  border: isDark ? '1px solid rgba(211, 32, 41, 0.3)' : '1px solid #ffccc7',
  borderRadius: '4px',
  display: 'flex',
  alignItems: 'center',
  gap: '4px',
});
