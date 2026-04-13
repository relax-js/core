**Overall**

Target audience:  Beginner developers.

- Do not analyze code base to find patterns etc, ask if required.
* Prefer the simplest, most minimal approach first. Do not over-design solutions or add unnecessary abstractions.
* Always reproduce bugs before fixing if tests can be written (skip for UI etc). If tests can’t be written, add logs if you are not sure of the root cause.
* State mutations should always be made through methods, task-based APIs (DTOs excluded)
* UI components own their own logic and state. Parents pass data in, not behavior.
* Documentation and identifiers should be expressed from the point of view of the target audience.
* Tests should be named so they tell which business rule it's proving or which edge cases it's preventing. Use underscore in names.
* Favor composition over large classes.


**Documentation**
- Document using markdown in docs/
- JSDoc to explain context and purpose, but do NOT repeat what the code says.
- Never use em-dashes (—) in prose. Rephrase the sentence instead.

**TypeScript:**
- Never silently consume errors (no empty `.catch()`, no catch-and-ignore)
- No code comments; use JSDoc with purpose, context, and usage examples
- Use `declare type` for string enums (not `enum`)
- Create explicit event classes extending `Event` (not `CustomEvent`); store data as class properties; register in `HTMLElementEventMap`
- Use `ElementInternals` with `formAssociated = true` for form components
- `null` vs `undefined` semantics: use `null` for intentional or structural absence (a defined terminator, an empty slot by design). Use `undefined` for "not yet set" or for query results that returned nothing (like `Array.find`). Do not mix within a single concept (e.g. pick one for a linked-list node's prev/next across the whole API).

**CSS:**
- Semantic variable names (`--surface-bg`, `--input-bg`, `--accent-primary`)
- Style semantic HTML directly; scope forms with `.form` class
- CSS Grid/Flexbox for responsive layout
- CSS-only components where JS isn't needed
- Easy theme implementation via CSS variables
- No reset styles

**Components:**
- `r-` prefix
- Vanilla TypeScript, no frameworks
- Form controls: `name`, `value`, `disabled`, `required`, `dataType`
- `getData()`/`setData()` for typed values
- Use native HTML when possible instead of creating duplicate functionality.

**Formatting:**
- 4-space indentation
- Single quotes, trailing commas (ES5), 100 char width

**Testing:**
- Vitest with jsdom environment
- Test files: `tests/**/*.{tests,test}.ts`, mirroring `src/` structure
- Run: `npx vitest run <path>` for specific files
- Import from source (`../../../src/lib/...`), not package name
- For custom elements: register test components with `test-` prefix to avoid collisions
- Use `async/await` with `flush()` helper (`setTimeout(r, 0)`) for async DOM operations
- Reset module-level state in `beforeEach` (e.g., `onError(null as any)`)

**Workflow:**
- Always ask before changing public APIs

