import { fileURLToPath } from "url";
import { dirname } from "path";

import js from "@eslint/js";
import tseslint from "typescript-eslint";
import unicorn from "eslint-plugin-unicorn";
import perfectionist from "eslint-plugin-perfectionist";
import reactHooks from "eslint-plugin-react-hooks";
import boundaries from "eslint-plugin-boundaries";

const __dirname = dirname(fileURLToPath(import.meta.url));

export default [
    { ignores: ["dist", "node_modules", "src-tauri"] },

    js.configs.recommended,

    ...tseslint.configs.recommended,
    ...tseslint.configs.recommendedTypeChecked,

    unicorn.configs?.["flat/recommended"] ?? {},
    perfectionist.configs?.["recommended-alphabetical"] ?? {},

    {
        languageOptions: {
            parserOptions: {
                tsconfigRootDir: __dirname,
                projectService: true,
            },
        },

        plugins: {
            unicorn,
        },

        rules: {
            "@typescript-eslint/no-explicit-any": "error",
            "unicorn/consistent-function-scoping": "error",
            "unicorn/better-dom-traversing": "off",
            "unicorn/filename-case": "off",
            "unicorn/no-array-fill-with-reference-type": "off",
            "unicorn/no-array-reduce": "warn",
            "perfectionist/sort-imports": "error",
        },
    },
    {
        files: ["packages/editor/**/*.{ts,tsx}"],

        plugins: {
            "react-hooks": reactHooks,
        },

        rules: {
            ...(reactHooks.configs?.recommended?.rules ?? {}),
            "react-hooks/exhaustive-deps": "error",
            "react-hooks/refs": "off",
            "react-hooks/set-state-in-effect": "off",
        },
    },
    {
        plugins: {
            boundaries,
        },

        settings: {
            "boundaries/elements": [
                { type: "core", pattern: "packages/core/**" },
                { type: "player", pattern: "packages/player/**" },
                { type: "editor", pattern: "packages/editor/**" }
            ]
        },

        rules: {
            "boundaries/dependencies": [
                "error",
                {
                    default: "disallow",
                    rules: [
                        {
                            from: { type: "editor" },
                            allow: { to: { type: "core" } }
                        },
                        {
                            from: { type: "player" },
                            allow: { to: { type: "core" } }
                        },
                        {
                            from: { type: "core" },
                            disallow: { to: { type: ["editor", "player"] } }
                        }
                    ]
                }
            ]
        },
    },
];
