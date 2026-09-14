import type { Lang } from './translate';

/**
 * Toutes les chaines affichees au joueur, en francais (langue d'origine du
 * jeu) et en anglais. Cles a plat, namespacees par ecran ou par donnee
 * (difficulty.*, terrain.*, skin.*, team.*, perk.* : ex-libelles deplaces
 * ici depuis ai.ts/rules.ts/theme.ts/teamData.ts/roguelite.ts, qui ne
 * gardent que les donnees fonctionnelles).
 *
 * Les pages legales (public/legal/*.html, src/ui/Legal.tsx) restent
 * volontairement en francais uniquement : droit francais applicable,
 * identite reelle de l'editeur — pas un choix a faire dependre de la
 * langue d'affichage du jeu.
 */

const fr: Record<string, string> = {
  // ---- menu
  'menu.subtitle': 'Le duel de lancer, sur un seul telephone.',
  'menu.solo': "Solo — contre l'IA",
  'menu.aiLevelAria': "Niveau de l'IA",
  'menu.local1v1': '1v1 local — a deux',
  'menu.local2v2': '2v2 local — a quatre',
  'menu.defi': 'Defi — {n} manches, de plus en plus dures',
  'menu.tournament': 'Tournoi local — 4 ou 8 joueurs',
  'menu.bestStage.one': 'Meilleure serie : {stage}/{total} manche franchie',
  'menu.bestStage.many': 'Meilleure serie : {stage}/{total} manches franchies',
  'menu.terrainAria': 'Terrain',
  'menu.windAria': 'Meteo',
  'menu.windOff': 'Sans vent',
  'menu.windOn': 'Avec vent',
  'menu.windOnHint':
    "Une brise devie les lancers — direction (8 sens) et force (1 ou 2) tirees au debut de chaque partie, affichees clairement en jeu",
  'menu.windOffHint': 'Terrain calme',
  'menu.skinAria': 'Skin des kubbs',
  'menu.batonAria': 'Baton',
  'menu.langAria': 'Langue',
  'menu.rules': 'Regles',
  'menu.quit': 'Quitter',
  'menu.footer': 'Pass-and-play · 4 minutes max',
  'menu.about': 'A propos',
  'menu.legal': 'Confidentialite & mentions legales',

  // ---- difficulty (ai.ts)
  'difficulty.facile.label': 'Facile',
  'difficulty.facile.hint': 'Vise large, dose au hasard',
  'difficulty.moyen.label': 'Moyen',
  'difficulty.moyen.hint': 'Correct, mais gache des lancers',
  'difficulty.difficile.label': 'Difficile',
  'difficulty.difficile.hint': 'Ne gache presque rien',

  // ---- terrain (rules.ts FIELD_PRESETS)
  'terrain.classique.label': 'Classique',
  'terrain.classique.hint': 'Terrain nu',
  'terrain.chicane.label': 'Chicane',
  'terrain.chicane.hint': "Deux rochers en S, hors de l'axe",
  'terrain.sentinelle.label': 'Sentinelle',
  'terrain.sentinelle.hint': 'Le roi, garde des deux cotes',

  // ---- skin (theme.ts)
  'skin.bois.label': 'Bois',
  'skin.bois.hint': "Le look d'origine, brut de sciage",
  'skin.marbre.label': 'Marbre',
  'skin.marbre.hint': 'Blocs en pierre veinee',
  'skin.metal.label': 'Metal',
  'skin.metal.hint': 'Blocs metalliques et reflets nets',
  'skin.ardoise.label': 'Ardoise',
  'skin.ardoise.hint': 'Pierre sombre fracturee (boutique)',

  // ---- baton (batons.ts) — n'affecte que le joueur, jamais l'IA
  'baton.base.label': 'De base',
  'baton.nordique.label': 'Nordique',
  'baton.sniper.label': 'Sniper',
  'baton.lourd.label': 'Lourd',
  'baton.stabilise.label': 'Stabilise',
  'baton.statPower': 'Puissance',
  'baton.statPrecision': 'Precision',
  'baton.statControl': 'Controle',

  // ---- effet de lancer (throwEffects.ts) — feu/glace sont des articles de boutique
  'effect.none.label': 'Aucun',
  'effect.none.hint': 'Trainee couleur du baton',
  'effect.feu.label': 'Feu',
  'effect.feu.hint': 'Trainee orange incandescente (boutique)',
  'effect.glace.label': 'Glace',
  'effect.glace.hint': 'Trainee bleu glacial (boutique)',

  // ---- Boutique (shop.ts) — Phase 3 de la progression
  'shop.title': 'Boutique',
  'shop.intro': 'Achetez de nouveaux habillages avec les pieces gagnees en match.',
  'shop.balance': '{n} pieces',
  'shop.category.skin': 'Skins de kubbs',
  'shop.category.trail': 'Effets de lancer',
  'shop.category.baton': 'Batons',
  'shop.owned': 'Possede',
  'shop.buy': 'Acheter — {price} 🪙',
  'shop.cantAfford': 'Pieces insuffisantes',
  'shop.back': 'Retour',
  'menu.shop': 'Boutique',
  'menu.effectAria': 'Effet de lancer',
  'menu.coinsAria': '{n} pieces',

  // ---- Succes (achievements.ts) — Phase 4 de la progression
  'achievement.unlocked': 'SUCCES DEBLOQUE :',
  'achievement.double.label': 'Double',
  'achievement.double.hint': 'Faire tomber 2 kubbs (ou plus) avec un seul lancer',
  'achievement.triple.label': 'Triple',
  'achievement.triple.hint': 'Faire tomber exactement 3 kubbs avec un seul lancer',
  'achievement.perfect.label': 'Perfect',
  'achievement.perfect.hint': 'Faire tomber 4 kubbs ou plus avec un seul lancer',
  'achievement.kubb-eloigne.label': 'Longue distance',
  'achievement.kubb-eloigne.hint': "Faire tomber le kubb adverse le plus eloigne de votre lancer",
  'achievement.ricochet.label': 'Ricochet',
  'achievement.ricochet.hint': 'Redresser un de vos kubbs grace a un tir indirect (rebond sur une bande)',
  'achievement.sans-faute.label': 'Sans-faute',
  'achievement.sans-faute.hint': 'Gagner une partie sans rater un seul lancer',
  'achievement.victoire-parfaite.label': 'Victoire parfaite',
  'achievement.victoire-parfaite.hint': "Gagner une partie sans perdre un seul de vos kubbs",
  'achievement.roi-dernier-lancer.label': 'Coup de grace',
  'achievement.roi-dernier-lancer.hint': 'Faire tomber le roi sur votre tout dernier lancer',
  'achievements.title': 'Succes',
  'achievements.intro': 'Des defis ponctuels a realiser en partie, debloques une seule fois.',
  'achievements.reward': '+{xp} XP · +{coins} 🪙',
  'achievements.earned': 'Debloque',
  'achievements.locked': 'A realiser',
  'achievements.back': 'Retour',
  'menu.achievements': 'Succes',
  'result.achievementUnlocked': '🏆 Succes : {label}',

  // ---- progression (progression.ts) — niveau/XP, Phase 2 de la progression
  'progression.title.debutant': 'Lanceur debutant',
  'progression.title.amateur': 'Lanceur amateur',
  'progression.title.confirme': 'Lanceur confirme',
  'progression.title.elite': "Tireur d'elite",
  'progression.title.maitre': 'Maitre du Kubb',
  'progression.title.legende': 'Legende du terrain',
  'progression.level': 'Niveau {n}',
  'progression.xpGained': '+{n} XP',
  'progression.levelUp': 'NIVEAU SUPERIEUR !',

  // ---- team (teamData.ts)
  'team.blue.label': 'Bleue',
  'team.red.label': 'Rouge',

  // ---- perk (roguelite.ts)
  'perk.lancer-bonus.label': 'Bras infatigable',
  'perk.lancer-bonus.description': '+{n} lancers sur toute la manche',
  'perk.bras-vif.label': 'Bras vif',
  'perk.bras-vif.description': '+{pct}% de puissance au bout du glissement',
  'perk.second-souffle.label': 'Second souffle',
  'perk.second-souffle.description': "Le premier lancer qui ne renverse rien n'est pas compte",

  // ---- HUD
  'hud.ai': 'IA',
  'hud.player2v2': '{team} J{n}',
  'hud.stageTag': ' · Manche {n}/{total}',
  'hud.windAria': 'Vent : {direction}, force {force}',
  'wind.dir.N': 'Nord',
  'wind.dir.NE': 'Nord-Est',
  'wind.dir.E': 'Est',
  'wind.dir.SE': 'Sud-Est',
  'wind.dir.S': 'Sud',
  'wind.dir.SW': 'Sud-Ouest',
  'wind.dir.W': 'Ouest',
  'wind.dir.NW': 'Nord-Ouest',
  'hud.kubbs': 'kubbs',
  'hud.throws': 'lancers',
  'hud.time': 'temps',
  'hud.muteOn': 'Activer le son',
  'hud.muteOff': 'Couper le son',
  'hud.pause': 'Pause',
  'hud.aiAiming': "L'IA vise…",
  'hud.kingTipExpanded': 'Le roi est a portee : le viser maintenant fait gagner la partie',
  'hud.kingTipShort': 'Le roi est a portee — visez-le pour gagner',
  'hud.openingThrow': "Tir d'ouverture : approchez le roi le plus possible SANS le toucher",
  'hud.resume': 'Reprendre',
  'hud.leaveMatch': 'Quitter la partie',

  // ---- Result screen
  'result.draw': 'Match nul',
  'result.defeat': 'Defaite',
  'result.victory': 'Victoire !',
  'result.teamVictory': "Victoire de l'equipe {team}",
  'result.detail.kingDown': 'Le roi est tombe dans les regles.',
  'result.detail.kingEarly': "L'equipe {team} a touche le roi avant d'avoir abattu tous les kubbs adverses.",
  'result.detail.timeout': "Temps ecoule : le plus grand nombre de kubbs abattus l'emporte.",
  'result.detail.throwsExhausted': "Plus de lancers : le plus grand nombre de kubbs abattus l'emporte.",
  'result.knockedLabel': 'kubbs abattus',
  'result.you': 'Vous',
  'result.ai': 'IA',
  'result.defi.stageCleared': 'Manche {n} franchie !',
  'result.defi.runComplete': 'Run terminee : les {total} manches sont passees. Bravo.',
  'result.defi.runOver.one': 'Run terminee a la manche {stage} — {cleared} manche franchie.',
  'result.defi.runOver.many': 'Run terminee a la manche {stage} — {cleared} manches franchies.',
  'result.defi.abandonRun': 'Abandonner la run',
  'result.defi.nextStage': 'Manche suivante',
  'result.defi.newRun': 'Nouvelle run',
  'result.menu': 'Menu',
  'result.replay': 'Rejouer',
  'result.tournament.win': '{name} remporte ce match !',
  'result.tournament.draw': 'Match nul',
  'result.tournament.replayHint': 'Rejouez ce match pour departager.',
  'result.tournament.seeBracket': 'Voir le tableau',
  'result.tournament.replay': 'Rejouer ce match',
  'result.tournament.forfeit': 'Abandonner le tournoi',
  'result.coinsGained': '+{n} 🪙',

  // ---- Perk choice screen
  'perk.screen.title': 'Choisissez un bonus',
  'perk.screen.subtitle': "Avant la manche {n}/{total} — il reste sur vous jusqu'a la fin de la run.",
  'perk.screen.next': 'Manche suivante…',

  // ---- Quit screen
  'quit.title': 'A bientot',
  'quit.text': "Vous pouvez fermer l'onglet. Sur mobile, l'application se ferme depuis le gestionnaire de taches.",
  'quit.back': 'Revenir au menu',

  // ---- Rules screen
  'rules.title': 'Regles',
  'rules.item1': 'Chaque equipe aligne {n} kubbs sur sa ligne de fond. Un roi unique se tient au centre du terrain.',
  'rules.item2':
    "Les equipes lancent a tour de role, uniquement depuis l'aplomb de l'un de leurs kubbs encore debout : touchez l'un d'eux sur votre ligne, c'est de la que part le baton. Un kubb tombe n'est plus une position de lancer.",
  'rules.item3': "Glissez vers la cible pour donner l'angle, la longueur du glissement donne la puissance. Relachez pour lancer.",
  'rules.item4':
    "Un baton ne fait tomber un kubb que s'il le percute assez fort. Chaque lancer part avec une legere deviation : personne ne vise parfaitement.",
  'rules.item5': 'Un kubb tombe est hors jeu. Quand tous les kubbs adverses sont a terre, vous pouvez viser le roi.',
  'rules.item6':
    "Le roi se tient sur la ligne mediane : contournez-le tant que vous n'avez pas le droit de le viser. Le toucher trop tot = defaite immediate de l'equipe qui a lance.",
  'rules.item7': 'Faire tomber le roi dans les regles = victoire.',
  'rules.item8':
    "Partie limitee a 4 minutes et {n} lancers par equipe. Au buzzer, l'equipe qui a abattu le plus de kubbs l'emporte.",
  'rules.item9':
    "Un tir qui ricoche sur une bande avant d'abattre un kubb adverse redresse en recompense l'un de vos propres kubbs tombes, toujours le plus a gauche.",
  'rules.itemOpening':
    "Avant la partie, chaque equipe tire une fois vers le roi pour savoir qui commence : le plus proche SANS le toucher est prioritaire. Toucher le roi fait perdre ce tirage — sauf si l'adversaire le touche aussi, auquel cas on recommence.",
  'rules.back': 'Retour',
  'rules.replayTutorial': 'Revoir le tutoriel',
  'rules.tutorialWillReplay': 'Reapparaitra a la prochaine partie',

  // ---- Tutorial
  'tutorial.step1': 'Touchez votre ligne pour vous placer',
  'tutorial.step2': 'Glissez vers la cible, relachez pour lancer',
  'tutorial.step3': "Le roi, au centre, est interdit tant que l'adversaire tient debout",
  'tutorial.toast': 'Un lancer par tour — un kubb tombe reste hors jeu.',

  // ---- Tournament
  'tournament.round.final': 'Finale',
  'tournament.round.semifinals': 'Demi-finales',
  'tournament.round.quarterfinals': 'Quarts de finale',
  'tournament.round.n': 'Tour {n}',
  'tournament.setup.title': 'Tournoi local',
  'tournament.setup.intro': 'Elimination directe, pass-and-play : chacun joue sur le meme telephone, a tour de role.',
  'tournament.setup.sizeAria': 'Taille du tournoi',
  'tournament.setup.players': '{n} joueurs',
  'tournament.setup.playerPlaceholder': 'Joueur {n}',
  'tournament.setup.start': 'Commencer le tournoi',
  'tournament.setup.cancel': 'Annuler',
  'tournament.bracket.title': 'Tournoi',
  'tournament.bracket.champion': 'Champion : {name}',
  'tournament.bracket.newTournament': 'Nouveau tournoi',
  'tournament.bracket.menu': 'Menu',
  'tournament.bracket.play': 'Jouer : {a} vs {b}',
  'tournament.bracket.forfeit': 'Abandonner le tournoi',

  // ---- About
  'about.title': 'A propos',
  'about.createdBy': 'Cree par {name}',
  'about.contact': 'Contact : {email}',
  'about.crashLogTitle': "Journal d'erreurs",
  'about.crashLog.none': 'Aucune erreur enregistree sur cet appareil.',
  'about.crashLog.one':
    "1 erreur enregistree sur cet appareil. Si le jeu se comporte mal, copiez ce journal et envoyez-le a l'adresse ci-dessus.",
  'about.crashLog.many':
    "{n} erreurs enregistrees sur cet appareil. Si le jeu se comporte mal, copiez ce journal et envoyez-le a l'adresse ci-dessus.",
  'about.copyLog': 'Copier le journal',
  'about.copied': 'Copie !',
  'about.clearLog': 'Effacer le journal',
  'about.back': 'Retour',

  // ---- Boot
  'boot.loading': 'Chargement…',

  // ---- Error boundary
  'error.title': 'Oups…',
  'error.text':
    "Une erreur inattendue est survenue. Votre progression (meilleure serie, preferences) n'est pas affectee : elle reste enregistree sur cet appareil.",
  'error.reload': 'Recharger le jeu',

  // ---- Match (dessine sur le canevas Phaser, via translate() directement)
  'match.aiTurn': "AU TOUR DE L'IA",
  'match.yourTurn': 'A VOUS DE JOUER',
  'match.teamTurn': "AU TOUR DE L'EQUIPE {team}",
  'match.teamTurnPlayer': '{base} — JOUEUR {n}',
  'match.secondSouffle': 'SECOND SOUFFLE !',
  'match.knockedLast': 'DERNIER !',
  'match.knockedDown': 'ABATTU !',
  'match.kubbRevived': 'KUBB RELEVE !',
  'match.openingTouched': 'TOUCHE !',
  'match.openingBothTouched': 'EGALITE, ON REJOUE !',
  'match.comboGood': 'BON LANCER',
  'match.comboPrecision': 'PRECISION',
  'match.comboDouble': 'DOUBLE',
  'match.comboTriple': 'TRIPLE',
  'match.comboPerfect': 'PERFECT !',
  'match.comboMultiplier': '×{n} COMBO',
  'match.kingFalls': 'LE ROI TOMBE !',
  'match.kingTooEarly': 'ROI TOUCHE TROP TOT'
};

