import {build} from 'esbuild';
await build({entryPoints:['src/pdf-entry.ts'],outfile:'dist/pdf-browser.js',bundle:true,platform:'browser',format:'iife',globalName:'SolarPdf',loader:{'.png':'dataurl','.jpg':'dataurl','.jpeg':'dataurl'},tsconfig:'tsconfig.json'});
