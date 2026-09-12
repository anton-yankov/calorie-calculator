import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import ts from "typescript";

// Exercise the real TypeScript modules with isolated database/Next.js boundaries.
export function loadModule(path, mocks = {}, globals = {}) {
  const filename = new URL(`../../${path}`, import.meta.url);
  const compiled = ts.transpileModule(readFileSync(filename, "utf8"), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
  }).outputText;
  const loaded = { exports: {} };
  const require = createRequire(filename);
  new Function("require", "module", "exports", ...Object.keys(globals), compiled)(
    (name) =>
      name in mocks
        ? mocks[name]
        : name.startsWith("@/")
          ? loadModule(`src/${name.slice(2)}.ts`, mocks, globals)
          : require(name),
    loaded,
    loaded.exports,
    ...Object.values(globals),
  );
  return loaded.exports;
}
