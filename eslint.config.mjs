import jsPlugin from '@eslint/js'
import tsPlugin from 'typescript-eslint'
import importPlugin from 'eslint-plugin-import'
import reactHooksPlugin from "eslint-plugin-react-hooks"

// "prettier",

export default [
  {
    ignores: [
      "*.js",
      "*.cjs",
      "*.mjs",
      "**/.jestEnvVars.js",
      ".gitignore",
      ".dockerignore",
      "**/.env.*",
      "**/env.*",
      "**/ignore/**/*",
      "**/__mocks__/*.js",
      "**/testdata/**/*.js",
      "**/jest.config.ts",
      "**/tsup.config*.ts",
      "**/webpack*.js",
      "**/proxy-dev-server.js",
      "**/dist/*",
      "**/build/*",
    ],
  },

  jsPlugin.configs.recommended,
  ...tsPlugin.configs.recommended,
  importPlugin.flatConfigs.recommended,

  {
    plugins: {
      "react-hooks": reactHooksPlugin,
    },

    rules: {
      semi: ["error", "never"],

      "no-unused-vars": "off",
      "@typescript-eslint/no-unused-vars": ["error"],

      "@typescript-eslint/explicit-member-accessibility": [
        "warn", {
          accessibility: "no-public",
        }
      ],

      "@typescript-eslint/no-empty-function": [
        "error", {
          allow: ["constructors"],
        }
      ],

      "@typescript-eslint/no-redeclare": "off",

      "import/no-default-export": "error",
      "import/no-unresolved": "off",
      "import/named": "off",
      "import/first": "error",

      "react/prop-types": "off",

      "no-console": "error",
    }
  }
]
