const fs=require('node:fs'),path=require('node:path'),ts=require('typescript');
const root=path.resolve(__dirname,'..'),failures=[];
const walk=directory=>fs.readdirSync(directory,{withFileTypes:true}).flatMap(entry=>entry.isDirectory()?walk(path.join(directory,entry.name)):[path.join(directory,entry.name)]);
const files=walk(path.join(root,'src')).filter(file=>/[.]tsx?$/.test(file));
for(const file of files){
 const name=path.relative(root,file).replaceAll('\\','/'),text=fs.readFileSync(file,'utf8'),source=ts.createSourceFile(file,text,ts.ScriptTarget.Latest,true);
 const module=name.match(/^src\/modules\/([^/]+)/)?.[1];
 for(const node of source.statements){
  if(!(ts.isImportDeclaration(node)||ts.isExportDeclaration(node))||!node.moduleSpecifier||!ts.isStringLiteral(node.moduleSpecifier))continue;
  const spec=node.moduleSpecifier.text;
  if(/^@\/(acl|ohs|stores|components|lib|config)(\/|$)/.test(spec))failures.push(name+': 旧目录引用 '+spec);
  if(/@prisma|generated\/prisma|platform\/prisma|integrations\/enterprise|@shared\//.test(spec))failures.push(name+': 已移除依赖 '+spec);
  if(name.includes('/domain/')&&/modules\/[^/]+\/(services|repositories)\/|\/application\/|\/infrastructure\//.test(spec))failures.push(name+': 领域依赖实现 '+spec);
  if(name.includes('/ui/')&&(/\/server$|modules\/[^/]+\/repositories\/|platform\/(database|ai\/|config\/)/.test(spec)))failures.push(name+': 客户端引用服务端 '+spec);
  const other=spec.match(/^@\/modules\/([^/]+)\/(.+)$/);
  if(module&&other&&module!==other[1]&&!['server','client','contracts','contracts/index'].includes(other[2]))failures.push(name+': 跨模块内部引用 '+spec);
 }
 if(/NEXT_PUBLIC_\w*(?:API_KEY|SECRET|PASSWORD)/.test(text))failures.push(name+': 密钥不得公开到客户端');
 if(/^src\/app\/api\/.+\/route[.]ts$/.test(name)&&!['src/app/api/auth/login/route.ts','src/app/api/auth/companies/route.ts','src/app/api/health/route.ts'].includes(name)){
  for(const node of source.statements){
   if(!node.modifiers?.some(modifier=>modifier.kind===ts.SyntaxKind.ExportKeyword))continue;
   if(ts.isFunctionDeclaration(node)&&node.name&&/^(GET|POST|PUT|PATCH|DELETE|HEAD|OPTIONS)$/.test(node.name.text))failures.push(name+': API必须使用 withCompanyRoute 建立已验证公司上下文');
   if(ts.isVariableStatement(node))for(const declaration of node.declarationList.declarations){
    if(!ts.isIdentifier(declaration.name)||!/^(GET|POST|PUT|PATCH|DELETE|HEAD|OPTIONS)$/.test(declaration.name.text))continue;
    const init=declaration.initializer;if(!init||!ts.isCallExpression(init)||!ts.isIdentifier(init.expression)||init.expression.text!=='withCompanyRoute')failures.push(name+': API必须使用 withCompanyRoute 包装');
   }
  }
 }
}
if(failures.length){console.error(failures.join('\n'));process.exitCode=1;}else console.log('模块边界、客户端依赖和已移除依赖检查通过（'+files.length+'个源码文件）');
