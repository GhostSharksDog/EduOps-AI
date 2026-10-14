import { EditorView } from '@codemirror/view';
import { HighlightStyle, syntaxHighlighting } from '@codemirror/language';
import { tags as t } from '@lezer/highlight';

export const lightEditorTheme = EditorView.theme({
  '&': {
    backgroundColor: '#ffffff',
    color: 'rgba(0, 0, 0, 0.88)',
  },
  '.cm-content': {
    caretColor: '#1677ff',
  },
  '.cm-scroller': {
    fontFamily: 'inherit',
  },
  '.cm-scroller::-webkit-scrollbar': {
    width: '8px',
    height: '8px',
  },
  '.cm-scroller::-webkit-scrollbar-track': {
    backgroundColor: '#f5f7fa',
    borderRadius: '4px',
  },
  '.cm-scroller::-webkit-scrollbar-thumb': {
    backgroundColor: '#d9d9d9',
    borderRadius: '4px',
  },
  '.cm-scroller::-webkit-scrollbar-thumb:hover': {
    backgroundColor: '#bfbfbf',
  },
  '.cm-scroller::-webkit-scrollbar-corner': {
    backgroundColor: '#f5f7fa',
  },
  '.cm-cursor': {
    borderLeftColor: '#1677ff',
  },
  '.cm-gutters': {
    backgroundColor: '#f5f7fa',
    color: 'rgba(0, 0, 0, 0.45)',
    borderRight: '1px solid rgba(22, 119, 255, 0.08)',
  },
  '.cm-activeLineGutter': {
    backgroundColor: 'rgba(22, 119, 255, 0.06)',
    color: '#1677ff',
  },
  '.cm-activeLine': {
    backgroundColor: 'rgba(22, 119, 255, 0.04)',
  },
  '.cm-selectionBackground': {
    backgroundColor: 'rgba(22, 119, 255, 0.1)',
  },
  '&.cm-focused .cm-selectionBackground': {
    backgroundColor: 'rgba(22, 119, 255, 0.18)',
  },
  '.cm-matchingBracket': {
    backgroundColor: 'rgba(22, 119, 255, 0.1)',
    borderBottom: '1px solid #1677ff',
  },
  '.cm-nonmatchingBracket': {
    backgroundColor: 'rgba(255, 79, 79, 0.1)',
    borderBottom: '1px solid #ff4d4f',
  },
  '.cm-keyword': {
    color: '#1677ff',
    fontWeight: '600',
  },
  '.cm-string': {
    color: '#cf1322',
  },
  '.cm-number': {
    color: '#d4380d',
  },
  '.cm-operator': {
    color: '#595959',
  },
  '.cm-punctuation': {
    color: '#595959',
  },
  '.cm-comment': {
    color: '#8c8c8c',
    fontStyle: 'italic',
  },
  '.cm-variableName': {
    color: '#262626',
  },
  '.cm-propertyName': {
    color: '#262626',
  },
  '.cm-typeName': {
    color: '#4096ff',
  },
  '.cm-function': {
    color: '#4096ff',
  },
  '.cm-builtin': {
    color: '#1677ff',
  },
  '.cm-tooltip-autocomplete': {
    backgroundColor: '#ffffff',
    border: '1px solid rgba(22, 119, 255, 0.2)',
    borderRadius: '6px',
    boxShadow: '0 6px 16px rgba(0, 0, 0, 0.08)',
  },
  '.cm-completionLabel': {
    color: 'rgba(0, 0, 0, 0.88)',
  },
  '.cm-completionDetail': {
    color: 'rgba(0, 0, 0, 0.45)',
    fontStyle: 'italic',
  },
  '.cm-completionMatchedText': {
    color: '#1677ff',
    textDecoration: 'none',
    fontWeight: '600',
  },
  '.cm-tooltip-autocomplete > ul': {
    fontFamily: 'inherit',
  },
  '.cm-tooltip-autocomplete > ul > li': {
    padding: '4px 8px',
  },
  '.cm-tooltip-autocomplete > ul > li[aria-selected]': {
    backgroundColor: 'rgba(22, 119, 255, 0.1)',
    color: 'rgba(0, 0, 0, 0.88)',
  },
  '.cm-tooltip-autocomplete > ul::-webkit-scrollbar': {
    width: '8px',
    height: '8px',
  },
  '.cm-tooltip-autocomplete > ul::-webkit-scrollbar-track': {
    backgroundColor: '#f5f7fa',
    borderRadius: '4px',
  },
  '.cm-tooltip-autocomplete > ul::-webkit-scrollbar-thumb': {
    backgroundColor: '#d9d9d9',
    borderRadius: '4px',
  },
  '.cm-tooltip-autocomplete > ul::-webkit-scrollbar-thumb:hover': {
    backgroundColor: '#bfbfbf',
  },
  '.cm-tooltip-autocomplete > ul::-webkit-scrollbar-corner': {
    backgroundColor: '#f5f7fa',
  },
  '.cm-completionIcon': {
    opacity: 0.7,
  },
  '.cm-completionIcon-keyword::after': {
    content: '"K"',
    color: '#1677ff',
  },
  '.cm-completionIcon-function::after': {
    content: '"f"',
    color: '#4096ff',
  },
  '.cm-completionIcon-type::after': {
    content: '"T"',
    color: '#4096ff',
  },
  '.cm-completionIcon-table::after': {
    content: '"T"',
    color: '#cf1322',
  },
  '.cm-completionIcon-column::after': {
    content: '"C"',
    color: '#262626',
  },
});

