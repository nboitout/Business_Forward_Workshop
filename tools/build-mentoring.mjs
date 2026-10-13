import { build } from 'esbuild';
await build({ entryPoints: ['src/mentoring/app.js'], outfile: 'public/mentoring/app.js', bundle: true, minify: true, format: 'esm', target: 'es2022', legalComments: 'eof' });
console.log('Built mentoring portal');
