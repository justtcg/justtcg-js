import globals from "globals";
import pluginJs from "@eslint/js";
import tseslint from "typescript-eslint";
import eslintConfigPrettier from "eslint-config-prettier";

export default [
    // Start with baseline recommended rules 
    pluginJs.configs.recommended,

    // Add TypeScript-specific rules 
    ...tseslint.configs.recommended,

    // IMPORTANT: Add Prettier config last to disable conflicting style rules
    eslintConfigPrettier,

    // Custom configuration for our project
    {
        files: ["src/**/*.ts"], // Apply these settings only to our source files 
        languageOptions: {
            globals: {
                ...globals.node, // Use Node.js global variables 
            },
        },
        // We can add custom rules here later if we need them
        rules: {
            // Example: 'no-console': 'warn'
        },
    },
    {
        // Ignore the build output directory
        ignores: ["dist/*"],
    },
];