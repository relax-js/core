/**
 * Sets form field values from a data object using the name attribute.
 * Supports dot notation for accessing nested properties and array handling.
 *
 * When `context` is provided, `<select>` elements are populated with options
 * before their value is set. The option source is resolved from either the
 * `data-source` attribute or, as a fallback, the select's `name` attribute.
 * The resolved property on `context` can be an array or a method returning
 * an array. The `data-source` attribute may also declare which item
 * properties to use as value and text.
 *
 * @param form - The HTML form element to populate
 * @param data - The data object containing values to set in the form
 * @param context - Optional sources used to populate `<select>` options
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
 *
 * @example
 * // Populating a <select> from context using the name convention
 * // <select name="country"></select>
 * setFormData(form, { country: 'se' }, {
 *   country: [
 *     { value: 'se', text: 'Sweden' },
 *     { value: 'us', text: 'United States' }
 *   ]
 * });
 *
 * @example
 * // Using data-source with custom value/text properties
 * // <select name="country" data-source="countries(id, name)"></select>
 * setFormData(form, { country: 2 }, {
 *   countries: [
 *     { id: 1, name: 'Sweden' },
 *     { id: 2, name: 'United States' }
 *   ]
 * });
 *
 * @example
 * // data-source as a method on context
 * // <select name="country" data-source="getCountries"></select>
 * setFormData(form, { country: 'se' }, {
 *   getCountries: () => [
 *     { value: 'se', text: 'Sweden' },
 *     { value: 'us', text: 'United States' }
 *   ]
 * });
 */
export function setFormData(form: HTMLFormElement, data: object, context?: object): void {
    if (context) {
        const selects = form.querySelectorAll('select[name]');
        selects.forEach(select => {
            populateSelectOptions(select as HTMLSelectElement, context as Record<string, any>);
        });
    }

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
    
    return segments.reduce<any>((result, segment) => {
      if (!result || typeof result !== 'object') return undefined;

      // Handle array indexer segments like [0]
      if (segment.startsWith('[') && segment.endsWith(']')) {
        const index = segment.slice(1, -1);
        return result[index];
      }

      return result[segment];
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

  function populateSelectOptions(select: HTMLSelectElement, context: Record<string, any>): void {
    const dataSource = select.getAttribute('data-source');
    const name = select.getAttribute('name') || '';

    let sourceKey: string;
    let valueField = 'value';
    let textField = 'text';

    if (dataSource) {
      const match = dataSource.match(/^\s*(\w+)\s*(?:\(\s*(\w+)\s*,\s*(\w+)\s*\))?\s*$/);
      if (!match) return;
      sourceKey = match[1];
      if (match[2] && match[3]) {
        valueField = match[2];
        textField = match[3];
      }
    } else {
      sourceKey = name.endsWith('[]') ? name.slice(0, -2) : name;
      if (!sourceKey) return;
    }

    const source = context[sourceKey];
    if (source === undefined) return;

    const items = typeof source === 'function' ? source.call(context) : source;
    if (!Array.isArray(items)) return;

    const placeholders = Array.from(select.options).filter(opt => opt.value === '');
    select.innerHTML = '';
    placeholders.forEach(opt => select.add(opt));

    for (const item of items) {
      if (item === null || item === undefined) continue;
      if (typeof item === 'object') {
        const value = String(item[valueField]);
        const text = String(item[textField]);
        select.add(new Option(text, value));
      } else {
        const str = String(item);
        select.add(new Option(str, str));
      }
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