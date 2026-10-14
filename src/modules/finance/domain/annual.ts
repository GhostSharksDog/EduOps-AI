import type {FinanceAnnual,FinanceCode} from '../contracts';
// 元转分后计算差额，避免金额相减丢失分位。原始披露金额始终作为字符串保存。
export function cents(value:string):bigint {if(!/^\d{1,13}\.\d{2}$/.test(value))throw new Error('财务金额格式无效');return BigInt(value.replace('.',''));}
export function annualValues(row:FinanceAnnual):Record<FinanceCode,number|null>{
 const revenue=cents(row.revenue),cost=cents(row.cost),selling=cents(row.selling),admin=cents(row.administrative),ratio=(n:bigint)=>revenue?Number(n)*100/Number(revenue):null;
 return {revenue:Number(revenue)/100,cost:Number(cost)/100,grossProfit:Number(revenue-cost)/100,grossMargin:ratio(revenue-cost),selling:Number(selling)/100,sellingRatio:ratio(selling),administrative:Number(admin)/100,administrativeRatio:ratio(admin)};
}
