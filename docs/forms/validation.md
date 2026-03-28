# Form Validation

The `FormValidator` class provides form validation with HTML5 integration, error summaries, and custom validation support.

## Basic Usage

```typescript
import { FormValidator } from 'relaxjs/forms';

const form = document.querySelector('form');
const validator = new FormValidator(form, {
    submitCallback: () => saveData()
});
```

## Configuration Options

```typescript
interface ValidatorOptions {
    autoValidate?: boolean;           // Validate on every input event
    useSummary?: boolean;             // Show errors in summary element
    customChecks?: (form: HTMLFormElement) => void;  // Custom validation
    preventDefault?: boolean;          // Always prevent form submission
    preventDefaultOnFailed?: boolean;  // Prevent submission on failure (default: true)
    submitCallback?: () => void;       // Called when form is valid
}
```

## Auto-Validation

Enable real-time validation as users type:

```typescript
const validator = new FormValidator(form, {
    autoValidate: true,
    useSummary: true
});
```

## Error Summary Display

Instead of browser tooltips, show errors in a summary element:

```typescript
const validator = new FormValidator(form, {
    useSummary: true,
    submitCallback: () => handleSubmit()
});
```

The error summary is automatically created and prepended to the form with:
- `role="alert"` for accessibility
- `aria-live="assertive"` for screen readers
- `class="error-summary"` for styling

## Custom Validation

Add business logic validation beyond HTML5 constraints:

```typescript
const validator = new FormValidator(form, {
    useSummary: true,
    customChecks: (form) => {
        const password = form.querySelector('[name="password"]') as HTMLInputElement;
        const confirm = form.querySelector('[name="confirmPassword"]') as HTMLInputElement;

        if (password.value !== confirm.value) {
            validator.addErrorToSummary('Password Confirmation', 'Passwords do not match');
        }

        const startDate = new Date(form.querySelector('[name="startDate"]').value);
        const endDate = new Date(form.querySelector('[name="endDate"]').value);

        if (endDate <= startDate) {
            validator.addErrorToSummary('End Date', 'Must be after start date');
        }
    },
    submitCallback: () => saveData()
});
```

## Manual Validation

Trigger validation programmatically:

```typescript
if (validator.validateForm()) {
    // Form is valid
    proceedToNextStep();
}
```

## Error Summary Methods

### addErrorToSummary

Add a single error to the summary:

```typescript
validator.addErrorToSummary('Email', 'This email is already registered');
```

### displayErrorSummary

Display multiple errors at once:

```typescript
validator.displayErrorSummary([
    'Name: This field is required',
    'Email: Invalid email format',
    'Age: Must be 18 or older'
]);
```

### clearErrorSummary

Remove all errors from the summary:

```typescript
validator.clearErrorSummary();
```

## Finding Forms

Use `FindForm` to locate a form relative to a custom element:

```typescript
class MyComponent extends HTMLElement {
    connectedCallback() {
        const form = FormValidator.FindForm(this);
        new FormValidator(form);
    }
}
```

