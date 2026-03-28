# DOM Helpers

Utility functions for finding elements and setting form validation errors.

## `selectOne`

Finds exactly one element matching a selector. Throws if no match is found.

When the selector starts with `#`, it tries matching by `id` first, then falls back to the `name` attribute. This makes it convenient for form fields where `name` is more common than `id`.

```typescript
import { selectOne } from '@relax.js/core/elements';

// Standard CSS selector
const container = selectOne('.main-content');

// # looks up id, then name
const email = selectOne<HTMLInputElement>('#email');

// Scope to a parent element
const field = selectOne<HTMLInputElement>('#username', form);
```

The default return type is `HTMLElement`. Pass a type parameter for more specific types:

```typescript
const input = selectOne<HTMLInputElement>('#age');
input.valueAsNumber; // OK, typed as HTMLInputElement
```

## `formError`

Sets a validation error message on a form field. Supports both native form elements (`<input>`, `<select>`, `<textarea>`, `<button>`) and form-associated custom elements that use `ElementInternals`. Throws if the element is not a form field.

```typescript
import { formError } from '@relax.js/core/elements';

// Set an error
formError('#email', 'Please enter a valid email');

// Clear an error
formError('#email', '');

// Scope to a specific form
formError('#quantity', 'Must be positive', orderForm);
```

### Native form fields

Calls `setCustomValidity(message)` and `reportValidity()` directly on the element.

### Form-associated custom elements

Detects elements whose constructor has `static formAssociated = true` and exposes `setCustomValidity`. This covers custom elements built with the `ElementInternals` API that proxy validation methods.

### Non-form elements

Throws an error if the matched element is neither a native form field nor a form-associated custom element.

## `getParentComponent`

Finds the closest parent element of a specific Web Component type. Traverses up the DOM tree looking for an ancestor matching the given constructor.

```typescript
import { getParentComponent } from '@relax.js/core/elements';
```

### Finding a Parent Container

```typescript
class ListItem extends HTMLElement {
    connectedCallback() {
        const list = getParentComponent(this, ListContainer);
        if (list) {
            list.registerItem(this);
        }
    }
}
```

### Accessing Parent Methods

```typescript
class TabPanel extends HTMLElement {
    activate() {
        const tabs = getParentComponent(this, TabContainer);
        tabs?.selectPanel(this);
    }
}
```

### Handling Missing Parent

Returns `null` if no matching parent is found:

```typescript
const form = getParentComponent(input, FormContainer);
if (!form) {
    console.warn('Input must be inside a FormContainer');
    return;
}
```
