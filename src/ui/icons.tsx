import type { ReactNode } from 'react';

/**
 * Petites icones du menu : du SVG en trait, sans aucun texte (le texte des boutons reste exactement celui du libelle,
 * ce dont les lecteurs d'ecran et les verifications dependent). Elles prennent la couleur du texte (`currentColor`).
 */
function Icon({ children }: { children: ReactNode }) {
  return (
    <svg className="icon" viewBox="0 0 24 24" width="24" height="24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" focusable="false">
      {children}
    </svg>
  );
}

export const IconGlobe = () => (
  <Icon>
    <circle cx="12" cy="12" r="9" />
    <path d="M3 12h18M12 3c2.8 2.6 4 5.6 4 9s-1.2 6.4-4 9c-2.8-2.6-4-5.6-4-9s1.2-6.4 4-9z" />
  </Icon>
);
export const IconTarget = () => (
  <Icon>
    <circle cx="12" cy="12" r="9" />
    <circle cx="12" cy="12" r="5" />
    <circle cx="12" cy="12" r="1.4" fill="currentColor" />
  </Icon>
);
export const IconSword = () => (
  <Icon>
    <path d="M7 4h10v5a5 5 0 0 1-10 0V4z" />
    <path d="M7 6H4v1.5A3.5 3.5 0 0 0 7.5 11M17 6h3v1.5a3.5 3.5 0 0 1-3.5 3.5" />
    <path d="M12 14v4M8.5 20h7" />
  </Icon>
);
export const IconPalette = () => (
  <Icon>
    <path d="M12 3a9 9 0 1 0 0 18c1.5 0 2-1 1.6-2-.5-1.2.3-2.5 1.7-2.5H17a4 4 0 0 0 4-4C21 6.6 17 3 12 3z" />
    <circle cx="7.5" cy="11" r="1.2" fill="currentColor" />
    <circle cx="10.5" cy="7.2" r="1.2" fill="currentColor" />
    <circle cx="15" cy="7.8" r="1.2" fill="currentColor" />
  </Icon>
);
export const IconBag = () => (
  <Icon>
    <path d="M5 8h14l-1 12H6L5 8z" />
    <path d="M9 8V6.5a3 3 0 0 1 6 0V8" />
  </Icon>
);
export const IconMedal = () => (
  <Icon>
    <circle cx="12" cy="14" r="5.5" />
    <path d="M8.5 9.5 6.5 3h4l1.5 3 1.5-3h4l-2 6.5" />
    <path d="m12 11.5 1 2 2.2.3-1.6 1.6.4 2.2-2-1-2 1 .4-2.2-1.6-1.6 2.2-.3 1-2z" fill="currentColor" stroke="none" />
  </Icon>
);
export const IconGear = () => (
  <Icon>
    <circle cx="12" cy="12" r="3.2" />
    <path d="M12 2.5v3M12 18.5v3M2.5 12h3M18.5 12h3M5.3 5.3l2.1 2.1M16.6 16.6l2.1 2.1M18.7 5.3l-2.1 2.1M7.4 16.6l-2.1 2.1" />
  </Icon>
);
export const IconBook = () => (
  <Icon>
    <path d="M4 5.5C4 4.7 4.7 4 5.5 4H11v15H5.5C4.7 19 4 18.3 4 17.5v-12z" />
    <path d="M20 5.5c0-.8-.7-1.5-1.5-1.5H13v15h5.5c.8 0 1.5-.7 1.5-1.5v-12z" />
  </Icon>
);
export const IconShare = () => (
  <Icon>
    <circle cx="6" cy="12" r="2.4" />
    <circle cx="18" cy="6" r="2.4" />
    <circle cx="18" cy="18" r="2.4" />
    <path d="m8.1 10.9 7.8-3.8M8.1 13.1l7.8 3.8" />
  </Icon>
);
export const IconPlay = () => (
  <Icon>
    <path d="M8 5.5v13l11-6.5-11-6.5z" fill="currentColor" />
  </Icon>
);

/** Embleme du menu : un kubb de bois (bloc en perspective) couronne, dessine en SVG (pas d'image a telecharger). */
export function MenuEmblem() {
  return (
    <svg className="emblem" viewBox="0 0 120 120" width="84" height="84" aria-hidden="true" focusable="false">
      <defs>
        <linearGradient id="emb-front" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#e0b070" />
          <stop offset="1" stopColor="#a8723a" />
        </linearGradient>
        <linearGradient id="emb-gold" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#ffe9a0" />
          <stop offset="1" stopColor="#d99f2a" />
        </linearGradient>
        <radialGradient id="emb-glow" cx="0.5" cy="0.5" r="0.5">
          <stop offset="0" stopColor="#f2c14e" stopOpacity="0.5" />
          <stop offset="1" stopColor="#f2c14e" stopOpacity="0" />
        </radialGradient>
      </defs>
      <circle cx="60" cy="64" r="58" fill="url(#emb-glow)" />
      <ellipse cx="64" cy="108" rx="32" ry="6" fill="#000" opacity="0.35" />
      {/* cote droit, dessus, face avant */}
      <path d="M84 52 98 42v52l-14 12V52z" fill="#7b4b20" stroke="#4f2f12" strokeWidth="2" strokeLinejoin="round" />
      <path d="M32 52 46 42h52L84 52H32z" fill="#f0c98a" stroke="#4f2f12" strokeWidth="2" strokeLinejoin="round" />
      <rect x="32" y="52" width="52" height="54" rx="3" fill="url(#emb-front)" stroke="#4f2f12" strokeWidth="2" />
      {/* veines du bois */}
      <path d="M38 64c8 3 22 3 40 0M38 78c9 3 24 3 40 0M38 92c8 3 22 3 40 0" stroke="#5b3a18" strokeOpacity="0.5" strokeWidth="2" fill="none" strokeLinecap="round" />
      <path d="M70 60c3 6 3 12 0 20" stroke="#5b3a18" strokeOpacity="0.35" strokeWidth="1.6" fill="none" strokeLinecap="round" />
      {/* couronne posee sur le dessus */}
      <g transform="translate(0 -3)">
        <path d="M44 46 38 22l14 9 10-17 10 17 14-9-6 24c-6 3-26 3-34 0z" fill="url(#emb-gold)" stroke="#9a6a0e" strokeWidth="2" strokeLinejoin="round" />
        <circle cx="38" cy="22" r="3.6" fill="#fff1c2" stroke="#9a6a0e" strokeWidth="1.4" />
        <circle cx="62" cy="13" r="4" fill="#fff1c2" stroke="#9a6a0e" strokeWidth="1.4" />
        <circle cx="86" cy="22" r="3.6" fill="#fff1c2" stroke="#9a6a0e" strokeWidth="1.4" />
        <circle cx="62" cy="38" r="3.3" fill="#d6304a" stroke="#7a1626" strokeWidth="1.2" />
      </g>
    </svg>
  );
}
