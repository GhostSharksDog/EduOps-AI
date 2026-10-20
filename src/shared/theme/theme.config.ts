import {theme, type ThemeConfig} from 'antd';
import {editorialPalette, uiFontFamily} from './palette';

function createTheme(dark: boolean): ThemeConfig {
    const p = editorialPalette(dark);
    return {
        algorithm: dark ? [theme.darkAlgorithm] : [theme.defaultAlgorithm],
        token: {
            colorPrimary: p.primary, colorInfo: p.primary, colorSuccess: p.success,
            colorWarning: p.warning, colorError: p.error,
            colorBgBase: p.surface, colorBgLayout: p.canvas, colorBgContainer: p.surface,
            colorBgElevated: p.elevated, colorFillAlter: p.soft,
            colorText: p.ink, colorTextHeading: p.ink, colorTextLabel: p.ink,
            colorTextSecondary: p.muted, colorTextDescription: p.muted,
            colorBorder: p.border, colorBorderSecondary: p.border,
            colorLink: p.primary, colorLinkHover: p.primary, colorTextLightSolid: dark ? p.canvas : '#FFFFFF',
            fontFamily: uiFontFamily, fontSize: 15, fontSizeSM: 13, fontSizeLG: 16,
            fontSizeHeading1: 36, fontSizeHeading2: 30, fontSizeHeading3: 28,
            fontSizeHeading4: 20, fontSizeHeading5: 17, fontWeightStrong: 650,
            borderRadius: 10, borderRadiusLG: 16, borderRadiusSM: 6,
            controlHeight: 38, controlHeightSM: 30, controlHeightLG: 44,
            boxShadow: p.shadow, boxShadowSecondary: p.shadow,
            motionDurationFast: '0.12s', motionDurationMid: '0.18s', motionDurationSlow: '0.24s',
        },
        components: {
            Layout: {headerBg: p.surface, bodyBg: p.canvas, siderBg: p.sidebar},
            Card: {headerFontSize: 16, headerHeight: 52, paddingLG: 22, colorBgContainer: p.surface},
            Button: {fontWeight: 600, primaryShadow: 'none', defaultShadow: 'none'},
            Table: {headerBg: p.soft, headerColor: p.ink, rowHoverBg: p.primarySoft, cellPaddingBlock: 13},
            Menu: {
                itemBg: 'transparent', subMenuItemBg: 'transparent', itemSelectedBg: p.primarySoft,
                itemSelectedColor: p.primary, itemHoverBg: p.soft, iconSize: 18, itemHeight: 46,
                darkItemBg: 'transparent', darkSubMenuItemBg: 'transparent', darkItemColor: p.sidebarMuted,
                darkItemSelectedBg: '#344379', darkItemSelectedColor: '#FFFFFF',
                darkItemHoverBg: '#293557', darkItemHoverColor: '#FFFFFF',
            },
            Select: {optionSelectedBg: p.primarySoft, optionActiveBg: p.soft},
            Modal: {contentBg: p.surface, headerBg: p.surface},
            Drawer: {colorBgElevated: p.surface},
            Collapse: {headerBg: 'transparent', contentBg: p.surface},
            Tag: {defaultBg: p.soft, defaultColor: p.muted},
            Tabs: {itemSelectedColor: p.primary, inkBarColor: p.primary},
        },
    };
}
export const lightTheme = createTheme(false);
export const darkTheme = createTheme(true);
