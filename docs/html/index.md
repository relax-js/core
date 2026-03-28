# HTML & Templating

This module provides templating utilities for rendering dynamic HTML content.

## Available Features

| Feature | Description | Use Case |
|---------|-------------|----------|
| [html](html.md) | Tagged template literal with update support | Single-use templates with in-place updates |
| [compileTemplate](template.md) | Full-featured template compiler | Reusable templates with loops, conditionals, pipes |
| [Pipes](../Pipes.md) | Value transformation functions | Format dates, currencies, text in templates |
| [TableRenderer](TableRenderer.md) | Table row renderer for Web Components | Data tables with row updates and button handlers |

## Quick Comparison

### html

Best for: Single templates that need efficient updates

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

- **Need in-place updates?** → Use `html`
- **Need loops/conditionals?** → Use `compileTemplate`
- **Building a data table?** → Use `TableRenderer`
