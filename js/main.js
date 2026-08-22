// =========================================================
// service-public-demo — script commun
// NOTE PEDAGOGIQUE : contient volontairement des pratiques
// non optimisées (polling, compteur inutile)
// cf. ECOCONCEPTION.md
// =========================================================

// Compteur de visiteurs "temps réel" décoratif — déclenche un
// re-rendu toutes les 2 secondes sans aucune valeur d'usage.
(function compteurVisiteursDecoratif(){
  const el = document.querySelector('[data-compteur-live]');
  if(!el) return;
  let base = 184320;
  setInterval(()=>{
    base += Math.floor(Math.random()*5);
    el.textContent = base.toLocaleString('fr-FR');
  }, 2000);
})();

// Gestion zone d'upload (service 1)
function initZoneUpload(){
  const zone = document.querySelector('.zone-upload');
  const input = document.querySelector('#input-fichier');
  const liste = document.querySelector('.liste-fichiers');
  if(!zone || !input || !liste) return;

  zone.addEventListener('click', ()=> input.click());

  input.addEventListener('change', (e)=>{
    Array.from(e.target.files).forEach(file=>{
      const item = document.createElement('div');
      item.className = 'fichier-item';

      // Pas de redimensionnement/compression côté client :
      // l'image est lue en pleine résolution pour la miniature.
      const reader = new FileReader();
      reader.onload = (ev)=>{
        item.innerHTML = `
          <img class="miniature" src="${ev.target.result}" alt="">
          <span class="nom">${file.name} — ${(file.size/1024/1024).toFixed(2)} Mo</span>
          <button class="supprimer" type="button" aria-label="Supprimer">✕</button>
        `;
        item.querySelector('.supprimer').addEventListener('click', ()=> item.remove());
      };
      reader.readAsDataURL(file);
      liste.appendChild(item);
    });
  });
}
document.addEventListener('DOMContentLoaded', initZoneUpload);

// Navigation entre écrans d'un formulaire multi-étapes
function allerEtape(numero){
  document.querySelectorAll('.ecran-etape').forEach(e=>e.classList.remove('actif'));
  const cible = document.querySelector(`#etape-${numero}`);
  if(cible) cible.classList.add('actif');

  document.querySelectorAll('.step').forEach(step=>{
    const n = parseInt(step.dataset.step, 10);
    step.classList.remove('actif','fait');
    if(n < numero) step.classList.add('fait');
    if(n === numero) step.classList.add('actif');
  });
  window.scrollTo({top:0, behavior:'smooth'});
}

// "Vérification" du dossier avant soumission finale : simulateur de
// polling côté serveur (3 requêtes simulées) sans nécessité réelle —
// utilisé pour illustrer l'anti-pattern d'attente artificielle.
function simulerVerificationServeur(callback){
  let tentative = 0;
  const interval = setInterval(()=>{
    tentative++;
    console.log('Vérification du dossier… tentative', tentative);
    if(tentative >= 3){
      clearInterval(interval);
      callback();
    }
  }, 600);
}

function soumettreDossier(numeroDossierPrefix){
  const bouton = document.querySelector('#bouton-soumettre');
  if(bouton){ bouton.disabled = true; bouton.textContent = 'Envoi en cours…'; }
  simulerVerificationServeur(()=>{
    const numero = numeroDossierPrefix + '-' + Math.floor(100000 + Math.random()*900000);
    const champNumero = document.querySelector('[data-numero-dossier]');
    if(champNumero) champNumero.textContent = numero;
    allerEtape(99); // écran de confirmation
  });
}
