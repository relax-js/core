# RouteLink

A clickable element that triggers client-side navigation to a named route.

## Usage

### Basic Navigation

```html
<r-link name="home">Home</r-link>
<r-link name="about">About Us</r-link>
```

### With Route Parameters

```html
<r-link name="user" param-id="123">View User</r-link>
<r-link name="product" param-id="456" param-tab="details">Product Details</r-link>
```

### Multi-word Parameter Names

HTML lowercases attribute names, so `param-programId` reaches the DOM as `param-programid`. Two ways to target a route parameter declared as `:programId`:

```html
<r-link name="program" param-program-id="42">Open</r-link>
<r-link name="program" param-programId="42">Also works</r-link>
```

The kebab-case form (`param-program-id`) is converted to camelCase (`programId`) before navigation. The camelCase form is recovered through case-insensitive lookup against the route definition. Either way, the component receives the parameter under the route-defined name (`programId`).

For complex values, prefer the `params` JSON attribute below — JSON keys preserve their casing exactly.

### With Target

```html
<r-link name="settings" target="sidebar">Settings</r-link>
<r-link name="preview" target="modal">Preview</r-link>
```

### Back / Forward Links

Use `direction="back"` or `direction="forward"` to step through a target's navigation history. Combine with `target` to control a specific named target; omit `target` to control the default one.

```html
<r-link direction="back">Back</r-link>
<r-link direction="forward">Forward</r-link>
<r-link direction="back" target="modal">Close step</r-link>
```

When there is no history to walk, the element sets `aria-disabled="true"` so CSS can style it:

```css
r-link[aria-disabled="true"] {
    opacity: 0.4;
    pointer-events: none;
}
```

`name`, `param-*`, and `params` are ignored when `direction` is set.

### Complex Parameters via JSON

```html
<r-link name="search" params='{"query":"typescript","page":1}'>
    Search Results
</r-link>
```

## Attributes

| Attribute | Type | Description |
|-----------|------|-------------|
| `name` | `string` | Route name to navigate to (required, unless `direction` is set) |
| `target` | `string` | Target `r-route-target` name |
| `params` | `string` | JSON object with additional route data |
| `param-*` | `string` | Individual route parameters (e.g., `param-id="123"`). Kebab-case is converted to camelCase (`param-program-id` → `programId`). |
| `direction` | `'back' \| 'forward'` | Walks the target's history instead of navigating to a route. Sets `aria-disabled="true"` when no history is available. |

## Behavior

1. Renders as an inline element with `cursor: pointer`
2. Sets `role="link"` and `tabindex="0"` for accessibility
3. On click, calls `navigate()` with the route name and collected parameters
4. Prevents default click behavior

## Combining Parameters

Both `param-*` attributes and `params` JSON can be used together:

```html
<r-link name="product"
     param-id="789"
     params='{"source":"email","campaign":"summer"}'>
    View Product
</r-link>
```

All parameters are merged into a single flat object:
```typescript
{ id: '789', source: 'email', campaign: 'summer' }
```

## Styling

Style as any inline element:

```css
r-link {
    color: var(--accent-primary);
    text-decoration: underline;
}

r-link:hover {
    color: var(--accent-hover);
}

r-link:focus {
    outline: 2px solid var(--accent-primary);
    outline-offset: 2px;
}
```

## Comparison with Native Links

| Feature | `<a href>` | `<r-link>` |
|---------|------------|---------|
| Navigation | Full page reload | Client-side routing |
| Parameters | Query string | Route params + data |
| Target | Window/frame | Route target |
| SEO | Crawlable | Requires SSR |

Use `<r-link>` for SPA navigation within the app. Use native `<a>` for external links or when SEO is critical.
