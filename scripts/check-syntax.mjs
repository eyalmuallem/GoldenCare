import fs from 'node:fs';
import path from 'node:path';
import ts from 'typescript';

const root = path.resolve('src');
const files = [];
function walk(dir) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) walk(full);
    else if (/\.(js|jsx)$/.test(entry.name)) files.push(full);
  }
}
walk(root);
let failed = false;
for (const file of files) {
  const source = fs.readFileSync(file, 'utf8');
  const out = ts.transpileModule(source, {
    compilerOptions: {
      jsx: ts.JsxEmit.ReactJSX,
      target: ts.ScriptTarget.ES2022,
      module: ts.ModuleKind.ESNext,
      allowJs: true,
    },
    fileName: file,
    reportDiagnostics: true,
  });
  const errors = (out.diagnostics || []).filter((d) => d.category === ts.DiagnosticCategory.Error);
  if (errors.length) {
    failed = true;
    console.error(`\n${file}`);
    for (const error of errors) console.error(ts.flattenDiagnosticMessageText(error.messageText, '\n'));
  }
}
if (failed) process.exit(1);
console.log(`Syntax check passed for ${files.length} source files.`);
