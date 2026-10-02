import js from "@eslint/js";
import tseslint from "typescript-eslint";
import eslintConfigPrettier from "eslint-config-prettier";
import globals from "globals";

// ESLint flat config。整形は Prettier、ここでは型だけでは拾えないバグと品質を検出する。
// 型情報を使うルール（no-floating-promises 等）のため type-checked を採用する。
export default tseslint.config(
  { ignores: ["node_modules", "coverage", "tmp"] },

  js.configs.recommended,
  ...tseslint.configs.recommendedTypeChecked,

  {
    languageOptions: {
      parserOptions: {
        projectService: true,
        tsconfigRootDir: import.meta.dirname,
      },
    },
    rules: {
      // 先頭 _ の未使用引数・変数は許可（tsc の noUnusedParameters と挙動を揃える）
      "@typescript-eslint/no-unused-vars": [
        "error",
        { argsIgnorePattern: "^_", varsIgnorePattern: "^_" },
      ],
    },
  },

  // 設定系の JS ファイルは型情報なしで lint する
  {
    files: ["**/*.js", "**/*.mjs", "**/*.cjs"],
    extends: [tseslint.configs.disableTypeChecked],
    languageOptions: { globals: { ...globals.node } },
  },

  // 整形に関するルールを無効化（Prettier と競合させない）。必ず最後に置く。
  eslintConfigPrettier,
);
