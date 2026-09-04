# Building a Form Page

The end-to-end shape of a page that edits something: `compileTemplate` for the markup, `setFormData` to fill the fields, `FormValidator` to own the submit event, and an async callback to save. One web component, one file. Start here when you are building a form and work outwards to the reference pages.

## The whole thing

```typescript
import { compileTemplate, CompiledTemplate } from '@relax.js/core/html';
import { FormValidator, readData, setFormData } from '@relax.js/core/forms';
import { get, put } from '@relax.js/core/http';
import { LoadRoute } from '@relax.js/core/routing';

interface Profile {
    displayName: string;
    email: string;
    bio: string;
}

class ProfilePage extends HTMLElement implements LoadRoute<{ userId: string }> {
    private template: CompiledTemplate;
    private form!: HTMLFormElement;
    private validator!: FormValidator;
    private userId = '';

    constructor() {
        super();

        this.template = compileTemplate(`
            <form class="form">
                <h1>{{heading}}</h1>

                <label for="displayName">Display name</label>
                <input id="displayName" name="displayName" required>

                <label for="email">Email</label>
                <input id="email" name="email" type="email" required>

                <label for="bio">Bio</label>
                <textarea id="bio" name="bio"></textarea>

                <button type="submit">Save</button>
                <button type="button" r-click="discard()">Discard changes</button>
            </form>
        `);
    }

    async loadRoute(data: { userId: string }) {
        this.userId = String(data.userId);

        this.appendChild(this.template.content);
        this.template.render({ heading: 'Your profile' }, { discard: () => this.load() });

        this.form = FormValidator.FindForm(this);
        this.validator = new FormValidator(this.form, {
            useSummary: true,
            submitCallback: () => this.save(),
        });

        await this.load();
    }

    private async load() {
        const response = await get(`/users/${this.userId}`);
        setFormData(this.form, response.as<Profile>());
    }

    private async save() {
        const profile = readData<Profile>(this.form);
        const response = await put(`/users/${this.userId}`, JSON.stringify(profile));
        if (!response.success) {
            this.validator.addErrorToSummary('Save', response.statusReason);
        }
    }
}

customElements.define('profile-page', ProfilePage);
```

Register the route and the page is done:

```typescript
const routes: Route[] = [
    { name: 'profile', path: '/profile/:userId', componentTagName: 'profile-page' },
];
```

## The four rules this example encodes

**`FormValidator` owns the form's submit event.** Its constructor attaches the listener. Do not add your own, and construct one even when you have no validation rules to declare, because taking over submit is what it is for. Supplying `submitCallback` also suppresses the native browser submit, so the page never navigates away.

**One `render()` wires the handlers permanently.** The `r-click` on the discard button keeps working for the life of the component even though `render()` is called exactly once. Rendering once does not mean the template is inert. This matters here because the `<textarea>` must stay out of anything re-rendered: every render writes the value property back and moves the caret. Rendering once solves that without costing you the handlers.

**`submitCallback` can be async and is awaited.** Its type is `() => void | Promise<void>`. A rejected promise is reported through `onError` rather than swallowed.

**Read on submit, write on load.** `setFormData` fills the form from the server, `readData` reads it back out. Neither one hooks submit; `FormValidator` is what calls them at the right moment.

## Where to go next

- [Validation](validation.md) for validation rules, the error summary, and the full `FormValidator` options.
- [Reading & Writing](reading-writing.md) for how `readData` and `setFormData` convert types and handle nested names such as `preferences.theme`.
- [compileTemplate](../html/template.md) for loops, conditionals, pipes, and the rest of the `r-<event>` bindings.
- [Creating Form Components](creating-form-components.md) if the page needs an input the platform does not provide.
- [Patterns](patterns.md) for multi-step forms, unsaved-change guards, and file uploads.
