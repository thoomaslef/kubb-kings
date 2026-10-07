/**
 * Vue en miroir : en ligne, chacun se voit EN BAS, face a son adversaire.
 *
 * L'hote tient Bleue (lanceur en bas du terrain) ; l'invite tient Rouge,
 * dont le lanceur est en HAUT. Sans correction, l'invite jouerait a
 * l'envers. La camera de l'invite est donc tournee de 180 degres
 * (rules.ts::isMirroredView) — le monde physique, lui, ne change pas.
 *
 * Ce que les tests unitaires ne voient pas, et que celle-ci prouve :
 *   - la camera de l'invite est tournee, celle de l'hote non ;
 *   - le bas de l'ecran de CHACUN montre son propre camp. Mesure avec la
 *     fonction de conversion de PHASER (`getWorldPoint`), pas avec ma
 *     propre formule : verifier une rotation avec la meme formule que celle
 *     qui l'applique ne prouverait rien ;
 *   - un vrai geste de souris de l'invite — tire vers le HAUT de son ecran —
 *     lance bien vers l'adversaire, dans le monde ;
 *   - les textes flottants sont redresses, et le vent se lit depuis
 *     l'ecran de chacun (nord <-> sud) ;
 *   - le 1v1 local, lui, n'est JAMAIS retourne.
 */
import { attendreEcran, attendreSonTour, conclure, creerSalon, focus, lancer, lancerDepuisLeMenu, lancerNavigateur, ouvrirJeu, rejoindreSalon, surveiller } from './harness.mjs';

const DESIGN = { width: 720, height: 1280 };
const navigateur = await lancerNavigateur();
const contexte = await navigateur.newContext({ viewport: { width: 390, height: 844 } });
const erreurs = [];
const resultats = {};

const hote = await contexte.newPage();
const invite = await contexte.newPage();
surveiller('hote', hote, erreurs);
surveiller('invite', invite, erreurs);
await ouvrirJeu(hote);
await ouvrirJeu(invite);
// Du vent, pour verifier sa lecture depuis chaque ecran.
await hote.evaluate(() => window.__kubbStoreApi.getState().setWindEnabled(true));

const code = await creerSalon(hote);
const inviteEnMatch = await rejoindreSalon(invite, code);
const hoteEnMatch = await attendreEcran(hote, 'match', 120);
if (!inviteEnMatch || !hoteEnMatch) throw new Error('Les deux joueurs ne sont pas entres en match.');
await hote.waitForTimeout(1500);

/** Vue de la scene d'une page : rotation, et monde vu au centre du BAS de l'ecran. */
const vue = (page) =>
  page.evaluate(() => {
    const scene = window.__kubb.scene.getScene('MatchScene');
    const cam = scene.cameras.main;
    const c = document.querySelector('canvas').getBoundingClientRect();
    // Pixel de la page -> pixel du canevas de jeu (taille interne), puis monde, par PHASER.
    const echelle = scene.scale.width / c.width;
    const bas = cam.getWorldPoint((c.width / 2) * echelle, c.height * 0.88 * echelle);
    const haut = cam.getWorldPoint((c.width / 2) * echelle, c.height * 0.12 * echelle);
    return {
      rotation: cam.rotation ?? cam.rotation,
      camp: window.__kubbStoreApi.getState().profileTeam,
      monde: { yBas: bas.y, yHaut: haut.y },
      lanceurs: { blue: scene.throwerSprites.blue.y, red: scene.throwerSprites.red.y },
      vent: document.querySelector('.hud__wind-code')?.textContent ?? null,
      ventScene: scene.wind?.direction ?? null
    };
  });

const vh = await vue(hote);
const vi = await vue(invite);
console.log({ vh, vi });

const proche = (a, b) => Math.abs(a - b) < 220;
resultats.hoteNonTourne = Math.abs(vh.rotation ?? 0) < 0.01;
resultats.inviteTourne = Math.abs((vi.rotation ?? 0) - Math.PI) < 0.01;
resultats.basDeLEcranDeLHoteEstSonCamp = proche(vh.monde.yBas, vh.lanceurs.blue);
resultats.basDeLEcranDeLInviteEstSonCamp = vi.camp === 'red' && proche(vi.monde.yBas, vi.lanceurs.red);
resultats.hautDeLEcranDeLInviteEstLAdversaire = proche(vi.monde.yHaut, vi.lanceurs.blue);

// Le vent : meme vent dans le monde, lu a l'envers sur l'ecran de l'invite.
const oppose = { N: 'S', S: 'N', E: 'W', W: 'E', NE: 'SW', SW: 'NE', NW: 'SE', SE: 'NW' };
resultats.ventPresent = !!vh.ventScene && vh.ventScene === vi.ventScene;
resultats.ventLuDeLHote = vh.vent === vh.ventScene;
resultats.ventLuALEnversParLInvite = vi.vent === oppose[vi.ventScene];

