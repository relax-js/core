**Audience**

Experienced developers who concluded that large frameworks abstract away too much to stay efficient in big systems, because the cost lands when tracking down errors. Assume the reader knows the web platform, not framework vocabulary.

- Keep behavior visible at the call site. Indirection that hides where something happened costs more than the boilerplate it removes.
- Abstraction that removes repetition is welcome. Abstraction that removes visibility is not.
- Coding agents are a primary consumer and need the same property: they navigate by reading and grepping, and cannot run the app. The whole library fitting in an agent's context alongside the actual problem is a real advantage, and every added API spends it.

**Overall**

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
- CHANGELOG.md is minimal: one line per change stating what changed, no reasoning, no history of what it did before. Group under Breaking / Added / Fixed / Changed.
- Write for a reader who knows the web platform but has never seen this library. State what something is for and when to reach for it, then show it working.
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

