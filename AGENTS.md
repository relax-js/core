# AGENTS.md

## Vocabulary
- (fill in with developer -- see first conversation turn)

## Definition of done
- (fill in with developer)

## Repo orientation
- `src/`: Library source, organized by feature
- `tests/`: Test suite mirroring `src/` structure; suffix `.test.ts` or `.tests.ts`
- `dist/`: Build output -- do not edit manually
- `docs/`: Feature documentation in Markdown
- `build.js`: esbuild bundle script, runs after `tsc`
- `coverage/`: Generated coverage reports -- not committed

## Non-negotiables (libraries / patterns)
- Vanilla TypeScript only -- no frameworks, no virtual DOM
- `r-` prefix for all Web Component tag names
- Form components must use `ElementInternals` with `formAssociated = true`
- Form components must expose `name`, `value`, `disabled`, `required`, `dataType` and implement `getData()` / `setData()` for typed values
- Decorator-based DI via `reflect-metadata` -- do not introduce another DI mechanism
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
- Don't use `CustomEvent` -- create explicit event classes extending `Event`
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
- Use `async/await` with a `flush()` helper (`setTimeout(r, 0)`) for async DOM operations in tests
- Reset module-level state in `beforeEach` (e.g., `onError(null as any)`)
- See `package.json` scripts for exact commands
