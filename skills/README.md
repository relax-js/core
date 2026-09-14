# Agent skills

Skills for an agent writing UI in a project that depends on `@relax.js/core`. They are shipped
in the npm package and copied into a project with:

```
npx @relax.js/core init-agents
```

The copy rewrites every `@relax.js/core/docs/...` reference to the real path of the installed
docs folder, so a skill can always reach its detail page, and stamps each file with the package
version. A copy is a snapshot: after upgrading the package, run the command again and it names the
copies that describe an older library.

## The border between a skill and a doc

Docs answer "how does this work, what is available". They are read by someone who already knows
they need this API. Complete, explanatory, versioned with the code.

Skills answer "what will you get wrong if you write this from your priors". They load before the
agent knows it has a problem, and exist to overwrite wrong defaults and route to the right doc.

Two tests decide where a line belongs:

- Would an agent that never read this produce code that compiles, type-checks and does nothing?
  Skill. Would it merely not know a name? Docs.
- Would the sentence need editing when the implementation changes? Docs. Only when the design
  changes? Skill.

The two must not overlap. A skill that starts accumulating examples is turning into a doc, and
should hand off to one instead. That is what keeps them from drifting apart: the only thing a
skill repeats from a doc is its filename.
