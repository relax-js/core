# Reading & Writing Form Data

Functions for reading and writing form data with automatic type conversion.

## mapFormToClass

Maps form field values to a class instance's properties with type conversion. Provides full type safety by populating an existing typed object.

```typescript
import { mapFormToClass } from '@relax.js/core/forms';

class UserDTO {
    name: string = '';
    email: string = '';
    age: number = 0;
    newsletter: boolean = false;
}

const form = document.querySelector('form');
const user = mapFormToClass(form, new UserDTO());
console.log(user.name, user.age, user.newsletter);
```

### Options

```typescript
// Options object (inline, not a named interface)
{
    throwOnMissingProperty?: boolean;  // Throw if form field has no matching property
    throwOnMissingField?: boolean;     // Throw if class property has no matching field
}
```

### Strict Validation Mode

Catch mismatches between form fields and your data model:

```typescript
const user = mapFormToClass(form, new UserDTO(), {
    throwOnMissingProperty: true,  // Catch typos in form field names
    throwOnMissingField: true      // Ensure all DTO fields are in form
});
```

### Type Conversion

Automatic conversion based on input types:

| Input Type | Converted To |
|------------|--------------|
| `checkbox` | `boolean` |
| `number` | `number` |
| `date` | `Date` |

```typescript
class ProductDTO {
    name: string = '';
    price: number = 0;
    inStock: boolean = false;
    releaseDate: Date | null = null;
}

const product = mapFormToClass(form, new ProductDTO());
// product.price is number, product.inStock is boolean
```

## readData

Reads all form data into a plain object with automatic type conversion. Use when you don't need strict typing.

```typescript
import { readData } from '@relax.js/core/forms';

const form = document.querySelector('form');
const data = readData(form);
```

### Type Conversion

Type conversion is determined by:
1. `data-type` attribute if present (`number`, `boolean`, `string`, `Date`)
2. Input type (`checkbox`, `number`, `date`, etc.)
3. Falls back to string

```html
<form>
    <input name="username" value="john" />
    <input name="age" type="number" value="25" />
    <input name="active" type="checkbox" checked />
    <input name="salary" data-type="number" value="50000" />
    <select name="colors" multiple>
        <option value="red" selected>Red</option>
        <option value="blue" selected>Blue</option>
    </select>
</form>
```

```typescript
const data = readData(form);
// Returns: {
//     username: 'john',
//     age: 25,
//     active: true,
//     salary: 50000,
//     colors: ['red', 'blue']
// }
```

### Checkbox Handling

Unchecked checkboxes are included as `false` in the result. Checked checkboxes with no explicit `value` attribute (which submit as `'on'` in FormData) are correctly converted to `true`.

```html
<input name="active" type="checkbox" checked />
<input name="terms" type="checkbox" />
```

```typescript
const data = readData(form);
// Returns: { active: true, terms: false }
```

### Custom Form Components

Works with form-associated custom elements:

```html
<form>
    <r-input name="email" value="test@example.com"></r-input>
    <r-checkbox name="terms" checked></r-checkbox>
</form>
```

```typescript
const data = readData(form);
// Returns: { email: 'test@example.com', terms: true }
```

## setFormData

Populates form fields from a data object using the `name` attribute.

```typescript
import { setFormData } from '@relax.js/core/forms';

const form = document.querySelector('form');
const data = { name: 'John', email: 'john@example.com' };
setFormData(form, data);
```

### Nested Objects (Dot Notation)

```html
<form>
    <input name="user.name" />
    <input name="user.contact.email" />
</form>
```

```typescript
const data = {
    user: {
        name: 'John',
        contact: {
            email: 'john@example.com'
        }
    }
};
setFormData(form, data);
```

### Date and DateTime

`setFormData` formats `Date` objects to the correct string format for each input type:

```html
<input type="date" name="birthday" />
<input type="datetime-local" name="meeting" />
```

```typescript
setFormData(form, {
    birthday: new Date('2000-01-15'),     // Sets "2000-01-15"
    meeting: new Date('2024-06-15T14:30') // Sets "2024-06-15T14:30"
});
```

### Select (Single)

`setFormData` can both **populate options** and **select a value** on a `<select>`.

- The selected value comes from `data` (second argument).
- The options come from `context` (optional third argument). If `context` is not provided, options must already exist in the DOM.
- The data value is compared as a string against each option's `value` attribute. If no option matches, nothing is selected.

#### Existing options in the DOM

```html
<select name="country">
    <option value="se">Sweden</option>
    <option value="us">United States</option>
</select>
```

```typescript
setFormData(form, { country: 'se' });
// Selects the "Sweden" option
```

#### Populating options from `context`

Pass the collection on a third argument. By convention, the property name in `context` matches the select's `name` attribute. Items use a `{ value, text }` shape.

```html
<select name="country"></select>
```

```typescript
setFormData(form, { country: 'se' }, {
    country: [
        { value: 'se', text: 'Sweden' },
        { value: 'us', text: 'United States' }
    ]
});
```

A plain string array also works — each string becomes both the value and the text:

```typescript
setFormData(form, { country: 'Sweden' }, {
    country: ['Sweden', 'United States']
});
```

#### Using `data-source` for custom property names

When your collection has different property names (like `id` and `name`), declare them on the select:

```html
<select name="country" data-source="countries(id, name)"></select>
```

```typescript
setFormData(form, { country: 2 }, {
    countries: [
        { id: 1, name: 'Sweden' },
        { id: 2, name: 'United States' }
    ]
});
```

The `data-source` attribute has two parts:

