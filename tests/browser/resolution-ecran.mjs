/**
 * Le jeu dessine-t-il VRAIMENT a la definition de l'ecran, et sans rien
 * casser au passage ?
 *
 * POURQUOI CETTE VERIFICATION EXISTE. Les onze autres tournent au
 * `deviceScaleFactor` par defaut de Playwright, c'est-a-dire 1 — or a 1, le
 * facteur de rendu vaut 1 et TOUT le code introduit pour la haute
 * resolution est inerte. Trois defauts bien reels sont ainsi passes : le
 * bandeau de passage de tour ecrivait son texte a x=720, hors du cadre
 * visible ; la chute du roi ramenait le zoom a 1 et divisait donc le terrain
 * par deux, definitivement ; et les textes flottants n'etaient plus bornes.
 * Aucun n'etait visible a DPR 1. Elle tourne donc a DPR 3, comme un
 * telephone.
 *
 * Elle mesure deux familles de choses :
 *   - la NETTETE : combien de pixels physiques couvre un pixel de texture.
 *     Au-dessus de 1, l'image est etiree, donc floue. C'etait 1,625 avant
 *     que les textures soient generees a la resolution de l'ecran, et ce
 *     chiffre n'avait PAS bouge quand seul le tampon de rendu l'a ete : le
 *     zoom de la camera annulait exactement le gain.
 *   - la NON-REGRESSION PHYSIQUE : compenser la resolution des textures par
 *     l'echelle des sprites redimensionne aussi les corps Matter (c'est le
 *     piege de `setScale` sur une image Matter). Les hitboxes sont donc
 *     mesurees ici, sur l'ecran dense ou le probleme se poserait.
 */
import { focus, lancerNavigateur, URL as JEU } from './harness.mjs';

const DESIGN = { width: 720, height: 1280 };
const HITBOX = { kubb: 36, kingRadius: 20, batonWidth: 14, batonLength: 62 };
const SHADOW_SCALE = { kubb: 1.05, king: 1.2 };

const proche = (a, b, tol = 0.6) => Math.abs(a - b) <= tol;

const navigateur = await lancerNavigateur();
const erreurs = [];
const releves = {};

