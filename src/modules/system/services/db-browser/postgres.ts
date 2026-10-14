import {db, queryRows, execute, type DbClient} from '@/platform/database';
import type {IDbBrowserService, TableInfo, PreviewData} from '@/modules/system/services/db-browser/interface';
const identifier=/^[a-zA-Z_][a-zA-Z0-9_]*$/;
function quote(value:string):string {
  if(!identifier.test(value)) throw new Error('无效的数据库标识符');
  return `"${value}"`;
}
export class PostgresDbBrowserService implements IDbBrowserService {
  constructor(private client:DbClient=db){}
  async getTables(schema:string):Promise<TableInfo[]> {
    quote(schema);
    const rows=await queryRows(`SELECT t.table_name, obj_description((quote_ident($1)||'.'||quote_ident(t.table_name))::regclass) AS comment
      FROM information_schema.tables t WHERE t.table_schema=$1 AND t.table_type='BASE TABLE' ORDER BY t.table_name`,[schema],this.client);
    return rows.map(row=>({name:row.table_name,rowCount:null,comment:row.comment}));
  }
  private async columns(schema:string,table:string):Promise<string[]> {
    quote(schema);quote(table);
    const rows=await queryRows(`SELECT column_name FROM information_schema.columns WHERE table_schema=$1 AND table_name=$2 ORDER BY ordinal_position`,[schema,table],this.client);
    if(!rows.length) throw new Error('数据表不存在');
    return rows.map(row=>row.column_name);
  }
  async getPreview(schema:string,table:string):Promise<PreviewData> {
    const columns=(await this.columns(schema,table)).filter(name=>!/(password|secret|token)/i.test(name));
    const rows=await queryRows(`SELECT ${columns.map(quote).join(',')} FROM ${quote(schema)}.${quote(table)} LIMIT 100`,[],this.client);
    return {columns,rows};
  }
  async truncateTable(schema:string,table:string):Promise<void> {
    await this.columns(schema,table);
    await execute(`TRUNCATE TABLE ${quote(schema)}.${quote(table)} RESTART IDENTITY CASCADE`,[],this.client);
  }
}
