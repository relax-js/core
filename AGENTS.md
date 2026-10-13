# AGENTS.md

Rules for working **on** this library. For working **with** it in a consuming project, see `docs/AGENTS.md`.

## Definition of done
- The behaviour is covered by a test that fails without the change
- `npx vitest run` and `npx tsc --noEmit` both pass
- Public API changes were agreed with the developer first
- Documentation in `docs/` matches what the code now does

## Repo orientation
- `src/`: Library source, organized by feature
- `tests/`: Test suite mirroring `src/` structure; suffix `.test.ts` or `.tests.ts`
- `dist/`: Build output -- do not edit manually
- `docs/`: Feature documentation in Markdown, shipped in the npm package
- `src/testing/`: Test helpers published as `@relax.js/core/testing`; use them in tests here too
- `build.js`: esbuild bundle script, runs after `tsc`
- `coverage/`: Generated coverage reports -- not committed

## Non-negotiables (libraries / patterns)
- Vanilla TypeScript only -- no frameworks, no virtual DOM
- `r-` prefix for all Web Component tag names
- Form components must use `ElementInternals` with `formAssociated = true`
- Form components must expose `name`, `value`, `disabled`, `required`, `dataType` and implement `getData()` / `setData()` for typed values
- DI declares dependencies explicitly (`@ContainerService({ inject: [...] })`), no metadata reflection -- do not introduce another DI mechanism
- Explicit event classes extending `Event` (not `CustomEvent`); data as class properties; registered in `HTMLElementEventMap`
- `declare type` for string enums -- never `enum`
- Always ask before changing public APIs

## House rules
- API surface and identifiers expressed from the point of view of beginner developers
- Prefer the simplest, most minimal approach; do not over-design or add unnecessary abstractions
- State mutations go through methods; task-based APIs (DTOs excluded)
- UI components own their own logic and state; parents pass data in, not behavior
- Favor composition over large classes
- Always reproduce bugs via a failing test before fixing (when testable); add logs if root cause is unclear
- JSDoc for purpose, context, and usage examples -- do not repeat what the code says; no inline code comments
- Never use em-dashes in prose; rephrase the sentence instead
- 4-space indentation, single quotes, trailing commas (ES5), 100-char line width
- CSS: semantic variable names (`--surface-bg`, `--input-bg`, `--accent-primary`); Grid/Flexbox for layout; CSS-only components where JS is not needed; no reset styles

## Anti-patterns here
- Don't silently consume errors -- no empty `.catch()`, no catch-and-ignore
- Don't use `CustomEvent` -- create explicit event classes extending `Event`. `SortChangeEvent` in `src/html/TableRenderer.ts` predates this rule and still extends `CustomEvent`; changing it would break consumers reading `event.detail`, so leave it and do not copy it
- Don't use `enum` -- use `declare type` for string enums
- Don't duplicate native HTML functionality; use native HTML when possible
- Don't add reset styles
- Don't import from the package name in tests -- import from `src/`

## Naming
- Web Component tags: `r-` prefix (e.g., `r-route-target`, `r-tabs`)
- Test files: mirror the `src/` path (e.g., `src/forms/validator.ts` -> `tests/forms/validator.test.ts`)
- Test names: describe the business rule proven or the edge case prevented, with underscores (e.g., `validates_required_field_when_empty`)
- Test-only custom elements: `test-` prefix to avoid registration collisions
- CSS variables: semantic names, not structural ones

## Build / test
- TypeScript strict mode must pass before merging (see `package.json` scripts)
- All tests must pass before merging
- Use `flush()` and `mount()` from `src/testing` for async DOM operations in tests; do not hand-roll timers
- Assert on reported failures with `captureRelaxErrors()` rather than letting them go unnoticed
- Reset module-level state in `beforeEach` (e.g., `onError(null as any)`)
- See `package.json` scripts for exact commands

## Moved from CLAUDE.md

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
