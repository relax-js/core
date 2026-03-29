# Creating Custom Form Components

This guide explains how to create custom web components that integrate with the RelaxJS form system using the HTML Form API (form-associated custom elements).

## Overview

Form-associated custom elements allow your web components to:

- Participate in form submission via `FormData`
- Work with `readData()`, `setFormData()`, and `mapFormToClass()`
- Support native form validation with `FormValidator`
- Be accessed via `form.elements`
- Reset with the form

## Basic Structure

```typescript
class RInput extends HTMLElement {
    static formAssociated = true;

    private internals: ElementInternals;
    private input: HTMLInputElement;

    constructor() {
        super();
        this.internals = this.attachInternals();
    }

    connectedCallback() {
        this.render();
        this.setupEventListeners();
    }

    private render() {
        this.innerHTML = `<input type="text">`;
        this.input = this.querySelector('input');
    }

    private setupEventListeners() {
        this.input.addEventListener('input', () => {
            this.internals.setFormValue(this.input.value);
        });
    }

    get value(): string {
        return this.input?.value ?? '';
    }

    set value(val: string) {
        if (this.input) {
            this.input.value = val;
            this.internals.setFormValue(val);
        }
    }

    get name(): string {
        return this.getAttribute('name') ?? '';
    }

    set name(val: string) {
        this.setAttribute('name', val);
    }
}

customElements.define('r-input', RInput);
```

## Required Properties

### formAssociated

Static property that enables form association:

```typescript
class MyComponent extends HTMLElement {
    static formAssociated = true;
    // ...
}
```

### ElementInternals

Provides the bridge to the form:

```typescript
private internals: ElementInternals;

constructor() {
    super();
    this.internals = this.attachInternals();
}
```

## Core Form Properties

Implement these properties for full form integration:

### name

The field name used in form data:

```typescript
get name(): string {
    return this.getAttribute('name') ?? '';
}

set name(val: string) {
    this.setAttribute('name', val);
}
```

### value

The current value:

```typescript
get value(): string {
    return this._value;
}

set value(val: string) {
    this._value = val;
    this.internals.setFormValue(val);
    this.updateDisplay();
}
```

### disabled

Prevents interaction and excludes from form data:

```typescript
get disabled(): boolean {
    return this.hasAttribute('disabled');
}

set disabled(val: boolean) {
    if (val) {
        this.setAttribute('disabled', '');
    } else {
        this.removeAttribute('disabled');
    }
}
```

### required

Marks field as required for validation:

```typescript
get required(): boolean {
    return this.hasAttribute('required');
}

set required(val: boolean) {
    if (val) {
        this.setAttribute('required', '');
    } else {
        this.removeAttribute('required');
    }
}
```

## Type Conversion with dataType

The `dataType` property allows custom type conversion when using `readData()`:

```typescript
get dataType(): string | ((value: string) => unknown) {
    return this.getAttribute('data-type') ?? 'string';
}

set dataType(val: string | ((value: string) => unknown)) {
    if (typeof val === 'function') {
        (this as any)._dataTypeConverter = val;
    } else {
        this.setAttribute('data-type', val);
    }
}
```

Built-in data types: `'string'`, `'number'`, `'boolean'`, `'Date'`

## Validation

### Native Validation

Use `setValidity()` for HTML5 validation integration:

```typescript
private validate(): void {
    if (this.required && !this.value) {
        this.internals.setValidity(
            { valueMissing: true },
            'This field is required',
            this.input
        );
    } else if (this.pattern && !new RegExp(this.pattern).test(this.value)) {
        this.internals.setValidity(
            { patternMismatch: true },
            'Please match the requested format',
            this.input
        );
    } else {
        this.internals.setValidity({});
    }
}
```

### Validation Flags

Available `ValidityStateFlags`:

| Flag | Description |
|------|-------------|
| `valueMissing` | Required field is empty |
| `typeMismatch` | Value doesn't match input type |
| `patternMismatch` | Value doesn't match pattern |
| `tooLong` | Value exceeds maxlength |
| `tooShort` | Value is shorter than minlength |
| `rangeUnderflow` | Value is below min |
| `rangeOverflow` | Value exceeds max |
| `stepMismatch` | Value doesn't match step |
| `badInput` | Browser can't convert input |
| `customError` | Custom validation failed |

### Custom Validation Messages

```typescript
private validate(): void {
    const value = this.value;

    if (this.required && !value) {
        this.internals.setValidity(
            { valueMissing: true },
            'Please fill out this field',
            this.input
        );
        return;
    }

    if (this.minLength && value.length < this.minLength) {
        this.internals.setValidity(
            { tooShort: true },
            `Please enter at least ${this.minLength} characters`,
            this.input
        );
        return;
    }

    // Custom business logic
    if (this.getAttribute('data-type') === 'email' && !this.isValidEmail(value)) {
        this.internals.setValidity(
            { typeMismatch: true },
            'Please enter a valid email address',
            this.input
        );
        return;
    }

    this.internals.setValidity({});
}
```

