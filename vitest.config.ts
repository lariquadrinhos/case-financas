import { defineConfig } from 'vitest/config'
import react from '@vitejs/plugin-react'
import path from 'node:path'

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
      // `server-only` throws on import outside a Server Component; under test the
      // module being imported IS the server code. See src/test/server-only.stub.ts.
      'server-only': path.resolve(__dirname, './src/test/server-only.stub.ts'),
    },
  },
  test: {
    environment: 'jsdom',
    globals: true,
    /**
     * O padrão do Vitest, e por isso escrito aqui: o número já foi 30s.
     *
     * O limite de 30s existia porque os diálogos com Popover/Select do Radix
     * levavam até 21s por teste. A P40 mediu o porquê em 2026-09-09 — uma
     * recursão mútua de `:modal` entre @floating-ui e nwsapi, cortada em
     * `vitest.setup.ts`, onde o raciocínio está escrito. Depois disso:
     *
     *   suíte inteira      125,97s → 14,14s
     *   pior teste isolado  21.398ms → 429ms
     *
     * 5s dá ~11x de folga sobre o pior caso, o bastante para contenção de CPU
     * em CI e pouco o bastante para uma regressão desse tipo voltar a quebrar
     * o portão em vez de só deixá-lo lento.
     */
    testTimeout: 5_000,
    setupFiles: ['./vitest.setup.ts'],
    include: ['src/**/*.{test,spec}.{ts,tsx}'],
    exclude: ['node_modules', '.next', 'e2e'],
    coverage: {
      provider: 'v8',
      // As pastas são `domain/` e `data/` (inglês, ADR-0010); enquanto isto
      // apontou para `dominio/` e `dados/`, a cobertura media zero arquivo.
      include: ['src/domain/**', 'src/data/**', 'src/api/**'],
      reporter: ['text', 'html'],
    },
  },
})
