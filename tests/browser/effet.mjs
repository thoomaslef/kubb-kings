/**
 * L'effet : le geste produit-il vraiment une courbe, et du bon cote ?
 *
 * `src/game/spin.test.ts` verifie les deux regles pures (un trajet devient un
 * effet, un effet devient une force). Il ne peut rien dire de la chaine
 * reelle : un vrai doigt qui glisse en arc sur le canevas, Phaser qui en tire
 * un effet, Matter qui courbe la trajectoire. C'est tout l'interet de cette
 * verification — elle PILOTE LA SOURIS, elle ne pose pas `aimSpin` a la main.
 *
 * Un banc d'essai qui ecrirait directement `scene.aimSpin` testerait la
 * physique en sautant le geste, c'est-a-dire precisement la moitie qu'on
 * vient d'ecrire.
 */
import { attendreEcran, focus, lancer, lancerNavigateur, lancerDepuisLeMenu, ouvrirJeu, surveiller } from './harness.mjs';

const DESIGN = { width: 720, height: 1280 };

const navigateur = await lancerNavigateur();
const contexte = await navigateur.newContext({ viewport: { width: 390, height: 844 } });
const erreurs = [];
const page = await contexte.newPage();
surveiller('effet', page, erreurs);

await ouvrirJeu(page);
await lancerDepuisLeMenu(page, /1 contre 1|1v1/i);
if (!(await attendreEcran(page, 'match'))) throw new Error("La partie ne s'est pas lancee.");
await page.waitForTimeout(1200);
await focus(page);

/** Design -> pixels CSS de la page. La camera montre exactement la zone de design. */
async function versEcran() {
  const r = await page.evaluate(() => {
    const c = document.querySelector('canvas').getBoundingClientRect();
    return { left: c.left, top: c.top, width: c.width, height: c.height };
  });
  return (x, y) => ({ x: r.left + (x / DESIGN.width) * r.width, y: r.top + (y / DESIGN.height) * r.height });
}
const ecran = await versEcran();

/**
 * Glisse du lanceur vers la cible en suivant un arc, comme un vrai pouce.
 * `fleche` > 0 bombe vers la GAUCHE de la corde (repere ecran, y vers le bas) ;
 * 0 donne un glissement rectiligne.
 */
async function glisser(fleche, { depart = { x: 360, y: 1080 }, arrivee = { x: 360, y: 700 }, pas = 14 } = {}) {
  const dx = arrivee.x - depart.x;
  const dy = arrivee.y - depart.y;
  const longueur = Math.hypot(dx, dy);
  const nx = -dy / longueur;
  const ny = dx / longueur;

  const p0 = ecran(depart.x, depart.y);
  await page.mouse.move(p0.x, p0.y);
  await page.mouse.down();
  for (let i = 1; i <= pas; i += 1) {
    const t = i / pas;
    const ecart = fleche * 4 * t * (1 - t);
    const p = ecran(depart.x + dx * t + nx * ecart, depart.y + dy * t + ny * ecart);
    await page.mouse.move(p.x, p.y);
  }
  return { relacher: () => page.mouse.up() };
}

/** Pose un enregistreur de trajectoire dans la page, avant le lancer. */
const armerEnregistreur = () =>
  page.evaluate(() => {
    const scene = window.__kubb.scene.getScene('MatchScene');
    // Un numero de generation : sans lui, les enregistreurs des lancers
    // precedents tournent encore et continuent d'ecrire dans le releve.
    const moi = (window.__gen = (window.__gen ?? 0) + 1);
    window.__trajet = [];
    const tick = () => {
      if (window.__gen !== moi) return;
      if (scene.baton) {
        const b = scene.baton.sprite;
        window.__trajet.push({ x: b.x, y: b.y, vx: b.body?.velocity.x ?? 0, vy: b.body?.velocity.y ?? 0 });
      }
      if (window.__trajet.length < 900) requestAnimationFrame(tick);
    };
    requestAnimationFrame(tick);
  });

