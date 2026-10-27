---
name: relaxjs-templates
description: Rendering HTML with @relax.js/core - compileTemplate, TSX, the html tagged literal, loops, if/unless, pipes and r-<event> handlers. Use when building or fixing the markup a Relaxjs component renders, when a value renders empty or stale, when render() appears to do nothing, when a second html`` instance never appears, or when a click handler in a template never fires.
---

# Relaxjs templates

Pick by where the markup lives:

- **Text** (an HTML file, a `<template>` element, a server response): `compileTemplate`. It
  handles structure: nested paths, `loop`, `if`/`unless`, pipes and `r-<event>` handlers.
- **Written in TypeScript** next to the code using it: TSX, when the project has the JSX
  settings below. Loops and conditions are plain TypeScript and every tag is type-checked.
- `html` is a tagged literal for one block of flat values, for projects without JSX settings.

Do not carry syntax across from one to the other. `compileTemplate` and `html` update in place and
fail quietly. TSX builds once and is checked by `tsc`.

## TSX

```json
"jsx": "react",
"jsxFactory": "h"
```

`"react"` is only TypeScript's name for the mode; React is not involved. Every `.tsx` file
imports `import { h } from '@relax.js/core/jsx'`.

- A tag is the real element. Keep it in a variable and assign to it to update; there is no
  re-render, no state and no diffing. A list is updated with `replaceChildren(...)`.
- Props use the DOM property names: `className`, `htmlFor`, `onclick`, `value`. React spellings
  (`class`, `for`, `onClick`) are type errors. A name with a dash (`data-id`, `aria-label`) is
  set as an attribute.
- Custom events go in `on={{ 'issue-selected': (e) => ... }}`, which accepts events registered in
  `GlobalEventHandlersEventMap`.
- Every tag is typed `HTMLElement`. Cast for element-specific members:
  `<input /> as HTMLInputElement`.
- Use the component class as the tag (`<UserCard user={u} />`), not its tag name. Props are
  assigned before it connects.
- No fragments. Return one element, or an array where a child is expected.
- Text children are text nodes, never HTML.

## Check before you run

Type the call, `compileTemplate<ViewModel, Handlers>(\`...\`)`, with the view model `render()`
takes and the object holding the handlers. Then run

```
npx @relax.js/core check
```

after editing a template. It resolves every `{{path}}`, `if`/`unless`, `loop` alias,
`fn(args)` call, `r-<event>` name and pipe against those types, and every `{{name}}` in an
`html\`...\`` literal against the object it is bound with, and prints
`file:line:col - error: ...` lines like `tsc`, exit code 1 on findings. The summary counts the
templates it could not check: no type argument, a `compileTemplate` string that is not a literal,
or an `html` bind function never called in its file. Read it; silence with skipped templates is
not green.

If the project has no such test yet, add one so `npm test` runs the check too:

```typescript
import { checkProject, formatDiagnostic } from '@relax.js/core/check';

it('every_template_resolves_against_its_view_model', () => {
    expect(checkProject('tsconfig.json').diagnostics.map(formatDiagnostic)).toEqual([]);
});
```

## Nothing throws, so read the errors

A mistyped path, a function that was never passed, an unknown event name, a render that changed
nothing: each renders empty or does nothing, and reports. In a test `captureRelaxErrors()` turns
that into an assertion, `failOnRelaxErrors()` in the setup file makes an unread one fail the test,
and every message says what to do instead. A blank element is almost always
a spelling mistake, not a data problem.

`render()` compares the context by identity, so pass a new object when data changes
(`render({ ...state })`) rather than mutating the one you passed last time.

## Rendering once is not inert

Handlers wired by the first `render()` stay live for the life of the element, through loops that
add and remove rows. A template rendered exactly once is fully interactive.

Later renders may omit the functions context: `render(newData)` keeps the previous one, and
`render(newData, null)` drops it deliberately.

## r-<event> handlers

The value must be a call expression: `r-click="save()"` binds, `r-click="save"` does not. The
function is looked up in the functions context, the second argument to `render()`, so a misspelled
function name only surfaces when the event fires.

Return `false` from the handler to `preventDefault()`. An `async` handler returns a promise and
can never do that, so take the event and cancel it before the first `await`:

```html
<form r-submit="save(event)">
```

Only real DOM events work. The name is checked against `on<event>`, so a component's own
`PageSelectedEvent` has no `onpageselected` and `r-pageselected` is rejected. Use
`addEventListener` for custom events. Binding to an element that never fires the event
(`r-submit` on a `<div>`) binds and stays silent.

Every attribute starting with `r-` is treated as an event binding and stripped from the output,
valid or not.

For a real form prefer `FormValidator` over `r-submit`. See the **relaxjs-forms** skill.

## html gives one instance per tagged literal

`html\`...\`` returns a bind function. Calling it produces the instance; calling `update()` on that
instance changes its values. Binding twice re-drives the first instance instead of adding a second,
so evaluate the tagged literal again per instance, or use `compileTemplate` with `loop`.

## Detail

- `@relax.js/core/docs/html/jsx.md` for TSX setup, props, children and components
- `@relax.js/core/docs/html/template.md` for `compileTemplate`, loops, conditionals, attribute
  and boolean binding, and the full event syntax
- `@relax.js/core/docs/html/checking.md` for what `check` verifies and what it skips
- `@relax.js/core/docs/html/html.md` for the tagged literal
- `@relax.js/core/docs/Pipes.md` for the built-in pipes and custom registries
- `@relax.js/core/docs/html/TableRenderer.md` for data tables