- **Source name** (required): the property on `context` to read from — `countries` above.
- **Value and text properties** (optional): inside parentheses, separated by a comma — `(id, name)` means `item.id` is the option value and `item.name` is the option text. Without parentheses, the defaults `value` and `text` are used.

#### `data-source` as a method

The property on `context` can be a method. It is called with no arguments and must return an array:

```html
<select name="country" data-source="getCountries"></select>
```

```typescript
setFormData(form, { country: 'se' }, {
    getCountries: () => [
        { value: 'se', text: 'Sweden' },
        { value: 'us', text: 'United States' }
    ]
});
```

#### Placeholder options are preserved

Options whose `value` is empty (for example a leading "Select one…") are kept when `setFormData` repopulates the list:

```html
<select name="country">
    <option value="">Select one…</option>
</select>
```

After calling `setFormData` with a `context`, the placeholder stays at the top and the new options are appended after it.

### Select Multiple

Works the same way as single selects. The `data` value must be an array. Options can be populated from `context` using either the name convention or `data-source`.

```html
<select name="colors" multiple>
    <option value="red">Red</option>
    <option value="green">Green</option>
    <option value="blue">Blue</option>
</select>
```

```typescript
setFormData(form, { colors: ['red', 'blue'] });
// Selects "red" and "blue", deselects "green"
```

Each array item is compared as a string against each option's `value` attribute. Options that don't match any array item are deselected.

### Simple Arrays ([] Notation)

For checkboxes, multi-select, and text inputs:

```html
<form>
    <input name="hobbies[]" type="checkbox" value="Reading" />
    <input name="hobbies[]" type="checkbox" value="Cycling" />
    <input name="hobbies[]" type="checkbox" value="Cooking" />
</form>
```

```typescript
const data = {
    hobbies: ['Reading', 'Cooking']
};
setFormData(form, data);
// Checks "Reading" and "Cooking" checkboxes
```

### Array of Objects (Indexed Notation)

```html
<form>
    <input name="users[0].name" />
    <input name="users[0].email" />
    <input name="users[1].name" />
    <input name="users[1].email" />
</form>
```

```typescript
const data = {
    users: [
        { name: 'John', email: 'john@example.com' },
        { name: 'Jane', email: 'jane@example.com' }
    ]
};
setFormData(form, data);
```

### Complex Data Structures

```html
<form id="product-form">
    <input name="product.name" placeholder="Product Name">
    <input name="product.price" type="number" placeholder="Price">

    <input name="categories[]" type="checkbox" value="electronics">
    <input name="categories[]" type="checkbox" value="gadgets">

    <input name="variants[0].size" placeholder="Size">
    <input name="variants[0].color" placeholder="Color">
    <input name="variants[1].size" placeholder="Size">
    <input name="variants[1].color" placeholder="Color">

    <input name="supplier.company" placeholder="Company">
    <input name="supplier.contact.email" placeholder="Email">
</form>
```

```typescript
const productData = {
    product: {
        name: 'Wireless Headphones',
        price: 99.99
    },
    categories: ['electronics', 'gadgets'],
    variants: [
        { size: 'M', color: 'black' },
        { size: 'L', color: 'white' }
    ],
    supplier: {
        company: 'TechCorp',
        contact: {
            email: 'orders@techcorp.com'
        }
    }
};

setFormData(form, productData);

// Later, extract the data
const extractedData = readData(form);
// Result matches the original structure
```

## Type Converters

### Built-in Converters

| Converter | Input | Output |
|-----------|-------|--------|
| `BooleanConverter` | `'true'`, `'on'`, `'1'`, any positive number string -> `true`; `'false'`, `'off'`, `'0'` -> `false` | `boolean` |
| `NumberConverter` | Numeric string | `number` |
| `DateConverter` | ISO or locale-formatted date string | `Date` |

#### Locale-Aware Date Parsing

`DateConverter` detects the current locale and parses dates in the local format:

| Locale | Format | Example |
|--------|--------|---------|
| `en` (US) | `MM/DD/YYYY` | `01/15/2024` |
| `sv` (Swedish) | `YYYY-MM-DD` | `2024-01-15` |
| `de` (German) | `DD.MM.YYYY` | `15.01.2024` |

ISO format (`2024-01-15`) is always accepted regardless of locale.

### Custom Type via `data-type` Attribute

Use the `data-type` attribute to override conversion for any field:

```html
<input name="salary" data-type="number" value="50000" />
<input name="active" data-type="boolean" value="true" />
<input name="birthday" data-type="Date" value="2000-01-15" />
```

```typescript
const data = readData(form);
console.log(data.salary);   // number: 50000
console.log(data.active);   // boolean: true
console.log(data.birthday); // Date object
```

Supported `data-type` values: `number`, `boolean`, `string`, `Date`.

### Date and Time Handling

```html
<input name="startDate" type="date">
<input name="startTime" type="time">
<input name="duration" type="time" step="900"> <!-- 15 min steps -->
```

```typescript
// Custom handling for combining date and time
document.querySelector('[name="startTime"]').getData = function() {
    const dateInput = form.querySelector('[name="startDate"]') as HTMLInputElement;
    const timeInput = this as HTMLInputElement;

    if (dateInput.value && timeInput.value) {
        return new Date(`${dateInput.value}T${timeInput.value}`);
    }
    return null;
};
```

### Input Type Conversion Table

| Input Type | Converted To |
|------------|--------------|
| `checkbox` | `boolean` |
| `number` | `number` |
| `date` | `Date` |
| `datetime-local` | `Date` |
| `month` | `Date` (first of month) |
| `week` | `{ year, week }` |
| `time` | `{ hours, minutes, seconds }` |
| Default | `string` |
