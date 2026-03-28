/**
 * Sets form field values from a data object using the name attribute.
 * Supports dot notation for accessing nested properties and array handling.
 * 
 * @param form - The HTML form element to populate
 * @param data - The data object containing values to set in the form
 * 
 * @example
 * // Basic usage with flat object
 * const form = document.querySelector('form');
 * const data = { name: 'John', email: 'john@example.com' };
 * setFormData(form, data);
 * 
 * @example
 * // Using with nested objects via dot notation
 * const form = document.querySelector('form');
 * const data = { 
 *   user: { 
 *     name: 'John', 
 *     contact: { 
 *       email: 'john@example.com' 
 *     } 
 *   } 
 * };
 * // Form has fields with names like "user.name" and "user.contact.email"
 * setFormData(form, data);
 * 
 * @example
 * // Using with simple arrays using [] notation
 * const form = document.querySelector('form');
 * const data = { 
 *   hobbies: ['Reading', 'Cycling', 'Cooking']
 * };
 * // Form has multiple fields with names like "hobbies[]"
 * setFormData(form, data);
 * 
 * @example
 * // Using with array of objects using numeric indexers
 * const form = document.querySelector('form');
 * const data = { 
 *   users: [
 *     { name: 'John', email: 'john@example.com' },
 *     { name: 'Jane', email: 'jane@example.com' }
 *   ]
 * };
 * // Form has fields with names like "users[0].name", "users[1].email", etc.
 * setFormData(form, data);
 */
export function setFormData(form: HTMLFormElement, data: object): void {
    const formElements = form.querySelectorAll('[name]');

    formElements.forEach(element => {

      const name = element.getAttribute('name');
      if (!name) return;

      // Handle simple array notation (e.g., hobbies[])
      if (name.endsWith('[]')) {
        const arrayName = name.slice(0, -2);
        const arrayValue = getValueByComplexPath(data, arrayName);

        if (Array.isArray(arrayValue)) {
          const el = element as Record<string, any>;
          const type = el.type || element.getAttribute('type') || '';

          if (type === 'checkbox' || type === 'radio') {
            el.checked = arrayValue.includes(el.value);
          } else if ('options' in el && boolAttr(element, 'multiple')) {
            arrayValue.forEach(val => {
              const option = Array.from(el.options as HTMLOptionElement[])
                .find((opt: HTMLOptionElement) => opt.value === String(val));
              if (option) (option as HTMLOptionElement).selected = true;
            });
          } else if ('value' in el) {
            const allWithName = form.querySelectorAll(`[name="${name}"]`);
            const idx = Array.from(allWithName).indexOf(element);
            if (idx >= 0 && idx < arrayValue.length) {
              el.value = String(arrayValue[idx]);
            }
          }
        }
        return;
      }

      // Handle complex paths with array indexers and dot notation
      const value = getValueByComplexPath(data, name);
      if (value === undefined || value === null) return;

      setElementValue(element, value);
    });
  }
  
  function getValueByComplexPath(obj: object, path: string): any {
    // Handle array indexers like users[0].name
    const segments = [];
    let currentSegment = '';
    let inBrackets = false;
    
    for (let i = 0; i < path.length; i++) {
      const char = path[i];
      
      if (char === '[' && !inBrackets) {
        if (currentSegment) {
          segments.push(currentSegment);
          currentSegment = '';
        }
        inBrackets = true;
        currentSegment += char;
      } else if (char === ']' && inBrackets) {
        currentSegment += char;
        segments.push(currentSegment);
        currentSegment = '';
        inBrackets = false;
      } else if (char === '.' && !inBrackets) {
        if (currentSegment) {
          segments.push(currentSegment);
          currentSegment = '';
        }
      } else {
        currentSegment += char;
      }
    }
    
    if (currentSegment) {
      segments.push(currentSegment);
    }
    
    return segments.reduce((result, segment) => {
      if (!result || typeof result !== 'object') return undefined;
      
      // Handle array indexer segments like [0]
      if (segment.startsWith('[') && segment.endsWith(']')) {
        const index = segment.slice(1, -1);
        return result[index];
      }
      
      return result[segment];
    }, obj);
  }
  
  function getValueByPath(obj: object, path: string): any {
    return path.split('.').reduce((o, key) => {
      return o && typeof o === 'object' ? o[key] : undefined;
    }, obj);
  }
  
  function setElementValue(element: Element, value: any): void {
    const el = element as Record<string, any>;
    const type = el.type || element.getAttribute('type') || '';

    if (type === 'checkbox') {
      el.checked = Boolean(value);
    } else if (type === 'radio') {
      el.checked = el.value === String(value);
    } else if (type === 'date' && value instanceof Date) {
      el.value = value.toISOString().split('T')[0];
    } else if (type === 'datetime-local' && value instanceof Date) {
      const pad = (n: number) => String(n).padStart(2, '0');
      el.value = `${value.getFullYear()}-${pad(value.getMonth() + 1)}-${pad(value.getDate())}T${pad(value.getHours())}:${pad(value.getMinutes())}`;
    } else if ('options' in el && boolAttr(element, 'multiple') && Array.isArray(value)) {
      const options = Array.from(el.options as HTMLOptionElement[]);
      const vals = value.map(String);
      options.forEach((opt: HTMLOptionElement) => {
        opt.selected = vals.includes(opt.value);
      });
    } else if ('value' in el) {
      el.value = String(value);
    }
  }

  function boolAttr(element: Element, name: string): boolean {
    const el = element as Record<string, any>;
    if (name in el && typeof el[name] === 'boolean') return el[name];
    const attr = element.getAttribute(name);
    if (attr === null) return false;
    if (attr === '' || attr.toLowerCase() === 'true' || attr.toLowerCase() === name) return true;
    return false;
  }