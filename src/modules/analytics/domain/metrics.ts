import type {MetricDefinition} from '../contracts';
export const metricDefinitions:MetricDefinition[]=[
 {code:'admission_conversion',name:'招生转化率',numerator:'同批次线索在观察窗口内签约的去重人数',denominator:'该批次有效线索去重人数',unit:'percent',notes:'线索批次与转化观察窗口必须一致，试听转化单独拆解'},
 {code:'renewal_rate',name:'续费率',numerator:'到期学员在续费观察窗口内完成续费的去重人数',denominator:'本期具备续费条件的到期学员去重人数',unit:'percent',notes:'跨期续费按到期批次归属，排除无需续费的正常结课'},
 {code:'attendance_rate',name:'出勤率',numerator:'有效课程实际出勤人次',denominator:'有效课程应出勤人次',unit:'percent',notes:'取消课程排除；请假、补课口径单独记录'},
 {code:'class_fill_rate',name:'满班率',numerator:'有效班级已占用名额',denominator:'有效班级核定容量',unit:'percent',notes:'按校区、课程和班级统计，容量变化记录版本'},
 {code:'hours_progress',name:'课耗进度',numerator:'有效合约已消耗课时',denominator:'有效合约可消耗总课时',unit:'percent',notes:'退课和调整后的课时以合约版本为准'},
 {code:'retention_rate',name:'学员留存率',numerator:'期初在读学员中期末仍在读的去重人数',denominator:'期初在读学员去重人数',unit:'percent',notes:'正常结课与主动流失分别报告'},
 {code:'complaint_count',name:'客诉趋势',numerator:'本期有效客诉去重记录数',denominator:'不适用',unit:'count',notes:'同时查看客诉类型、处理状态及相邻周期趋势'},
 {code:'refund_amount',name:'退费趋势',numerator:'本期实际完成的净退费金额',denominator:'不适用',unit:'currency',notes:'部分退款按实际金额，撤销退款排除'},
];
