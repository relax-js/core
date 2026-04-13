import { reportError } from '../errors';

/**
 * @module FormValidator
 * Form validation with support for native HTML5 validation and error summaries.
 * Provides automatic validation on submit with customizable behavior.
 *
 * @example
 * // Basic usage with submit callback
 * const form = document.querySelector('form');
 * const validator = new FormValidator(form, {
 *     submitCallback: () => saveData()
 * });
 *
 * @example
 * // With auto-validation on input
 * const validator = new FormValidator(form, {
 *     autoValidate: true,
 *     useSummary: true
 * });
 */

/**
 * Gets the human-readable field name from its associated label.
 */
function getFieldName(element: HTMLElement): string | null {
    const id = element.getAttribute('id');
    if (id) {
        const form = element.closest('form');
        if (form) {
            const label = form.querySelector(`label[for="${id}"]`) as HTMLLabelElement | null;
            if (label) {
                return label.textContent?.trim() || null;
            }
        }
    }

    return null;
}

/**
 * Configuration options for FormValidator.
 */
export interface ValidatorOptions {
    /** Validate on every input event, not just submit */
    autoValidate?: boolean;
    /** Show errors in a summary element instead of browser tooltips */
    useSummary?: boolean;
    /** Custom validation function called before native validation */
    customChecks?: (form: HTMLFormElement) => void;
    /** Always prevent default form submission */
    preventDefault?: boolean;
    /** Prevent default on validation failure (default: true) */
    preventDefaultOnFailed?: boolean;
    /** Callback invoked when form passes validation */
    submitCallback?: () => void | Promise<void>;
}

/**
 * Form validation helper that integrates with HTML5 validation.
 * Supports error summaries, auto-validation, and custom submit handling.
 *
 * @example
 * // Prevent submission and handle manually
 * class MyComponent extends HTMLElement {
 *     private validator: FormValidator;
 *
 *     connectedCallback() {
 *         const form = this.querySelector('form');
 *         this.validator = new FormValidator(form, {
 *             submitCallback: () => this.handleSubmit()
 *         });
 *     }
 *
 *     private async handleSubmit() {
 *         const data = readData(this.form);
 *         await fetch('/api/save', { method: 'POST', body: JSON.stringify(data) });
 *     }
 * }
 *
 * @example
 * // With error summary display
 * const validator = new FormValidator(form, {
 *     useSummary: true,
 *     autoValidate: true
 * });
 */
export class FormValidator {
    private errorSummary?: HTMLDivElement;

    constructor(
        private form: HTMLFormElement,
        private options?: ValidatorOptions
    ) {
        if (!this.form) {
            throw new Error('Form must be specified.');
        }

        this.form.addEventListener('submit', (event) => {
            if (
                options?.preventDefault ||
                this.options?.submitCallback != null
            ) {
                event.preventDefault();
            }
            if (this.options?.customChecks) {
                this.options.customChecks(form);
            }

            if (this.validateForm()) {
                try {
                    const result = this.options?.submitCallback?.call(this);
                    if (result instanceof Promise) {
                        result.catch((cause) => {
                            const error = reportError('submitCallback failed', { cause });
                            if (error) throw error;
                        });
                    }
                } catch (cause) {
                    const error = reportError('submitCallback failed', { cause });
                    if (error) throw error;
                }
            } else {
                if (options?.preventDefaultOnFailed !== false) {
                    event.preventDefault();
                }
            }
        });

        if (options?.autoValidate) {
            form.addEventListener('input', (/*e: InputEvent*/) => {
                this.validateForm();
            });
        }
    }

    /**
     * Validates all form fields.
     * Uses native HTML5 validation and optionally displays an error summary.
     *
     * @returns true if form is valid, false otherwise
     */
    public validateForm(): boolean {
        const formElements = Array.from(
            this.form.querySelectorAll('input,textarea,select')
        ) as (HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement)[];
        let isFormValid = true;

        if (this.options?.useSummary !== true) {
            if (this.form.checkValidity()) {
                return true;
            }

            this.form.reportValidity();
            this.focusFirstErrorElement();
            return false;
        }

        const errorMessages: string[] = [];

        formElements.forEach((element) => {
            if (!element.checkValidity()) {
                isFormValid = false;
                const fieldName =
                    getFieldName.call(this, element) ||
                    element.name ||
                    'Unnamed Field';
                errorMessages.push(
                    `${fieldName}: ${element.validationMessage}`
                );
            }
        });

        if (!isFormValid) {
            this.displayErrorSummary(errorMessages);
            this.focusFirstErrorElement();
        } else {
            this.clearErrorSummary();
        }

        return isFormValid;
    }

    /**
     * Displays a list of error messages in the summary element.
     *
     * @param messages - Array of error messages to display
     */
    public displayErrorSummary(messages: string[]) {
        this.clearErrorSummary();
        if (!this.errorSummary){
            this.createErrorSummary();
        }

        const errorList = this.errorSummary!.querySelector('ul')!;
        messages.forEach((message) => {
            const listItem = document.createElement('li');
            listItem.textContent = message;
            errorList.appendChild(listItem);
        });
    }

    private createErrorSummary() {
        const errorSummary = document.createElement('div');
        errorSummary.className = 'error-summary';
        errorSummary.style.color = 'red';
        errorSummary.setAttribute('role', 'alert');
        errorSummary.setAttribute('aria-live', 'assertive');
        errorSummary.setAttribute('aria-atomic', 'true');
        this.errorSummary = errorSummary;

        const errorList = document.createElement('ul');
        this.errorSummary.appendChild(errorList);

        this.form.prepend(errorSummary);
    }
    /**
     * Adds a single error to the summary display.
     *
     * @param fieldName - The name of the field with the error
     * @param message - The error message
     */
    public addErrorToSummary(fieldName: string, message: string) {
        if (!this.errorSummary){
            this.createErrorSummary();
        }
        const errorList = this.errorSummary!.querySelector('ul')!;
        const listItem = document.createElement('li');
        listItem.textContent = `${fieldName}: ${message}`;
        errorList.appendChild(listItem);
    }

    /**
     * Clears all errors from the summary display.
     */
    public clearErrorSummary() {
        if (this.errorSummary){
            const ul = this.errorSummary.querySelector('ul');
            if (ul) ul.innerHTML = '';
        }
    }

    private focusFirstErrorElement() {
        const firstInvalidElement = this.form.querySelector(':invalid');
        if (
            firstInvalidElement instanceof HTMLElement &&
            document.activeElement !== firstInvalidElement
        ) {
            firstInvalidElement.focus();
        }
    }

    /**
     * Finds a form element relative to the given element.
     * Searches parent first, then direct children.
     *
     * @param element - The element to search from
     * @returns The found form element
     * @throws Error if no form is found
     *
     * @example
     * class MyComponent extends HTMLElement {
     *     connectedCallback() {
     *         const form = FormValidator.FindForm(this);
     *         new FormValidator(form);
     *     }
     * }
     */
    public static FindForm(element: HTMLElement): HTMLFormElement {
        if (element.parentElement?.tagName == 'FORM') {
            return <HTMLFormElement>element.parentElement;
        } else {
            for (let i = 0; i < element.children.length; i++) {
                const child = element.children[i];
                if (child.tagName == 'FORM') {
                    return <HTMLFormElement>child;
                }
            }
        }

        throw new Error(
            'Parent or a direct child must be a FORM for class ' +
                element.constructor.name
        );
    }
}
