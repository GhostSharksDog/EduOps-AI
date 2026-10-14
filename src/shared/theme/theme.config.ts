import { ThemeConfig, theme } from 'antd';

const cleanBlueLightTheme: ThemeConfig = {
    token: {
        colorPrimary: '#1677ff',
        colorSuccess: '#52c41a',
        colorWarning: '#faad14',
        colorError: '#ff4d4f',
        colorInfo: '#1677ff',

        colorBgBase: '#ffffff',
        colorBgContainer: '#ffffff',
        colorBgElevated: '#ffffff',
        colorBgLayout: '#f5f7fa',

        colorText: 'rgba(0, 0, 0, 0.88)',
        colorTextSecondary: 'rgba(0, 0, 0, 0.65)',
        colorTextTertiary: 'rgba(0, 0, 0, 0.45)',
        colorTextQuaternary: 'rgba(0, 0, 0, 0.25)',
        colorTextHeading: 'rgba(0, 0, 0, 0.88)',
        colorTextLabel: 'rgba(0, 0, 0, 0.88)',
        colorTextDescription: 'rgba(0, 0, 0, 0.65)',
        colorTextLightSolid: '#ffffff',
        colorTextPlaceholder: 'rgba(0, 0, 0, 0.25)',
        colorTextDisabled: 'rgba(0, 0, 0, 0.25)',

        colorIcon: 'rgba(0, 0, 0, 0.65)',
        colorIconHover: '#1677ff',

        colorLink: '#1677ff',
        colorLinkHover: '#4096ff',
        colorLinkActive: '#0958d9',

        controlInteractiveSize: 16,

        lineWidth: 1,
        lineWidthBold: 2,
        lineWidthFocus: 2,

        borderRadius: 6,
        borderRadiusLG: 8,
        borderRadiusSM: 4,
        borderRadiusXS: 2,

        fontSize: 14,
        fontSizeSM: 12,
        fontSizeLG: 16,
        fontSizeXL: 20,
        fontSizeHeading1: 38,
        fontSizeHeading2: 30,
        fontSizeHeading3: 24,
        fontSizeHeading4: 20,
        fontSizeHeading5: 16,
        fontWeightStrong: 600,

        paddingXXS: 4,
        paddingXS: 8,
        paddingSM: 12,
        padding: 16,
        paddingMD: 20,
        paddingLG: 24,
        paddingXL: 32,
        paddingContentHorizontal: 16,
        paddingContentHorizontalSM: 12,
        paddingContentHorizontalLG: 24,
        paddingContentVertical: 16,
        paddingContentVerticalSM: 12,
        paddingContentVerticalLG: 24,

        marginXXS: 4,
        marginXS: 8,
        marginSM: 12,
        margin: 16,
        marginMD: 20,
        marginLG: 24,
        marginXL: 32,
        marginXXL: 48,

        boxShadow: '0 6px 16px rgba(0, 0, 0, 0.08)',
        boxShadowSecondary: '0 3px 6px rgba(0, 0, 0, 0.12)',
        boxShadowTertiary: '0 2px 4px rgba(0, 0, 0, 0.06)',

        opacityLoading: 0.65,

        motionDurationSlow: '0.3s',
        motionDurationMid: '0.2s',
        motionDurationFast: '0.1s',
    },
    components: {
        Layout: {
            headerBg: '#ffffff',
            siderBg: '#fafafa',
            bodyBg: '#f5f7fa',
        },
        Card: {
            colorBgContainer: '#ffffff',
            borderRadiusLG: 8,
        },
        Button: {
            borderRadius: 6,
            controlHeight: 32,
            controlHeightLG: 40,
            fontWeight: 500,
        },
        Input: {
            borderRadius: 6,
            controlHeight: 32,
            colorBgContainer: '#ffffff',
        },
        InputNumber: {
            borderRadius: 6,
            controlHeight: 32,
            colorBgContainer: '#ffffff',
        },
        Modal: {
            contentBg: '#ffffff',
            headerBg: '#ffffff',
        },
        Table: {
            headerBg: '#fafafa',
            headerColor: 'rgba(0, 0, 0, 0.88)',
        },
        Menu: {
            itemBg: 'transparent',
            itemSelectedBg: 'rgba(22, 119, 255, 0.15)',
            itemHoverBg: 'rgba(22, 119, 255, 0.12)',
            itemActiveBg: 'rgba(22, 119, 255, 0.10)',
            itemSelectedColor: '#0958d9',
            subMenuItemBg: 'transparent',
            groupTitleColor: '#1677ff',
            itemPaddingInline: 16,
            iconSize: 16,
        },
        Select: {
            optionSelectedBg: 'rgba(22, 119, 255, 0.1)',
            optionActiveBg: 'rgba(22, 119, 255, 0.06)',
        },
        Typography: {
            colorTextHeading: 'rgba(0, 0, 0, 0.88)',
            colorText: 'rgba(0, 0, 0, 0.88)',
            colorTextSecondary: 'rgba(0, 0, 0, 0.65)',
        },
        Tag: {
            borderRadiusSM: 4,
            borderRadiusLG: 6,
        },
        Alert: {
            borderRadius: 6,
        },
        Message: {
            borderRadius: 6,
        },
        Notification: {
            borderRadius: 6,
        },
        Drawer: {
            colorBgElevated: '#ffffff',
        },
        Popover: {
            colorBgElevated: '#ffffff',
        },
        Dropdown: {
            borderRadius: 6,
        },
        Progress: {
            circleTextFontSize: '14px',
        },
    },
    algorithm: [],
};