export const darkEditorTheme = EditorView.theme({
  '&': {
    backgroundColor: '#1f1f1f',
    color: 'rgba(255, 255, 255, 0.88)',
  },
  '.cm-content': {
    caretColor: '#177ddc',
  },
  '.cm-scroller': {
    fontFamily: 'inherit',
  },
  '.cm-scroller::-webkit-scrollbar': {
    width: '8px',
    height: '8px',
  },
  '.cm-scroller::-webkit-scrollbar-track': {
    backgroundColor: '#1f1f1f',
    borderRadius: '4px',
  },
  '.cm-scroller::-webkit-scrollbar-thumb': {
    backgroundColor: '#434343',
    borderRadius: '4px',
  },
  '.cm-scroller::-webkit-scrollbar-thumb:hover': {
    backgroundColor: '#5a5a5a',
  },
  '.cm-scroller::-webkit-scrollbar-corner': {
    backgroundColor: '#1f1f1f',
  },
  '.cm-cursor': {
    borderLeftColor: '#177ddc',
  },
  '.cm-gutters': {
    backgroundColor: '#141414',
    color: 'rgba(255, 255, 255, 0.45)',
    borderRight: '1px solid rgba(23, 125, 220, 0.15)',
  },
  '.cm-activeLineGutter': {
    backgroundColor: 'rgba(23, 125, 220, 0.1)',
    color: '#177ddc',
  },
  '.cm-activeLine': {
    backgroundColor: 'rgba(23, 125, 220, 0.08)',
  },
  '.cm-selectionBackground': {
    backgroundColor: 'rgba(23, 125, 220, 0.2)',
  },
  '&.cm-focused .cm-selectionBackground': {
    backgroundColor: 'rgba(23, 125, 220, 0.3)',
  },
  '.cm-matchingBracket': {
    backgroundColor: 'rgba(23, 125, 220, 0.15)',
    borderBottom: '1px solid #177ddc',
  },
  '.cm-nonmatchingBracket': {
    backgroundColor: 'rgba(211, 32, 41, 0.15)',
    borderBottom: '1px solid #d32029',
  },
  '.cm-keyword': {
    color: '#177ddc',
    fontWeight: '600',
  },
  '.cm-string': {
    color: '#ff7875',
  },
  '.cm-number': {
    color: '#ff9c6e',
  },
  '.cm-operator': {
    color: '#8c8c8c',
  },
  '.cm-punctuation': {
    color: '#bfbfbf',
  },
  '.cm-comment': {
    color: '#5a5a5a',
    fontStyle: 'italic',
  },
  '.cm-variableName': {
    color: '#d9d9d9',
  },
  '.cm-propertyName': {
    color: '#d9d9d9',
  },
  '.cm-typeName': {
    color: '#409cff',
  },
  '.cm-function': {
    color: '#409cff',
  },
  '.cm-builtin': {
    color: '#177ddc',
  },
  '.cm-tooltip-autocomplete': {
    backgroundColor: '#262626',
    border: '1px solid rgba(23, 125, 220, 0.3)',
    borderRadius: '6px',
    boxShadow: '0 6px 16px rgba(0, 0, 0, 0.3)',
  },
  '.cm-completionLabel': {
    color: 'rgba(255, 255, 255, 0.88)',
  },
  '.cm-completionDetail': {
    color: 'rgba(255, 255, 255, 0.45)',
    fontStyle: 'italic',
  },
  '.cm-completionMatchedText': {
    color: '#177ddc',
    textDecoration: 'none',
    fontWeight: '600',
  },
  '.cm-tooltip-autocomplete > ul': {
    fontFamily: 'inherit',
  },
  '.cm-tooltip-autocomplete > ul > li': {
    padding: '4px 8px',
  },
  '.cm-tooltip-autocomplete > ul > li[aria-selected]': {
    backgroundColor: 'rgba(23, 125, 220, 0.2)',
    color: '#ffffff',
  },
  '.cm-tooltip-autocomplete > ul::-webkit-scrollbar': {
    width: '8px',
    height: '8px',
  },
  '.cm-tooltip-autocomplete > ul::-webkit-scrollbar-track': {
    backgroundColor: '#1f1f1f',
    borderRadius: '4px',
  },
  '.cm-tooltip-autocomplete > ul::-webkit-scrollbar-thumb': {
    backgroundColor: '#434343',
    borderRadius: '4px',
  },
  '.cm-tooltip-autocomplete > ul::-webkit-scrollbar-thumb:hover': {
    backgroundColor: '#5a5a5a',
  },
  '.cm-tooltip-autocomplete > ul::-webkit-scrollbar-corner': {
    backgroundColor: '#1f1f1f',
  },
  '.cm-completionIcon': {
    opacity: 0.7,
  },
  '.cm-completionIcon-keyword::after': {
    content: '"K"',
    color: '#177ddc',
  },
  '.cm-completionIcon-function::after': {
    content: '"f"',
    color: '#409cff',
  },
  '.cm-completionIcon-type::after': {
    content: '"T"',
    color: '#409cff',
  },
  '.cm-completionIcon-table::after': {
    content: '"T"',
    color: '#ff7875',
  },
  '.cm-completionIcon-column::after': {
    content: '"C"',
    color: '#d9d9d9',
  },
}, { dark: true });

