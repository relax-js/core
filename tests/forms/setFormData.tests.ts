import { describe, it, expect, beforeEach } from 'vitest';
import { setFormData } from '../../src/forms/setFormData';

describe('setFormData', () => {
  let form: HTMLFormElement;

  beforeEach(() => {
    document.body.innerHTML = '';
    form = document.createElement('form');
    document.body.appendChild(form);
  });

  it('should set values for basic input fields', () => {
    form.innerHTML = `
      <input type="text" name="name">
      <input type="email" name="email">
      <input type="number" name="age">
    `;

    const data = {
      name: 'John Doe',
      email: 'john@example.com',
      age: 30
    };

    setFormData(form, data);

    expect((form.querySelector('[name="name"]') as HTMLInputElement).value).toBe('John Doe');
    expect((form.querySelector('[name="email"]') as HTMLInputElement).value).toBe('john@example.com');
    expect((form.querySelector('[name="age"]') as HTMLInputElement).value).toBe('30');
  });

  it('should handle checkbox inputs', () => {
    form.innerHTML = `
      <input type="checkbox" name="subscribe">
      <input type="checkbox" name="terms">
    `;

    const data = {
      subscribe: true,
      terms: false
    };

    setFormData(form, data);

    expect((form.querySelector('[name="subscribe"]') as HTMLInputElement).checked).toBe(true);
    expect((form.querySelector('[name="terms"]') as HTMLInputElement).checked).toBe(false);
  });

  it('should handle radio inputs', () => {
    form.innerHTML = `
      <input type="radio" name="gender" value="male">
      <input type="radio" name="gender" value="female">
      <input type="radio" name="gender" value="other">
    `;

    const data = {
      gender: 'female'
    };

    setFormData(form, data);

    const radioButtons = form.querySelectorAll('[name="gender"]') as NodeListOf<HTMLInputElement>;
    expect(radioButtons[0].checked).toBe(false);
    expect(radioButtons[1].checked).toBe(true);
    expect(radioButtons[2].checked).toBe(false);
  });

  it('should handle select elements', () => {
    form.innerHTML = `
      <select name="country">
        <option value="us">United States</option>
        <option value="ca">Canada</option>
        <option value="uk">United Kingdom</option>
      </select>
    `;

    const data = {
      country: 'ca'
    };

    setFormData(form, data);

    expect((form.querySelector('[name="country"]') as HTMLSelectElement).value).toBe('ca');
  });

  it('should handle textarea elements', () => {
    form.innerHTML = `
      <textarea name="comments"></textarea>
    `;

    const data = {
      comments: 'Some test comments'
    };

    setFormData(form, data);

    expect((form.querySelector('[name="comments"]') as HTMLTextAreaElement).value).toBe('Some test comments');
  });

  it('should handle date inputs', () => {
    form.innerHTML = `
      <input type="date" name="birthday">
    `;

    const data = {
      birthday: new Date('2000-01-15')
    };

    setFormData(form, data);

    expect((form.querySelector('[name="birthday"]') as HTMLInputElement).value).toBe('2000-01-15');
  });

  it('should support dot notation for nested properties', () => {
    form.innerHTML = `
      <input type="text" name="user.name">
      <input type="email" name="user.contact.email">
      <input type="text" name="user.address.city">
    `;

    const data = {
      user: {
        name: 'Jane Smith',
        contact: {
          email: 'jane@example.com'
        },
        address: {
          city: 'New York'
        }
      }
    };

    setFormData(form, data);

    expect((form.querySelector('[name="user.name"]') as HTMLInputElement).value).toBe('Jane Smith');
    expect((form.querySelector('[name="user.contact.email"]') as HTMLInputElement).value).toBe('jane@example.com');
    expect((form.querySelector('[name="user.address.city"]') as HTMLInputElement).value).toBe('New York');
  });

  it('should handle simple array notation with checkboxes', () => {
    form.innerHTML = `
      <input type="checkbox" name="hobbies[]" value="reading">
      <input type="checkbox" name="hobbies[]" value="cycling">
      <input type="checkbox" name="hobbies[]" value="cooking">
      <input type="checkbox" name="hobbies[]" value="gaming">
    `;

    const data = {
      hobbies: ['reading', 'cooking']
    };

    setFormData(form, data);

    const checkboxes = form.querySelectorAll('[name="hobbies[]"]') as NodeListOf<HTMLInputElement>;
    expect(checkboxes[0].checked).toBe(true);  // reading
    expect(checkboxes[1].checked).toBe(false); // cycling
    expect(checkboxes[2].checked).toBe(true);  // cooking
    expect(checkboxes[3].checked).toBe(false); // gaming
  });

  it('should handle simple array notation with multiple select', () => {
    form.innerHTML = `
      <select name="colors[]" multiple>
        <option value="red">Red</option>
        <option value="green">Green</option>
        <option value="blue">Blue</option>
        <option value="yellow">Yellow</option>
      </select>
    `;

    const data = {
      colors: ['red', 'blue']
    };

    setFormData(form, data);

    const select = form.querySelector('[name="colors[]"]') as HTMLSelectElement;
    const options = Array.from(select.options);
    
    expect(options[0].selected).toBe(true);  // red
    expect(options[1].selected).toBe(false); // green
    expect(options[2].selected).toBe(true);  // blue
    expect(options[3].selected).toBe(false); // yellow
  });

  it('should handle array indexers for object arrays', () => {
    form.innerHTML = `
      <input type="text" name="users[0].name">
      <input type="email" name="users[0].email">
      <input type="text" name="users[1].name">
      <input type="email" name="users[1].email">
    `;

    const data = {
      users: [
        { name: 'John Doe', email: 'john@example.com' },
        { name: 'Jane Smith', email: 'jane@example.com' }
      ]
    };

    setFormData(form, data);

    expect((form.querySelector('[name="users[0].name"]') as HTMLInputElement).value).toBe('John Doe');
    expect((form.querySelector('[name="users[0].email"]') as HTMLInputElement).value).toBe('john@example.com');
    expect((form.querySelector('[name="users[1].name"]') as HTMLInputElement).value).toBe('Jane Smith');
    expect((form.querySelector('[name="users[1].email"]') as HTMLInputElement).value).toBe('jane@example.com');
  });

  it('should handle complex array indexers with nested properties', () => {
    form.innerHTML = `
      <input type="text" name="companies[0].departments[1].name">
      <input type="text" name="companies[0].departments[1].manager.name">
      <input type="number" name="companies[0].departments[1].size">
    `;

    const data = {
      companies: [
        {
          departments: [
            { name: 'HR', size: 5 },
            { 
              name: 'Engineering', 
              size: 20,
              manager: {
                name: 'Alice Johnson'
              }
            }
          ]
        }
      ]
    };

    setFormData(form, data);

    expect((form.querySelector('[name="companies[0].departments[1].name"]') as HTMLInputElement).value)
      .toBe('Engineering');
    expect((form.querySelector('[name="companies[0].departments[1].manager.name"]') as HTMLInputElement).value)
      .toBe('Alice Johnson');
    expect((form.querySelector('[name="companies[0].departments[1].size"]') as HTMLInputElement).value)
      .toBe('20');
  });

  it('should ignore fields with no matching data', () => {
    form.innerHTML = `
      <input type="text" name="firstName">
      <input type="text" name="missing">
    `;

    const data = {
      firstName: 'John'
    };

    setFormData(form, data);

    expect((form.querySelector('[name="firstName"]') as HTMLInputElement).value).toBe('John');
    expect((form.querySelector('[name="missing"]') as HTMLInputElement).value).toBe('');
  });

  it('should ignore fields with no name attribute', () => {
    form.innerHTML = `
      <input type="text" name="firstName">
      <input type="text">
    `;

    const data = {
      firstName: 'John'
    };

    setFormData(form, data);

    expect((form.querySelector('[name="firstName"]') as HTMLInputElement).value).toBe('John');
    // No error should occur for the input without a name
  });

  it('should not assign null values to fields', () => {
    form.innerHTML = `
      <input type="text" name="firstName" value="existing">
      <input type="text" name="lastName" value="existing">
    `;

    const data = {
      firstName: null,
      lastName: 'Smith'
    };

    setFormData(form, data);

    expect((form.querySelector('[name="firstName"]') as HTMLInputElement).value).toBe('existing');
    expect((form.querySelector('[name="lastName"]') as HTMLInputElement).value).toBe('Smith');
  });

  it('should not assign undefined values to fields', () => {
    form.innerHTML = `
      <input type="text" name="firstName" value="existing">
      <input type="text" name="lastName" value="existing">
    `;

    const data = {
      firstName: undefined,
      lastName: 'Smith'
    };

    setFormData(form, data);

    expect((form.querySelector('[name="firstName"]') as HTMLInputElement).value).toBe('existing');
    expect((form.querySelector('[name="lastName"]') as HTMLInputElement).value).toBe('Smith');
  });

  it('should not assign null values in nested properties', () => {
    form.innerHTML = `
      <input type="text" name="user.name" value="existing">
      <input type="text" name="user.email" value="existing">
    `;

    const data = {
      user: {
        name: null,
        email: 'jane@example.com'
      }
    };

    setFormData(form, data);

    expect((form.querySelector('[name="user.name"]') as HTMLInputElement).value).toBe('existing');
    expect((form.querySelector('[name="user.email"]') as HTMLInputElement).value).toBe('jane@example.com');
  });

  it('should not assign null values in array indexed properties', () => {
    form.innerHTML = `
      <input type="text" name="users[0].name" value="existing">
      <input type="text" name="users[0].email">
    `;

    const data = {
      users: [
        { name: null, email: 'john@example.com' }
      ]
    };

    setFormData(form, data);

    expect((form.querySelector('[name="users[0].name"]') as HTMLInputElement).value).toBe('existing');
    expect((form.querySelector('[name="users[0].email"]') as HTMLInputElement).value).toBe('john@example.com');
  });

  it('should not assign null to checkboxes', () => {
    form.innerHTML = `
      <input type="checkbox" name="subscribe" checked>
    `;

    const data = {
      subscribe: null
    };

    setFormData(form, data);

    expect((form.querySelector('[name="subscribe"]') as HTMLInputElement).checked).toBe(true);
  });

  it('should not assign null to select elements', () => {
    form.innerHTML = `
      <select name="country">
        <option value="us">United States</option>
        <option value="ca" selected>Canada</option>
      </select>
    `;

    const data = {
      country: null
    };

    setFormData(form, data);

    expect((form.querySelector('[name="country"]') as HTMLSelectElement).value).toBe('ca');
  });

  it('should not assign null to textarea elements', () => {
    form.innerHTML = `
      <textarea name="comments">existing text</textarea>
    `;

    const data = {
      comments: null
    };

    setFormData(form, data);

    expect((form.querySelector('[name="comments"]') as HTMLTextAreaElement).value).toBe('existing text');
  });

  it('should handle deeply nested properties with long dot paths', () => {
    form.innerHTML = `
      <input type="text" name="a.very.deeply.nested.property">
    `;

    const data = {
      a: {
        very: {
          deeply: {
            nested: {
              property: 'found me!'
            }
          }
        }
      }
    };

    setFormData(form, data);

    expect((form.querySelector('[name="a.very.deeply.nested.property"]') as HTMLInputElement).value).toBe('found me!');
  });

  it('should handle select multiple without [] suffix', () => {
    form.innerHTML = `
      <select name="colors" multiple>
        <option value="red">Red</option>
        <option value="green">Green</option>
        <option value="blue">Blue</option>
      </select>
    `;

    const data = {
      colors: ['red', 'blue']
    };

    setFormData(form, data);

    const select = form.querySelector('[name="colors"]') as HTMLSelectElement;
    const options = Array.from(select.options);
    expect(options[0].selected).toBe(true);
    expect(options[1].selected).toBe(false);
    expect(options[2].selected).toBe(true);
  });

  it('should handle datetime-local inputs with Date objects', () => {
    form.innerHTML = `
      <input type="datetime-local" name="meeting">
    `;

    const data = {
      meeting: new Date('2024-06-15T14:30:00')
    };

    setFormData(form, data);

    const input = form.querySelector('[name="meeting"]') as HTMLInputElement;
    expect(input.value).toMatch(/^2024-06-15T14:30/);
  });

  it('should distribute array values across text inputs with [] notation', () => {
    form.innerHTML = `
      <input type="text" name="tags[]">
      <input type="text" name="tags[]">
      <input type="text" name="tags[]">
    `;

    const data = {
      tags: ['html', 'css', 'js']
    };

    setFormData(form, data);

    const inputs = form.querySelectorAll('[name="tags[]"]') as NodeListOf<HTMLInputElement>;
    expect(inputs[0].value).toBe('html');
    expect(inputs[1].value).toBe('css');
    expect(inputs[2].value).toBe('js');
  });

  it('should handle nested bracket paths with [] array notation', () => {
    form.innerHTML = `
      <input type="checkbox" name="items[0].tags[]" value="urgent">
      <input type="checkbox" name="items[0].tags[]" value="low">
    `;

    const data = {
      items: [
        { tags: ['urgent'] }
      ]
    };

    setFormData(form, data);

    const checkboxes = form.querySelectorAll('[name="items[0].tags[]"]') as NodeListOf<HTMLInputElement>;
    expect(checkboxes[0].checked).toBe(true);
    expect(checkboxes[1].checked).toBe(false);
  });
});