for (const dpr of [1, 3]) {
  const contexte = await navigateur.newContext({
    viewport: { width: 390, height: 844 },
    deviceScaleFactor: dpr
  });
  const page = await contexte.newPage();
  // Page au premier plan, sinon Chromium ralentit son horloge d'un facteur
  // quatre et un `delayedCall` de 520 ms de temps de jeu n'arrive pas en deux
  // secondes de temps reel (cf. harness.mjs).
  await focus(page);
  page.on('pageerror', (e) => erreurs.push(`dpr${dpr} / ${e.message}`));
  page.on('console', (m) => {
    if (m.type() === 'error') erreurs.push(`dpr${dpr} / console: ${m.text()}`);
  });

  await page.goto(JEU);
  await page.evaluate(() => {
    localStorage.setItem('kubb-kings.tutorial-done', '1');
    localStorage.setItem('kubb-kings.lang', 'fr');
  });
  await page.reload();
  await page.waitForFunction(() => window.__kubbStoreApi?.getState().screen === 'menu', null, { timeout: 30000 });

  // Mode Solo, puis l'ecran de choix du terrain.
  await page.locator('button', { hasText: /Solo|Contre l/i }).first().click();
  await page.waitForSelector('.map-grid', { timeout: 20000 });
  await page.locator('.map-actions .btn--primary').first().click();
  await page.waitForFunction(() => window.__kubbStoreApi.getState().screen === 'match', null, { timeout: 30000 });
  await page.waitForTimeout(1200);

  const m = await page.evaluate(() => {
    const jeu = window.__kubb;
    const scene = jeu.scene.getScene('MatchScene');
    const cam = scene.cameras.main;
    const taille = (cle) => {
      const src = jeu.textures.get(cle).source[0];
      return [src.width, src.height];
    };
    const dims = (corps) => [
      corps.bounds.max.x - corps.bounds.min.x,
      corps.bounds.max.y - corps.bounds.min.y
    ];

    const kubb = scene.teams.blue.kubbs[0];
    const sol = scene.children.list.find((o) => o.type === 'TileSprite');
    const ombres = scene.children.list.filter((o) => o.type === 'Image' && o.texture.key === 'shadow');
    const lanceur = scene.children.list.find((o) => o.type === 'Image' && o.texture.key.startsWith('thrower-'));

    return {
      dpr: window.devicePixelRatio,
      tampon: [jeu.canvas.width, jeu.canvas.height],
      css: [jeu.canvas.clientWidth, jeu.canvas.clientHeight],
      zoomCamera: cam.zoom,
      texKubb: taille('kubb-blue-bois'),
      texHerbe: taille('grass'),
      texRoi: taille('king-or'),
      // Tailles AFFICHEES, en unites de design : c'est ce qui attrape un
      // sprite dont on aurait oublie de compenser l'echelle.
      afficheKubb: [kubb.sprite.displayWidth, kubb.sprite.displayHeight],
      afficheRoi: [scene.king.sprite.displayWidth, scene.king.sprite.displayHeight],
      afficheOmbreKubb: ombres.length ? ombres[0].displayWidth : null,
      afficheLanceur: lanceur ? lanceur.displayWidth : null,
      echelleTuileSol: sol ? sol.tileScaleX : null,
      // Corps Matter : ne doivent RIEN devoir a la resolution de l'ecran.
      corpsKubb: dims(kubb.sprite.body),
      masseKubb: kubb.sprite.body.mass,
      rayonRoi: scene.king.sprite.body.circleRadius
    };
  });

  // Bandeau de passage de tour : son texte doit tomber DANS le cadre visible.
  //
  // La largeur n'est pas fournie ici, et c'est le point : une premiere
  // version la passait elle-meme, si bien qu'elle ne verifiait que le
  // centrage interne du bandeau — la mutation qui remettait
  // `this.scale.width` cote appelant ne la faisait pas broncher. Le
  // parametre a donc disparu de `turnBanner` (cf. juice.ts).
  const bandeau = await page.evaluate(() => {
    const scene = window.__kubb.scene.getScene('MatchScene');
    scene.juice.turnBanner('TEST', 0xffffff, 640);
    const conteneur = scene.children.list.filter((o) => o.type === 'Container').pop();
    const texte = conteneur.list.find((o) => o.type === 'Text');
    // `xMonde` suffit a prouver la largeur retenue : le texte est pose a
    // `width / 2`. (Le cadre englobant du conteneur ne dirait rien de la
    // barre : un Graphics n'en fournit pas, il serait donc exclu du calcul.)
    return { xMonde: conteneur.x + texte.x, resolutionTexte: texte.style.resolution };
  });

  // Texte flottant : borne dans le cadre, quel que soit le point d'origine.
  const flottant = await page.evaluate(() => {
    const scene = window.__kubb.scene.getScene('MatchScene');
    scene.juice.floatingText(9999, 9999, 'X', '#fff');
    const t = scene.children.list.filter((o) => o.type === 'Text').pop();
    return { x: t.x, y: t.y };
  });

  // Les kubbs qui CHANGENT de corps en cours de partie : replante en champ
  // (Kubb.plantInField recree un corps puis l'anime) et redresse en
  // demi-taille (reviveUp, recompense du ricochet). Mesurer le seul kubb pose
  // au demarrage ne suffisait pas, et c'est ainsi qu'un defaut est passe : la
  // compensation de resolution etait appliquee une seconde fois au "pop" du
  // replantage, et la hitbox doublait — sur ecran dense uniquement.
  await page.evaluate(() => {
    const scene = window.__kubb.scene.getScene('MatchScene');
    scene.teams.blue.kubbs[1].plantInField(scene, 300, 800);
    const redresse = scene.teams.blue.kubbs[2];
    redresse.knockDown(scene);
    redresse.reviveUp(scene, true);
  });
  // Le replantage s'accompagne d'un "pop" (0,6 -> 1) qui redimensionne le
  // corps pendant son animation : mesurer tout de suite donnerait 21,6 au
  // lieu de 36, des deux cotes, et ne dirait rien. On attend donc la FIN de
  // l'animation plutot que de forcer la valeur attendue.
  await page.waitForFunction(
    () => {
      const scene = window.__kubb.scene.getScene('MatchScene');
      return scene.tweens.getTweensOf(scene.teams.blue.kubbs[1].sprite).length === 0;
    },
    null,
    { timeout: 60000 }
  );
  const corpsRecrees = await page.evaluate(() => {
    const scene = window.__kubb.scene.getScene('MatchScene');
    const cote = (k) => +(k.sprite.body.bounds.max.x - k.sprite.body.bounds.min.x).toFixed(3);
    const redresse = scene.teams.blue.kubbs[2];
    return {
      champ: cote(scene.teams.blue.kubbs[1]),
      redresse: cote(redresse),
      afficheRedresse: redresse.sprite.displayWidth
    };
  });

  // Post-traitement WebGL : la vignette de camera, et le halo du roi qui
  // s'allume quand il devient une cible legale. Tous deux silencieusement
  // absents en rendu Canvas — on verifie donc d'abord qu'on est bien en
  // WebGL, sinon la verification ne prouverait rien.
  const fx = await page.evaluate(() => {
    const scene = window.__kubb.scene.getScene('MatchScene');
    const avant = scene.king.sprite.preFX?.list.length ?? -1;
    scene.king.setTargetGlow(true);
    const allume = scene.king.sprite.preFX?.list.length ?? -1;
    scene.king.setTargetGlow(false);
    const eteint = scene.king.sprite.preFX?.list.length ?? -1;
    return {
      webgl: window.__kubb.renderer.type === Phaser.WEBGL,
      // Sur une CAMERA, `postFX.addVignette` installe un pipeline, pas un
      // controleur : `postFX.list` reste vide et ne prouve rien. C'est
      // `postPipelines` qu'il faut lire, ou le pipeline porte le numero de
      // l'effet comme nom.
      vignettes: scene.cameras.main.postPipelines.filter((p) => String(p.name) === String(Phaser.FX.VIGNETTE))
        .length,
      haloAvant: avant,
      haloAllume: allume,
      haloEteint: eteint
    };
  });

  // Chute du roi : le coup de zoom doit REVENIR au zoom de base.
  //
  // Mesure AVANT tout lancer, et c'est important : un vrai lancer peut
  // terminer la partie, la scene s'arrete alors et son horloge avec elle —
  // le `delayedCall` qui ramene le zoom ne se declenche jamais et la
  // verification echoue une fois sur quelques-unes, pour une raison qui n'a
  // rien a voir avec ce qu'elle mesure. (`juice.kingFall` est purement
  // cosmetique : il ne termine aucune partie a lui seul.)
  await page.evaluate(() => window.__kubb.scene.getScene('MatchScene').juice.kingFall(360, 640, true));
  // On attend la CONDITION (le zoom revenu a sa valeur de base), pas une
  // duree choisie a la main. Et le plafond est genereux : l'atelier rend en
  // logiciel, sans GPU, et tombe a ~3 images par seconde a 1440x2560, si
  // bien que la sequence de 1 060 ms de temps de JEU (coup de zoom, attente,
  // retour) prend une vingtaine de secondes de temps reel ici. Sur un
  // telephone, qui rend a cette definition nativement, c'est immediat.
  const base = Math.min(2, Math.max(1, dpr));
  const apresChute = await (async () => {
    let dernier = null;
    for (let i = 0; i < 160; i += 1) {
      dernier = await page.evaluate(() => {
        const scene = window.__kubb.scene.getScene('MatchScene');
        return {
          zoom: scene.cameras.main.zoom,
          enCours: scene.cameras.main.zoomEffect.isRunning,
          sceneVivante: scene.scene.isActive()
        };
      });
      if (!dernier.enCours && Math.abs(dernier.zoom - base) < 0.02) return dernier;
      await page.waitForTimeout(500);
    }
    return dernier;
  })();

  // Un lancer reel, pour avoir un baton en vol et mesurer son corps.
  //
  // Le baton tourne en vol : son cadre englobant depend donc de son angle et
  // ne peut rien prouver. On compare l'AIRE du corps, qui n'en depend pas.
  const baton = await page.evaluate(() => {
    const scene = window.__kubb.scene.getScene('MatchScene');
    scene.throwX[scene.activeTeam] = 120;
    scene.aimAngle = scene.forwardAngle();
    scene.aimPower = 0.5;
    scene.launch();
    const b = scene.baton.sprite.body;
    return {
      aire: b.area,
      masse: b.mass,
      affiche: [scene.baton.sprite.displayWidth, scene.baton.sprite.displayHeight]
    };
  });

  const facteur = base;
  // Un pixel de design couvre tant de pixels physiques (c'est l'ecran).
  const designVersPhysique = (m.css[0] * dpr) / (m.tampon[0] / m.zoomCamera);
  // Et un pixel de TEXTURE ? Mesure sur une piece REELLE : sa taille
  // affichee en unites de design, convertie en pixels physiques, divisee
  // par le nombre de pixels que sa texture contient vraiment.
  //
  // Le calculer depuis le facteur attendu serait sans valeur : une premiere
  // version faisait exactement cela, et la mutation « textures generees a la
  // taille de design » ne l'a pas fait broncher — elle mesurait une
  // intention, pas le resultat.
  const pixelsParTexel = (m.afficheKubb[0] * designVersPhysique) / m.texKubb[0];

  releves[dpr] = { ...m, baton, bandeau, flottant, corpsRecrees, fx, apresChute, facteur, designVersPhysique, pixelsParTexel };

  console.log(`\n=== deviceScaleFactor ${dpr} (facteur attendu : ${facteur}) ===`);
  console.log(`  tampon ${m.tampon.join('x')} sur ${m.css.join('x')} css   zoom camera ${m.zoomCamera}`);
  console.log(`  texture kubb ${m.texKubb.join('x')}   herbe ${m.texHerbe.join('x')}   roi ${m.texRoi.join('x')}`);
  console.log(`  affichage kubb ${m.afficheKubb.map((v) => v.toFixed(1)).join('x')}   roi ${m.afficheRoi.map((v) => v.toFixed(1)).join('x')}   lanceur ${m.afficheLanceur}`);
  console.log(`  corps kubb ${m.corpsKubb.map((v) => v.toFixed(2)).join('x')} (attendu ${HITBOX.kubb})   masse ${m.masseKubb.toFixed(3)}   rayon roi ${m.rayonRoi}`);
  console.log(`  baton : aire ${baton.aire.toFixed(2)}   masse ${baton.masse.toFixed(3)}   affiche ${baton.affiche.map((v) => v.toFixed(1)).join('x')}`);
  console.log(`  bandeau texte x=${bandeau.xMonde}   flottant ${JSON.stringify(flottant)}   zoom apres chute du roi ${apresChute.zoom} (scene vivante : ${apresChute.sceneVivante})`);
  console.log(`  corps recrees : kubb de champ ${corpsRecrees.champ} (attendu ${HITBOX.kubb})   redresse en demi-taille ${corpsRecrees.redresse} (attendu ${HITBOX.kubb / 2})`);
  console.log(`  post-traitement : webgl ${fx.webgl}   vignettes camera ${fx.vignettes}   halo roi ${fx.haloAvant}->${fx.haloAllume}->${fx.haloEteint}`);
  console.log(`  NETTETE : 1 pixel de design = ${designVersPhysique.toFixed(3)} px physiques, 1 pixel de TEXTURE = ${pixelsParTexel.toFixed(3)} px physiques`);

  await page.close();
  await contexte.close();
}

