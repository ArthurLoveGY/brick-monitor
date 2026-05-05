# AGENTS.md

## Goal

This repository prioritizes:

1. fail-fast behavior
2. explicit errors over silent fallback
3. maintainable code over clever code
4. minimal, localized changes over broad refactors
5. readability and debuggability over convenience

If a requested change conflicts with these priorities, choose the option that keeps failures visible and the code easier for humans to modify.

## Language rule

- Always respond to the user in Chinese unless the user explicitly requests another language.
- Do not switch to English for explanations, summaries, plans, or review comments unless necessary.
- Keep code, commands, file paths, API fields, logs, and exact error messages in their original language when needed for correctness.

## Non-negotiable engineering rules

- Do not hide errors with broad fallback logic.
- Do not swallow exceptions.
- Do not add "temporary" compatibility layers unless explicitly requested.
- Do not guess missing business logic.
- Do not silently coerce invalid input into a default success path.
- Do not return placeholder values to keep flows running.
- Do not introduce magic behavior that is not documented near the code.
- Prefer failing loudly with a precise error message over continuing with uncertain state.

## Forbidden patterns

- Never add a fallback branch unless the user explicitly asks for graceful degradation.
- Never use broad exception handling (`catch`, `except`, rescue-all) without rethrowing or returning a typed error.
- Never add compatibility code for old interfaces unless the migration requirement is clearly stated.
- Never mark TODO/FIXME as a substitute for correct behavior.
- Never silently ignore a failed write, parse, validation, or network operation.
- Never convert an unknown state into a fake success result.
- Never bypass validation just to keep the flow running.
- Never use “best effort” behavior for core business logic unless explicitly required.

## Error handling

- Every failure path must be explicit.
- Raise or return structured, actionable errors.
- Include enough context for debugging, but never expose secrets.
- If input is invalid, fail immediately at the boundary.
- If an invariant is broken, stop and surface it clearly.
- Catch exceptions only when:
  - adding useful context
  - converting to a domain-specific error
  - cleaning up resources
- After catching, rethrow or return an explicit failure. Never silently continue.

## Fallback policy

Assume fallback logic is harmful unless the user explicitly asks for resilience behavior.

Forbidden by default:

- try A, then silently try B, C, D
- implicit default values for required fields
- auto-healing logic that changes semantics
- compatibility shims for old code paths
- "best effort" writes that can partially succeed without surfacing failure

Allowed only when explicitly required:

- user-facing resilience features with clear logging
- feature-flagged migration paths
- well-tested degradation behavior with observability

If fallback is truly required, document:

- why it exists
- when it triggers
- how it is logged
- how it is tested
- when it can be removed

## Maintainability rules

- Prefer simple functions with clear names.
- Prefer composition over deeply nested conditionals.
- Keep modules focused and small.
- Extract helpers only when they reduce complexity, not just to "organize" code.
- Avoid hidden coupling across files.
- Keep control flow obvious.
- Add comments only for non-obvious intent, invariants, or tradeoffs.
- When modifying code, preserve or improve local clarity.
- Prefer boring, explicit code over clever abstractions.
- Do not introduce abstraction layers unless they clearly reduce long-term complexity.
- Keep changes easy for a human teammate to understand and extend later.

## Change strategy

- Make the smallest change that correctly solves the problem.
- Preserve existing architecture unless a refactor is necessary.
- Do not rewrite working modules without a clear reason.
- Separate refactors from behavior changes when practical.
- When a refactor is needed, keep it narrow and explain why.
- Prefer editing an existing code path over introducing parallel logic.
- Do not create a second implementation path unless explicitly required.

## Types and interfaces

- Prefer strict types over loose types.
- Avoid `any`, untyped dicts, and ambiguous return shapes unless unavoidable.
- Validate external input at the boundary.
- Make invalid states hard to represent.
- Keep public interfaces stable and explicit.
- Prefer schemas, typed DTOs, or validated input objects at boundaries.
- Do not weaken types to make the compiler quiet.

## Testing requirements

For every non-trivial change:

- add or update tests covering the changed behavior
- cover both success and failure paths
- cover boundary conditions and invalid input when relevant

Prefer:

- focused unit tests for logic
- integration tests for module boundaries
- regression tests for bug fixes

Do not remove failing tests to make the suite pass.
Fix the code or update the test only if behavior intentionally changed.

## Debuggability

- Error messages must identify what failed and why.
- Logs must help trace execution without excessive noise.
- Do not log secrets, tokens, or personal data.
- Keep stack traces intact where possible.
- When introducing a new branch in logic, make it observable in tests or logs.
- If a failure is expected to be actionable, the message should say what input, invariant, or dependency caused it.

## Code review standard

Before finishing, verify:

1. Does this change expose errors instead of hiding them?
2. Is the control flow easy for a human to follow?
3. Did I avoid unnecessary fallback logic?
4. Are invariants explicit?
5. Are tests covering failure cases?
6. Could a teammate modify this code quickly in 3 months?

If any answer is "no", revise the implementation.

## Completion gate

A task is not complete if:

- tests do not cover the new failure mode
- the change adds silent fallback behavior
- the implementation obscures the real source of failure
- the code becomes harder to modify than before
- the change introduces hidden compatibility logic without clear need
- the summary does not explain surfaced risks or assumptions

## Working style for the agent

When asked to implement something:

1. inspect the existing code path first
2. identify the narrowest correct change
3. prefer editing existing code over introducing new abstractions
4. preserve visible errors
5. run relevant tests, lint, and type checks
6. summarize what changed, why, and any remaining risks

When unsure:

- do not invent behavior
- do not guess hidden product requirements
- stop at the nearest boundary
- surface the uncertainty clearly
- leave the code in a truthful state

## Output expectations

When completing a task, report:

- files changed
- behavioral change
- failure modes now surfaced
- tests added or updated
- any assumptions that should be confirmed by a human

## Commands

Use the actual project commands below and keep them updated.

- install: `pnpm install`
- dev: `pnpm dev`
- test: `pnpm test`
- lint: `pnpm lint`
- typecheck: `pnpm typecheck`

## Directory guidance

- Read existing code in the target module before editing.
- Prefer following nearby patterns over inventing a new style.
- If a subdirectory has its own `AGENTS.md` or override instructions, follow the closer file.
- Put stricter rules closer to high-risk code such as payment, auth, persistence, and external integration layers.

## High-risk area rules

For high-risk code paths such as payments, auth, data persistence, migrations, and external API integration:

- never hide write failures
- never pretend a side effect succeeded when confirmation is missing
- never auto-retry with changed semantics unless explicitly required
- never downgrade a hard failure into a soft success
- always make state transitions and failure conditions explicit

## Final principle

Visible failure is better than hidden corruption.
Simple code is better than clever code.
A smaller truthful implementation is better than a bigger fragile one.