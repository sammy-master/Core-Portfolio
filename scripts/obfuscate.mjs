import fs from 'node:fs';
import path from 'node:path';
import JavaScriptObfuscator from 'javascript-obfuscator';

const assetsDir = path.resolve('dist/assets');
if (fs.existsSync(assetsDir)) {
  for (const file of fs.readdirSync(assetsDir)) {
    if (!file.endsWith('.js')) continue;
    const full = path.join(assetsDir, file);
    const code = fs.readFileSync(full, 'utf8');
    const result = JavaScriptObfuscator.obfuscate(code, {
      compact: true,
      controlFlowFlattening: false,
      deadCodeInjection: false,
      identifierNamesGenerator: 'hexadecimal',
      renameGlobals: false,
      selfDefending: false,
      simplify: true,
      splitStrings: false,
      stringArray: true,
      stringArrayThreshold: 0.5,
      target: 'browser',
    });
    fs.writeFileSync(full, result.getObfuscatedCode(), 'utf8');
    console.log(`[obfuscate] Hardened ${file}`);
  }
}
