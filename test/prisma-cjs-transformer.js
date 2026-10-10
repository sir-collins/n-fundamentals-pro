// Jest transformer for Prisma's generated client (src/generated) only.
//
// The generated client loads its WebAssembly query compiler with a dynamic
// `import()`. Real Node runs that fine, but Jest executes each file inside a
// `vm` sandbox that rejects dynamic import unless Node is started with
// --experimental-vm-modules — and that flag makes Jest treat
// @nestjs/mongoose as ESM, breaking it. Compiling these files as plain
// CommonJS turns `import()` into `require()`, sidestepping both. Everything
// else still goes through ts-jest unchanged.
const ts = require('typescript');

module.exports = {
  process(sourceText, sourcePath) {
    const { outputText, sourceMapText } = ts.transpileModule(sourceText, {
      fileName: sourcePath,
      compilerOptions: {
        module: ts.ModuleKind.CommonJS,
        target: ts.ScriptTarget.ES2023,
        esModuleInterop: true,
        sourceMap: true,
      },
    });
    return { code: outputText, map: sourceMapText };
  },
};
