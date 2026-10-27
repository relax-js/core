# HTML & Templating

This module provides templating utilities for rendering dynamic HTML content.

## Available Features

| Feature | Description | Use Case |
|---------|-------------|----------|
| [TSX](jsx.md) | Tags in `.tsx` files that are real DOM elements | Markup written in TypeScript, built once and updated by assignment |
| [html](html.md) | Tagged template literal with update support | Single-use templates with in-place updates |
| [compileTemplate](template.md) | Full-featured template compiler | Reusable templates with loops, conditionals, pipes, event handling |
| [Pipes](../Pipes.md) | Value transformation functions | Format dates, currencies, text in templates |
| [check](checking.md) | Static check of `compileTemplate` expressions against `<T, F>` | Catch a misspelled path or handler in CI instead of in the browser |
| [TableRenderer](TableRenderer.md) | Table row renderer for Web Components | Data tables with row updates and button handlers |

## Quick Comparison

### html

Best for: One template with values spliced in from JavaScript

```typescript
const card = html`<div>{{name}}</div>`;
const result = card({ name: 'John' });
container.appendChild(result.fragment);
result.update({ name: 'Jane' }); // Updates in place
```

### compileTemplate

Best for: Complex templates with loops and conditionals

```typescript
const { content, render } = compileTemplate(`
    <ul>
        <li loop="item in items" if="item.visible">{{item.name}}</li>
    </ul>
`);
render({ items: [...] });
```

### TableRenderer

Best for: Data tables in Web Components

```typescript
const renderer = new TableRenderer(table, template, 'id', this);
renderer.render(data);
renderer.updateRow(id, newData);
```

## Choosing the Right Tool

Start with where the markup lives.

- **Markup arrives as text** (an HTML file, a `<template>` element, a server response, a CMS)?
  Use `compileTemplate`. Text cannot be TSX, and `compileTemplate` gives text loops,
  conditionals, pipes and events.
- **Markup is written in TypeScript next to the code that uses it?** Use [TSX](jsx.md). Loops and
  conditions are plain TypeScript, every tag and prop is type-checked, and the result is the
  element itself.
- **No JSX settings in the build, or values re-bound in place many times?** `html` needs no
  compiler settings and updates its `{{}}` slots in place.

Both `html` and `compileTemplate` update in place, and each call site owns one DOM tree. TSX
builds once; you update the elements you kept.

- **Plain values, no loops or conditionals?** → Use `html`
- **Need loops/conditionals?** → Use `compileTemplate`
- **Need loops together with event handlers?** → Use `compileTemplate` with `r-<event>` attributes
- **Building a data table?** → Use `TableRenderer`
- **Want template mistakes caught before the app runs?** → Use `compileTemplate<T, F>` and [`npx @relax.js/core check`](checking.md)
