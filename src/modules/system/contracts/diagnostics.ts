export type DiagnosticState='ready'|'warning'|'failed'|'blocked';
export interface DiagnosticCheck {
 id:'postgres'|'schema'|'vector'|'clickhouse'|'events'|'chat'|'embedding';
 title:string;
 state:DiagnosticState;
 description:string;
 recovery:string;
 href?:string;
 details?:string[];
 durationMs?:number;
}
export interface RuntimeDiagnostics {
 checkedAt:string;
 state:'ready'|'attention';
 checks:DiagnosticCheck[];
 durationMs:number;
 modelNetworkChecked:false;
}
