/**
 * PROJECT EKO — DESIGN SYSTEM TOKENS & UI PRIMITIVES
 * Rich African aesthetic: Lagos Emerald, Warm Gold, Charcoal Dark-Mode, Glassmorphism.
 */

export const EKO_DESIGN_TOKENS = {
  colors: {
    primaryGreen: '#05472A',
    emeraldBright: '#008751',
    lagosGold: '#F4B41A',
    warmYellow: '#FFD700',
    charcoalDark: '#12161A',
    panelBg: 'rgba(18, 22, 26, 0.88)',
    panelBorder: 'rgba(244, 180, 26, 0.28)',
    surfaceLight: '#F8F9FA',
    dangerRed: '#E63946',
    hudAccent: '#00F0FF',
    textPrimary: '#FFFFFF',
    textMuted: '#A0AAB2',
  },
  typography: {
    fontFamily: "-apple-system, BlinkMacSystemFont, 'Inter', 'Segoe UI', Roboto, sans-serif",
    fontSizeHeading: '1.25rem',
    fontSizeBody: '0.9rem',
    fontSizeSmall: '0.75rem',
  },
  shadows: {
    card: '0 8px 32px 0 rgba(0, 0, 0, 0.45)',
    glowGold: '0 0 16px rgba(244, 180, 26, 0.4)',
    glowEmerald: '0 0 16px rgba(0, 135, 81, 0.4)',
  },
};

export interface EkoPhoneAppState {
  activeApp: 'home' | 'ekoride' | 'jobshub' | 'garage' | 'fleet' | 'market' | 'profile' | 'messages';
  isOpen: boolean;
  batteryPercent: number;
  timeString: string;
}
