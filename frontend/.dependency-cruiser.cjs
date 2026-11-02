/**
 * Frontend boundaries (Doc 8 §2, manuscript 4.3.1). Any violation fails `python tools/check.py`.
 * Paths are relative to the directory depcruise runs in (frontend/ or a test fixture).
 */
module.exports = {
  forbidden: [
    {
      name: "no-backend-import",
      comment: "The frontend talks to the backend only over HTTP.",
      severity: "error",
      from: {},
      to: { path: "(^|/)backend/" },
    },
    {
      name: "store-isolated",
      comment: "The Project store depends only on generated types.",
      severity: "error",
      from: { path: "^store/" },
      to: { path: "^(components|app|api-client)/" },
    },
    {
      name: "api-client-isolated",
      comment: "The API client depends only on generated types.",
      severity: "error",
      from: { path: "^api-client/" },
      to: { path: "^(store|components|app)/" },
    },
    {
      name: "api-types-leaf",
      comment: "Generated types import nothing in the app.",
      severity: "error",
      from: { path: "^api-types/" },
      to: { path: "^(store|components|app|api-client)/" },
    },
    {
      name: "no-circular",
      severity: "error",
      from: {},
      to: { circular: true },
    },
  ],
  options: {
    doNotFollow: { path: "node_modules" },
    tsConfig: { fileName: "tsconfig.json" },
    tsPreCompilationDeps: true,
  },
};
