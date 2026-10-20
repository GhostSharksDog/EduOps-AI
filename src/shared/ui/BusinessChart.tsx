'use client';
import {useEffect,useRef,useState} from 'react';
import {Alert,Empty,Table} from 'antd';
import type {EChartsCoreOption,EChartsType} from 'echarts/core';
import {editorialPalette,uiFontFamily} from '@/shared/theme/palette';
import {useTheme} from './ThemeProvider';
export default function BusinessChart({title,option,rows,onSelect,height=260,empty=false,fill=false}:{title:string;option:EChartsCoreOption;rows:Record<string,string|number|null>[];onSelect?:(index:number)=>void;height?:number;empty?:boolean;fill?:boolean}) {
    const host=useRef<HTMLDivElement>(null),instance=useRef<EChartsType|null>(null),callback=useRef(onSelect);callback.current=onSelect;
    const {isDarkMode}=useTheme(),[error,setError]=useState('');
    useEffect(()=>{if(!host.current||empty)return;let disposed=false,observer:ResizeObserver|undefined;const element=host.current;
        void import('./echarts-client').then(core=>{
            if(disposed)return;
            const palette=editorialPalette(isDarkMode);
            const axis={axisLine:{lineStyle:{color:palette.border}},axisTick:{lineStyle:{color:palette.border}},axisLabel:{color:palette.muted,fontFamily:uiFontFamily,fontSize:12},nameTextStyle:{color:palette.muted,fontFamily:uiFontFamily},splitLine:{lineStyle:{color:palette.border,type:'dashed' as const}}};
            const chartTheme={color:[palette.primary,palette.agent,palette.accent,palette.cyan,palette.sage,palette.muted],backgroundColor:'transparent',textStyle:{color:palette.muted,fontFamily:uiFontFamily,fontSize:12},categoryAxis:axis,valueAxis:axis,legend:{textStyle:{color:palette.muted,fontFamily:uiFontFamily,fontSize:12},pageTextStyle:{color:palette.muted,fontFamily:uiFontFamily},pageIconColor:palette.primary,pageIconInactiveColor:palette.border},tooltip:{backgroundColor:palette.surface,borderColor:palette.border,borderWidth:1,padding:[10,14],textStyle:{color:palette.ink,fontFamily:uiFontFamily,fontSize:12},axisPointer:{lineStyle:{color:palette.muted},shadowStyle:{color:palette.soft}}},line:{lineStyle:{width:3},itemStyle:{borderWidth:2}},bar:{label:{color:palette.ink,fontFamily:uiFontFamily}},pie:{itemStyle:{borderColor:palette.surface},label:{color:palette.ink,fontFamily:uiFontFamily}}};
            const chart=core.init(element,chartTheme,{renderer:'svg'});instance.current=chart;chart.on('click',(p:{dataIndex?:number})=>{if(typeof p.dataIndex==='number')callback.current?.(p.dataIndex);});observer=new ResizeObserver(()=>chart.resize());observer.observe(element);
            chart.setOption({backgroundColor:'transparent',aria:{enabled:true,label:{description:title+'。可在下方查看数据表。'}},tooltip:{trigger:'axis',renderMode:'richText'},...option,...(window.matchMedia('(prefers-reduced-motion: reduce)').matches?{animation:false}:{})});
        }).catch(()=>{if(!disposed)setError('图表加载失败，可展开数据表查看结果。');});
        return()=>{disposed=true;observer?.disconnect();instance.current?.dispose();instance.current=null;};
    },[option,empty,title,isDarkMode]);
    const columns=rows.length?Object.keys(rows[0]).map(key=>({title:key,dataIndex:key,render:(v:unknown)=>v===null?'待观察／未知':String(v)})):[];
    return <div className="business-chart" data-fill={fill||undefined}>{error&&<Alert type="warning" title={error}/>} {empty?<Empty description="暂无可绘制数据"/>:<div ref={host} role="img" aria-label={title} style={{height,width:'100%'}}/>}<details><summary>查看图表数据</summary><Table size="small" rowKey={(_,i)=>String(i)} columns={columns} dataSource={rows} pagination={rows.length>12?{pageSize:12}:false} scroll={{x:true}}/></details></div>;
}
