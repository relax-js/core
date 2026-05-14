# compileTemplate

A full-featured template engine for web components. Compiles HTML templates with mustache-style expressions into reactive render functions.

## Features

- **Text Interpolation** - `{{expression}}` syntax with nested path support
- **Attribute Binding** - Dynamic attribute values
- **Pipes** - Transform values with `{{value | uppercase | shorten:20}}`
- **Function Calls** - `{{formatDate(createdAt)}}`, `{{add(5, 3)}}`
- **Array Indexing** - `{{items[0]}}`, `{{users[1].name}}`
- **Conditional Rendering** - `if` and `unless` attributes
- **Loop Rendering** - `loop="item in items"` directive
- **Event Handling** - `r-<event>="handler(args)"` wires DOM events to functions
- **Type-Safe** - Full TypeScript support
- **Performance Optimized** - Expression caching and memoized re-renders

## Basic Usage

```typescript
import { compileTemplate } from '@relax.js/core/html';

// 1. Compile the template
const { content, render } = compileTemplate(`
    <div class="user-card">
        <h2>Hello, {{user.name}}</h2>
        <p if="user.isAdmin">Admin User</p>
        <ul>
            <li loop="permission in user.permissions">{{permission}}</li>
        </ul>
    </div>
`);

// 2. Render with data
render({
    user: {
        name: 'John Smith',
        isAdmin: true,
        permissions: ['read', 'write', 'delete']
    }
});

// 3. Append to DOM
document.getElementById('app').appendChild(content);

// 4. Update with new data (DOM updates automatically)
render({
    user: {
        name: 'Jane Doe',
        isAdmin: false,
        permissions: ['read']
    }
});
```

## Template Syntax

### Text Interpolation

Embed data expressions in text nodes:

```html
<p>Hello, {{user.name}}! Your score is {{user.score}}.</p>
<p>Welcome to {{app.name}} - {{app.version}}</p>
```

### Attribute Binding

Set attribute values dynamically:

```html
<img src="/avatars/{{user.id}}.png" alt="Avatar for {{user.name}}">
<a href="/users/{{user.id}}" class="{{linkClass}}">View Profile</a>
```

### Array Indexing

Access array elements by index:

```html
<p>First item: {{items[0]}}</p>
<p>Second user: {{users[1].name}}</p>
<p>Nested: {{data.rows[0].cells[1].value}}</p>
```

### Pipes

Transform values using pipe functions:

```html
<span>{{name | uppercase}}</span>
<span>{{price | currency}}</span>
<span>{{text | trim | uppercase | shorten:20}}</span>
<span>{{createdAt | daysAgo}}</span>
```

See [Pipes](../Pipes.md) for the full list of built-in pipes.

```typescript
import { compileTemplate } from '@relax.js/core/html';
import { createPipeRegistry } from '@relax.js/core/utils';

const pipeRegistry = createPipeRegistry();
const { content, render } = compileTemplate(
    '<span>{{name | uppercase}}</span>',
    { strict: false, pipeRegistry }
);
```

### Function Calls

Call functions defined in the functions context:

```html
<span>Today: {{getDate()}}</span>
<span>Sum: {{add(5, 3)}}</span>
<span>{{greet("World")}}</span>
<span>{{formatPrice(item.price)}}</span>
<span>{{format(user.name, "bold")}}</span>
```

```typescript
const { content, render } = compileTemplate(`
    <div>
        <p>{{formatDate(createdAt)}}</p>
        <p>Total: {{calculateTotal(items)}}</p>
    </div>
`);

render(
    { createdAt: new Date(), items: [10, 20, 30] },
    {
        formatDate: (d) => d.toLocaleDateString(),
        calculateTotal: (arr) => arr.reduce((a, b) => a + b, 0)
    }
);
```

Function arguments can be:
- String literals: `"hello"` or `'hello'`
- Number literals: `42`, `3.14`
- Context paths: `user.name`, `items[0]`

### Conditional Rendering

Show or hide elements with the `if` and `unless` directive attributes.
When hidden, the element is removed from the DOM entirely and replaced by an invisible comment placeholder.
When shown again, a fresh clone is inserted and its inner bindings are re-compiled with the latest data.

#### `if`

Renders the element only when the expression resolves to a truthy value:

```html
<div if="user.isLoggedIn">
    Welcome back, {{user.name}}!
</div>

<button if="cart.items">Checkout</button>
```