/** Un lancer complet : geste, relachement, attente de l'immobilisation. */
async function lancerAvecGeste(fleche) {
  await page.evaluate(() => {
    const scene = window.__kubb.scene.getScene('MatchScene');
    // Phase de visee garantie, camp BLEU impose, et terrain degage : on
    // mesure une trajectoire, pas une collision ni un tour de jeu.
    //
    // Imposer le camp est indispensable : au bout de quelques lancers la
    // main passe a rouge, dont le lanceur est en HAUT du terrain — le meme
    // glissement part alors vers l'arriere et se fait brider, et le releve
    // revenait vide sans rien dire.
    scene.activeTeam = 'blue';
    scene.phase = 'aiming';
    // DETRUIRE le baton precedent, pas seulement oublier la reference :
    // orphelin, il restait dans le monde, immobile, et l'enregistreur le
    // suivait en croyant suivre le nouveau. La courbure mesuree valait alors
    // 0 px sur 0 px, et la verification concluait a tort.
    if (scene.baton) scene.baton.destroy();
    scene.baton = null;
    ['blue', 'red'].forEach((t) =>
      scene.teams[t].kubbs.forEach((k) => {
        k.sprite.setVisible(false);
        if (k.sprite.body && k.sprite.body.world) scene.matter.world.remove(k.sprite.body);
      })
    );
    if (scene.king.sprite.body && scene.king.sprite.body.world !== null) {
      try { scene.matter.world.remove(scene.king.sprite.body); } catch { /* deja retire */ }
    }
  });
  await armerEnregistreur();
  const geste = await glisser(fleche);
  const effetLu = await page.evaluate(() => window.__kubb.scene.getScene('MatchScene').aimSpin);
  await geste.relacher();

  for (let i = 0; i < 80; i += 1) {
    const fini = await page.evaluate(() => {
      const scene = window.__kubb.scene.getScene('MatchScene');
      return !scene.baton || scene.phase !== 'flying';
    });
    if (fini) break;
    await page.waitForTimeout(150);
  }
  const trajet = await page.evaluate(() => window.__trajet ?? []);
  // Echec FRANC : un releve vide donnerait une courbure de 0 px, et la
  // verification conclurait a tort que l'effet ne courbe rien.
  if (trajet.length < 6) {
    throw new Error(`Aucune trajectoire enregistree (${trajet.length} releves) — le lancer n'est pas parti.`);
  }
  const parcouru = Math.hypot(trajet[trajet.length - 1].x - trajet[0].x, trajet[trajet.length - 1].y - trajet[0].y);
  if (parcouru < 50) {
    throw new Error(`Le projectile n'a parcouru que ${parcouru.toFixed(0)} px — c'est un baton immobile qu'on a suivi.`);
  }
  return { effetLu, trajet };
}

/**
 * Ecart lateral signe maximal par rapport a la DIRECTION DE DEPART.
 *
 * Surtout pas par rapport a la corde depart -> arrivee : le baton rebondit
 * sur la bande du fond et revient, si bien que cette corde ne designe plus
 * la direction du vol — elle peut meme pointer a l'oppose. Une premiere
 * version mesurait cela, et concluait que la courbe partait du mauvais cote
 * alors que la physique etait juste.
 *
 * On ne regarde donc que l'aller : les releves jusqu'au point le plus
 * eloigne du depart.
 */
function courbure(trajet) {
  if (trajet.length < 6) return { ecart: 0, longueur: 0 };
  const a = trajet[0];
  // Direction de depart : la VITESSE reelle du projectile des son premier releve en mouvement.
  //
  // La premiere version l'estimait a partir de la POSITION des trois premiers releves. Or ces
  // releves sont pris a 20 images par seconde dans un navigateur sans carte graphique : quelques
  // pixels d'erreur sur une base de ~60 px font quelques degres, soit des dizaines de pixels a
  // 800 px. Un tir DROIT « courbait » alors de 70 px, et un vrai demi-effet de 77 px se
  // confondait avec ce bruit. La vitesse, elle, est exacte : c'est ce que Matter vient de donner
  // au baton (deviation aleatoire du lancer comprise), avant que l'effet n'ait agi.
  const mobile = trajet.find((p) => Math.hypot(p.vx ?? 0, p.vy ?? 0) > 5);
  let ux;
  let uy;
  if (mobile) {
    const v = Math.hypot(mobile.vx, mobile.vy);
    ux = mobile.vx / v;
    uy = mobile.vy / v;
  } else {
    // Repli (releves sans vitesse) : direction prise sur les premiers releves.
    const ref = trajet[Math.min(3, trajet.length - 1)];
    const dx = ref.x - a.x;
    const dy = ref.y - a.y;
    const d0 = Math.hypot(dx, dy);
    if (d0 < 1) return { ecart: 0, longueur: 0 };
    ux = dx / d0;
    uy = dy / d0;
  }

  // L'aller seul : on s'arrete au point le plus eloigne du depart.
  let iLoin = 0;
  let distMax = 0;
  trajet.forEach((p, i) => {
    const d = Math.hypot(p.x - a.x, p.y - a.y);
    if (d > distMax) { distMax = d; iLoin = i; }
  });

  let ecart = 0;
  for (let i = 0; i <= iLoin; i += 1) {
    const p = trajet[i];
    const e = ux * (p.y - a.y) - uy * (p.x - a.x);
    if (Math.abs(e) > Math.abs(ecart)) ecart = e;
  }
  return { ecart, longueur: distMax };
}