// ---------------------------------------------------------------- un vrai geste de l'invite
// Le tour: l'hote ouvre peut-etre ; il joue alors un coup pour passer la main.
const premier = await hote.evaluate(() => window.__kubb.scene.getScene('MatchScene').activeTeam);
if (premier === 'blue') await lancer(hote, 0.4);
await focus(invite);
if (!(await attendreSonTour(invite))) throw new Error("L'invite n'a jamais eu la main.");

const lancerInvite = await invite.evaluate(() => {
  const scene = window.__kubb.scene.getScene('MatchScene');
  return { x: scene.throwX.red, y: scene.throwerSprites.red.y };
});
const rect = await invite.evaluate(() => {
  const c = document.querySelector('canvas').getBoundingClientRect();
  return { left: c.left, top: c.top, width: c.width, height: c.height };
});
// Position ECRAN du lanceur, donnee par la camera de Phaser (monde -> ecran).
const ecranLanceur = await invite.evaluate(({ x, y }) => {
  const scene = window.__kubb.scene.getScene('MatchScene');
  const cam = scene.cameras.main;
  const c = document.querySelector('canvas').getBoundingClientRect();
  const echelle = scene.scale.width / c.width;
  // Recherche inverse : le pixel dont `getWorldPoint` renvoie le lanceur.
  let meilleur = { d: 1e9, px: 0, py: 0 };
  for (let py = 0; py < c.height; py += 4) {
    for (let px = 0; px < c.width; px += 4) {
      const w = cam.getWorldPoint(px * echelle, py * echelle);
      const d = Math.hypot(w.x - x, w.y - y);
      if (d < meilleur.d) meilleur = { d, px, py };
    }
  }
  return meilleur;
}, lancerInvite);

resultats.lanceurDeLInviteEstEnBasDeLEcran = ecranLanceur.py > rect.height * 0.6;

// Tirer vers le HAUT de l'ecran : un glissement de 300 px, comme un pouce.
await invite.mouse.move(rect.left + ecranLanceur.px, rect.top + ecranLanceur.py);
await invite.mouse.down();
for (let i = 1; i <= 12; i += 1) {
  await invite.mouse.move(rect.left + ecranLanceur.px, rect.top + ecranLanceur.py - (i * 240) / 12);
}
const visee = await invite.evaluate(() => {
  const scene = window.__kubb.scene.getScene('MatchScene');
  return { angle: scene.aimAngle, puissance: scene.aimPower };
});
await invite.mouse.up();
await invite.waitForTimeout(200);
const vitesse = await invite.evaluate(() => {
  const scene = window.__kubb.scene.getScene('MatchScene');
  const b = scene.baton?.sprite?.body;
  return b ? { vx: b.velocity.x, vy: b.velocity.y } : null;
});
console.log({ ecranLanceur, visee, vitesse });
resultats.leGesteViseLAdversaire = !!vitesse && vitesse.vy > 3 && Math.abs(vitesse.vx) < Math.abs(vitesse.vy);
resultats.lAngleDeViseeEstVersLeBasDuMonde = visee.puissance > 0.1 && Math.sin(visee.angle) > 0.5;

// ---------------------------------------------------------------- texte redresse
const texte = await invite.evaluate(() => {
  const scene = window.__kubb.scene.getScene('MatchScene');
  const avant = scene.children.list.length;
  scene.juice.floatingText(360, 640, 'TEST', '#ffffff');
  const t = scene.children.list.filter((o) => o.type === 'Text' && o.text === 'TEST').pop();
  return t ? { rotation: t.rotation } : null;
});
resultats.texteFlottantRedresse = // Phaser ramene la rotation dans ]-PI ; PI] : un demi-tour vaut PI ou -PI.
  !!texte && Math.abs(Math.abs(texte.rotation) - Math.PI) < 0.01;
const texteHote = await hote.evaluate(() => {
  const scene = window.__kubb.scene.getScene('MatchScene');
  scene.juice.floatingText(360, 640, 'TEST', '#ffffff');
  const t = scene.children.list.filter((o) => o.type === 'Text' && o.text === 'TEST').pop();
  return t ? { rotation: t.rotation } : null;
});
resultats.texteDeLHoteNonTourne = !!texteHote && Math.abs(texteHote.rotation) < 0.01;

await hote.close();
await invite.close();

// ---------------------------------------------------------------- le 1v1 local n'est jamais retourne
const local = await contexte.newPage();
surveiller('local', local, erreurs);
await ouvrirJeu(local);
await lancerDepuisLeMenu(local, /1v1|1 contre 1/i);
await attendreEcran(local, 'match');
await local.waitForTimeout(1200);
const rotLocal = await local.evaluate(() => window.__kubb.scene.getScene('MatchScene').cameras.main.rotation);
resultats.le1v1LocalNEstPasRetourne = Math.abs(rotLocal) < 0.01;

conclure(resultats, erreurs);
await navigateur.close();
