'use client';

import {Menu, MenuProps} from 'antd';
import {useTheme} from '@/shared/ui/ThemeProvider';

type ThemedMenuProps = MenuProps;

export default function ThemedMenu(props: ThemedMenuProps) {
    const {isDarkMode} = useTheme();
    
    return (
        <Menu
            {...props}
            theme={props.theme ?? (isDarkMode ? 'dark' : 'light')}
        />
    );
}
