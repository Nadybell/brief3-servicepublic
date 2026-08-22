// Script de build — minifie CSS, JS et HTML avant déploiement
// (RGESN RWEB-0077 : "Minifier les fichiers CSS, JavaScript, HTML et SVG")
//
// Le code source reste lisible et commenté dans le dépôt ; seule la
// version publiée dans dist/ est minifiée. Ce script est appelé
// automatiquement par le workflow GitHub Actions à chaque déploiement.

const fs = require('fs');
const path = require('path');
const CleanCSS = require('clean-css');
const { minify: minifyJs } = require('terser');
const { minify: minifyHtml } = require('html-minifier-terser');

const ROOT = path.join(__dirname, '..');
const DIST = path.join(ROOT, 'dist');

// Fichiers/dossiers copiés tels quels (pas de minification possible/utile)
const COPY_AS_IS = ['img', 'favicon.ico'];

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

async function minifyHtmlFile(src, dest) {
  const input = fs.readFileSync(src, 'utf8');
  const output = await minifyHtml(input, HTML_MINIFY_OPTIONS);
  ensureDir(path.dirname(dest));
  fs.writeFileSync(dest, output);
  logReduction(src, input.length, output.length);
}

function logReduction(file, before, after) {
  const pct = (((before - after) / before) * 100).toFixed(0);
  console.log(`  ${path.relative(ROOT, file)}: ${before} → ${after} octets (-${pct}%)`);
}

function findFiles(dir, ext) {
  let results = [];
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      results = results.concat(findFiles(full, ext));
    } else if (entry.name.endsWith(ext)) {
      results.push(full);
    }
  }
  return results;
}

async function main() {
  // Repart d'un dossier dist/ propre à chaque build
  fs.rmSync(DIST, { recursive: true, force: true });
  ensureDir(DIST);

  console.log('Copie des ressources non minifiables (images...)');
  for (const name of COPY_AS_IS) {
    copyRecursive(path.join(ROOT, name), path.join(DIST, name));
  }

  console.log('Minification CSS');
  for (const file of findFiles(path.join(ROOT, 'css'), '.css')) {
    await minifyCssFile(file, path.join(DIST, path.relative(ROOT, file)));
  }

  console.log('Minification JS');
  for (const file of findFiles(path.join(ROOT, 'js'), '.js')) {
    await minifyJsFile(file, path.join(DIST, path.relative(ROOT, file)));
  }

  console.log('Minification HTML');
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
