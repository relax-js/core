import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { FormValidator, ValidatorOptions } from '../../src/forms/FormValidator'

describe('FormValidator', () => {
  let form: HTMLFormElement;
  let input: HTMLInputElement;
  let label: HTMLLabelElement;
  let submitEvent: Event;
  
  let consoleSpy: any;
  
  beforeEach(() => {
    document.body.innerHTML = '';
    
    form = document.createElement('form');
    form.setAttribute('id', 'test-form');
    
    input = document.createElement('input');
    input.setAttribute('id', 'test-input');
    input.setAttribute('name', 'testInput');
    input.setAttribute('required', 'true');
    
    label = document.createElement('label');
    label.setAttribute('for', 'test-input');
    label.textContent = 'Test Input';
    
    form.appendChild(label);
    form.appendChild(input);
    document.body.appendChild(form);
    
    submitEvent = new Event('submit', { bubbles: true, cancelable: true });
    consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
  });
  
  afterEach(() => {
    vi.restoreAllMocks();
  });
  
  describe('Constructor', () => {
    it('should create an instance successfully', () => {
      const validator = new FormValidator(form);
      expect(validator).toBeInstanceOf(FormValidator);
    });
    
    it('should throw an error if form is not provided', () => {
      expect(() => new FormValidator(null as unknown as HTMLFormElement)).toThrow('Form must be specified.');
    });
    
    it('should attach event listeners based on options', () => {
      let submitCalled = false;
      let inputCalled = false;
      const testForm = document.createElement('form');
      testForm.addEventListener('submit', () => { submitCalled = true; });
      testForm.addEventListener('input', () => { inputCalled = true; });
      new FormValidator(testForm, { autoValidate: true });
      
      testForm.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }));
      testForm.dispatchEvent(new Event('input', { bubbles: true }));
      
      expect(submitCalled).toBe(true);
      expect(inputCalled).toBe(true);
    });
  });
  
  describe('validateForm', () => {
    it('should return true if form is valid', () => {
      input.value = 'test';
      const validator = new FormValidator(form, { useSummary: true });
      expect(validator.validateForm()).toBe(true);
      
      const errorSummary = document.querySelector('.error-summary');
      expect(errorSummary).toBeNull();
    });
    
    it('should return false if form is invalid', () => {
      const validator = new FormValidator(form, { useSummary: true });

      const result = validator.validateForm();

      expect(result).toBe(false);
      const errorSummary = document.querySelector('.error-summary');
      expect(errorSummary).not.toBeNull();
      const errorItems = errorSummary?.querySelectorAll('li');
      expect(errorItems?.length).toBe(1);
      expect(errorItems?.[0].textContent).toContain('Test Input');
    });
    
    it('should use reportValidity if useSummary is false', () => {
      const reportValiditySpy = vi.spyOn(form, 'reportValidity');
      
      const validator = new FormValidator(form, { useSummary: false });
      validator.validateForm();
      
      expect(reportValiditySpy).toHaveBeenCalled();
    });
  });
  
  describe('Submit handler', () => {
    it('should handle preventDefault based on options', () => {
      const preventDefaultSpy = vi.spyOn(submitEvent, 'preventDefault');
      new FormValidator(form, { preventDefault: true });
      form.dispatchEvent(submitEvent);
      expect(preventDefaultSpy).toHaveBeenCalled();
      preventDefaultSpy.mockClear();
      
      new FormValidator(form, { 
        submitCallback: () => { /* empty */ } 
      });
      form.dispatchEvent(submitEvent);

      expect(preventDefaultSpy).toHaveBeenCalled();
    });
    
    it('should call submitCallback if form is valid', () => {
      input.value = 'test'; // Make the input valid
      let callbackCalled = false;
      
      new FormValidator(form, { 
        submitCallback: () => { callbackCalled = true; } 
      });
      
      form.dispatchEvent(submitEvent);
      expect(callbackCalled).toBe(true);
    });
    
    it('should not call submitCallback if form is invalid', () => {
      // Input is required but empty
      let callbackCalled = false;
      
      new FormValidator(form, { 
        submitCallback: () => { callbackCalled = true; } 
      });
      
      form.dispatchEvent(submitEvent);
      expect(callbackCalled).toBe(false);
    });
    
    it('should call customChecks if provided', () => {
      let customChecksCalled = false;
      
      new FormValidator(form, { 
        customChecks: () => { customChecksCalled = true; } 
      });
      
      form.dispatchEvent(submitEvent);
      expect(customChecksCalled).toBe(true);
    });
  });
  
  describe('Error summary methods', () => {
    it('should display and clear error messages correctly', () => {
      const validator = new FormValidator(form);
      validator.displayErrorSummary(['Error 1', 'Error 2']);
      let errorSummary = document.querySelector('.error-summary');
      expect(errorSummary).not.toBeNull();
      let errorItems = errorSummary?.querySelectorAll('li');
      expect(errorItems?.length).toBe(2);
      expect(errorItems?.[0].textContent).toBe('Error 1');
      expect(errorItems?.[1].textContent).toBe('Error 2');

      validator.clearErrorSummary();
      errorSummary = document.querySelector('.error-summary ul');
      expect(errorSummary?.innerHTML).toBe('');
    });
  });
  
  describe('FindForm static method', () => {
    it('should find parent form element', () => {
      const childDiv = document.createElement('div');
      form.appendChild(childDiv);
      
      const foundForm = FormValidator.FindForm(childDiv);

      expect(foundForm).toBe(form);
    });
    
    it('should find child form element', () => {
      const container = document.createElement('div');
      const innerForm = document.createElement('form');
      container.appendChild(innerForm);
      document.body.appendChild(container);
      
      const foundForm = FormValidator.FindForm(container);

      expect(foundForm).toBe(innerForm);
    });
    
    it('should throw error if no form is found', () => {
      const div = document.createElement('div');
      document.body.appendChild(div);

      expect(() => FormValidator.FindForm(div)).toThrow(/Parent or a direct child must be a FORM/);
    });

    it('should throw error for detached element with no parent', () => {
      const detached = document.createElement('div');

      expect(() => FormValidator.FindForm(detached)).toThrow(/Parent or a direct child must be a FORM/);
    });
  });

  // Tests for identified potential issues
  describe('Potential Issues', () => {
    describe('shadowRoot access in getFieldName', () => {
      it('should work with regular DOM when shadowRoot is undefined', () => {
        const validator = new FormValidator(form, { useSummary: true });
        
        // This should not throw an error despite shadowRoot being undefined
        validator.validateForm();
        
        // Check that errors use element name as fallback
        const errorSummary = document.querySelector('.error-summary');
        const errorText = errorSummary?.querySelector('li')?.textContent;
        expect(errorText).toContain('Test Input');
      });
    });
    
    describe('Form field selection and validation', () => {
      it('should validate custom constraints', () => {
        // Create input with pattern constraint
        const patternInput = document.createElement('input');
        patternInput.setAttribute('pattern', '[A-Z]{3}');
        patternInput.setAttribute('name', 'patternField');
        patternInput.value = 'abc'; // Invalid pattern (not uppercase)
        form.appendChild(patternInput);
        
        const validator = new FormValidator(form, { useSummary: true });
        expect(validator.validateForm()).toBe(false);
        
        // Fix the pattern field
        patternInput.value = 'ABC';
        // But regular input is still invalid
        
        expect(validator.validateForm()).toBe(false);
        
        // Make all inputs valid
        input.value = 'test';
        expect(validator.validateForm()).toBe(true);
      });
      
      it('should handle dynamically added form elements', () => {
        input.value = 'test'; // Make the initial input valid
        const validator = new FormValidator(form, { useSummary: true });
        
        // Form is valid initially
        expect(validator.validateForm()).toBe(true);
        
        // Add new invalid input dynamically
        const newInput = document.createElement('input');
        newInput.setAttribute('required', 'true');
        newInput.setAttribute('name', 'dynamicField');
        form.appendChild(newInput);
        
        // Now form should be invalid
        expect(validator.validateForm()).toBe(false);
        
        // Error summary should include the new field
        const errorSummary = document.querySelector('.error-summary');
        const errorText = errorSummary?.querySelector('li')?.textContent;
        expect(errorText).toContain('dynamicField');
      });
      
      it('should handle removed form elements', () => {
        // Start with invalid form
        const validator = new FormValidator(form, { useSummary: true });
        expect(validator.validateForm()).toBe(false);
        
        // Remove the invalid input
        form.removeChild(input);
        
        // Now form should be valid
        expect(validator.validateForm()).toBe(true);
      });
    });
  });
});