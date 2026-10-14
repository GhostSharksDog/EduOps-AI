'use client';

import {useState} from 'react';
import {Tooltip, Button} from 'antd';
import {CopyOutlined, CheckOutlined} from '@ant-design/icons';
import {useGlobalMessage} from '@/shared/lib/message-service';

interface CopyableIdProps {
    id: string;
    length?: number;
}

export function CopyableId({id, length = 8}: CopyableIdProps) {
    const [copied, setCopied] = useState(false);
    const {success, error} = useGlobalMessage();

    const handleCopy = async () => {
        try {
            await navigator.clipboard.writeText(id);
            setCopied(true);
            success('已复制');
            setTimeout(() => setCopied(false), 2000);
        } catch {
            error('复制失败');
        }
    };

    const truncated = id.length > length ? `${id.slice(0, length)}...` : id;

    return (
        <span style={{display: 'inline-flex', alignItems: 'center', gap: 4}}>
            <Tooltip title={id}>
                <span style={{fontFamily: 'monospace', color: '#666'}}>{truncated}</span>
            </Tooltip>
            <Button
                type="text"
                size="small"
                icon={copied ? <CheckOutlined/> : <CopyOutlined/>}
                onClick={handleCopy}
                style={{color: copied ? '#52c41a' : undefined, padding: '0 4px'}}
            />
        </span>
    );
}
