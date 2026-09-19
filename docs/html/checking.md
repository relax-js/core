# Checking templates before they run

A template expression is a string, so `tsc` cannot see that `{{user.naem}}` names a property that
does not exist. The runtime reports it when the template renders. `check` reports it before:

```
npx @relax.js/core check
```

It reads the project's `tsconfig.json`, finds every `compileTemplate` call whose template is a
literal and every `html\`…\`` literal, and verifies each expression against the types with the
TypeScript compiler. Findings come out in the same line format as `tsc`, one per expression, and the exit code
is 1 when there are any:

```
src/UserCard.ts:14:23 - error: Cannot resolve "user.naem": Profile has no property "naem"
src/UserCard.ts:19:31 - error: "r-clik" is not a known event for <button>
src/UserList.ts:22:18 - error: "save(row, event)" does not match (row: Row) => void

12 templates checked, 2 skipped (1 no type argument, 1 not a literal)
```

Run it next to `tsc --noEmit` in CI, and after editing a template.

## Give the call its types

The checker only knows what the type arguments tell it:

```typescript
interface ViewModel {
    user: Profile;
    rows: Row[];
    busy: boolean;
}

interface Handlers {
    save: (row: Row, event: Event) => void;
    label: (count: number) => string;
}

const tpl = compileTemplate<ViewModel, Handlers>(`
    <h1>{{user.name}}</h1>
    <p>{{label(rows.length)}}</p>
    <ul>
        <li loop="row in rows" unless="busy">
            {{row.name}}
            <button r-click="save(row, event)">Save</button>
        </li>
    </ul>
`);

tpl.render(model, handlers);
```

`T` is the view model `render()` takes. `F` is the functions context, the second argument to
`render()`. Both are plain object types; an `interface` works.

## What is checked

| Expression | Rule |
|---|---|
| `{{user.name}}`, `if="…"`, `unless="…"`, handler arguments | every segment is a property of the type before it. `null` and `undefined` are looked through, because the runtime renders them as empty. `[0]` on an array gives the element type. A string index signature accepts any key. `any` ends the check for that path |
| `loop="row in rows"` | `rows` is an array; `row` has its element type inside the element |
| `{{fn(a, 'x', 1)}}`, `r-click="fn(row, event)"` | `fn` is a property of `F` with a call signature that accepts the argument count and types. `event` is the DOM `Event`, in handlers only |
| `r-<event>` | `on<event>` exists on the element's DOM type (`HTMLElementTagNameMap[tag]`, else `HTMLElement`), the same test the runtime makes. The value must be a call |
| `{{value \| pipe}}` | the pipe is one of the built-ins, unless the call passes a `pipeRegistry` |
| `{{` | is closed on the same line. The runtime leaves an unclosed one as literal text without a report |

## The `html` tag

`html` has no type parameter. The context type is taken from the bind call instead: the argument
of an immediate `html\`…\`(model)`, or the first call in the same file of the variable or class
field the bind function was stored in. Nothing to annotate:

```typescript
const card = html`<h2>{{name}}</h2><p>{{greet|name}}</p>`;
card({ name: 'John', greet(n: string) { return `Hi ${n}`; } });
```

| Expression | Rule |
|---|---|
| `{{name}}` | a property of the bound object. Names are flat; `{{user.name}}` is reported because the runtime looks up the whole string as one key |
| `{{fn\|a, b.c, 'x', 1}}` | `fn` is a function property whose signature accepts the arguments; arguments may be dotted paths |
| `${expr}` | left alone; `tsc` types it already |
| `{{` | is closed |

## What is skipped

Each skipped template is counted in the summary with its reason.

- **No type argument.** `compileTemplate(\`…\`)` without `<T>` still gets the syntax, pipe and
  event checks. Paths are not verified. Without `<T, F>`, function names and signatures are not
  verified either.
- **Not a literal.** A `compileTemplate` template held in a variable, built with `${}`
  substitutions, or imported from a file has no text at the call site.
- **No bind call.** An `html` bind function that is returned, passed on, or called in another
  file gives the checker no context type.
- **A custom pipe registry** is a runtime value, so pipe names are not checked for that call.

Structure is read by a small scanner, not a browser. It does not apply the browser's content-model
rules (a `<p>` closed early by a block element, a `<tr>` outside a `<table>`, raw text inside
`<textarea>` or `<script>`), so a `loop` alias may be scoped differently from how it renders in
such markup. Keep templates well-formed and the two agree.

Column numbers count the characters as written in the source, so an escape sequence such as `\"`
or `\n` inside a template shifts what follows it by one.

## Make the test suite run it

A command only helps when it is run. One test turns every finding into a failing test, which is
what an agent verifying its own change through `npm test` sees:

```typescript
import { checkProject, formatDiagnostic } from '@relax.js/core/check';

it('every_template_resolves_against_its_view_model', () => {
    const result = checkProject('tsconfig.json');
    expect(result.diagnostics.map(formatDiagnostic)).toEqual([]);
});
```

`checkProgram(program)` takes a `ts.Program` you already have. Both need the `typescript` package,
which is an optional peer dependency: nothing else in the library loads it.
