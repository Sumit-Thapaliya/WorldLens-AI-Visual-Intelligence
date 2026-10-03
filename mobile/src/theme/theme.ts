/**
 * Theme tokens matching WorldLens premium industrial/cybernetic aesthetic.
 * Gunmetal + cyan circuit + brass accents, derived from the aperture logo.
 */
export const theme = {
  colors: {
    bg: '#06090d',
    bg2: '#0b1118',
    gun: '#1a232c',
    gun2: '#232e38',
    panel: 'rgba(11,17,24,0.75)',
    panelSolid: '#16202a',
    border: 'rgba(255,255,255,0.06)',
    borderCyan: 'rgba(79,209,197,0.25)',
    borderBrass: 'rgba(201,164,92,0.3)',
    metal: '#c9ccd1',
    steel: '#8b929a',
    brass: '#c9a45c',
    brass2: '#8a6d32',
    gold: '#e8c579',
    cyan: '#4fd1c5',
    cyan2: '#22b8a9',
    cyanGlow: 'rgba(79,209,197,0.5)',
    red: '#ef5a5a',
    green: '#5dd39e',
    violet: '#a78bfa',
    white: '#e8ebee',
  },
  fonts: {
    regular: 'System',
    mono: 'Menlo',
  },
  radius: {
    sm: 8,
    md: 12,
    lg: 18,
    xl: 24,
    pill: 999,
  },
  spacing: {
    xs: 4,
    sm: 8,
    md: 12,
    lg: 16,
    xl: 24,
  },
  spring: { damping: 14, stiffness: 140, mass: 0.8 } as const,
};

export type Theme = typeof theme;
