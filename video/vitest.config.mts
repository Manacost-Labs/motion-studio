// Модульные тесты чистой логики (npm test → vitest run): без рендера, браузера и сети, весь прогон — секунды.
// Тесты лежат рядом с кодом: src/core/**/*.test.ts (движок) и scripts/**/*.test.ts (данные и функции скриптов).
// В CI (.github/workflows/ci.yml) и в pre-commit — вместе с tsc и check-layers.
import {defineConfig} from 'vitest/config';

export default defineConfig({
  test: {
    include: ['src/core/**/*.test.ts', 'scripts/**/*.test.ts'],
    environment: 'node',
  },
});
