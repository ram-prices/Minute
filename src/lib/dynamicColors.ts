import { registerPlugin } from '@capacitor/core';
import { themeFromSourceColor, applyTheme, argbFromHex } from '@material/material-color-utilities';

export interface DynamicColorPlugin {
  getAccentColor(): Promise<{ value: string | null }>;
}

const DynamicColor = registerPlugin<DynamicColorPlugin>('DynamicColor');

/**
 * Fetches the system accent color from Android 12+ and applies
 * a full Material 3 theme to the document body.
 * 
 * @param fallbackHex The default color to use if dynamic colors aren't available (e.g. iOS, Web, or older Android)
 */
export async function applyDynamicColors(fallbackHex = '#6750A4') {
  try {
    // 1. Get the seed color from Capacitor (Native Android)
    const { value } = await DynamicColor.getAccentColor();
    const seedColorHex = value || fallbackHex;
    
    // 2. Generate the full Material 3 theme
    const theme = themeFromSourceColor(argbFromHex(seedColorHex));
    
    // 3. Check if the user prefers dark mode
    const isDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
    
    // 4. Apply it to your HTML (creates all the --md-sys-color-* variables)
    applyTheme(theme, { target: document.body, dark: isDark });
    
    // 5. Listen for system theme changes (Light/Dark mode toggle)
    window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', (e) => {
      applyTheme(theme, { target: document.body, dark: e.matches });
    });
    
    return true;
  } catch (e) {
    console.error('Failed to apply dynamic colors:', e);
    return false;
  }
}
