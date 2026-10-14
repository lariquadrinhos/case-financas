/**
 * Stand-in for the `server-only` package under Vitest.
 *
 * `server-only` throws on import outside a Server Component, by design. The unit
 * tests of `src/api/handler.ts` and of anything that reads a session are plain
 * Node code, so without this alias they cannot import the module under test at
 * all — and an HTTP wrapper that carries `requireSession()` is exactly the code
 * that must be tested.
 *
 * The alias is declared in `vitest.config.ts` and nowhere else: the real package
 * still guards the real build.
 */

export {}
