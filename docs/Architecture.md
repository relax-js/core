# Architecture Overview

Relaxjs is a library for building web applications with Web Components. It emphasizes explicit control, direct DOM manipulation, and predictable behavior.

## Philosophy

Unlike modern SPA frameworks, Relaxjs takes an explicit approach:

- **No virtual DOM**: The real DOM is the source of truth
- **No hidden reactivity**: Changes happen when you explicitly make them
- **No synthetic lifecycle**: Uses native Web Component lifecycle hooks
- **Full developer control**: You always know what triggered what

## Core Modules

```
relaxjs/
├── Routing          # SPA navigation with guards and layouts
├── Forms            # Data binding, validation, type conversion
├── DI               # Dependency injection container
├── HTTP             # Fetch wrapper and WebSocket client
├── i18n             # Internationalization with ICU support
├── Templates        # HTML templating with data binding
└── Components       # Pre-built UI components
```

## Module Integration

### Application Startup

```typescript
import { defineRoutes, startRouting } from 'relaxjs/routing';
import { setLocale } from 'relaxjs/i18n';
import { serviceCollection } from 'relaxjs/di';

class Application extends HTMLElement {
    async connectedCallback() {
        // 1. Register services
        serviceCollection.registerByType(ApiService, { inject: [] });
        serviceCollection.registerByType(AuthService, { inject: [ApiService] });

        // 2. Set locale
        await setLocale(navigator.language);

        // 3. Define routes
        defineRoutes([
            { name: 'home', path: '/', componentTagName: 'app-home' },
            { name: 'login', path: '/login', componentTagName: 'login-page' }
        ]);

        // 4. Start routing
        startRouting();
    }
}

customElements.define('app-main', Application);
```

### Component Pattern

```typescript
class UserProfile extends HTMLElement {
    private form: HTMLFormElement;
    private validator: FormValidator;

    connectedCallback() {
        this.innerHTML = `
            <form>
                <input name="name" required>
                <input name="email" type="email" required>
                <button type="submit">Save</button>
            </form>
        `;

        this.form = this.querySelector('form')!;
        this.validator = new FormValidator(this.form, {
            submitCallback: () => this.save()
        });

        this.loadUser();
    }

    async loadUser() {
        const api = container.resolve(ApiService);
        const user = await api.get('/user/profile');
        setFormData(this.form, user.as<User>());
    }

    async save() {
        const data = readData(this.form);
        const api = container.resolve(ApiService);
        await api.put('/user/profile', JSON.stringify(data));
    }
}

customElements.define('user-profile', UserProfile);
```

## Data Flow

```
┌─────────────────────────────────────────────────────────┐
│                    User Action                           │
└─────────────────────────────────────────────────────────┘
                           │
                           ▼
┌─────────────────────────────────────────────────────────┐
│                  Event Handler                           │
│                                                          │
│   element.addEventListener('click', (e) => {             │
│       // Explicit action                                 │
│   });                                                    │
└─────────────────────────────────────────────────────────┘
                           │
                           ▼
┌─────────────────────────────────────────────────────────┐
│                    DOM Update                            │
│                                                          │
│   // Direct manipulation                                 │
│   element.textContent = newValue;                        │
│   element.setAttribute('data-state', 'active');          │
└─────────────────────────────────────────────────────────┘
```

## Routing Architecture

```
┌──────────────┐    navigate()     ┌──────────────────┐
│   User       │ ────────────────► │   Router         │
│   Action     │                   │                  │
└──────────────┘                   │  - Match route   │
                                   │  - Check guards  │
                                   │  - Update URL    │
                                   └────────┬─────────┘
                                            │
                                   NavigateRouteEvent
                                            │
                                            ▼
                                   ┌──────────────────┐
                                   │  r-route-target│
                                   │                  │
                                   │  - Load component│
                                   │  - Pass params   │
                                   └──────────────────┘
```

### Multiple Targets

```html
<body>
    <r-route-target>
        <!-- Main content renders here -->
    </r-route-target>

    <r-route-target name="modal">
        <!-- Modal content renders here -->
    </r-route-target>

    <r-route-target name="sidebar">
        <!-- Sidebar content renders here -->
    </r-route-target>
</body>
```

```typescript
// Navigate to specific target
navigate('userDetails', { params: { id: '123' }, target: 'modal' });
```

## Form Data Flow

