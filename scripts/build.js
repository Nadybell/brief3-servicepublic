// Script de build — minifie CSS/JS/HTML et optimise les images avant
// déploiement (RGESN RWEB-0077 minification + optimisation images).
//
// Le code source reste lisible et commenté dans le dépôt ; seule la
// version publiée dans dist/ est minifiée/optimisée. Ce script est appelé
// automatiquement par le workflow GitHub Actions à chaque déploiement.

const fs = require('fs');
const path = require('path');
const CleanCSS = require('clean-css');
const { minify: minifyJs } = require('terser');
const { minify: minifyHtml } = require('html-minifier-terser');
const sharp = require('sharp');
const cheerio = require('cheerio');

const ROOT = path.join(__dirname, '..');
const DIST = path.join(ROOT, 'dist');

// Fichiers/dossiers copiés tels quels (img/ est traité séparément par
// optimizeImages, plus bas — pas de copie brute pour les images).
const COPY_AS_IS = ['favicon.ico'];

// Largeur maximale d'une image source. Une image plus large que ça est
// quasiment toujours plus grande que nécessaire pour un affichage web
// (au-delà, même sur un écran Retina, le gain de netteté est invisible
// à l'œil nu). Ce plafond générique ne remplace pas un calcul précis de
// la taille d'affichage réelle propre à chaque emplacement (fait
// manuellement pour la galerie d'exemples de pièces) : c'est un filet de
// sécurité qui évite les images bien plus grandes que nécessaire.
const IMAGE_MAX_WIDTH = 1600;
const JPEG_QUALITY = 80;
const WEBP_QUALITY = 78;
const PNG_COMPRESSION_LEVEL = 9;

const HTML_MINIFY_OPTIONS = {
  collapseWhitespace: true,
  removeComments: true,
  removeRedundantAttributes: true,
  removeEmptyAttributes: true,
  minifyCSS: true,
  minifyJS: true,
};

function ensureDir(dir) {
  fs.mkdirSync(dir, { recursive: true });
}

function copyRecursive(src, dest) {
  if (!fs.existsSync(src)) return;
  const stat = fs.statSync(src);
  if (stat.isDirectory()) {
    ensureDir(dest);
    for (const entry of fs.readdirSync(src)) {
      copyRecursive(path.join(src, entry), path.join(dest, entry));
    }
  } else {
    fs.copyFileSync(src, dest);
  }
}

async function minifyCssFile(src, dest) {
  const input = fs.readFileSync(src, 'utf8');
  const output = new CleanCSS({}).minify(input);
  if (output.errors.length) {
    throw new Error(`Erreur CSS (${src}): ${output.errors.join(', ')}`);
  }
  ensureDir(path.dirname(dest));
  fs.writeFileSync(dest, output.styles);
  logReduction(src, input.length, output.styles.length);
}

async function minifyJsFile(src, dest) {
  const input = fs.readFileSync(src, 'utf8');
  const output = await minifyJs(input, { format: { comments: false } });
  ensureDir(path.dirname(dest));
  fs.writeFileSync(dest, output.code);
  logReduction(src, input.length, output.code.length);
}

function logReduction(file, before, after) {
  const pct = (((before - after) / before) * 100).toFixed(0);
  console.log(`  ${path.relative(ROOT, file)}: ${before} → ${after} octets (-${pct}%)`);
}

function findFiles(dir, ext) {
  let results = [];
  if (!fs.existsSync(dir)) return results;
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      results = results.concat(findFiles(full, ext));
    } else if (entry.name.toLowerCase().endsWith(ext)) {
      results.push(full);
    }
  }
  return results;
}

