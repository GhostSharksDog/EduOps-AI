'use client';
import Markdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
export default function MarkdownContent({content}:{content:string}){
 return <div className="knowledge-markdown"><Markdown remarkPlugins={[remarkGfm]} skipHtml urlTransform={url=>/^(https?:\/\/|mailto:|\/|#)/i.test(url)&&!url.startsWith('//')?url:''} components={{img:({alt})=><span>{alt??'图片'}</span>,a:({href,children})=>href?<a href={href} target="_blank" rel="noopener noreferrer">{children}</a>:<span>{children}</span>}}>{content}</Markdown></div>;
}
