import JavaScriptObfuscator from 'javascript-obfuscator';
import {createHash} from 'node:crypto';
import {parse} from 'acorn';

const cache = new Map();
const MAX_CACHE_BYTES = 8 * 1024 * 1024;
let cacheBytes = 0;

export function obfuscateUserscript(source) {
  const digest = createHash('sha256').update(source).digest('hex');
  if (cache.has(digest)) return cache.get(digest);
  const metadata = source.match(/\/\/\s*==UserScript==[\s\S]*?\/\/\s*==\/UserScript==/);
  if (!metadata) throw Error('Metadata BMscript tidak ditemukan.');
  const code = source.slice(0, metadata.index) + source.slice(metadata.index + metadata[0].length);
  const notices = [];
  parse(code, {
    ecmaVersion: 'latest',
    onComment(block, text) {
      if (/@license|@preserve|^!|copyright|MIT License/i.test(text)) {
        notices.push(block ? '/*' + text + '*/' : '// ' + text);
      }
    }
  });
  const result = JavaScriptObfuscator.obfuscate(code, {
    target: 'browser-no-eval',
    compact: true,
    identifierNamesGenerator: 'hexadecimal',
    renameGlobals: false,
    renameProperties: false,
    stringArray: true,
    stringArrayEncoding: ['base64'],
    stringArrayThreshold: 1,
    stringArrayRotate: true,
    stringArrayShuffle: true,
    controlFlowFlattening: false,
    deadCodeInjection: false,
    debugProtection: false,
    selfDefending: false,
    sourceMap: false,
    seed: parseInt(digest.slice(0, 7), 16) + 1
  });
  const output = [metadata[0], ...notices, result.getObfuscatedCode(), ''].join('\n');
  const size = Buffer.byteLength(output);
  if (size <= MAX_CACHE_BYTES) {
    while (cacheBytes + size > MAX_CACHE_BYTES) {
      const oldest = cache.keys().next().value;
      cacheBytes -= Buffer.byteLength(cache.get(oldest));
      cache.delete(oldest);
    }
    cache.set(digest, output);
    cacheBytes += size;
  }
  return output;
}