## Form Callbacks

### formAssociatedCallback

Called when the element is associated with a form:

```typescript
formAssociatedCallback(form: HTMLFormElement | null): void {
    if (form) {
        console.log('Associated with form:', form.id);
    } else {
        console.log('Disassociated from form');
    }
}
```

### formResetCallback

Called when the form is reset:

```typescript
formResetCallback(): void {
    this.value = this.getAttribute('value') ?? '';
}
```

### formDisabledCallback

Called when the element's disabled state changes due to the form:

```typescript
formDisabledCallback(disabled: boolean): void {
    this.input.disabled = disabled;
}
```

### formStateRestoreCallback

Called during form restoration (browser back/forward):

```typescript
formStateRestoreCallback(state: string, mode: 'restore' | 'autocomplete'): void {
    this.value = state;
}
```

## Complete Example: Text Input

```typescript
class RInput extends HTMLElement {
    static formAssociated = true;
    static observedAttributes = ['value', 'disabled', 'required', 'placeholder', 'type'];

    private internals: ElementInternals;
    private input: HTMLInputElement;

    constructor() {
        super();
        this.internals = this.attachInternals();
    }

    connectedCallback(): void {
        this.render();
        this.setupEventListeners();
        this.validate();
    }

    private render(): void {
        const type = this.getAttribute('type') ?? 'text';
        const placeholder = this.getAttribute('placeholder') ?? '';
        const value = this.getAttribute('value') ?? '';

        this.innerHTML = `
            <input
                type="${type}"
                placeholder="${placeholder}"
                value="${value}"
                ${this.disabled ? 'disabled' : ''}
            >
        `;
        this.input = this.querySelector('input');
        this.internals.setFormValue(value);
    }

    private setupEventListeners(): void {
        this.input.addEventListener('input', () => {
            this.internals.setFormValue(this.input.value);
            this.validate();
            this.dispatchEvent(new Event('input', { bubbles: true }));
        });

        this.input.addEventListener('change', () => {
            this.dispatchEvent(new Event('change', { bubbles: true }));
        });
    }

    private validate(): void {
        if (this.required && !this.value) {
            this.internals.setValidity(
                { valueMissing: true },
                'This field is required',
                this.input
            );
        } else {
            this.internals.setValidity({});
        }
    }

    attributeChangedCallback(name: string, oldValue: string, newValue: string): void {
        if (!this.input) return;

        switch (name) {
            case 'value':
                this.input.value = newValue ?? '';
                this.internals.setFormValue(newValue ?? '');
                break;
            case 'disabled':
                this.input.disabled = newValue !== null;
                break;
            case 'required':
                this.input.required = newValue !== null;
                this.validate();
                break;
            case 'placeholder':
                this.input.placeholder = newValue ?? '';
                break;
            case 'type':
                this.input.type = newValue ?? 'text';
                break;
        }
    }

    // Form callbacks
    formResetCallback(): void {
        this.value = this.getAttribute('value') ?? '';
    }

    formDisabledCallback(disabled: boolean): void {
        this.input.disabled = disabled;
    }

    formStateRestoreCallback(state: string): void {
        this.value = state;
    }

    // Properties
    get value(): string {
        return this.input?.value ?? '';
    }

    set value(val: string) {
        if (this.input) {
            this.input.value = val;
            this.internals.setFormValue(val);
            this.validate();
        }
    }

    get name(): string {
        return this.getAttribute('name') ?? '';
    }

    set name(val: string) {
        this.setAttribute('name', val);
    }

    get disabled(): boolean {
        return this.hasAttribute('disabled');
    }

    set disabled(val: boolean) {
        if (val) {
            this.setAttribute('disabled', '');
        } else {
            this.removeAttribute('disabled');
        }
    }

    get required(): boolean {
        return this.hasAttribute('required');
    }

    set required(val: boolean) {
        if (val) {
            this.setAttribute('required', '');
        } else {
            this.removeAttribute('required');
        }
    }

    get form(): HTMLFormElement | null {
        return this.internals.form;
    }

    get validity(): ValidityState {
        return this.internals.validity;
    }

    get validationMessage(): string {
        return this.internals.validationMessage;
    }

    get willValidate(): boolean {
        return this.internals.willValidate;
    }

    checkValidity(): boolean {
        return this.internals.checkValidity();
    }

    reportValidity(): boolean {
        return this.internals.reportValidity();
    }
}

customElements.define('r-input', RInput);
```

## Complete Example: Checkbox

