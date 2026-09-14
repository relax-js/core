# Working in a Relaxjs project

The rules an agent needs in order to write UI with `@relax.js/core` ship as skills. Install them
into a project with:

```
npx @relax.js/core init-agents
```

That copies them into `.claude/skills/` and rewrites their documentation references to the path
where this package is installed. Each copy is stamped with the package version it came from, so
running the command again after an upgrade lists the copies that are behind. Existing files are
left alone unless you pass `--force`.

| Skill | Covers |
|-------|--------|
| `relaxjs` | The core model, and where the rest is. Start here |
| `relaxjs-templates` | `compileTemplate`, `html`, loops, conditionals, pipes, `r-<event>` |
| `relaxjs-forms` | `FormValidator`, reading and writing form data, custom controls |
| `relaxjs-routing` | Routes, `<r-route-target>`, parameters, guards, layouts |
| `relaxjs-services` | Dependency injection, HTTP, WebSocket, SSE |
| `relaxjs-testing` | `mount()`, `flush()`, `captureRelaxErrors()`, debug traces |
| `relaxjs-setup` | Startup order, i18n loading, build configuration |

If your agent tool has no skill support, point its instruction file at
`node_modules/@relax.js/core/skills/relaxjs/SKILL.md` and let it follow the links from there.

The skills carry what an agent gets wrong from habit. The rest of `docs/` explains how things
work. `skills/README.md` states where that border runs, which is worth reading before editing
either one.