const d1 = releves[1];
const d3 = releves[3];

const resultats = {
  // ---- le facteur est bien pris en compte, et plafonne
  zoomSuitLeFacteur: d1.zoomCamera === 1 && d3.zoomCamera === 2,
  tamponSuitLeFacteur: d1.tampon[0] === 720 && d3.tampon[0] === 1440,

  // ---- les TEXTURES suivent, elles aussi : c'est la moitie qui manquait
  textureKubbSuitLeFacteur: d1.texKubb[0] === 40 && d3.texKubb[0] === 80,
  textureHerbeSuitLeFacteur: d1.texHerbe[0] === 128 && d3.texHerbe[0] === 256,
  textureRoiSuitLeFacteur: d1.texRoi[0] === 52 && d3.texRoi[0] === 104,
  texteRenduFinement: d1.bandeau.resolutionTexte === 1 && d3.bandeau.resolutionTexte === 2,

  // ---- un pixel de texture ne doit plus etre etire. 1,625 avant.
  netteteGagnee: d3.pixelsParTexel <= 1.05,
  // ... sans que la geometrie du monde ait bouge d'un pixel.
  memeGeometrieDeDesign: proche(d1.designVersPhysique * 3, d3.designVersPhysique * 1, 0.01)
    || proche(d1.designVersPhysique, d3.designVersPhysique / 3, 0.01),

  // ---- tailles AFFICHEES identiques des deux cotes, en unites de design
  kubbMemeTailleAffichee:
    proche(d1.afficheKubb[0], d3.afficheKubb[0]) && proche(d1.afficheKubb[0], 40 * (HITBOX.kubb / 36)),
  roiMemeTailleAffichee: proche(d1.afficheRoi[0], d3.afficheRoi[0]) && proche(d1.afficheRoi[0], 52),
  ombreMemeTailleAffichee:
    proche(d1.afficheOmbreKubb, d3.afficheOmbreKubb) && proche(d1.afficheOmbreKubb, 56 * SHADOW_SCALE.kubb),
  lanceurMemeTailleAffichee: proche(d1.afficheLanceur, d3.afficheLanceur) && proche(d1.afficheLanceur, 40),
  batonMemeTailleAffichee: proche(d1.baton.affiche[0], d3.baton.affiche[0]) && proche(d1.baton.affiche[0], 16),
  solMemeMotif: d1.echelleTuileSol === 1 && d3.echelleTuileSol === 0.5,

  // ---- LES HITBOXES NE BOUGENT PAS. C'est ce qui rendait la compensation
  //      par l'echelle des sprites dangereuse.
  corpsKubbIntact:
    proche(d1.corpsKubb[0], HITBOX.kubb, 0.01) && proche(d3.corpsKubb[0], HITBOX.kubb, 0.01),
  masseKubbIntacte: proche(d1.masseKubb, d3.masseKubb, 0.001),
  rayonRoiIntact: d1.rayonRoi === HITBOX.kingRadius && d3.rayonRoi === HITBOX.kingRadius,
  corpsBatonIntact:
    proche(d1.baton.aire, d3.baton.aire, 0.01) && proche(d1.baton.masse, d3.baton.masse, 0.001),

  // ---- les trois regressions mesurees avant correction
  bandeauDansLeCadre: d1.bandeau.xMonde === DESIGN.width / 2 && d3.bandeau.xMonde === DESIGN.width / 2,
  flottantBorne:
    d1.flottant.x <= DESIGN.width - 180 &&
    d3.flottant.x <= DESIGN.width - 180 &&
    d3.flottant.y <= DESIGN.height - 90,
  zoomRetabliApresChuteDuRoi:
    d1.apresChute.sceneVivante &&
    d3.apresChute.sceneVivante &&
    proche(d1.apresChute.zoom, 1, 0.02) &&
    proche(d3.apresChute.zoom, 2, 0.02),

  corpsKubbDeChampIntact: [d1, d3].every((d) => proche(d.corpsRecrees.champ, HITBOX.kubb, 0.01)),
  corpsKubbRedresseIntact: [d1, d3].every((d) => proche(d.corpsRecrees.redresse, HITBOX.kubb / 2, 0.01)),
  kubbRedresseAfficheEnDemiTaille: [d1, d3].every((d) => proche(d.corpsRecrees.afficheRedresse, 20)),

  // ---- post-traitement WebGL
  renduWebgl: d1.fx.webgl && d3.fx.webgl,
  vignetteDeCamera: d1.fx.vignettes === 1 && d3.fx.vignettes === 1,
  haloDuRoiSAllumeEtSEteint: [d1.fx, d3.fx].every(
    (f) => f.haloAvant === 0 && f.haloAllume === 1 && f.haloEteint === 0
  ),

  aucuneErreurJs: erreurs.length === 0
};

console.log('\n', JSON.stringify(resultats, null, 1));
console.log('Erreurs JS :', erreurs);
const ok = Object.values(resultats).every(Boolean);
console.log('=== OK:', ok, '===');
await navigateur.close();
process.exitCode = ok ? 0 : 1;