#### `unless`

The inverse of `if`. Renders the element only when the expression is falsy:

```html
<div unless="user.isLoggedIn">
    Please <a href="/login">sign in</a> to continue.
</div>
```

#### Truthiness Rules

The condition expression is resolved from the context and evaluated with JavaScript truthiness:

| Value | `if` shows? | `unless` shows? |
|-------|-------------|-----------------|
| `true` | yes | no |
| `false` | no | yes |
| `"hello"` (non-empty string) | yes | no |
| `""` (empty string) | no | yes |
| `1` (positive number) | yes | no |
| `0` | no | yes |
| `undefined` / missing | no | yes |
| `null` | no | yes |
| `{ ... }` (object) | yes | no |

#### Updates Across Renders

The element toggles in and out of the DOM as the condition changes across `render()` calls.

Inner bindings (text, attributes, nested conditionals, loops) are re-evaluated on every `render()` call while the element is visible, not just when first inserted:

```typescript
const { content, render } = compileTemplate(`
    <span if="show">{{name}}</span>
`);

render({ show: true, name: 'Alice' });
// → <span>Alice</span>

render({ show: false, name: 'Alice' });
// → (element removed)

render({ show: true, name: 'Bob' });
// → <span>Bob</span>  (picks up latest data)

render({ show: true, name: 'Charlie' });
// → <span>Charlie</span>  (inner content updates while visible)
```

#### Nesting Conditionals

`if` and `unless` can be nested. Inner conditionals react independently to their own expressions:

```html
<div if="hasPermission">
    <p>You have access.</p>
    <div if="isAdmin">
        <button>Delete All</button>
    </div>
</div>
```

```typescript
render({ hasPermission: true, isAdmin: true });
// → both div and button visible

render({ hasPermission: true, isAdmin: false });
// → outer div visible, button removed

render({ hasPermission: false, isAdmin: true });
// → everything removed (outer controls inner)
```

#### Multiple Independent Conditionals

Sibling `if` elements toggle independently and preserve their position among siblings:

```html
<span>Always</span>
<span if="showA">A</span>
<span if="showB">B</span>
<span>End</span>
```

### Loop Rendering

Repeat elements for arrays with `loop`:

```html
<ul>
    <li loop="item in cart.items">
        {{item.name}} - ${{item.price}}
    </li>
</ul>
```

Combine with conditionals:

```html
<table>
    <tr loop="user in users">
        <td>{{user.name}}</td>
        <td if="user.isAdmin">Administrator</td>
        <td unless="user.isAdmin">Regular User</td>
    </tr>
</table>
```

Loop with array indexing:

```html
<li loop="item in data.lists[0]">{{item}}</li>
```

## Event Handling

Add an `r-<event>` attribute to call a function when that DOM event fires. The
part after `r-` is the event name, so `r-click`, `r-change`, `r-input`,
`r-keypress`, and `r-submit` all work. The function name is looked up in the
functions context (the second argument to `render`), and its arguments are
resolved against the current data:

```typescript
const tpl = compileTemplate(`
    <button r-click="save()">Save</button>
`);

tpl.render({}, { save: () => console.log('saved') });
document.body.appendChild(tpl.content);
```

The event name is only wired when the element actually supports it. An
unrecognised name such as `r-clik` is reported through the `onError` callback
instead of failing silently.

The listener is attached once per element. Each render only refreshes the data
the handler closes over, so handlers keep working as loops reuse, add, and
remove rows.

### Passing data to handlers

Arguments to the handler are resolved the same way as `{{expression}}` values,
so an object in the context is passed straight through as that object:

```html
<button r-click="removeRow(row)">x</button>
<button r-click="select(row.owner)">owner</button>
<input r-change="rename(row, event)">
```

Each argument can be:

- A **context path** - `row`, `row.owner`, `items[0]` - resolved against the
  current data and passed as-is (objects stay objects).
- A **string literal** - `'apple'` or `"apple"`.
- A **number literal** - `3`, `1.5`.
- The literal `event` - the native DOM event.

```typescript
const tpl = compileTemplate(`
    <button r-click="capture(event, 'save')">Save</button>
`);

tpl.render({}, {
    capture: (event, label) => console.log(label, event.target),
});
```

### Handling events inside loops

Inside a `loop`, the iteration alias is in scope, so each row's handler
receives that row's object. One handler in the functions context covers every
row, including rows added on later renders:

