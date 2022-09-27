module.exports = {
	'env': {
		'commonjs': true,
		'es2021': true,
		'node': true
	},
	'extends': [ 'eslint:recommended', 'plugin:n/recommended' ],
	'overrides': [
	],
	'parserOptions': {
		'ecmaVersion': 'latest'
	},
	'rules': {
		'indent': [
			'error',
			'tab'
		],
		'linebreak-style': [
			'error',
			'unix'
		],
		'quotes': [
			'error',
			'single'
		],
		'semi': [
			'error',
			'always'
		],
		'spaced-comment': [
			'error',
			'always'
		],
		'no-multi-spaces': [
			'error'
		],
		'no-trailing-spaces': [
			'error'
		],
		'space-before-blocks': [
			'error',
			'always'
		],
		'space-in-parens': [
			'error',
			'always'
		],
		'space-infix-ops': [
			'error'
		],
	}
};
