import { defineConfig } from 'vitest/config'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  test: {
    environment: 'jsdom',
    globals: true,
    setupFiles: ['./src/test/setup.ts'],
    css: true,
    // Sok teszt-fájl párhuzamos futtatásakor (pl. teljes `vitest run`) a
    // gép terhelése miatt az 5s alapértelmezett timeout időnként túl
    // szűkös egyes userEvent-interakciókra — ez nem valódi tesztsiker/
    // -hiba kérdés, csak erőforrás-versengés, ezért nagyobb tartalékkal
    // számolunk.
    testTimeout: 10000,
  },
})
