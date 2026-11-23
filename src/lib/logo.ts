/**
 * The DYNOMARK logotype: forward-leaning block letters with clipped corners,
 * one diagonal cut (the dyno) through every letter, landing on an orange hold.
 * Letter paths are drawn upright on a 100-unit cap height, then skewed.
 * scripts/make-icons.mjs and scripts/make-splash.mjs carry the same geometry.
 */
export const LOGO_LETTERS = [
  'M0,0H58L82,24V76L58,100H0ZM26,26V74H50L56,68V32L50,26Z', // D
  'M94,0H122L136,26L150,0H178L149,54V100H123V54Z', // Y
  'M190,100V0H218L246,48V0H272V100H244L216,52V100Z', // N
  'M308,0H342L366,24V76L342,100H308L284,76V24ZM316,26H334L340,32V68L334,74H316L310,68V32Z', // O
  'M378,100V0H408L430,40L452,0H482V100H456V46L436,82H424L404,46V100Z', // M
  'M494,100V24L518,0H554L578,24V100H552V68H520V100ZM520,44H552V32L546,26H526L520,32Z', // A
  'M590,0H650L674,24V46L660,60L676,100H647L635,68H616V100H590ZM616,26V44H642L648,38V32L642,26Z', // R
  'M686,0H712V38L742,0H772L734,48L772,100H741L712,60V100H686Z', // K
];
/** The D on its own, drawn at x = 0: the app icon mark. */
export const ICON_LETTER = 'M0,0H58L82,24V76L58,100H0ZM26,26V74H50L56,68V32L50,26Z';
export const LOGO_SKEW_DEG = -14;
/** The dyno: a cut drawn in unskewed space, removed from the letters. */
export const LOGO_CUT = { x1: -34, y1: 98, x2: 760, y2: 10, width: 7 };
export const LOGO_HOLD = { cx: 778, cy: -2, r: 10 };
export const LOGO_BOX = { x: -38, y: -14, w: 832, h: 118 };
export const HOLD_COLOR = '#FF8A3D';
