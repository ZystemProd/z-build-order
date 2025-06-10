import { promises as fs } from 'fs';
import { minify } from 'terser';

async function minifyVendor() {
  const dir = new URL('../dist/assets/', import.meta.url);
  try {
    const files = await fs.readdir(dir);
    for (const file of files) {
      if (file.startsWith('vendor-firebase-core') && file.endsWith('.js')) {
        const filePath = new URL(file, dir);
        const code = await fs.readFile(filePath, 'utf8');
        const result = await minify(code, { compress: true, mangle: true });
        await fs.writeFile(filePath, result.code);
        console.log(`Minified ${file}`);
      }
    }
  } catch (err) {
    console.error('Minification failed:', err);
    process.exit(1);
  }
}

minifyVendor();