```typescript
let state = {
    rows: [
        { id: 1, name: 'Apple' },
        { id: 2, name: 'Banana' },
    ],
};

const tpl = compileTemplate(`
    <ul>
        <li loop="row in rows">
            {{row.name}}
            <button r-click="removeRow(row)">x</button>
        </li>
    </ul>
`);

const fns = {
    removeRow: (row) => {
        // row is the object for the clicked line
        state = { rows: state.rows.filter((r) => r !== row) };
        tpl.render(state, fns);
    },
};

tpl.render(state, fns);
document.body.appendChild(tpl.content);
```

### Always render with a fresh context object

`render()` only updates the DOM when the context object is a different object
than the previous render. Changing an array in place and calling `render()`
with the same object does nothing:

```typescript
// does NOT update the DOM
state.rows.push(newRow);
tpl.render(state);

// updates the DOM
tpl.render({ rows: [...state.rows, newRow] });
```

This matters most after a handler changes the data: build a new context object
so the next `render()` takes effect.

## Configuration

```typescript
import { compileTemplate, EngineConfig } from '@relax.js/core/html';
import { createPipeRegistry } from '@relax.js/core/utils';

const config: EngineConfig = {
    strict: true,
    onError: (msg) => console.error(msg),
    pipeRegistry: createPipeRegistry()
};

const { content, render } = compileTemplate(template, config);
```

| Option | Type | Default | Description |
|--------|------|---------|-------------|
| `strict` | boolean | `false` | Throw errors for missing paths/functions |
| `onError` | function | `undefined` | Callback for error messages |
| `pipeRegistry` | PipeRegistry | `defaultPipes` | Custom pipe registry |

## API Reference

### compileTemplate(templateStr, config?)

Compiles an HTML template string into a render function.

```typescript
function compileTemplate(
    templateStr: string,
    config?: EngineConfig
): CompiledTemplate;

interface CompiledTemplate {
    content: DocumentFragment | HTMLElement;
    render: (ctx: Context, fns?: FunctionsContext) => void;
}
```

### Context

Data object passed to `render()`:

```typescript
interface Context {
    [key: string]: ContextValue;
}

// Example
render({
    user: { name: 'John', age: 30 },
    items: ['a', 'b', 'c'],
    isActive: true
});
```

### FunctionsContext

Functions object passed as second argument to `render()`:

```typescript
interface FunctionsContext {
    [key: string]: (...args: any[]) => any;
}

// Example
render(data, {
    formatDate: (d) => d.toLocaleDateString(),
    add: (a, b) => a + b,
    greet: (name) => `Hello, ${name}!`
});
```

## Web Component Integration

```typescript
class UserCard extends HTMLElement {
    private template: CompiledTemplate;
    private _user: any = null;

    constructor() {
        super();
        this.attachShadow({ mode: 'open' });

        this.template = compileTemplate(`
            <div class="card">
                <h3>{{user.name}}</h3>
                <p>{{user.email}}</p>
                <p if="user.isAdmin">Administrator</p>
            </div>
        `);

        this.shadowRoot!.appendChild(this.template.content);
    }

    set user(value) {
        this._user = value;
        this.template.render({ user: this._user });
    }
}

customElements.define('user-card', UserCard);
```

## Complete Example

```typescript
import { compileTemplate } from '@relax.js/core/html';
import { createPipeRegistry } from '@relax.js/core/utils';

const pipeRegistry = createPipeRegistry();

const { content, render } = compileTemplate(`
    <div class="product-list">
        <h1>{{title | uppercase}}</h1>
        <p if="showIntro">{{getIntro()}}</p>

        <ul>
            <li loop="product in products" if="product.inStock">
                <span>{{product.name | capitalize}}</span>
                <span>{{formatPrice(product.price)}}</span>
                <span>{{product.stock}} in stock</span>
            </li>
        </ul>

        <p unless="products">No products available</p>
    </div>
`, { strict: false, pipeRegistry });

render(
    {
        title: 'our products',
        showIntro: true,
        products: [
            { name: 'apple', price: 1.50, stock: 10, inStock: true },
            { name: 'banana', price: 0.75, stock: 0, inStock: false },
            { name: 'orange', price: 2.00, stock: 5, inStock: true }
        ]
    },
    {
        getIntro: () => 'Welcome to our store!',
        formatPrice: (p) => `$${p.toFixed(2)}`
    }
);

document.body.appendChild(content);
```
