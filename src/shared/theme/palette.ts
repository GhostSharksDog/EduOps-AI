// 页面、组件和图表共享的视觉值；这里只包含可公开的设计常量。
export const uiFontFamily = '"Segoe UI", "Microsoft YaHei UI", "Microsoft YaHei", "PingFang SC", "Noto Sans CJK SC", sans-serif';
export const editorialPalettes = {
    light: {
        canvas: '#F3F5FA', surface: '#FFFFFF', elevated: '#FFFFFF', soft: '#EAEFF7',
        ink: '#172039', muted: '#647089', border: '#DFE5EF', primary: '#4F59D9',
        primarySoft: '#EDF0FF', agent: '#7653C6', agentSoft: '#F1EDFC',
        accent: '#3F918B', accentSoft: '#E5F4F1', success: '#247657', warning: '#95601B',
        error: '#B44450', cyan: '#447B9C', sage: '#879BB8',
        sidebar: '#151C32', sidebarInk: '#F5F6FF', sidebarMuted: '#B1BBD2',
        shadow: '0 12px 38px rgba(29, 39, 73, 0.055)',
    },
    dark: {
        canvas: '#101421', surface: '#181E30', elevated: '#232C43', soft: '#242C43',
        ink: '#F2F4FF', muted: '#B2BED5', border: '#34415B', primary: '#A3B2FF',
        primarySoft: '#2A3459', agent: '#C5AFF6', agentSoft: '#342D50',
        accent: '#8AD5CB', accentSoft: '#233E40', success: '#8FD8B8', warning: '#EDC383',
        error: '#F3A1AC', cyan: '#96CDEB', sage: '#A6BAD5',
        sidebar: '#11172A', sidebarInk: '#F5F6FF', sidebarMuted: '#ACBAD5',
        shadow: '0 12px 38px rgba(0, 0, 0, 0.18)',
    },
} as const;
export type EditorialPalette = {[K in keyof typeof editorialPalettes.light]: string};
export const editorialPalette = (dark: boolean): EditorialPalette => editorialPalettes[dark ? 'dark' : 'light'];
export function editorialVariables(dark: boolean): Record<string, string> {
    const p = editorialPalette(dark);
    return {
        '--edu-canvas': p.canvas, '--edu-soft': p.canvas, '--edu-surface': p.surface,
        '--edu-elevated': p.elevated, '--edu-tint': p.soft, '--edu-ink': p.ink,
        '--edu-muted': p.muted, '--edu-border': p.border, '--edu-primary': p.primary,
        '--edu-primary-soft': p.primarySoft, '--edu-agent': p.agent, '--edu-agent-soft': p.agentSoft,
        '--edu-accent': p.accent, '--edu-accent-soft': p.accentSoft, '--edu-success': p.success,
        '--edu-warning': p.warning, '--edu-error': p.error, '--edu-sidebar': p.sidebar,
        '--edu-sidebar-ink': p.sidebarInk, '--edu-sidebar-muted': p.sidebarMuted,
        '--edu-shadow': p.shadow, '--edu-font': uiFontFamily,
        '--edu-on-primary': dark ? p.canvas : '#FFFFFF', '--edu-on-ink': '#F5F6FF',
        '--edu-art-background': '#101528', '--edu-art-ink': '#F5F6FF',
        '--edu-motion-fast': '220ms', '--edu-motion-enter': '420ms',
    };
}