const darkTheme: ThemeConfig = {
    token: {
        colorPrimary: '#1677ff',
        colorSuccess: '#49aa19',
        colorWarning: '#d48806',
        colorError: '#d32029',
        colorInfo: '#1677ff',

        colorBgBase: '#141414',
        colorBgContainer: '#1f1f1f',
        colorBgElevated: '#262626',
        colorBgLayout: '#000000',

        colorText: 'rgba(255, 255, 255, 0.88)',
        colorTextSecondary: 'rgba(255, 255, 255, 0.65)',
        colorTextTertiary: 'rgba(255, 255, 255, 0.45)',
        colorTextQuaternary: 'rgba(255, 255, 255, 0.25)',
        colorTextHeading: 'rgba(255, 255, 255, 0.88)',
        colorTextLabel: 'rgba(255, 255, 255, 0.88)',
        colorTextDescription: 'rgba(255, 255, 255, 0.65)',
        colorTextLightSolid: '#ffffff',
        colorTextPlaceholder: 'rgba(255, 255, 255, 0.25)',
        colorTextDisabled: 'rgba(255, 255, 255, 0.25)',

        colorIcon: 'rgba(255, 255, 255, 0.65)',
        colorIconHover: '#1677ff',

        colorLink: '#1677ff',
        colorLinkHover: '#4096ff',
        colorLinkActive: '#0958d9',

        controlInteractiveSize: 16,

        lineWidth: 1,
        lineWidthBold: 2,
        lineWidthFocus: 2,

        borderRadius: 6,
        borderRadiusLG: 8,
        borderRadiusSM: 4,
        borderRadiusXS: 2,

        fontSize: 14,
        fontSizeSM: 12,
        fontSizeLG: 16,
        fontSizeXL: 20,
        fontSizeHeading1: 38,
        fontSizeHeading2: 30,
        fontSizeHeading3: 24,
        fontSizeHeading4: 20,
        fontSizeHeading5: 16,
        fontWeightStrong: 600,

        paddingXXS: 4,
        paddingXS: 8,
        paddingSM: 12,
        padding: 16,
        paddingMD: 20,
        paddingLG: 24,
        paddingXL: 32,
        paddingContentHorizontal: 16,
        paddingContentHorizontalSM: 12,
        paddingContentHorizontalLG: 24,
        paddingContentVertical: 16,
        paddingContentVerticalSM: 12,
        paddingContentVerticalLG: 24,

        marginXXS: 4,
        marginXS: 8,
        marginSM: 12,
        margin: 16,
        marginMD: 20,
        marginLG: 24,
        marginXL: 32,
        marginXXL: 48,

        boxShadow: '0 6px 16px rgba(0, 0, 0, 0.3)',
        boxShadowSecondary: '0 3px 6px rgba(0, 0, 0, 0.4)',
        boxShadowTertiary: '0 2px 4px rgba(0, 0, 0, 0.2)',

        opacityLoading: 0.65,

        motionDurationSlow: '0.3s',
        motionDurationMid: '0.2s',
        motionDurationFast: '0.1s',
    },
    components: {
        Layout: {
            headerBg: '#1f1f1f',
            siderBg: '#0d0d0d',
            bodyBg: '#000000',
        },
        Card: {
            colorBgContainer: '#1f1f1f',
            borderRadiusLG: 8,
        },
        Button: {
            borderRadius: 6,
            controlHeight: 32,
            controlHeightLG: 40,
            fontWeight: 500,
        },
        Input: {
            borderRadius: 6,
            controlHeight: 32,
            colorBgContainer: '#1f1f1f',
        },
        InputNumber: {
            borderRadius: 6,
            controlHeight: 32,
            colorBgContainer: '#1f1f1f',
        },
        Modal: {
            contentBg: '#1f1f1f',
            headerBg: '#1f1f1f',
        },
        Table: {
            headerBg: '#262626',
            headerColor: 'rgba(255, 255, 255, 0.88)',
        },
        Menu: {
            darkItemBg: 'transparent',
            darkItemSelectedBg: '#1677ff',
            darkItemHoverBg: 'rgba(22, 119, 255, 0.25)',
            darkItemSelectedColor: '#ffffff',
            darkItemColor: 'rgba(255, 255, 255, 0.75)',
            darkSubMenuItemBg: 'transparent',
            groupTitleColor: '#1677ff',
            itemPaddingInline: 16,
            iconSize: 16,
        },
        Select: {
            optionSelectedBg: 'rgba(22, 119, 255, 0.15)',
            optionActiveBg: 'rgba(22, 119, 255, 0.1)',
        },
        Typography: {
            colorTextHeading: 'rgba(255, 255, 255, 0.88)',
            colorText: 'rgba(255, 255, 255, 0.88)',
            colorTextSecondary: 'rgba(255, 255, 255, 0.65)',
        },
        Tag: {
            borderRadiusSM: 4,
            borderRadiusLG: 6,
        },
        Alert: {
            borderRadius: 6,
        },
        Message: {
            borderRadius: 6,
        },
        Notification: {
            borderRadius: 6,
        },
        Drawer: {
            colorBgElevated: '#262626',
        },
        Popover: {
            colorBgElevated: '#262626',
        },
        Dropdown: {
            borderRadius: 6,
        },
        Progress: {
            circleTextFontSize: '14px',
        },
    },
    algorithm: [theme.darkAlgorithm],
};

const lightTheme: ThemeConfig = cleanBlueLightTheme;

export { darkTheme, lightTheme };
