import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  // 禁止直接导入 antd 静态方法，必须使用 App.useApp() 或 useGlobalMessage
  // 原因：静态方法无法消费 React Context（如动态主题）
  // 参考：https://ant.design/docs/react/customize-theme#usepresetalias
  {
    files: ["**/*.{ts,tsx}"],
    ignores: ["src/lib/message-service.tsx"], // 豁免：基础设施需要访问原始 API
    rules: {
      "no-restricted-imports": ["error", {
        "patterns": [{
          "group": ["antd"],
          "importNames": ["message", "notification", "modal"],
          "message": "禁止直接从 antd 导入 message/notification/modal 静态方法。\n\n请使用以下替代方案：\n- React 组件: import { useGlobalMessage } from '@/shared/lib/message-service';\n- 或使用: const { message, modal, notification } = App.useApp();\n\n原因：静态方法无法消费 React Context（如动态主题）"
        }]
      }],
      // 忽略下划线前缀的未使用变量（接口实现占位参数）
      "@typescript-eslint/no-unused-vars": ["warn", {
        "argsIgnorePattern": "^_",
        "varsIgnorePattern": "^_",
        "caughtErrorsIgnorePattern": "^_"
      }],
      // Ant Design 废弃属性检测
      // Space/Steps direction → orientation
      // Select dropdownRender → popupRender
      "no-restricted-syntax": ["error",
        {
          "selector": "JSXElement[openingElement.name.name=Space] JSXAttribute[name.name=direction]",
          "message": "Ant Design Space 的 direction 属性已废弃。\n\n请使用: orientation=\"vertical\" 或 orientation=\"horizontal\""
        },
        {
          "selector": "JSXElement[openingElement.name.name=Steps] JSXAttribute[name.name=direction]",
          "message": "Ant Design Steps 的 direction 属性已废弃。\n\n请使用: orientation=\"vertical\" 或 orientation=\"horizontal\""
        },
        {
          "selector": "JSXElement[openingElement.name.name=Select] JSXAttribute[name.name=dropdownRender]",
          "message": "Ant Design Select 的 dropdownRender 属性已废弃。\n\n请使用: popupRender={(menu) => ...}"
        }
      ]
    }
  },
  // Override default ignores of eslint-config-next.
  globalIgnores([
    // Default ignores of eslint-config-next:
    ".next/**",
    ".trae/**",
    ".idea/**",
    ".spec-workflow/**",
    ".shared/**",
    "out/**",
    "doc/**",
    "deployment/**",
    "node_modules/**",
    "public/**",
    "scripts/**",
    "sql/**",
    "prisma/**",
    "tests/**",
    "build/**",
    "src/generated/**",
    "next-env.d.ts",
  ]),
]);

export default eslintConfig;
