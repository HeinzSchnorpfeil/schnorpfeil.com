import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const templatePath = path.join(__dirname, 'src', 'template.html');
const legalTemplatePath = path.join(__dirname, 'src', 'legal-template.html');
const localesPath = path.join(__dirname, 'src', 'locales');
const outputDir = __dirname;

// Base path for deployment (e.g., '/schnorpfeil.com/' for GitHub Pages)
const basePath = process.env.BASE_PATH || '/';

// Ensure templates exist
if (!fs.existsSync(templatePath)) {
    console.error('Error: src/template.html not found.');
    process.exit(1);
}
if (!fs.existsSync(legalTemplatePath)) {
    console.error('Error: src/legal-template.html not found.');
    process.exit(1);
}

const template = fs.readFileSync(templatePath, 'utf-8');
const legalTemplate = fs.readFileSync(legalTemplatePath, 'utf-8');

const locales = ['de', 'en', 'pl', 'ru'];

const localeMap = {
    de: 'de_DE',
    en: 'en_US',
    pl: 'pl_PL',
    ru: 'ru_RU'
};

function getSeoHead(lang, subPath) {
    const pathSuffix = subPath ? `${subPath}/` : '';
    
    // Canonical for current lang
    const canonicalPath = lang === 'de' ? `/${pathSuffix}` : `/${lang}/${pathSuffix}`;
    const canonicalUrl = `https://schnorpfeil.com${canonicalPath}`;
    
    let seoHead = `<!-- Canonical & Hreflang -->\n`;
    seoHead += `    <link rel="canonical" href="${canonicalUrl}" />\n`;
    
    // Hreflang links
    seoHead += `    <link rel="alternate" hreflang="de" href="https://schnorpfeil.com/${pathSuffix}" />\n`;
    seoHead += `    <link rel="alternate" hreflang="en" href="https://schnorpfeil.com/en/${pathSuffix}" />\n`;
    seoHead += `    <link rel="alternate" hreflang="pl" href="https://schnorpfeil.com/pl/${pathSuffix}" />\n`;
    seoHead += `    <link rel="alternate" hreflang="ru" href="https://schnorpfeil.com/ru/${pathSuffix}" />\n`;
    seoHead += `    <link rel="alternate" hreflang="x-default" href="https://schnorpfeil.com/${pathSuffix}" />`;
    
    // Open Graph Tags
    seoHead += `\n    <meta property="og:url" content="${canonicalUrl}" />`;
    seoHead += `\n    <meta property="og:locale" content="${localeMap[lang] || 'de_DE'}" />`;
    
    // Alternates for Open Graph
    for (const [code, loc] of Object.entries(localeMap)) {
        if (code !== lang) {
            seoHead += `\n    <meta property="og:locale:alternate" content="${loc}" />`;
        }
    }
    
    return seoHead;
}

// Helper to generate HTML file
function generateHtml(templateStr, translations, lang, isDe, relativePath, outFileName, subPathName = '') {
    let rendered = templateStr;
    const baseUrl = isDe ? basePath : `${basePath}${lang}/`;

    // Inject Language Code and Base Url
    rendered = rendered.replace(/{{ lang }}/g, lang);
    rendered = rendered.replace(/{{ baseUrl }}/g, baseUrl);

    // Inject dynamic SEO Head
    const seoHead = getSeoHead(lang, subPathName);
    rendered = rendered.replace(/\{\{\s*seo_head\s*\}\}/g, seoHead);

    // Render translation keys
    for (const [key, value] of Object.entries(translations)) {
        if (typeof value === 'string') {
            const regex = new RegExp(`\\{\\{\\s*${key}\\s*\\}\\}`, 'gs');
            rendered = rendered.replace(regex, value);
        }
    }

    // Active Language Switcher setup
    const switcherRegex = new RegExp(`<!-- SW_${lang.toUpperCase()} -->.*?<!-- END_SW_${lang.toUpperCase()} -->`, 'sg');
    rendered = rendered.replace(switcherRegex, `<span class="nav-link active mx-1.5 font-bold text-xs border-b-2 border-primary pb-[1px] transition-colors duration-300">${lang.toUpperCase()}</span>`);

    // Clean up remaining switcher tags for unselected languages with subpage-aware links
    const pathSuffix = subPathName ? `${subPathName}/` : '';
    const cleanupRegexes = [
        { code: 'de', url: `${basePath}${pathSuffix}` },
        { code: 'en', url: `${basePath}en/${pathSuffix}` },
        { code: 'pl', url: `${basePath}pl/${pathSuffix}` },
        { code: 'ru', url: `${basePath}ru/${pathSuffix}` }
    ];

    cleanupRegexes.forEach(c => {
        if (c.code !== lang) {
            const cleanRe = new RegExp(`<!-- SW_${c.code.toUpperCase()} -->.*?<!-- END_SW_${c.code.toUpperCase()} -->`, 'sg');
            rendered = rendered.replace(cleanRe, `<a href="${c.url}" class="nav-link mx-1.5 transition-colors duration-300 text-xs font-semibold uppercase cursor-pointer">${c.code.toUpperCase()}</a>`);
        }
    });

    const outPath = path.join(outputDir, relativePath, outFileName);
    const outDir = path.dirname(outPath);

    if (!fs.existsSync(outDir)) {
        fs.mkdirSync(outDir, { recursive: true });
    }

    fs.writeFileSync(outPath, rendered, 'utf-8');
}

locales.forEach(lang => {
    const localeFile = path.join(localesPath, `${lang}.json`);
    if (!fs.existsSync(localeFile)) {
        console.warn(`Warning: Missing locale file for ${lang}`);
        return;
    }

    const translations = JSON.parse(fs.readFileSync(localeFile, 'utf-8'));
    const isDe = lang === 'de';
    
    const langDir = isDe ? '' : lang;

    // 1. Generate Main Index
    generateHtml(template, translations, lang, isDe, langDir, 'index.html', '');

    // 2. Generate Impressum Subpage
    let impressumTrans = {
        ...translations,
        og_title: translations.impressum_title || translations.og_title,
        meta_description: translations.impressum_meta_description || translations.meta_description,
        legal_title: translations.footer_impressum,
        legal_content: translations.legal_impressum_content,
        pageUrl: isDe ? '/impressum/' : `/${lang}/impressum/`
    };
    generateHtml(legalTemplate, impressumTrans, lang, isDe, path.join(langDir, 'impressum'), 'index.html', 'impressum');

    // 3. Generate Datenschutz Subpage
    let privacyTrans = {
        ...translations,
        og_title: translations.privacy_title || translations.og_title,
        meta_description: translations.privacy_meta_description || translations.meta_description,
        legal_title: translations.footer_privacy,
        legal_content: translations.legal_privacy_content,
        pageUrl: isDe ? '/datenschutz/' : `/${lang}/datenschutz/`
    };
    generateHtml(legalTemplate, privacyTrans, lang, isDe, path.join(langDir, 'datenschutz'), 'index.html', 'datenschutz');
});

console.log('✅ SSG Build Complete: Localized MPAs + Legal Pages generated.');
