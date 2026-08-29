# Commenting standards

## Why we comment

Comments exist to help future-you (and reviewers) understand *intent* and
*decisions* — not to restate what the code already says. A comment that just
narrates the next line is noise; delete it instead of writing it.

## Rule 1 — JSDoc on exported classes and public methods

Every exported class and public method gets a short JSDoc block: one line
summarizing what it does.

- Add `@param` only when the parameter's meaning isn't obvious from its name
  and type.
- Add `@throws` for exceptions a caller needs to know about.
- Add `@returns` only when the return value isn't obvious from the method
  name and return type.

Skip tags that would just repeat the signature.

## Rule 2 — inline comments explain "why," never "what"

Reserve `//` comments for non-obvious decisions — a deliberate guard clause,
a deliberate pattern (like a try/catch that rethrows known exceptions and
wraps everything else as a 500). If you can already tell what a line does by
reading it, it doesn't need a comment.

## Rule 3 — no stale comments

A wrong comment is worse than no comment. Update or delete a comment in the
same change that changes the code it describes.

## Rule 4 — file-header comments are the exception, not the rule

Most files don't need one — the class JSDoc covers it. Add a file-header
comment only when a file's role isn't obvious from its name and location
(e.g. a filter, a middleware).

## Scope

This standard applies to production code under `src/**/*.ts`. `*.spec.ts`
test files are exempt — Jest's `describe`/`it` strings already document
intent, and duplicating that in comments adds nothing.