const en: Record<string, string> = {
  // ---- menu
  'menu.subtitle': 'The throwing duel, on a single phone.',
  'menu.solo': 'Solo — vs AI',
  'menu.aiLevelAria': 'AI level',
  'menu.local1v1': 'Local 1v1 — for two',
  'menu.local2v2': 'Local 2v2 — for four',
  'menu.defi': 'Challenge — {n} stages, increasingly hard',
  'menu.tournament': 'Local tournament — 4 or 8 players',
  'menu.bestStage.one': 'Best streak: {stage}/{total} stage cleared',
  'menu.bestStage.many': 'Best streak: {stage}/{total} stages cleared',
  'menu.terrainAria': 'Field',
  'menu.windAria': 'Weather',
  'menu.windOff': 'No wind',
  'menu.windOn': 'With wind',
  'menu.windOnHint':
    'A breeze bends throws — direction (8-way) and force (1 or 2) set at the start of each match, shown clearly in-game',
  'menu.windOffHint': 'Calm field',
  'menu.skinAria': 'Kubb skin',
  'menu.batonAria': 'Baton',
  'menu.langAria': 'Language',
  'menu.rules': 'Rules',
  'menu.quit': 'Quit',
  'menu.footer': 'Pass-and-play · 4 minutes tops',
  'menu.about': 'About',
  'menu.legal': 'Privacy & legal notice',

  // ---- difficulty
  'difficulty.facile.label': 'Easy',
  'difficulty.facile.hint': 'Aims wide, throws at random power',
  'difficulty.moyen.label': 'Medium',
  'difficulty.moyen.hint': 'Decent, but wastes throws',
  'difficulty.difficile.label': 'Hard',
  'difficulty.difficile.hint': 'Wastes almost nothing',

  // ---- terrain
  'terrain.classique.label': 'Classic',
  'terrain.classique.hint': 'Bare field',
  'terrain.chicane.label': 'Chicane',
  'terrain.chicane.hint': 'Two rocks in an S, off the centerline',
  'terrain.sentinelle.label': 'Sentinel',
  'terrain.sentinelle.hint': 'The king, guarded on both sides',

  // ---- skin
  'skin.bois.label': 'Wood',
  'skin.bois.hint': 'The original look, straight off the saw',
  'skin.marbre.label': 'Marble',
  'skin.marbre.hint': 'Veined stone blocks',
  'skin.metal.label': 'Metal',
  'skin.metal.hint': 'Metal blocks with crisp highlights',
  'skin.ardoise.label': 'Slate',
  'skin.ardoise.hint': 'Dark fractured stone (shop)',

  // ---- baton (batons.ts) — affects the player only, never the AI
  'baton.base.label': 'Standard',
  'baton.nordique.label': 'Nordic',
  'baton.sniper.label': 'Sniper',
  'baton.lourd.label': 'Heavy',
  'baton.stabilise.label': 'Steady',
  'baton.statPower': 'Power',
  'baton.statPrecision': 'Precision',
  'baton.statControl': 'Control',

  // ---- throw effect (throwEffects.ts) — feu/glace are shop items
  'effect.none.label': 'None',
  'effect.none.hint': "Trail in the baton's own color",
  'effect.feu.label': 'Fire',
  'effect.feu.hint': 'Glowing orange trail (shop)',
  'effect.glace.label': 'Ice',
  'effect.glace.hint': 'Icy blue trail (shop)',

  // ---- Shop (shop.ts) — progression Phase 3
  'shop.title': 'Shop',
  'shop.intro': 'Buy new looks with the coins earned in matches.',
  'shop.balance': '{n} coins',
  'shop.category.skin': 'Kubb skins',
  'shop.category.trail': 'Throw effects',
  'shop.category.baton': 'Batons',
  'shop.owned': 'Owned',
  'shop.buy': 'Buy — {price} 🪙',
  'shop.cantAfford': 'Not enough coins',
  'shop.back': 'Back',
  'menu.shop': 'Shop',
  'menu.effectAria': 'Throw effect',
  'menu.coinsAria': '{n} coins',

  // ---- Achievements (achievements.ts) — progression Phase 4
  'achievement.unlocked': 'ACHIEVEMENT UNLOCKED:',
  'achievement.double.label': 'Double',
  'achievement.double.hint': 'Knock down 2 kubbs (or more) with a single throw',
  'achievement.triple.label': 'Triple',
  'achievement.triple.hint': 'Knock down exactly 3 kubbs with a single throw',
  'achievement.perfect.label': 'Perfect',
  'achievement.perfect.hint': 'Knock down 4 kubbs or more with a single throw',
  'achievement.kubb-eloigne.label': 'Long shot',
  'achievement.kubb-eloigne.hint': "Knock down the farthest opposing kubb from your throw",
  'achievement.ricochet.label': 'Ricochet',
  'achievement.ricochet.hint': 'Stand a kubb back up via an indirect throw (bounced off a wall)',
  'achievement.sans-faute.label': 'Flawless',
  'achievement.sans-faute.hint': 'Win a match without missing a single throw',
  'achievement.victoire-parfaite.label': 'Perfect victory',
  'achievement.victoire-parfaite.hint': 'Win a match without losing a single one of your kubbs',
  'achievement.roi-dernier-lancer.label': 'Final blow',
  'achievement.roi-dernier-lancer.hint': 'Knock down the king on your very last throw',
  'achievements.title': 'Achievements',
  'achievements.intro': 'One-time challenges to complete in matches, unlocked once each.',
  'achievements.reward': '+{xp} XP · +{coins} 🪙',
  'achievements.earned': 'Unlocked',
  'achievements.locked': 'To do',
  'achievements.back': 'Back',
  'menu.achievements': 'Achievements',
  'result.achievementUnlocked': '🏆 Achievement: {label}',

  // ---- progression (progression.ts) — level/XP, progression Phase 2
  'progression.title.debutant': 'Novice thrower',
  'progression.title.amateur': 'Amateur thrower',
  'progression.title.confirme': 'Seasoned thrower',
  'progression.title.elite': 'Elite marksman',
  'progression.title.maitre': 'Kubb master',
  'progression.title.legende': 'Field legend',
  'progression.level': 'Level {n}',
  'progression.xpGained': '+{n} XP',
  'progression.levelUp': 'LEVEL UP!',

  // ---- team
  'team.blue.label': 'Blue',
  'team.red.label': 'Red',

  // ---- perk
  'perk.lancer-bonus.label': 'Tireless arm',
  'perk.lancer-bonus.description': '+{n} throws for the whole stage',
  'perk.bras-vif.label': 'Quick arm',
  'perk.bras-vif.description': '+{pct}% power at full drag',
  'perk.second-souffle.label': 'Second wind',
  'perk.second-souffle.description': "The first throw that knocks nothing down doesn't count",

  // ---- HUD
  'hud.ai': 'AI',
  'hud.player2v2': '{team} P{n}',
  'hud.stageTag': ' · Stage {n}/{total}',
  'hud.windAria': 'Wind: {direction}, force {force}',
  'wind.dir.N': 'North',
  'wind.dir.NE': 'Northeast',
  'wind.dir.E': 'East',
  'wind.dir.SE': 'Southeast',
  'wind.dir.S': 'South',
  'wind.dir.SW': 'Southwest',
  'wind.dir.W': 'West',
  'wind.dir.NW': 'Northwest',
  'hud.kubbs': 'kubbs',
  'hud.throws': 'throws',
  'hud.time': 'time',
  'hud.muteOn': 'Unmute',
  'hud.muteOff': 'Mute',
  'hud.pause': 'Pause',
  'hud.aiAiming': 'AI is aiming…',
  'hud.kingTipExpanded': 'The king is in range: hitting it now wins the match',
  'hud.kingTipShort': 'The king is in range — aim for it to win',
  'hud.openingThrow': "Opening throw: get as close to the king as you can WITHOUT touching it",
  'hud.resume': 'Resume',
  'hud.leaveMatch': 'Leave the match',

  // ---- Result screen
  'result.draw': 'Draw',
  'result.defeat': 'Defeat',
  'result.victory': 'Victory!',
  'result.teamVictory': '{team} team wins',
  'result.detail.kingDown': 'The king fell within the rules.',
  'result.detail.kingEarly': '{team} team hit the king before knocking down all the opposing kubbs.',
  'result.detail.timeout': "Time's up: the most kubbs knocked down wins.",
  'result.detail.throwsExhausted': 'Out of throws: the most kubbs knocked down wins.',
  'result.knockedLabel': 'kubbs knocked down',
  'result.you': 'You',
  'result.ai': 'AI',
  'result.defi.stageCleared': 'Stage {n} cleared!',
  'result.defi.runComplete': 'Run complete: all {total} stages cleared. Well done.',
  'result.defi.runOver.one': 'Run over at stage {stage} — {cleared} stage cleared.',
  'result.defi.runOver.many': 'Run over at stage {stage} — {cleared} stages cleared.',
  'result.defi.abandonRun': 'Abandon the run',
  'result.defi.nextStage': 'Next stage',
  'result.defi.newRun': 'New run',
  'result.menu': 'Menu',
  'result.replay': 'Replay',
  'result.tournament.win': '{name} wins this match!',
  'result.tournament.draw': 'Draw',
  'result.tournament.replayHint': 'Replay this match to break the tie.',
  'result.tournament.seeBracket': 'View bracket',
  'result.tournament.replay': 'Replay this match',
  'result.tournament.forfeit': 'Forfeit the tournament',
  'result.coinsGained': '+{n} 🪙',

  // ---- Perk choice screen
  'perk.screen.title': 'Choose a bonus',
  'perk.screen.subtitle': 'Before stage {n}/{total} — it stays with you until the run ends.',
  'perk.screen.next': 'Next stage…',

  // ---- Quit screen
  'quit.title': 'See you soon',
  'quit.text': 'You can close this tab. On mobile, close the app from the task switcher.',
  'quit.back': 'Back to menu',

  // ---- Rules screen
  'rules.title': 'Rules',
  'rules.item1': 'Each team lines up {n} kubbs on its baseline. A single king stands at the center of the field.',
  'rules.item2':
    "Teams throw in turn, only from directly behind one of their kubbs still standing: tap one of them on your line, that's where the baton starts from. A fallen kubb is no longer a valid throwing spot.",
  'rules.item3': "Drag toward the target to set the angle; the drag length sets the power. Release to throw.",
  'rules.item4':
    "A baton only knocks down a kubb if it hits hard enough. Every throw starts with a slight deviation: nobody aims perfectly.",
  'rules.item5': "A fallen kubb is out of play. Once all the opposing kubbs are down, you may aim for the king.",
  'rules.item6':
    "The king stands on the centerline: go around it until you're allowed to aim at it. Hitting it too soon means immediate defeat for the throwing team.",
  'rules.item7': 'Knocking down the king within the rules = victory.',
  'rules.item8':
    'Match capped at 4 minutes and {n} throws per team. At the buzzer, the team with the most kubbs down wins.',
  'rules.item9':
    "A throw that bounces off a wall before knocking down an opposing kubb revives one of your own fallen kubbs as a reward — always the leftmost one.",
  'rules.itemOpening':
    "Before the match, each team throws once at the king to decide who starts: whoever gets closest WITHOUT touching it goes first. Touching the king loses this toss — unless the other team also touches it, in which case it's replayed.",
  'rules.back': 'Back',
  'rules.replayTutorial': 'Replay the tutorial',
  'rules.tutorialWillReplay': 'Will show again next match',

  // ---- Tutorial
  'tutorial.step1': 'Tap your line to position yourself',
  'tutorial.step2': 'Drag toward the target, release to throw',
  'tutorial.step3': 'The king, at the center, is off-limits while the opponent still stands',
  'tutorial.toast': "One throw per turn — a fallen kubb stays out of play.",

  // ---- Tournament
  'tournament.round.final': 'Final',
  'tournament.round.semifinals': 'Semifinals',
  'tournament.round.quarterfinals': 'Quarterfinals',
  'tournament.round.n': 'Round {n}',
  'tournament.setup.title': 'Local tournament',
  'tournament.setup.intro': 'Single elimination, pass-and-play: everyone plays on the same phone, in turn.',
  'tournament.setup.sizeAria': 'Tournament size',
  'tournament.setup.players': '{n} players',
  'tournament.setup.playerPlaceholder': 'Player {n}',
  'tournament.setup.start': 'Start the tournament',
  'tournament.setup.cancel': 'Cancel',
  'tournament.bracket.title': 'Tournament',
  'tournament.bracket.champion': 'Champion: {name}',
  'tournament.bracket.newTournament': 'New tournament',
  'tournament.bracket.menu': 'Menu',
  'tournament.bracket.play': 'Play: {a} vs {b}',
  'tournament.bracket.forfeit': 'Forfeit the tournament',

  // ---- About
  'about.title': 'About',
  'about.createdBy': 'Created by {name}',
  'about.contact': 'Contact: {email}',
  'about.crashLogTitle': 'Error log',
  'about.crashLog.none': 'No errors recorded on this device.',
  'about.crashLog.one':
    "1 error recorded on this device. If the game misbehaves, copy this log and send it to the address above.",
  'about.crashLog.many':
    '{n} errors recorded on this device. If the game misbehaves, copy this log and send it to the address above.',
  'about.copyLog': 'Copy the log',
  'about.copied': 'Copied!',
  'about.clearLog': 'Clear the log',
  'about.back': 'Back',

  // ---- Boot
  'boot.loading': 'Loading…',

  // ---- Error boundary
  'error.title': 'Oops…',
  'error.text':
    "An unexpected error occurred. Your progress (best streak, preferences) is unaffected: it stays saved on this device.",
  'error.reload': 'Reload the game',

  // ---- Match
  'match.aiTurn': "AI'S TURN",
  'match.yourTurn': 'YOUR TURN',
  'match.teamTurn': "{team} TEAM'S TURN",
  'match.teamTurnPlayer': '{base} — PLAYER {n}',
  'match.secondSouffle': 'SECOND WIND!',
  'match.knockedLast': 'LAST ONE!',
  'match.knockedDown': 'DOWN!',
  'match.openingTouched': 'HIT!',
  'match.openingBothTouched': 'TIE, THROW AGAIN!',
  'match.kubbRevived': 'KUBB REVIVED!',
  'match.comboGood': 'GOOD THROW',
  'match.comboPrecision': 'PRECISION',
  'match.comboDouble': 'DOUBLE',
  'match.comboTriple': 'TRIPLE',
  'match.comboPerfect': 'PERFECT!',
  'match.comboMultiplier': '×{n} COMBO',
  'match.kingFalls': 'THE KING FALLS!',
  'match.kingTooEarly': 'KING HIT TOO SOON'
};

export const DICTS: Record<Lang, Record<string, string>> = { fr, en };
