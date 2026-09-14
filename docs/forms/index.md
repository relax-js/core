# Forms

Forms are native HTML forms. The library adds validation that owns the submit, typed reading and
writing of form data, and the pieces needed to make a custom element behave like a real form
control.

## Available Features

| Feature | Description | Use Case |
|---------|-------------|----------|
| [Form utilities](forms.md) | Overview of the form API and what it supports | Getting oriented before picking a piece |
| [FormValidator](validation.md) | Validation that owns the submit event | Any form that posts data |
| [Reading & writing](reading-writing.md) | `readData`, `setFormData`, `mapFormToClass` | Moving values between a form and a typed object |
| [Form-associated API](form-api.md) | How the browser standard works and how the library uses it | Understanding what makes a custom control participate |
| [Custom form components](creating-form-components.md) | Building an element with `ElementInternals` | A control the browser treats as its own |
| [A complete form page](form-page.md) | One page end to end, with the rules it encodes | Copying a working shape |
| [Patterns](patterns.md) | Multi-step, conditional fields, unsaved changes | A form that is more than a list of inputs |

## Quick Start

```typescript
import { FormValidator, readData } from '@relax.js/core/forms';

const form = document.querySelector('form')!;

new FormValidator(form, {
    submitCallback: async () => {
        const data = readData<UserForm>(form);
        await api.save(data);
    },
});
```

`FormValidator` takes over the submit event, so the page does not navigate and the callback runs
only once the browser's own validation passes.

```typescript
const user = mapFormToClass(form, new User());
setFormData(form, { name: 'Alice', newsletter: true });
```

Validation itself is the platform's: `required`, `type="email"`, `min`, `pattern` and friends on
the input, not a schema in JavaScript.

## Choosing the Right Tool

- **A form that submits?** → [FormValidator](validation.md)
- **Need the values as a typed object?** → [readData / mapFormToClass](reading-writing.md)
- **Populating a form for editing?** → `setFormData` in [Reading & writing](reading-writing.md)
- **Writing a control the browser should treat as a form field?** →
  [Creating form components](creating-form-components.md)
- **Want to see the whole thing working first?** → [A complete form page](form-page.md)
