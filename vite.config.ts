import { defineConfig } from 'vite'
import tailwindcss from '@tailwindcss/vite'
import { resolve } from 'path'

export default defineConfig({
  base: '/',
  plugins: [
    tailwindcss(),
    {
      name: 'html-css-injector',
      enforce: 'post',
      generateBundle(options, bundle) {
        // Find the generated CSS file name in the output bundle
        const cssFile = Object.keys(bundle).find(fileName => fileName.endsWith('.css'));
        if (!cssFile) return;

        // Ensure every HTML file has the exact compiled CSS link injected in <head>
        for (const [fileName, asset] of Object.entries(bundle)) {
          if (fileName.endsWith('.html') && asset.type === 'asset' && typeof asset.source === 'string') {
            let html = asset.source;
            const cssLink = `<link rel="stylesheet" href="/${cssFile}">`;
            // Remove any unresolved dev CSS links
            html = html.replace(/<link\s+rel="stylesheet"\s+href="[^"]*style\.css"[^>]*>/g, '');
            if (!html.includes(cssFile)) {
              html = html.replace('</head>', `    ${cssLink}\n</head>`);
              asset.source = html;
            }
          }
        }
      }
    }
  ],
  build: {
    rollupOptions: {
      input: {
        main: resolve(__dirname, 'index.html'),
        en: resolve(__dirname, 'en/index.html'),
        pl: resolve(__dirname, 'pl/index.html'),
        ru: resolve(__dirname, 'ru/index.html'),
        impressum_de: resolve(__dirname, 'impressum/index.html'),
        datenschutz_de: resolve(__dirname, 'datenschutz/index.html'),
        impressum_en: resolve(__dirname, 'en/impressum/index.html'),
        datenschutz_en: resolve(__dirname, 'en/datenschutz/index.html'),
        impressum_pl: resolve(__dirname, 'pl/impressum/index.html'),
        datenschutz_pl: resolve(__dirname, 'pl/datenschutz/index.html'),
        impressum_ru: resolve(__dirname, 'ru/impressum/index.html'),
        datenschutz_ru: resolve(__dirname, 'ru/datenschutz/index.html'),
      }
    }
  }
})
