Vite Setup
==========

Relaxjs uses the modern **Stage 3 decorator** syntax (the one being standardized by TC39, supported by TypeScript 5.0 and newer). This is different from the older "experimental" decorators that many guides still describe.

This page shows how to set up a Vite + TypeScript project so that relaxjs decorators like `@RegisterValidator` work out of the box.

---

## Requirements

| Tool       | Minimum version | Why |
|------------|-----------------|-----|
| Node.js    | 18 or newer     | Required by Vite 5+ |
| TypeScript | 5.0 or newer    | Stage 3 decorator support |
| Vite       | 5.3 or newer    | Bundled esbuild transforms Stage 3 decorators |

If you created your project with `npm create vite@latest` recently, you already meet these.

---

## Step 1: Create a Vite project

```bash
npm create vite@latest my-app -- --template vanilla-ts
cd my-app
npm install
npm install @relax.js/core
```

The `vanilla-ts` template gives you TypeScript without a framework, which is what relaxjs is designed for.

---

## Step 2: Configure `tsconfig.json`

Open `tsconfig.json` and make sure these options are set:

```json
{
    "compilerOptions": {
        "target": "ES2022",
        "module": "ESNext",
        "moduleResolution": "Bundler",
        "experimentalDecorators": false,
        "useDefineForClassFields": true,
        "strict": true,
        "skipLibCheck": true,
        "lib": ["ES2022", "DOM"]
    },
    "include": ["src"]
}
```

The important lines for decorators:

- **`"experimentalDecorators": false`** — this is the switch. When `false` (or omitted), TypeScript uses the new Stage 3 decorators. When `true`, it uses the old legacy decorators, which are not compatible with relaxjs.
- **`"target": "ES2022"`** — any value from `ES2022` upward works. Do not pick a lower target; esbuild needs a modern target to emit clean decorator output.
- **`"useDefineForClassFields": true`** — required so class fields behave as the standard specifies. Relaxjs form components rely on this.

You do **not** need `emitDecoratorMetadata`. That option only applies to legacy decorators and is ignored here.

---

## Step 3: `vite.config.ts`

A minimal config is enough. Vite picks up your `tsconfig.json` automatically.

```ts
import { defineConfig } from 'vite';

export default defineConfig({
    server: {
        port: 3000,
    },
});
```

No plugins are required for decorators. Vite's built-in esbuild handles the transform.

---

## Step 4: Try a relaxjs decorator

Create `src/main.ts`:

```ts
import { RegisterValidator, ValidationContext } from '@relax.js/core/forms';

@RegisterValidator('even')
class EvenValidation {
    validate(value: string, context: ValidationContext) {
        const num = parseInt(value, 10);
        if (isNaN(num) || num % 2 !== 0) {
            context.addError('Value must be an even number');
        }
    }
}

console.log('EvenValidation registered');
```

Run the dev server:

```bash
npm run dev
```

Open the browser console. If you see `EvenValidation registered` and no errors, your decorator setup is working.

---

## Troubleshooting

### "Decorators are not valid here" or a parse error

Your TypeScript version is older than 5.0. Update it:

```bash
npm install -D typescript@latest
```

Then restart your editor so it picks up the new version.

### Code compiles but decorator never runs

You probably have `"experimentalDecorators": true` left over from an older template. Set it to `false` and restart the dev server.

### Syntax error at runtime, only in the browser

Your Vite (and therefore esbuild) version is too old to transform Stage 3 decorators. Upgrade:

```bash
npm install -D vite@latest
```

Vite 5.3 and newer bundle an esbuild version that handles the new decorator syntax.

### Error about `ElementInternals` or missing DOM types

Make sure `"lib"` includes `"DOM"` in `tsconfig.json`. Without it, TypeScript does not know about browser APIs that relaxjs uses.

---

## Vitest (optional)

If you add Vitest for testing, no extra decorator configuration is needed. Vitest uses the same esbuild transform as Vite, so the settings above apply to tests automatically.

```bash
npm install -D vitest jsdom
```

```ts
// vitest.config.ts
import { defineConfig } from 'vitest/config';

export default defineConfig({
    test: {
        environment: 'jsdom',
        globals: true,
    },
});
```

---

## Summary

For relaxjs decorators to work, you need three things:

1. TypeScript 5.0+
2. `"experimentalDecorators": false` in `tsconfig.json`
3. Vite 5.3+ (modern esbuild)

With those in place, decorators like `@RegisterValidator` work without any plugin or extra setup.