export const darkHighlightStyle = HighlightStyle.define([
  { tag: t.keyword, color: '#177ddc', fontWeight: '600' },
  { tag: t.operatorKeyword, color: '#177ddc', fontWeight: '600' },
  { tag: t.modifier, color: '#177ddc' },
  { tag: t.logicOperator, color: '#177ddc' },
  { tag: t.string, color: '#ff7875' },
  { tag: t.special(t.string), color: '#ff7875' },
  { tag: t.character, color: '#ff7875' },
  { tag: t.docString, color: '#ff7875' },
  { tag: t.attributeValue, color: '#ff7875' },
  { tag: t.number, color: '#ff9c6e' },
  { tag: t.integer, color: '#ff9c6e' },
  { tag: t.float, color: '#ff9c6e' },
  { tag: t.bool, color: '#177ddc' },
  { tag: t.null, color: '#177ddc' },
  { tag: t.definition(t.typeName), color: '#409cff' },
  { tag: t.typeName, color: '#409cff' },
  { tag: t.standard(t.typeName), color: '#409cff' },
  { tag: t.className, color: '#69b1ff' },
  { tag: t.macroName, color: '#409cff' },
  { tag: t.function(t.variableName), color: '#409cff' },
  { tag: t.function(t.propertyName), color: '#409cff' },
  { tag: t.comment, color: '#5a5a5a', fontStyle: 'italic' },
  { tag: t.lineComment, color: '#5a5a5a', fontStyle: 'italic' },
  { tag: t.blockComment, color: '#5a5a5a', fontStyle: 'italic' },
  { tag: t.docComment, color: '#5a5a5a', fontStyle: 'italic' },
  { tag: t.operator, color: '#8c8c8c' },
  { tag: t.definitionOperator, color: '#8c8c8c' },
  { tag: t.arithmeticOperator, color: '#8c8c8c' },
  { tag: t.bitwiseOperator, color: '#8c8c8c' },
  { tag: t.compareOperator, color: '#8c8c8c' },
  { tag: t.updateOperator, color: '#8c8c8c' },
  { tag: t.punctuation, color: '#bfbfbf' },
  { tag: t.separator, color: '#bfbfbf' },
  { tag: t.angleBracket, color: '#bfbfbf' },
  { tag: t.squareBracket, color: '#bfbfbf' },
  { tag: t.paren, color: '#bfbfbf' },
  { tag: t.brace, color: '#bfbfbf' },
  { tag: t.bracket, color: '#d9d9d9' },
  { tag: t.special(t.punctuation), color: '#d9d9d9' },
  { tag: t.special(t.bracket), color: '#d9d9d9' },
  { tag: t.special(t.variableName), color: '#d9d9d9' },
  { tag: t.self, color: '#d9d9d9' },
  { tag: t.propertyName, color: '#d9d9d9' },
  { tag: t.attributeName, color: '#d9d9d9' },
  { tag: t.namespace, color: '#d9d9d9' },
  { tag: t.labelName, color: '#d9d9d9' },
  { tag: t.heading, color: '#177ddc', fontWeight: 'bold' },
  { tag: t.strong, fontWeight: 'bold' },
  { tag: t.emphasis, fontStyle: 'italic' },
  { tag: t.strikethrough, textDecoration: 'line-through' },
  { tag: t.invalid, color: '#ff7875' },
  { tag: t.processingInstruction, color: '#5a5a5a' },
]);

