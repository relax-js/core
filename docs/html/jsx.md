# TSX

Write markup in `.tsx` files and get real DOM elements back. `<li>` is an `HTMLLIElement` the
moment the expression runs. There is no virtual DOM, no re-render and no reconciliation: to change
the element later, keep it in a variable and assign to it, the same as any element from
`document.createElement`.

Reach for TSX when the markup is written in TypeScript next to the code that uses it. Markup
that arrives as text (an HTML file, a `<template>` element, a server response) is for
[compileTemplate](template.md).

## Setup

`tsconfig.json`:

```json
{
    "compilerOptions": {
        "jsx": "react",
        "jsxFactory": "h"
    }
}
```

`"react"` is TypeScript's name for the mode that turns every tag into a call to the factory you
name. Nothing from React is involved. Vite, esbuild and Vitest read the same two settings.

Each `.tsx` file imports the factory, so the file says where its tags are turned into elements:

```tsx
import { h } from '@relax.js/core/jsx';
```

Leaving the import out is a compile error: `Cannot find name 'h'`.

## A component

```tsx
import { h } from '@relax.js/core/jsx';
import { IssueSelectedEvent } from './events';

interface Issue {
    id: string;
    title: string;
    severity: 'low' | 'high';
}

export class IssueList extends HTMLElement {
    private count = <span />;
    private list = <ul className="issues" />;

    connectedCallback() {
        this.replaceChildren(
            <header>
                <h2>Issues</h2>
                {this.count}
            </header>,
            this.list
        );
    }

    show(issues: Issue[]) {
        this.count.textContent = String(issues.length);
        this.list.replaceChildren(
            ...issues.map((issue) => (
                <li className={`issue ${issue.severity}`} data-id={issue.id}>
                    <button onclick={() => this.dispatchEvent(new IssueSelectedEvent(issue.id))}>
                        {issue.title}
                    </button>
                </li>
            ))
        );
    }
}

customElements.define('issue-list', IssueList);
```

TypeScript compiles each tag to one call on the same line:

```js
h('li', { className: `issue ${issue.severity}`, 'data-id': issue.id },
    h('button', { onclick: () => ... }, issue.title))
```

## Props

One rule decides what a prop does:

| Prop name | What happens | Example |
|---|---|---|
| Contains a dash | `setAttribute(name, value)` | `data-id`, `aria-label` |
| `on` | `addEventListener` for each entry | `on={{ 'issue-selected': (e) => ... }}` |
| Anything else | Assigned to the DOM property of that name | `className`, `htmlFor`, `value`, `onclick` |

Names are never translated, so write them as the DOM spells them: `className`, not `class`;
`htmlFor`, not `for`; `onclick`, not `onClick`. Every property is typed from lib.dom, so a wrong
name is a type error. A name that reaches the runtime anyway is reported through
[`onError`](../Errors.md) with the tag and the name, instead of being set as an unused expando.

An attribute set to `true` is present and empty, and one set to `false`, `null` or `undefined` is
left out. `style` takes a CSS string.

`on` accepts events registered in `GlobalEventHandlersEventMap`, typed with their event class.
That is where Relaxjs [event classes](../WhyRelaxjs.md) are registered.

## Children

Text, numbers, elements and arrays of them are appended in order. `null`, `undefined`, `true`
and `false` render nothing, so a condition can be written inline:

```tsx
<div>
    {busy && <span>Loading</span>}
    {users.map((user) => <li>{user.name}</li>)}
</div>
```

Text becomes a text node and is never parsed as HTML. Anything else, such as a plain object, is
reported.

## Components

A function used as a tag runs once with its props, children included, and returns the element
it built:

```tsx
import { h, type Child } from '@relax.js/core/jsx';

const Panel = (props: { title: string; children?: Child }) => (
    <section>
        <h2>{props.title}</h2>
        {props.children}
    </section>
);

const panel = <Panel title="Issues"><p>None yet</p></Panel>;
```

A custom element class used as a tag is constructed, its props are assigned to its fields, and
its children are appended. The props are set before the element is connected, so
`connectedCallback` sees them. Using the class instead of the tag name means the import cannot be
dropped by the bundler and a renamed field is a type error:

```tsx
const card = <UserCard user={user} />;
```

A class that is not registered with `customElements.define()` is reported with its name.

A custom element written by tag name, such as `<user-card />`, type-checks only when its tag is
declared in `HTMLElementTagNameMap`. Writing the class is the simpler route.

## Types

TypeScript gives every tag expression the same type, `HTMLElement`; it cannot infer
`HTMLUListElement` from `<ul />`. Cast where a member specific to one element is needed:

```tsx
const email = <input type="email" required /> as HTMLInputElement;
email.value = user.email;
```

The types live on `h` (`h.JSX`), so they do not clash with React types in the same project.

## Updating what you built

An expression builds elements once. Nothing watches your data, so a change is made in the method
where the data changed, with the DOM API you already know.

### Change a value

Keep the elements that change in fields, and assign to them:

```tsx
export class CartSummary extends HTMLElement {
    private total = <strong />;
    private spinner = <span>Saving</span>;
    private checkout = <button onclick={() => this.submit()}>Check out</button> as HTMLButtonElement;

    connectedCallback() {
        this.replaceChildren(<p>Total: {this.total}</p>, this.spinner, this.checkout);
        this.spinner.hidden = true;
    }

    update(cart: Cart) {
        this.total.textContent = formatPrice(cart.total);
        this.checkout.disabled = cart.items.length === 0;
    }

    private async submit() {
        this.spinner.hidden = false;
        await saveOrder();
        this.spinner.hidden = true;
    }
}
```

Showing and hiding is the native `hidden` property, not a conditional render.

### Replace a list

Build the rows again and swap them in:

```tsx
show(issues: Issue[]) {
    this.list.replaceChildren(...issues.map((issue) => <li>{issue.title}</li>));
}
```

There are no keys and no diffing; this is a full rebuild of the list, which is fast for the
lists most screens show.

### Update one row

When a rebuild would lose something (focus in an input inside a row, a scroll position, an open
`<details>`), keep the rows by id and replace only the one that changed:

```tsx
private rows = new Map<string, HTMLElement>();

show(issues: Issue[]) {
    this.rows.clear();
    this.list.replaceChildren(...issues.map((issue) => this.addRow(issue)));
}

updateIssue(issue: Issue) {
    this.rows.get(issue.id)?.replaceWith(this.addRow(issue));
}

private addRow(issue: Issue) {
    const row = <li>{issue.title}</li>;
    this.rows.set(issue.id, row);
    return row;
}
```

The map is the key, written where it is needed. For data tables,
[TableRenderer](TableRenderer.md) does this for you.

### Several elements without a wrapper

There is no `<>...</>`. A plain function that returns an array does the same job, because an
array is a valid child and `append` and `replaceChildren` take several nodes:

```tsx
const nameFields = (user: User) => [
    <label htmlFor="name">Name</label>,
    <input id="name" value={user.name} />,
];

form.append(...nameFields(user));
const section = <fieldset>{nameFields(user)}</fieldset>;
```
