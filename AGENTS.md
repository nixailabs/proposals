# AGENTS.md

## Cursor Cloud specific instructions

This is a simple Node.js/Express server that serves static HTML proposals. There is no build step, no database, no linter, and no test suite configured.

### Running the server

```bash
node server.js
```

The server listens on `PORT` (default `3010`). Proposals are served at `/v1/<client-name>` where `<client-name>` maps to an HTML file in the `proposals/` directory.

### Key notes

- **No build step**: The app runs directly with `node server.js` — there is no transpilation or bundling.
- **No test suite**: `package.json` has a placeholder test script (`echo "Error: no test specified" && exit 1`). There are no automated tests.
- **No linter**: No ESLint or similar tooling is configured.
- **Single dependency**: The only runtime dependency is `express`.
- **Static assets**: Logo images are served from `/assets/` via Express static middleware.
