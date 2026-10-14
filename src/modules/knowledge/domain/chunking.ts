/** 按段落边界切块，保留小范围重叠，结果顺序稳定。 */
export function chunkKnowledgeText(content:string,size=1000,overlap=120):string[]{
 if(!Number.isInteger(size)||size<100||!Number.isInteger(overlap)||overlap<0||overlap>=size)throw new Error('切块配置无效');
 const text=content.replace(/\r\n?/g,'\n').trim();
 if(!text)return [];
 const chunks:string[]=[];let start=0;
 while(start<text.length){
  let end=Math.min(start+size,text.length);
  if(end<text.length){const boundary=text.lastIndexOf('\n',end);if(boundary>start+size/2)end=boundary;}
  if(end<text.length&&/[\uD800-\uDBFF]/.test(text[end-1])&&/[\uDC00-\uDFFF]/.test(text[end]))end--;
  const chunk=text.slice(start,end).trim();if(chunk)chunks.push(chunk);
  if(end===text.length)break;
  start=Math.max(start+1,end-overlap);
  if(/[\uDC00-\uDFFF]/.test(text[start])&&/[\uD800-\uDBFF]/.test(text[start-1]))start--;
 }
 return chunks;
}
