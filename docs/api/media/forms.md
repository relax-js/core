# Form Utilities

A TypeScript library for form validation, data mapping, and form manipulation with strong typing support.

## Overview

The form utilities provide:

- **[Validation](validation.md)** - Form validation with HTML5 integration, error summaries, and custom validators
- **[Reading & Writing](reading-writing.md)** - Read and write form data with automatic type conversion
- **[Form API](form-api.md)** - How RelaxJS supports the Form-Associated Custom Elements standard
- **[Patterns](patterns.md)** - Common patterns for multi-step forms, file uploads, and state management
- **[Creating Form Components](creating-form-components.md)** - Guide for building custom form-associated components

## Form Components Support

All form utilities fully support **form-associated custom elements** (the HTML Form API). Custom web components created with `ElementInternals` and `formAssociated = true` integrate seamlessly with:

- `setFormData()` - Populates custom form components like standard HTML inputs
- `readData()` - Extracts values from custom form components
- `mapFormToClass()` - Maps custom form component values to class properties
- `FormValidator` - Validates custom form components with native and custom validation

## Quick Start

### Basic Form Validation

```typescript
const form = document.querySelector('form');
const validator = new FormValidator(form, {
    useSummary: true,
    autoValidate: true
});
```

### Reading Form Data

```typescript
const form = document.querySelector('form');
const data = readData(form);
// Returns typed object with automatic conversion
```

### Writing Form Data

```typescript
const form = document.querySelector('form');
const userData = {
    name: 'John',
    email: 'john@example.com',
    preferences: {
        notifications: true
    }
};
setFormData(form, userData);
```

### Mapping to Class Instance

```typescript
class UserDTO {
    name: string = '';
    email: string = '';
    age: number = 0;
}

const form = document.querySelector('form');
const user = mapFormToClass(form, new UserDTO());
```

## Complete Example

```typescript
class UserRegistration {
    name: string = '';
    email: string = '';
    age: number = 0;
    isSubscribed: boolean = false;
}

const form = document.querySelector('#registration-form');
const user = new UserRegistration();

const validator = new FormValidator(form, {
    useSummary: true,
    customChecks: (form) => {
        const password = form.querySelector('[name="password"]') as HTMLInputElement;
        const confirm = form.querySelector('[name="confirmPassword"]') as HTMLInputElement;

        if (password.value !== confirm.value) {
            validator.addErrorToSummary('Password Confirmation', 'Passwords do not match');
        }
    },
    submitCallback: () => {
        mapFormToClass(form, user);
        console.log('User data:', user);
    }
});
```
