# html Template Engine

A lightweight HTML template engine with update capabilities. Creates templates that can be re-rendered with new data without recreating DOM nodes.

## Usage

```typescript
import { html } from '@relax.js/core/html';

// Create a template
const userCard = html`
    <div class="user-card">
        <h2>{{name}}</h2>
        <p>{{email}}</p>
    </div>
`;

// Render with data
const result = userCard({ name: 'John', email: 'john@example.com' });
container.appendChild(result.fragment);

// Update with new data (no DOM recreation)
result.update({ name: 'Jane', email: 'jane@example.com' });
```

## Features

### Mustache Bindings

Use `{{property}}` syntax to bind context properties to text content or attributes:

```typescript
const template = html`
    <a href="{{url}}" class="{{linkClass}}">{{linkText}}</a>
`;
```

### Template Literal Substitutions

Use `${}` for static values or functions:

```typescript
const staticClass = 'container';
const template = html`<div class="${staticClass}">{{content}}</div>`;
```

### Event Handlers

Bind event handlers with context:

```typescript
const row = html`
    <tr>
        <td>{{name}}</td>
        <td>
            <button onclick=${function() { this.onEdit(this.id); }}>Edit</button>
        </td>
    </tr>
`;

const result = row({
    id: 42,
    name: 'Item',
    onEdit(id) { console.log('Edit:', id); }
});
```

### Context Functions

Call methods from the context object:

```typescript
const template = html`<div>{{formatPrice}}</div>`;

const result = template({
    price: 99.99,
    formatPrice() {
        return `$${this.price.toFixed(2)}`;
    }
});
```

### Function Arguments

Pass arguments to context functions using the pipe syntax:

```typescript
const template = html`<div>{{greet|name}}</div>`;

const result = template({
    name: 'John',
    greet(name) { return `Hello, ${name}!`; }
});
// Result: <div>Hello, John!</div>
```

The value after `|` is resolved from the context and passed to the function. Multiple arguments use comma separation:

```typescript
const template = html`<div>{{format|name,title}}</div>`;

const result = template({
    name: 'John',
    title: 'Developer',
    format(name, title) { return `${name} - ${title}`; }
});
```

For value transformations using pipes (like `uppercase`, `currency`), use [compileTemplate](template.md) instead.

## API

### `html` (tagged template literal)

```typescript
function html(
    templateStrings: TemplateStringsArray,
    ...substitutions: any[]
): (context: any) => RenderTemplate
```

Creates a template function that accepts a context object and returns a `RenderTemplate`.

### `RenderTemplate`

```typescript
interface RenderTemplate {
    fragment: DocumentFragment;
    update(context: any): void;
}
```

- `fragment`: The rendered DOM fragment. Add to the DOM once.
- `update(context)`: Re-renders with new data without recreating DOM nodes.

## Design

This template engine is designed for **single-use updateable templates**:

1. Create the template once
2. Render and add `fragment` to the DOM
3. Call `update()` to push changes to the existing nodes

For reusable templates that create multiple independent instances, use `compileTemplate` from [template](template.md).

## Property vs Attribute Binding

The engine automatically detects when to set element properties vs attributes:

```typescript
// Sets input.value property (not attribute)
const input = html`<input value="{{val}}">`;

// Sets data-id attribute
const div = html`<div data-id="{{id}}"></div>`;
```

## Custom Elements

Custom elements are automatically upgraded when encountered in templates.

## Limitations

The `html` template is optimized for simple, updateable templates. For advanced features, use [compileTemplate](template.md):

| Feature | `html` | `compileTemplate` |
|---------|--------|-------------------|
| Mustache bindings | Yes | Yes |
| Event handlers | Yes | No |
| In-place updates | Yes | Yes |
| Nested paths (`user.name`) | No | Yes |
| Loops (`loop="item in items"`) | No | Yes |
| Conditionals (`if`, `unless`) | No | Yes |
| Pipe transformations | No | Yes |
| Function calls with args | Yes (via `\|`) | Yes |