console.log('\n--- geste rectiligne ---');
const droit = await lancerAvecGeste(0);
const cDroit = courbure(droit.trajet);
console.log(`  effet lu : ${droit.effetLu.toFixed(3)}   ecart lateral : ${cDroit.ecart.toFixed(0)} px sur ${cDroit.longueur.toFixed(0)} px`);

console.log('\n--- geste bombe a gauche ---');
const gauche = await lancerAvecGeste(95);
const cGauche = courbure(gauche.trajet);
console.log(`  effet lu : ${gauche.effetLu.toFixed(3)}   ecart lateral : ${cGauche.ecart.toFixed(0)} px sur ${cGauche.longueur.toFixed(0)} px`);

console.log('\n--- geste bombe a droite ---');
const droite = await lancerAvecGeste(-95);
const cDroite = courbure(droite.trajet);
console.log(`  effet lu : ${droite.effetLu.toFixed(3)}   ecart lateral : ${cDroite.ecart.toFixed(0)} px sur ${cDroite.longueur.toFixed(0)} px`);

// Un pouce PIVOTE : un glissement « droit » l'est rarement tout a fait. Ce
// cas-la reproduit cette legere courbure involontaire — elle doit rendre
// exactement 0, sinon tirer droit deviendrait impossible sur un telephone.
console.log('\n--- geste presque droit (pouce qui pivote) ---');
const presqueDroit = await lancerAvecGeste(14);
const cPresque = courbure(presqueDroit.trajet);
console.log(`  effet lu : ${presqueDroit.effetLu.toFixed(3)}   ecart lateral : ${cPresque.ecart.toFixed(0)} px sur ${cPresque.longueur.toFixed(0)} px`);

console.log('\n--- geste a demi bombe ---');
// Corde de 380 px : 32 px de fleche = 8 % d'arc. C'etait 55 px (14,5 %) quand
// le maximum exigeait 24 % ; avec un maximum a 14 %, ce geste-la sature.
const moyen = await lancerAvecGeste(32);
const cMoyen = courbure(moyen.trajet);
console.log(`  effet lu : ${moyen.effetLu.toFixed(3)}   ecart lateral : ${cMoyen.ecart.toFixed(0)} px sur ${cMoyen.longueur.toFixed(0)} px`);

// Le cas du RETOUR DE JEU : « je n'arrive pas a donner assez de courbe ». Un
// arc ordinaire, tel qu'un pouce le trace sans y penser : ~10 % de la corde.
// Il ne donnait que 0,27 d'effet, parce que le maximum exigeait un arc de
// 24 % — reglage calibre sur un geste SIMULE, jamais sur un pouce.
console.log('\n--- arc ordinaire (10 % de la corde) ---');
const ordinaire = await lancerAvecGeste(38);
const cOrdinaire = courbure(ordinaire.trajet);
console.log(`  effet lu : ${ordinaire.effetLu.toFixed(3)}   ecart lateral : ${cOrdinaire.ecart.toFixed(0)} px sur ${cOrdinaire.longueur.toFixed(0)} px`);