// ---------------------------------------------------------------------
// Optimisation des images : redimensionnement + recompression + WebP.
// S'applique automatiquement à toute image .jpg/.jpeg/.png présente
// dans img/, y compris de nouvelles images ajoutées plus tard.
// ---------------------------------------------------------------------
async function optimizeImages() {
  const IMG_SRC = path.join(ROOT, 'img');
  const IMG_DIST = path.join(DIST, 'img');
  if (!fs.existsSync(IMG_SRC)) return;
  ensureDir(IMG_DIST);

  for (const entry of fs.readdirSync(IMG_SRC, { withFileTypes: true })) {
    if (entry.isDirectory()) continue; // pas de sous-dossiers dans img/ pour ce projet
    const ext = path.extname(entry.name).toLowerCase();
    const srcPath = path.join(IMG_SRC, entry.name);
    const baseName = path.basename(entry.name, ext);

    if (ext !== '.jpg' && ext !== '.jpeg' && ext !== '.png') {
      // Type non pris en charge (ex: .svg) : copié tel quel, non modifié.
      fs.copyFileSync(srcPath, path.join(IMG_DIST, entry.name));
      continue;
    }

    const image = sharp(srcPath);
    const meta = await image.metadata();
    const targetWidth = meta.width && meta.width > IMAGE_MAX_WIDTH ? IMAGE_MAX_WIDTH : null;
    const resized = targetWidth ? image.resize({ width: targetWidth }) : image.clone();

    const destJpgOrPng = path.join(IMG_DIST, entry.name);
    const destWebp = path.join(IMG_DIST, `${baseName}.webp`);

    if (ext === '.png') {
      await resized.clone().png({ compressionLevel: PNG_COMPRESSION_LEVEL }).toFile(destJpgOrPng);
    } else {
      await resized.clone().jpeg({ quality: JPEG_QUALITY, mozjpeg: true }).toFile(destJpgOrPng);
    }
    await resized.clone().webp({ quality: WEBP_QUALITY }).toFile(destWebp);

    const beforeSize = fs.statSync(srcPath).size;
    const afterSize = fs.statSync(destJpgOrPng).size;
    const webpSize = fs.statSync(destWebp).size;
    console.log(
      `  img/${entry.name}: ${beforeSize} → ${afterSize} o` +
        (targetWidth ? ` (redimensionné à ${targetWidth}px)` : '') +
        ` | +webp ${webpSize} o`
    );
  }
}

// ---------------------------------------------------------------------
// Transformation HTML : remplace chaque <img src="x.jpg"> local par un
// <picture> avec repli WebP + JPG, et ajoute loading="lazy". N'a aucun
// effet sur les <img> déjà entourés d'un <picture> (idempotent), ni sur
// les images externes (http...) ou non jpg/png (svg, etc.).
// ---------------------------------------------------------------------
function wrapLocalImagesWithPicture(html) {
  const $ = cheerio.load(html);

  $('img').each((_, el) => {
    const $img = $(el);
    const alreadyWrapped = $img.parent().is('picture');
    const src = $img.attr('src') || '';
    const isLocal = src && !/^(https?:)?\/\//i.test(src);
    const ext = path.extname(src).toLowerCase();
    const isJpgOrPng = ext === '.jpg' || ext === '.jpeg' || ext === '.png';

    if (alreadyWrapped || !isLocal || !isJpgOrPng) return;

    const webpSrc = src.slice(0, -ext.length) + '.webp';

    if (!$img.attr('loading')) {
      $img.attr('loading', 'lazy');
    }

    const $picture = $('<picture></picture>');
    const $source = $('<source>').attr('srcset', webpSrc).attr('type', 'image/webp');
    $img.before($picture);
    $picture.append($source);
    $img.appendTo($picture);
  });

  return $.html();
}

async function minifyHtmlFile(src, dest) {
  const rawInput = fs.readFileSync(src, 'utf8');
  const withPicture = wrapLocalImagesWithPicture(rawInput);
  const output = await minifyHtml(withPicture, HTML_MINIFY_OPTIONS);
  ensureDir(path.dirname(dest));
  fs.writeFileSync(dest, output);
  logReduction(src, rawInput.length, output.length);
}

async function main() {
  // Repart d'un dossier dist/ propre à chaque build
  fs.rmSync(DIST, { recursive: true, force: true });
  ensureDir(DIST);

  console.log('Copie des ressources non transformées (favicon...)');
  for (const name of COPY_AS_IS) {
    copyRecursive(path.join(ROOT, name), path.join(DIST, name));
  }

  console.log('Optimisation des images (redimensionnement + WebP)');
  await optimizeImages();

  console.log('Minification CSS');
  for (const file of findFiles(path.join(ROOT, 'css'), '.css')) {
    await minifyCssFile(file, path.join(DIST, path.relative(ROOT, file)));
  }

  console.log('Minification JS');
  for (const file of findFiles(path.join(ROOT, 'js'), '.js')) {
    await minifyJsFile(file, path.join(DIST, path.relative(ROOT, file)));
  }

  console.log('Minification HTML (+ passage des images locales en <picture> WebP)');
  const htmlFiles = [
    path.join(ROOT, 'index.html'),
    ...findFiles(path.join(ROOT, 'pages'), '.html'),
  ];
  for (const file of htmlFiles) {
    await minifyHtmlFile(file, path.join(DIST, path.relative(ROOT, file)));
  }

  console.log('Build terminé → dist/');
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
