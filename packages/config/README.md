# @workspace/config

Shared tooling configuration for the monorepo.

## Exports

- `@workspace/config/tsconfig.base.json` — base TypeScript compiler options.
- `@workspace/config/eslint` — base flat ESLint config used by workspace packages.

## Usage

`tsconfig.json`:

```json
{
  "extends": "@workspace/config/tsconfig.base.json"
}
```

`eslint.config.mjs`:

```js
export { default } from '@workspace/config/eslint'
```
