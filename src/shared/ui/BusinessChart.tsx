'use client';
import {useEffect,useRef,useState} from 'react';
import {Alert,Empty,Table,theme} from 'antd';
import type {EChartsCoreOption,EChartsType} from 'echarts/core';
export default function BusinessChart({title,option,rows,onSelect,height=260,empty=false}:{title:string;option:EChartsCoreOption;rows:Record<string,string|number|null>[];onSelect?:(index:number)=>void;height?:number;empty?:boolean}) {
    const host=useRef<HTMLDivElement>(null),instance=useRef<EChartsType|null>(null),callback=useRef(onSelect);callback.current=onSelect;
    const {token}=theme.useToken(),[error,setError]=useState('');
    useEffect(()=>{if(!host.current||empty)return;let disposed=false,observer:ResizeObserver|undefined;const element=host.current;
        void import('./echarts-client').then(core=>{
            if(disposed)return;
            const chart=core.init(element,undefined,{renderer:'svg'});instance.current=chart;chart.on('click',(p:{dataIndex?:number})=>{if(typeof p.dataIndex==='number')callback.current?.(p.dataIndex);});observer=new ResizeObserver(()=>chart.resize());observer.observe(element);
            chart.setOption({backgroundColor:'transparent',color:['#3478f6','#14b8a6','#8b5cf6','#f59e0b','#f97316','#94a3b8'],textStyle:{color:token.colorTextSecondary,fontFamily:'inherit',fontSize:12},aria:{enabled:true,label:{description:title+'。可在下方查看数据表。'}},tooltip:{trigger:'axis',renderMode:'richText'},...option,...(window.matchMedia('(prefers-reduced-motion: reduce)').matches?{animation:false}:{})});
        }).catch(()=>{if(!disposed)setError('图表加载失败，可展开数据表查看结果。');});
        return()=>{disposed=true;observer?.disconnect();instance.current?.dispose();instance.current=null;};
    },[option,empty,title,token.colorTextSecondary]);
    const columns=rows.length?Object.keys(rows[0]).map(key=>({title:key,dataIndex:key,render:(v:unknown)=>v===null?'待观察／未知':String(v)})):[];
    return <div className="business-chart">{error&&<Alert type="warning" title={error}/>} {empty?<Empty description="暂无可绘制数据"/>:<div ref={host} role="img" aria-label={title} style={{height,width:'100%'}}/>}<details><summary>查看图表数据</summary><Table size="small" rowKey={(_,i)=>String(i)} columns={columns} dataSource={rows} pagination={rows.length>12?{pageSize:12}:false} scroll={{x:true}}/></details></div>;
}
