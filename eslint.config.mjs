import eslintConfigNext from 'eslint-config-next';

export default [
  {
    ignores: ['**/node_modules/**', '**/.next/**', '**/out/**', '**/dist/**'],
  },
  ...eslintConfigNext,
  {
    rules: {
      'react-hooks/immutability': 'off',
      'react-hooks/set-state-in-effect': 'off',
      'react-hooks/preserve-manual-memoization': 'off',
      'react-hooks/purity': 'off',
      'react-hooks/incompatible-library': 'off',
    },
  },
];