```
┌─────────────┐     setFormData()    ┌─────────────────────────────────────┐
│  Data       │ ──────────────────►  │  Form Elements & Custom Components  │
│  Object     │                      │                                     │
└─────────────┘                      │  <input> <select> <textarea>        │
                                     │  <r-input> <r-checkbox> (FORM API)  │
      ▲                              └────────┬────────────────────────────┘
      │                                       │
      │   readData()                    User edits
      │                                       │
      │                                       ▼
┌─────┴───────┐     FormValidator    ┌─────────────────┐
│  Updated    │ ◄─────────────────── │  Validation     │
│  Object     │                      │                 │
└─────────────┘                      │  - HTML5        │
                                     │  - Custom rules │
                                     │  - FORM API     │
                                     │    components   │
                                     └─────────────────┘
```

### Form Component Support

The form utilities support both native HTML form elements and modern form-associated custom elements (those implementing the FORM API with `ElementInternals`). This means:

- **Native elements**: `<input>`, `<select>`, `<textarea>` work as expected
- **Custom components**: Web components like `<r-input>`, `<r-checkbox>`, `<r-select>` that use `ElementInternals` and `formAssociated = true` are fully integrated
- **No API differences**: Both types are handled identically by `setFormData()`, `readData()`, `mapFormToClass()`, and `FormValidator`

## Template Rendering

### Static Templates (html)

```typescript
const template = html`
    <div class="card">
        <h2>${'title'}</h2>
        <p>${'description'}</p>
    </div>
`;

// Creates new DOM each time
const fragment = template({ title: 'Hello', description: 'World' });
container.appendChild(fragment);
```

### Updateable Templates (html)

```typescript
const template = html`
    <div class="user">
        <span>{{name}}</span>
        <span>{{score|number}}</span>
    </div>
`;

const rendered = template({ name: 'John', score: 42 });
container.appendChild(rendered.fragment);

// Later, update without recreating DOM
rendered.update({ name: 'Jane', score: 100 });
```

## Service Architecture

```
┌────────────────────────────────────────────────────────┐
│                  ServiceCollection                      │
│                                                         │
│   Register services with metadata:                      │
│   - Constructor dependencies                            │
│   - Property injections                                 │
│   - Scope (global/closest)                             │
└───────────────────────────┬────────────────────────────┘
                            │
                            │ Configuration
                            ▼
┌────────────────────────────────────────────────────────┐
│                  ServiceContainer                       │
│                                                         │
│   Resolve services:                                     │
│   1. Check cache (for singletons)                       │
│   2. Resolve dependencies                               │
│   3. Create instance                                    │
│   4. Inject properties                                  │
│   5. Cache if global scope                              │
└────────────────────────────────────────────────────────┘
```

## File Organization

Recommended project structure:

```
src/
├── components/
│   ├── forms/           # Form-related components
│   ├── lists/           # List/table components
│   └── shared/          # Shared UI components
├── pages/               # Route components
├── services/            # Business logic services
├── guards/              # Route guards
├── models/              # TypeScript interfaces/types
└── app.ts              # Application entry point
```

## Best Practices

1. **Use native HTML when possible**: Don't create components for things HTML already does well

2. **Keep components small**: Each component should do one thing

3. **Form Components Use FORM API**: When building custom form components, use the HTML Form API with `ElementInternals` and `formAssociated = true`. All RelaxJS form utilities automatically support these components without any special handling:

```typescript
class CustomCheckbox extends HTMLElement {
  static formAssociated = true;
  
  private internals: ElementInternals;
  
  constructor() {
    super();
    this.internals = this.attachInternals();
  }
  
  connectedCallback() {
    const checkbox = document.createElement('input');
    checkbox.type = 'checkbox';
    this.appendChild(checkbox);
    
    checkbox.addEventListener('change', () => {
      this.internals.setFormValue(checkbox.checked ? 'on' : '');
    });
  }
  
  get checked() { return (this.querySelector('input') as HTMLInputElement).checked; }
  set checked(v) { (this.querySelector('input') as HTMLInputElement).checked = v; }
  
  get value() { return this.getAttribute('value') || 'on'; }
}

customElements.define('r-checkbox', CustomCheckbox);
```

Once defined, use it seamlessly with form utilities:

```typescript
const form = document.querySelector('form');
const data = { termsAccepted: true };
setFormData(form, data);  // Works with <r-checkbox name="termsAccepted"></r-checkbox>

const extracted = readData(form);  // Extracts values from custom components
const validator = new FormValidator(form);  // Validates custom components
```

3. **Explicit over implicit**: Prefer explicit method calls over magic bindings

4. **Type everything**: Use TypeScript interfaces for all data structures

5. **CSS variables for theming**: Use semantic variable names

6. **Form-associated components**: Use `ElementInternals` for custom form controls
