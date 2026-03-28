# Form-Associated Custom Elements API

The [Form-Associated Custom Elements](https://html.spec.whatwg.org/multipage/custom-elements.html#form-associated-custom-elements) standard lets web components participate in HTML forms just like native `<input>`, `<select>`, and `<textarea>` elements. RelaxJS form utilities fully support this API. Custom elements work transparently with `readData()`, `setFormData()`, `mapFormToClass()`, and `FormValidator`.

## How the Standard Works

A custom element becomes form-associated by declaring `static formAssociated = true` and using `ElementInternals`:

```typescript
class MyInput extends HTMLElement {
    static formAssociated = true;
    private internals: ElementInternals;

    constructor() {
        super();
        this.internals = this.attachInternals();
    }
}
```

This gives the element:

- Inclusion in `form.elements`: the browser tracks it like a native input
- Participation in `FormData`: submitted values via `internals.setFormValue()`
- Native validation: constraint checking via `internals.setValidity()`
- Form lifecycle callbacks: `formResetCallback()`, `formDisabledCallback()`, etc.

## How RelaxJS Supports It

All form utilities use duck-typing rather than `instanceof` checks. This means they work with any element that exposes the right properties, whether it's a native `<input>` or a custom `<r-input>`.

### Property Detection

RelaxJS reads element properties via attribute and property checks:

| Property | How it's detected |
|----------|-------------------|
| `type` | Property or `getAttribute('type')` |
| `value` | `'value' in element` |
| `checked` | Property (boolean) or attribute (`""`, `"true"`, `"checked"`) |
| `disabled` | Property (boolean) or attribute (`""`, `"true"`, `"disabled"`) |
| `multiple` | Property (boolean) or attribute (`""`, `"true"`, `"multiple"`) |
| `selectedOptions` | `'selectedOptions' in element` |

### readData()

Uses `FormData` to read values, which automatically includes form-associated custom elements. Unchecked checkboxes (including custom ones with `type="checkbox"` and a `checked` property) are included as `false`.

```typescript
const data = readData(form);
// Custom elements with name/value are included just like native inputs
```

### setFormData()

Sets values by querying `[name]` attributes and using duck-typed property access:

```typescript
setFormData(form, { email: 'user@example.com', terms: true });
// Works on both <input name="email"> and <r-input name="email">
```

For custom checkbox-like elements, `setFormData` checks `type === 'checkbox'` and sets the `checked` property. For custom select-like elements, it checks for `selectedOptions` and `multiple`.

### mapFormToClass()

Queries `input, select, textarea` and uses duck-typed value reading. Disabled elements (detected via attribute, not `instanceof`) are skipped, matching `FormData` behavior.

### FormValidator

Validates any element returned by `form.querySelectorAll('input,textarea,select')` that implements `checkValidity()`. Custom elements using `ElementInternals.setValidity()` integrate automatically.

## Required Properties for Custom Elements

For full compatibility with RelaxJS form utilities, custom elements should expose:

| Property | Purpose |
|----------|---------|
| `name` | Field name for data mapping |
| `value` | Current value (string) |
| `disabled` | Whether the field is excluded from form data |
| `type` | Element type (e.g., `'checkbox'`, `'text'`) for converter selection |
| `checked` | Boolean state for checkbox/radio-like elements |

See [Creating Form Components](creating-form-components.md) for complete implementation examples.

## Browser Support

Form-associated custom elements are supported in all modern browsers:

- Chrome 77+
- Edge 79+
- Firefox 93+
- Safari 16.4+
