const js = require( '@eslint/js' );
const tsParser = require( '@typescript-eslint/parser' );
const tsPlugin = require( '@typescript-eslint/eslint-plugin' );
const globals = require( 'globals' );
const promisePlugin = require( 'eslint-plugin-promise' );
const nPlugin = require( 'eslint-plugin-n' );
const securityPlugin = require( 'eslint-plugin-security' );

const nodeSettings = { node: { version: '>=24.0.0' } };

module.exports = [
	{
		ignores: [ 'dist/**', 'node_modules/**' ]
	},
	js.configs.recommended,
	{
		files: [ '**/*.{js,ts,cjs}' ],
		languageOptions: {
			ecmaVersion: 'latest',
			sourceType: 'module',
			globals: {
				...globals.node,
				...( globals.es2024 ?? globals.es2021 )
			}
		},
		settings: nodeSettings,
		plugins: {
			n: nPlugin,
			promise: promisePlugin,
			security: securityPlugin
		},
		rules: {
			'no-console': 'error',
			'no-duplicate-imports': 'error',
			'no-implicit-coercion': 'error',
			'no-throw-literal': 'error',
			'no-useless-concat': 'error',
			'n/no-deprecated-api': 'error',
			'n/no-unsupported-features/es-builtins': 'error',
			'n/no-unsupported-features/es-syntax': 'error',
			'n/prefer-node-protocol': 'error',
			'promise/catch-or-return': 'error',
			'promise/param-names': 'error',
			'security/detect-eval-with-expression': 'error',
			'security/detect-new-buffer': 'error',
			'security/detect-non-literal-regexp': 'error',
			'security/detect-object-injection': 'off',
			'security/detect-non-literal-fs-filename': 'off',
			'security/detect-unsafe-regex': 'error'
		}
	},
	{
		files: [ '**/*.ts' ],
		languageOptions: {
			parser: tsParser,
			parserOptions: {
				project: './tsconfig.json',
				tsconfigRootDir: __dirname,
				sourceType: 'module'
			}
		},
		plugins: {
			'@typescript-eslint': tsPlugin
		},
		rules: {
			...tsPlugin.configs['recommended-type-checked'].rules,
			...tsPlugin.configs['strict-type-checked'].rules,
			...tsPlugin.configs['stylistic-type-checked'].rules,
			'no-undef': 'off',
			'no-unused-vars': 'off',
			'n/no-missing-import': 'off',
			'n/no-unsupported-features/es-syntax': 'off',
			'@typescript-eslint/consistent-type-imports': [
				'error',
				{
					prefer: 'type-imports',
					fixStyle: 'separate-type-imports'
				}
			],
			'@typescript-eslint/consistent-type-exports': 'error',
			'@typescript-eslint/no-unused-vars': [
				'error',
				{
					argsIgnorePattern: '^_',
					varsIgnorePattern: '^_'
				}
			],
			'@typescript-eslint/no-misused-promises': [
				'error',
				{
					checksVoidReturn: {
						attributes: false
					}
				}
			],
			'@typescript-eslint/no-floating-promises': 'error',
			'@typescript-eslint/no-confusing-void-expression': 'error',
			'@typescript-eslint/strict-boolean-expressions': [
				'error',
				{
					allowString: false,
					allowNumber: false,
					allowNullableObject: false
				}
			],
			'@typescript-eslint/switch-exhaustiveness-check': 'error',
			'@typescript-eslint/restrict-template-expressions': [
				'error',
				{
					allowNumber: true,
					allowBoolean: true
				}
			]
		}
	},
	{
		files: [ 'src/cli.ts', 'test/**/*.js' ],
		rules: {
			'no-console': 'off'
		}
	},
	{
		files: [ '**/*.cjs' ],
		languageOptions: {
			sourceType: 'script'
		}
	}
];
