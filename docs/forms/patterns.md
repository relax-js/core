# Form Patterns

Common patterns for building forms with RelaxJS utilities.

## Multi-Step Forms

```typescript
class MultiStepForm {
    private currentStep = 1;
    private validators: FormValidator[] = [];

    constructor() {
        this.setupStepValidation();
    }

    setupStepValidation() {
        document.querySelectorAll('.form-step').forEach((step, index) => {
            const validator = new FormValidator(step as HTMLFormElement, {
                useSummary: true,
                preventDefault: true,
                submitCallback: () => this.nextStep()
            });
            this.validators.push(validator);
        });
    }

    nextStep() {
        if (this.validators[this.currentStep - 1].validateForm()) {
            this.currentStep++;
            this.showStep(this.currentStep);
        }
    }

    showStep(step: number) {
        document.querySelectorAll('.form-step').forEach((el, index) => {
            (el as HTMLElement).style.display = index + 1 === step ? 'block' : 'none';
        });
    }
}
```

## Form State Management

Track changes and auto-save drafts:

```typescript
class FormStateManager {
    private formData: Record<string, unknown> = {};
    private isDirty = false;

    constructor(private form: HTMLFormElement) {
        this.captureInitialState();
        this.setupChangeTracking();
    }

    captureInitialState() {
        this.formData = readData(this.form);
    }

    setupChangeTracking() {
        this.form.addEventListener('input', () => {
            this.isDirty = true;
            this.updateSaveButton();
        });

        // Auto-save every 30 seconds if dirty
        setInterval(() => {
            if (this.isDirty) {
                this.autoSave();
            }
        }, 30000);
    }

    autoSave() {
        const currentData = readData(this.form);
        localStorage.setItem('form-draft', JSON.stringify(currentData));
        this.isDirty = false;
        this.showSaveIndicator('Auto-saved');
    }

    restoreDraft() {
        const draft = localStorage.getItem('form-draft');
        if (draft) {
            const data = JSON.parse(draft);
            setFormData(this.form, data);
        }
    }

    hasChanges(): boolean {
        const current = readData(this.form);
        return JSON.stringify(current) !== JSON.stringify(this.formData);
    }
}
```

## Web Component Integration

```typescript
class UserProfileEditor extends HTMLElement {
    private form: HTMLFormElement;
    private validator: FormValidator;
    private user: UserProfile;

    connectedCallback() {
        this.innerHTML = `
            <form>
                <input name="displayName" placeholder="Display Name" required>
                <input name="email" type="email" placeholder="Email" required>
                <input name="preferences.notifications" type="checkbox"> Notifications
                <input name="preferences.theme" type="radio" value="light"> Light
                <input name="preferences.theme" type="radio" value="dark"> Dark
            </form>
        `;

        this.form = FormValidator.FindForm(this);
        this.user = new UserProfile();

        this.validator = new FormValidator(this.form, {
            useSummary: true,
            autoValidate: true,
            submitCallback: () => this.saveProfile()
        });

        this.loadUserData();
    }

    async loadUserData() {
        const userData = await fetchUserProfile();
        setFormData(this.form, userData);
    }

    saveProfile() {
        mapFormToClass(this.form, this.user);

        if (this.user.displayName.length < 2) {
            this.validator.addErrorToSummary('Display Name', 'Must be at least 2 characters');
            return;
        }

        updateUserProfile(this.user);
    }
}

customElements.define('user-profile-editor', UserProfileEditor);
```

## Dynamic Survey Form

Handle forms with dynamic question types:

```typescript
class SurveyResponse {
    userId: number = 0;
    responses: Record<string, string | number | boolean> = {};
    completedAt: Date = new Date();
}

const surveyForm = document.querySelector('#survey-form') as HTMLFormElement;
const response = new SurveyResponse();

// Custom data extraction for complex question types
document.querySelectorAll('[data-question-type="rating"]').forEach(element => {
    (element as any).getData = function() {
        const stars = this.querySelectorAll('.star.selected');
        return stars.length;
    };
});

const validator = new FormValidator(surveyForm, {
    autoValidate: true,
    customChecks: (form) => {
        const required = form.querySelectorAll('[data-required]');
        required.forEach(field => {
            const input = field as HTMLInputElement;
            if (!input.value && input.type !== 'checkbox') {
                const questionText = field.getAttribute('data-question');
                validator.addErrorToSummary(questionText, 'This question is required');
            }
        });
    },
    submitCallback: () => {
        response.responses = readData(surveyForm);
        response.completedAt = new Date();
        submitSurvey(response);
    }
});
```

## Unsaved Changes Warning

Warn users before leaving with unsaved changes:

```typescript
class UnsavedChangesGuard {
    private initialData: string;

    constructor(private form: HTMLFormElement) {
        this.initialData = JSON.stringify(readData(form));
        this.setupWarning();
    }

    setupWarning() {
        window.addEventListener('beforeunload', (e) => {
            if (this.hasUnsavedChanges()) {
                e.preventDefault();
                e.returnValue = '';
            }
        });
    }

    hasUnsavedChanges(): boolean {
        return JSON.stringify(readData(this.form)) !== this.initialData;
    }

    markAsSaved() {
        this.initialData = JSON.stringify(readData(this.form));
    }
}
```

## Form Reset with Confirmation

```typescript
class ResettableForm {
    private initialData: Record<string, unknown>;

    constructor(private form: HTMLFormElement) {
        this.initialData = readData(form);
        this.setupResetButton();
    }

    setupResetButton() {
        const resetBtn = this.form.querySelector('[type="reset"]');
        resetBtn?.addEventListener('click', (e) => {
            e.preventDefault();
            if (confirm('Are you sure you want to reset the form?')) {
                setFormData(this.form, this.initialData);
            }
        });
    }
}
```

## Conditional Field Visibility

```typescript
class ConditionalForm {
    constructor(private form: HTMLFormElement) {
        this.setupConditionalFields();
    }

    setupConditionalFields() {
        this.form.querySelectorAll('[data-show-when]').forEach(field => {
            const condition = field.getAttribute('data-show-when');
            const [fieldName, expectedValue] = condition.split('=');

            const triggerField = this.form.querySelector(`[name="${fieldName}"]`);
            triggerField?.addEventListener('change', () => {
                const currentValue = (triggerField as HTMLInputElement).value;
                (field as HTMLElement).style.display =
                    currentValue === expectedValue ? 'block' : 'none';
            });
        });
    }
}
```

Usage:

```html
<form>
    <select name="contactMethod">
        <option value="email">Email</option>
        <option value="phone">Phone</option>
    </select>

    <input name="email" data-show-when="contactMethod=email" placeholder="Email">
    <input name="phone" data-show-when="contactMethod=phone" placeholder="Phone">
</form>
```

## Form Data Comparison

```typescript
class FormComparison {
    static getDiff(
        original: Record<string, unknown>,
        current: Record<string, unknown>
    ): Record<string, { old: unknown; new: unknown }> {
        const diff: Record<string, { old: unknown; new: unknown }> = {};

        for (const key in current) {
            if (JSON.stringify(original[key]) !== JSON.stringify(current[key])) {
                diff[key] = {
                    old: original[key],
                    new: current[key]
                };
            }
        }

        return diff;
    }
}

// Usage
const original = readData(form);
// ... user makes changes ...
const current = readData(form);
const changes = FormComparison.getDiff(original, current);
console.log('Changed fields:', changes);
```