export const lightHighlightStyle = HighlightStyle.define([
  { tag: t.keyword, color: '#1677ff', fontWeight: '600' },
  { tag: t.operatorKeyword, color: '#1677ff', fontWeight: '600' },
  { tag: t.modifier, color: '#1677ff' },
  { tag: t.logicOperator, color: '#1677ff' },
  { tag: t.string, color: '#cf1322' },
  { tag: t.special(t.string), color: '#cf1322' },
  { tag: t.character, color: '#cf1322' },
  { tag: t.docString, color: '#cf1322' },
  { tag: t.attributeValue, color: '#cf1322' },
  { tag: t.number, color: '#d4380d' },
  { tag: t.integer, color: '#d4380d' },
  { tag: t.float, color: '#d4380d' },
  { tag: t.bool, color: '#1677ff' },
  { tag: t.null, color: '#1677ff' },
  { tag: t.definition(t.typeName), color: '#4096ff' },
  { tag: t.typeName, color: '#4096ff' },
  { tag: t.standard(t.typeName), color: '#4096ff' },
  { tag: t.className, color: '#1890ff' },
  { tag: t.macroName, color: '#4096ff' },
  { tag: t.function(t.variableName), color: '#4096ff' },
  { tag: t.function(t.propertyName), color: '#4096ff' },
  { tag: t.comment, color: '#8c8c8c', fontStyle: 'italic' },
  { tag: t.lineComment, color: '#8c8c8c', fontStyle: 'italic' },
  { tag: t.blockComment, color: '#8c8c8c', fontStyle: 'italic' },
  { tag: t.docComment, color: '#8c8c8c', fontStyle: 'italic' },
  { tag: t.operator, color: '#595959' },
  { tag: t.definitionOperator, color: '#595959' },
  { tag: t.arithmeticOperator, color: '#595959' },
  { tag: t.bitwiseOperator, color: '#595959' },
  { tag: t.compareOperator, color: '#595959' },
  { tag: t.updateOperator, color: '#595959' },
  { tag: t.punctuation, color: '#595959' },
  { tag: t.separator, color: '#595959' },
  { tag: t.angleBracket, color: '#595959' },
  { tag: t.squareBracket, color: '#595959' },
  { tag: t.paren, color: '#595959' },
  { tag: t.brace, color: '#595959' },
  { tag: t.bracket, color: '#262626' },
  { tag: t.special(t.punctuation), color: '#262626' },
  { tag: t.special(t.bracket), color: '#262626' },
  { tag: t.special(t.variableName), color: '#262626' },
  { tag: t.self, color: '#262626' },
  { tag: t.propertyName, color: '#262626' },
  { tag: t.attributeName, color: '#262626' },
  { tag: t.namespace, color: '#262626' },
  { tag: t.labelName, color: '#262626' },
  { tag: t.heading, color: '#1677ff', fontWeight: 'bold' },
  { tag: t.strong, fontWeight: 'bold' },
  { tag: t.emphasis, fontStyle: 'italic' },
  { tag: t.strikethrough, textDecoration: 'line-through' },
  { tag: t.invalid, color: '#cf1322' },
  { tag: t.processingInstruction, color: '#8c8c8c' },
]);