```typescript
class RCheckbox extends HTMLElement {
    static formAssociated = true;
    static observedAttributes = ['checked', 'disabled', 'required', 'value'];

    private internals: ElementInternals;
    private checkbox: HTMLInputElement;

    constructor() {
        super();
        this.internals = this.attachInternals();
    }

    connectedCallback(): void {
        this.render();
        this.setupEventListeners();
        this.updateFormValue();
    }

    private render(): void {
        const label = this.textContent;
        this.innerHTML = `
            <label>
                <input type="checkbox" ${this.checked ? 'checked' : ''}>
                <span>${label}</span>
            </label>
        `;
        this.checkbox = this.querySelector('input');
    }

    private setupEventListeners(): void {
        this.checkbox.addEventListener('change', () => {
            this.updateFormValue();
            this.dispatchEvent(new Event('change', { bubbles: true }));
        });
    }

    private updateFormValue(): void {
        if (this.checked) {
            this.internals.setFormValue(this.value);
        } else {
            this.internals.setFormValue(null);
        }
        this.validate();
    }

    private validate(): void {
        if (this.required && !this.checked) {
            this.internals.setValidity(
                { valueMissing: true },
                'Please check this box',
                this.checkbox
            );
        } else {
            this.internals.setValidity({});
        }
    }

    formResetCallback(): void {
        this.checked = this.hasAttribute('checked');
    }

    get checked(): boolean {
        return this.checkbox?.checked ?? this.hasAttribute('checked');
    }

    set checked(val: boolean) {
        if (this.checkbox) {
            this.checkbox.checked = val;
            this.updateFormValue();
        }
        if (val) {
            this.setAttribute('checked', '');
        } else {
            this.removeAttribute('checked');
        }
    }

    get value(): string {
        return this.getAttribute('value') ?? 'on';
    }

    set value(val: string) {
        this.setAttribute('value', val);
        this.updateFormValue();
    }

    get name(): string {
        return this.getAttribute('name') ?? '';
    }

    set name(val: string) {
        this.setAttribute('name', val);
    }

    get disabled(): boolean {
        return this.hasAttribute('disabled');
    }

    set disabled(val: boolean) {
        if (val) {
            this.setAttribute('disabled', '');
        } else {
            this.removeAttribute('disabled');
        }
    }

    get required(): boolean {
        return this.hasAttribute('required');
    }

    set required(val: boolean) {
        if (val) {
            this.setAttribute('required', '');
        } else {
            this.removeAttribute('required');
        }
    }

    checkValidity(): boolean {
        return this.internals.checkValidity();
    }

    reportValidity(): boolean {
        return this.internals.reportValidity();
    }
}

customElements.define('r-checkbox', RCheckbox);
```

## Complete Example: Select

```typescript
class RSelect extends HTMLElement {
    static formAssociated = true;
    static observedAttributes = ['value', 'disabled', 'required'];

    private internals: ElementInternals;
    private select: HTMLSelectElement;

    constructor() {
        super();
        this.internals = this.attachInternals();
    }

    connectedCallback(): void {
        this.render();
        this.setupEventListeners();
        this.validate();
    }

    private render(): void {
        const options = Array.from(this.querySelectorAll('option'))
            .map(opt => opt.outerHTML)
            .join('');

        this.innerHTML = `
            <select ${this.disabled ? 'disabled' : ''}>
                ${options}
            </select>
        `;
        this.select = this.querySelector('select');

        if (this.hasAttribute('value')) {
            this.select.value = this.getAttribute('value');
        }
        this.internals.setFormValue(this.select.value);
    }

    private setupEventListeners(): void {
        this.select.addEventListener('change', () => {
            this.internals.setFormValue(this.select.value);
            this.validate();
            this.dispatchEvent(new Event('change', { bubbles: true }));
        });
    }

    private validate(): void {
        if (this.required && !this.value) {
            this.internals.setValidity(
                { valueMissing: true },
                'Please select an option',
                this.select
            );
        } else {
            this.internals.setValidity({});
        }
    }

    formResetCallback(): void {
        this.select.selectedIndex = 0;
        this.internals.setFormValue(this.select.value);
    }

    get value(): string {
        return this.select?.value ?? '';
    }

    set value(val: string) {
        if (this.select) {
            this.select.value = val;
            this.internals.setFormValue(val);
            this.validate();
        }
    }

    get name(): string {
        return this.getAttribute('name') ?? '';
    }

    set name(val: string) {
        this.setAttribute('name', val);
    }

    get disabled(): boolean {
        return this.hasAttribute('disabled');
    }

    set disabled(val: boolean) {
        if (val) {
            this.setAttribute('disabled', '');
        } else {
            this.removeAttribute('disabled');
        }
    }

    get required(): boolean {
        return this.hasAttribute('required');
    }

    set required(val: boolean) {
        if (val) {
            this.setAttribute('required', '');
        } else {
            this.removeAttribute('required');
        }
    }

    checkValidity(): boolean {
        return this.internals.checkValidity();
    }

    reportValidity(): boolean {
        return this.internals.reportValidity();
    }
}

customElements.define('r-select', RSelect);
```