// ---- L'IA ne joue JAMAIS avec de l'effet. Partie solo, on la laisse jouer.
console.log('\n--- l IA tire droit ---');
await page.evaluate(() => window.__kubbStoreApi.getState().setScreen('menu'));
await ouvrirJeu(page);
await lancerDepuisLeMenu(page, /Solo|Contre l/i);
await attendreEcran(page, 'match');
// L'IA ne joue qu'APRES le joueur : il faut reellement jouer des tours, pas
// seulement attendre. Une premiere version se contentait d'attendre et
// n'observait jamais le moindre coup d'IA — elle ne prouvait donc rien.
let coupsIa = [];
for (let tour = 0; tour < 4 && coupsIa.length < 2; tour += 1) {
  await lancer(page, 0.85);
  for (let i = 0; i < 60; i += 1) {
    coupsIa = await page.evaluate(() => {
      const scene = window.__kubb?.scene?.getScene?.('MatchScene');
      if (!scene || !scene.scene.isActive()) return [];
      return scene.record.throws.filter((t) => t.team === 'red').map((t) => t.input.spin);
    });
    if (coupsIa.length >= tour + 1) break;
    await page.waitForTimeout(500);
  }
}
console.log(`  ${coupsIa.length} coup(s) d'IA observes, effets : [${coupsIa.join(', ')}]`);

const resultats = {
  gesteRectiligneSansEffet: droit.effetLu === 0,
  // Le tir droit n'est pas parfaitement droit : la deviation aleatoire de
  // +/-2,5 deg demeure (mesure jusqu'a 59 px sur 815, alors que 0 a 2 px
  // d'autres fois). Une courbe a effet, elle, depasse 200 px : le seuil de
  // 100 px separe les deux sans etre tributaire du tirage.
  trajectoireDroiteQuasiDroite: Math.abs(cDroit.ecart) < 100,

  gesteCourbeDonneUnEffet: Math.abs(gauche.effetLu) > 0.2 && Math.abs(droite.effetLu) > 0.2,
  effetsOpposesPourGestesOpposes: Math.sign(gauche.effetLu) === -Math.sign(droite.effetLu),

  // Le coeur : la trajectoire part DU COTE OU LE DOIGT EST PASSE, et de
  // facon nettement plus marquee que le tir droit.
  courbeDuCoteDuGeste: Math.sign(cGauche.ecart) === Math.sign(gauche.effetLu) && Math.sign(cDroite.ecart) === Math.sign(droite.effetLu),
  courbureBienPlusForteQueLeHasard:
    Math.abs(cGauche.ecart) > Math.abs(cDroit.ecart) * 2 + 20 && Math.abs(cDroite.ecart) > Math.abs(cDroit.ecart) * 2 + 20,
  courburesSymetriques: Math.sign(cGauche.ecart) === -Math.sign(cDroite.ecart),

  // Le controle doit etre GRADUE, pas binaire : un demi-geste donne un demi
  // effet, et une courbe intermediaire. Sans cela, l'effet ne serait qu'un
  // interrupteur a trois positions.
  zoneMorteAbsorbeLePouceQuiPivote: presqueDroit.effetLu === 0,

  // Un arc ordinaire doit DEJA courber nettement : plus de la moitie de
  // l'effet, et un vol franchement courbe (pas quelques pixels de derive).
  arcOrdinaireCourbeVraiment: ordinaire.effetLu > 0.45 && Math.abs(cOrdinaire.ecart) > 90,

  demiGesteDonneUnDemiEffet: moyen.effetLu > 0.15 && moyen.effetLu < 0.85,
  // Une demi-courbe est ENTRE « presque rien » et la courbe pleine, mesuree dans le SENS du geste.
  //
  // La premiere version comparait le demi-geste au tir droit (« plus de 20 px de plus »). Or le tir
  // droit porte la deviation aleatoire du lancer (jusqu'a ~70 px mesures, dans un sens ou dans
  // l'autre) : un vrai demi-effet de 77 px ne depassait pas 70 + 20, et la verification echouait
  // sans que le jeu ait rien de casse. On compare donc a un plancher FIXE, au-dessus du bruit
  // habituel du seul sens utile, et au plafond de la courbe pleine.
  demiGesteDonneUneDemiCourbe: (() => {
    const sens = Math.sign(cGauche.ecart) || 1;
    const moyenne = cMoyen.ecart * sens;
    return moyenne > 30 && moyenne < cGauche.ecart * sens - 20;
  })(),

  iaObservee: coupsIa.length >= 2,
  iaTireToujoursDroit: coupsIa.length >= 2 && coupsIa.every((s) => s === 0),

  aucuneErreurJs: erreurs.length === 0
};

console.log('\n', JSON.stringify(resultats, null, 1));
console.log('Erreurs JS :', erreurs);
const ok = Object.values(resultats).every(Boolean);
console.log('=== OK:', ok, '===');
await navigateur.close();
process.exitCode = ok ? 0 : 1;