`FindForm` searches:
1. Parent element (if it's a form)
2. Direct children

## Built-in Validators

Declarative validation rules applied via the `data-validate` attribute. Multiple rules are space-separated.

```html
<input name="age" type="number" data-validate="required range(0-120)" />
```

Validation messages use the i18n system. Load the `r-validation` namespace for localized messages:

```typescript
await loadNamespace('r-validation');
```

Translation keys in the `r-validation` namespace:

| Key | Message (EN) | Message (SV) |
|-----|-------------|-------------|
| `required` | `This field is required.` | `Detta fält är obligatoriskt.` |
| `range` | `Number must be between {min} and {max}, was {actual}.` | `Talet måste vara mellan {min} och {max}, var {actual}.` |
| `digits` | `Please enter only digits.` | `Ange endast siffror.` |

### required

Validates that the field has a non-empty value (whitespace-only fails).

```html
<input name="username" data-validate="required" />
```

### range(min-max)

Validates that a numeric value falls within a range (inclusive). Supports negative numbers and decimals. Empty values are skipped (use with `required` if the field must be filled).

```html
<input name="age" type="number" data-validate="range(0-120)" />
<input name="temperature" type="number" data-validate="range(-40-50)" />
<input name="ratio" type="number" data-validate="range(0.0-1.0)" />
```

### digits

Validates that the value contains only digits (0-9).

```html
<input name="zipCode" data-validate="digits" />
```

## Custom Validators

Register your own validators using the `@RegisterValidator` decorator. The class must implement a `validate(value, context)` method.

```typescript
import { RegisterValidator, ValidationContext } from 'relaxjs/forms';

@RegisterValidator('email')
class EmailValidation {
    validate(value: string, context: ValidationContext) {
        if (value && !value.includes('@')) {
            context.addError('Invalid email address');
        }
    }
}
```

Restrict a validator to specific input types with the second parameter:

```typescript
@RegisterValidator('positive', ['number'])
class PositiveValidation {
    validate(value: string, context: ValidationContext) {
        if (value && parseFloat(value) < 0) {
            context.addError('Value must be positive');
        }
    }
}
```

### ValidationContext

The context object passed to validators:

```typescript
interface ValidationContext {
    inputType: string;        // The HTML input type
    dataType?: string;        // The data-type attribute value
    addError(message: string): void;  // Report a validation error
}
```

### Validator Registry

Look up registered validators programmatically:

```typescript
import { getValidator } from 'relaxjs/forms';

const entry = getValidator('required');
// entry.validator is the class constructor
// entry.validInputTypes lists the input types this validator applies to
```

## File Upload Validation

```typescript
class FileUploadForm {
    private maxFileSize = 5 * 1024 * 1024; // 5MB
    private allowedTypes = ['image/jpeg', 'image/png', 'application/pdf'];

    constructor(form: HTMLFormElement) {
        const validator = new FormValidator(form, {
            useSummary: true,
            customChecks: (form) => this.validateFiles(form, validator),
            submitCallback: () => this.handleSubmit()
        });
    }

    validateFiles(form: HTMLFormElement, validator: FormValidator) {
        const fileInputs = form.querySelectorAll('input[type="file"]');

        fileInputs.forEach(input => {
            const files = (input as HTMLInputElement).files;
            if (!files) return;

            Array.from(files).forEach(file => {
                if (file.size > this.maxFileSize) {
                    validator.addErrorToSummary(
                        input.name,
                        `File "${file.name}" is too large (max 5MB)`
                    );
                }

                if (!this.allowedTypes.includes(file.type)) {
                    validator.addErrorToSummary(
                        input.name,
                        `File "${file.name}" has invalid type`
                    );
                }
            });
        });
    }

    handleSubmit() {
        const formData = new FormData(form);
        // Upload files...
    }
}
```

## Robust Error Handling

```typescript
class RobustFormHandler {
    private validator: FormValidator;

    constructor(private form: HTMLFormElement) {
        this.validator = new FormValidator(form, {
            useSummary: true,
            customChecks: (form) => this.comprehensiveValidation(form),
            submitCallback: () => this.handleSubmissionWithRetry()
        });
    }

    comprehensiveValidation(form: HTMLFormElement) {
        try {
            this.validateRequiredFields(form);
            this.validateDataFormats(form);
            this.validateBusinessRules(form);
        } catch (error) {
            console.error('Validation error:', error);
            this.validator.addErrorToSummary('System', 'Validation failed. Please try again.');
        }
    }

    validateDataFormats(form: HTMLFormElement) {
        const emails = form.querySelectorAll('input[type="email"]');
        emails.forEach(input => {
            if (input.value && !this.isValidEmail(input.value)) {
                this.validator.addErrorToSummary(input.name, 'Invalid email format');
            }
        });

        const phones = form.querySelectorAll('input[data-type="phone"]');
        phones.forEach(input => {
            if (input.value && !this.isValidPhone(input.value)) {
                this.validator.addErrorToSummary(input.name, 'Invalid phone number');
            }
        });
    }

    async handleSubmissionWithRetry() {
        const maxRetries = 3;
        let attempt = 0;

        while (attempt < maxRetries) {
            try {
                const data = readData(this.form);
                await this.submitToAPI(data);
                this.showSuccess();
                return;
            } catch (error) {
                attempt++;
                if (attempt >= maxRetries) {
                    this.validator.addErrorToSummary('Submission', 'Failed to submit after multiple attempts');
                } else {
                    await this.delay(1000 * attempt);
                }
            }
        }
    }
}
```