## getData and setData Methods

For complex components, implement `getData()` and `setData()` methods:

```typescript
class RRating extends HTMLElement {
    static formAssociated = true;

    private internals: ElementInternals;
    private _value: number = 0;

    constructor() {
        super();
        this.internals = this.attachInternals();
    }

    connectedCallback(): void {
        this.render();
    }

    private render(): void {
        this.innerHTML = `
            <div class="stars">
                ${[1, 2, 3, 4, 5].map(i => `
                    <span class="star" data-value="${i}">★</span>
                `).join('')}
            </div>
        `;

        this.querySelectorAll('.star').forEach(star => {
            star.addEventListener('click', () => {
                this.setData(Number(star.getAttribute('data-value')));
            });
        });
    }

    getData(): number {
        return this._value;
    }

    setData(value: number): void {
        this._value = Math.max(0, Math.min(5, value));
        this.internals.setFormValue(String(this._value));
        this.updateDisplay();
        this.dispatchEvent(new Event('change', { bubbles: true }));
    }

    private updateDisplay(): void {
        this.querySelectorAll('.star').forEach((star, index) => {
            star.classList.toggle('selected', index < this._value);
        });
    }

    get value(): string {
        return String(this._value);
    }

    set value(val: string) {
        this.setData(Number(val));
    }

    get name(): string {
        return this.getAttribute('name') ?? '';
    }

    set name(val: string) {
        this.setAttribute('name', val);
    }

    formResetCallback(): void {
        this.setData(0);
    }
}

customElements.define('r-rating', RRating);
```

## Usage with RelaxJS Forms

```html
<form id="profile-form">
    <r-input name="username" required placeholder="Username"></r-input>
    <r-input name="email" type="email" required placeholder="Email"></r-input>
    <r-checkbox name="newsletter">Subscribe to newsletter</r-checkbox>
    <r-select name="country" required>
        <option value="">Select country</option>
        <option value="us">United States</option>
        <option value="uk">United Kingdom</option>
    </r-select>
    <r-rating name="satisfaction"></r-rating>
    <button type="submit">Submit</button>
</form>
```

```typescript
const form = document.querySelector('#profile-form') as HTMLFormElement;

const validator = new FormValidator(form, {
    useSummary: true,
    autoValidate: true,
    submitCallback: () => {
        const data = readData(form);
        console.log('Form data:', data);
        // { username: 'john', email: 'john@example.com', newsletter: true, country: 'us', satisfaction: '4' }
    }
});

// Pre-fill form
setFormData(form, {
    username: 'john',
    email: 'john@example.com',
    newsletter: true,
    country: 'us',
    satisfaction: '4'
});
```

## Custom States with CustomStateSet

Use `ElementInternals.states` to expose component states as CSS pseudo-classes. This replaces data attributes or class toggling for states like invalid, loading, or disabled.

```typescript
class RInput extends HTMLElement {
    static formAssociated = true;
    private internals: ElementInternals;

    constructor() {
        super();
        this.internals = this.attachInternals();
    }

    private validate(): void {
        if (this.required && !this.value) {
            this.internals.states.add('invalid');
            this.internals.setValidity(
                { valueMissing: true },
                'This field is required',
                this.input
            );
        } else {
            this.internals.states.delete('invalid');
            this.internals.setValidity({});
        }
    }

    set loading(v: boolean) {
        if (v) {
            this.internals.states.add('loading');
        } else {
            this.internals.states.delete('loading');
        }
    }
}
```

Consumers style these states with the `:state()` pseudo-class:

```css
r-input:state(invalid) {
    border-color: var(--error-color, red);
}

r-input:state(loading) {
    opacity: 0.6;
    pointer-events: none;
}
```

This is preferred over data attributes because:

- States are encapsulated and can't be set externally via `setAttribute()`
- They work with CSS pseudo-class syntax, consistent with `:disabled`, `:invalid`
- No DOM attribute pollution

## Checklist

When creating a form component, ensure you have:

- [ ] `static formAssociated = true`
- [ ] `ElementInternals` via `attachInternals()`
- [ ] `name` property (get/set)
- [ ] `value` property (get/set)
- [ ] `disabled` property (get/set)
- [ ] `required` property (get/set)
- [ ] Call `setFormValue()` when value changes
- [ ] Call `setValidity()` for validation
- [ ] Implement `formResetCallback()`
- [ ] Implement `checkValidity()` and `reportValidity()`
- [ ] Dispatch `input` and/or `change` events
