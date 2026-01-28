const js = require( '@eslint/js' );
const tsParser = require( '@typescript-eslint/parser' );
const tsPlugin = require( '@typescript-eslint/eslint-plugin' );
const globals = require( 'globals' );

module.exports = [
	{
		ignores: [ 'dist/**', 'node_modules/**' ]
	},
	{
		languageOptions: {
			ecmaVersion: 2021,
			globals: {
				...globals.node,
				...globals.es2021
			}
		}
	},
	js.configs.recommended,
	{
		files: [ '**/*.ts' ],
		languageOptions: {
			parser: tsParser,
			parserOptions: {
				project: './tsconfig.json',
				tsconfigRootDir: __dirname,
				ecmaVersion: 2021,
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
		files: [ '**/*.js' ],
		languageOptions: {
			ecmaVersion: 2021,
			sourceType: 'script'
		}
	}
];
