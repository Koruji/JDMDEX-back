module.exports = {
  env: {
    node: true,
    jest: true,
    es2021: true,
  },
  extends: [
    'airbnb-base',
  ],
  parserOptions: {
    ecmaVersion: 'latest',
    sourceType: 'module',
  },
  rules: {
    'no-console': 'off',
    'no-unused-vars': ['error', { argsIgnorePattern: '^_' }],
    'import/extensions': 'off',
    'import/no-extraneous-dependencies': ['error', { devDependencies: true }],
    'linebreak-style': ['error', 'unix'],
    'max-len': ['error', { code: 100 }],
    'consistent-return': 'off',
    'no-return-await': 'off',
    'class-methods-use-this': 'off',
    'no-await-in-loop': 'off',
    'no-restricted-syntax': 'off',
    'camelcase': 'off',
    'radix': ['error', 'always'],
  },
  ignorePatterns: ['node_modules/', 'coverage/', 'uploads/', 'logs/'],
};
