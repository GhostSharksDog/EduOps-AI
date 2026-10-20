'use client';

import {useCallback, useEffect, useRef, useState} from 'react';
import dayjs from 'dayjs';
import {useAuthStore} from '@/modules/identity/client';
import {datasetAnalysisType,type DatasetVO} from '@/modules/education/contracts';
import {isLearningScope,isFinanceScope,financeScopeSchema} from '@/shared/contracts/analysis';
import type {AnalysisScope, CapabilityResult, LearningScope, FinanceScope} from '@/shared/contracts/analysis';
import {selectionFromSearch,analysisHref} from '@/shared/lib/analysis-navigation';
import {learningSelectionFromSearch} from '@/shared/lib/learning-navigation';
import {rememberReviewRecord} from '@/modules/overview/client';
import type {
    AgentProgressVO, AgentConfirmationDTO, AgentRunDTO, AgentRunVO, AgentSessionDetailVO, AgentSessionVO, ToolDefinition,
} from '../contracts';
import type {ActionPlanVO} from '../contracts/actions';

interface CatalogEntry {id: string; kind: string; name: string;}
function financeFromLocation():FinanceScope {
    const params=new URLSearchParams(window.location.search);
    try {const parsed=financeScopeSchema.safeParse(params.has('financeScope')?JSON.parse(params.get('financeScope')!):{years:JSON.parse(params.get('financeYears')??'[]')});return parsed.success?parsed.data:{years:[]};} catch {return {years:[]};}
}
interface AgentCapability {tools: ToolDefinition[];}
type TaskState=NonNullable<AgentSessionVO['taskState']>;
export interface TaskStateSaveResult {saved:boolean;conflict?:boolean;message?:string;}
class AgentRequestError extends Error {constructor(message:string,public status:number){super(message);}}
const initialScope = (): AnalysisScope => ({
    startDate: dayjs().subtract(1, 'month').startOf('month').format('YYYY-MM-DD'),
    endDate: dayjs().subtract(1, 'month').endOf('month').format('YYYY-MM-DD'),
    campusIds: [], courseIds: [], channelIds: [],
});
const publicScope = (scope: AnalysisScope): AnalysisScope => ({
    startDate: scope.startDate, endDate: scope.endDate,
    campusIds: [...scope.campusIds], courseIds: [...scope.courseIds], channelIds: [...scope.channelIds],
    ...(scope.dataCutoff ? {dataCutoff: scope.dataCutoff} : {}),
});
const initialLearningScope = (): LearningScope => ({courseKeys: []});
const publicLearningScope = (scope: LearningScope): LearningScope => ({
    courseKeys: [...scope.courseKeys],
    ...(scope.relativeDayStart !== undefined ? {relativeDayStart: scope.relativeDayStart} : {}),
    ...(scope.relativeDayEnd !== undefined ? {relativeDayEnd: scope.relativeDayEnd} : {}),
});
const errorText = (error: unknown) => error instanceof Error ? error.message : '操作失败，请重试。';
const active = (run: AgentRunVO | undefined) => run?.status === 'queued' || run?.status === 'running';

export function useAgentWorkspace() {
    const token = useAuthStore(state => state.token);
    const currentToken=useRef(token);currentToken.current=token;
    const user = useAuthStore(state => state.user);
    const writable = user?.role === 'admin' || user?.role === 'operator';
    const canChat=!!user;
    const [capability, setCapability] = useState<CapabilityResult<AgentCapability> | null>(null);
    const [datasets, setDatasets] = useState<DatasetVO[]>([]);
    const [catalog, setCatalog] = useState<CatalogEntry[]>([]);
    const [channelOptions,setChannelOptions]=useState<{id:string;name:string}[]>([]),[channelError,setChannelError]=useState('');
    const [sessions, setSessions] = useState<AgentSessionVO[]>([]);
    const [detail, setDetail] = useState<AgentSessionDetailVO | null>(null);
    const [sessionId, setSessionId] = useState('');
    const [datasetId, setDatasetId] = useState('');
    const [scope, setScope] = useState<AnalysisScope>(initialScope);
    const [financeScope,setFinanceScope]=useState<FinanceScope>({years:[]});
    const [learningScope, setLearningScope] = useState<LearningScope>(initialLearningScope);
    const [runs, setRuns] = useState<AgentRunVO[]>([]);
    const [runId, setRunId] = useState('');
    const [loading, setLoading] = useState(true);
    const [loadingSession, setLoadingSession] = useState(false);
    const [submitting, setSubmitting] = useState(false);
    const [executionExpired,setExecutionExpired]=useState(false);
    const [elapsed,setElapsed]=useState(0),[progressMessage,setProgressMessage]=useState('');
    const pollingAbort=useRef<AbortController|null>(null),sessionAbort=useRef<AbortController|null>(null),submitActive=useRef(false);
    useEffect(()=>()=>{pollingAbort.current?.abort();sessionAbort.current?.abort();},[]);
    const [confirming, setConfirming] = useState(false);
    const [savingTaskState,setSavingTaskState]=useState(false),taskWriteActive=useRef(false),taskWriteAbort=useRef<AbortController|null>(null);
    const recoveryKeys=useRef(new Map<string,string>());
    useEffect(()=>()=>taskWriteAbort.current?.abort(),[]);
    const [error, setError] = useState('');
    const [catalogError, setCatalogError] = useState('');
    const [catalogRefresh, setCatalogRefresh] = useState(0);
    const selection = useRef(0);
    const pendingRequest = useRef<{signature: string; requestKey: string} | null>(null);
    const selectedRun = runs.find(run => run.id === runId);
    const runningRun = runs.find(active);
    const sessionEditable = !sessionId || (!!detail && detail.session.id===sessionId && detail.session.editable === true) || (submitting&&runningRun?.sessionId===sessionId);
    const publicMode = datasetAnalysisType(datasets.find(dataset => dataset.id === datasetId)??{key:'',origin:'simulated'}) === 'learning';
    const financeMode=datasetAnalysisType(datasets.find(d=>d.id===datasetId)??{key:'',origin:'simulated'})==='finance';
    const restoreScope = useCallback((session: AgentSessionVO) => {
        if(isFinanceScope(session.scope))setFinanceScope({years:[...session.scope.years]});
        else if (isLearningScope(session.scope)) setLearningScope(publicLearningScope(session.scope));
        else setScope(publicScope(session.scope));
    }, []);

    const request = useCallback(async <T,>(path: string, input?: unknown, signal?: AbortSignal, retainFailure = false,method?:string): Promise<CapabilityResult<T>> => {
        let response: Response;
        try {
            response = await fetch(path, {
                method: method??(input === undefined ? 'GET' : 'POST'),
                headers: {Authorization: 'Bearer ' + token, ...(input === undefined ? {} : {'Content-Type': 'application/json'})},
                ...(input === undefined ? {} : {body: JSON.stringify(input)}), signal,
            });
        } catch (failure) {
            if (signal?.aborted) throw failure;
            throw new Error('连接失败，请检查网络后重试。');
        }
        let body: CapabilityResult<T> & {error?: string};
        try {body = await response.json();} catch {throw new Error('服务暂时没有返回有效结果，请稍后重试。');}
        if ((!response.ok || body.status !== 'ready') && !retainFailure) throw new AgentRequestError(body.message || body.error || '请求失败，请重试。',response.status);
        return body;
    }, [token]);

    const loadSessions = useCallback(async () => {
        const body = await request<AgentSessionVO[]>('/api/agent/sessions');
        if(currentToken.current===token)setSessions(body.data ?? []);
    }, [request,token]);

    const loadSession = useCallback(async (id: string, preferredRunId?: string, preserve = false) => {
        const current = ++selection.current;
        // Detach this view only. The server owns execution and the request key remains saved there.
        pollingAbort.current?.abort();submitActive.current=false;setSubmitting(false);setExecutionExpired(false);
        taskWriteAbort.current?.abort();setSavingTaskState(false);
        sessionAbort.current?.abort();const controller=new AbortController();sessionAbort.current=controller;
        setSessionId(id);
        if (!preserve) {setDetail(null); setRuns([]); setRunId('');}
        setError(''); setLoadingSession(true);
        try {
            const body = await request<AgentSessionDetailVO>('/api/agent/sessions/' + encodeURIComponent(id),undefined,controller.signal);
            if (current !== selection.current) return;
            if(!body.data)throw new Error('指定会话不存在或无权访问，请选择其他会话。');
            setDetail(body.data); setDatasetId(body.data.session.datasetId); restoreScope(body.data.session);
            setRuns(body.data.runs);
            if(preferredRunId&&!body.data.runs.some(run=>run.id===preferredRunId)){
                setRunId('');
                throw new Error('指定的分析结果不存在或无权访问，请从会话中选择其他结果。');
            }
            setRunId(preferredRunId && body.data.runs.some(run => run.id === preferredRunId) ? preferredRunId : body.data.runs.at(-1)?.id ?? '');
            const savedRun=body.data.runs.find(r=>r.id===preferredRunId)??body.data.runs.at(-1);if(savedRun&&!isFinanceScope(body.data.session.scope)&&!isLearningScope(body.data.session.scope))rememberReviewRecord('runId',savedRun.id,{datasetId:body.data.session.datasetId,scope:body.data.session.scope});
            const session=body.data.session,extra={sessionId:session.id,...(savedRun?{runId:savedRun.id}:{})};
            const href=isFinanceScope(session.scope)?'/dashboard/agent?'+new URLSearchParams({datasetId:session.datasetId,financeScope:JSON.stringify({years:session.scope.years}),...extra}):isLearningScope(session.scope)?'/dashboard/agent?'+new URLSearchParams({datasetId:session.datasetId,learningScope:JSON.stringify(publicLearningScope(session.scope)),...extra}):analysisHref('/dashboard/agent',{datasetId:session.datasetId,scope:publicScope(session.scope)},extra);
            window.history.replaceState(null,'',href);window.dispatchEvent(new Event('education-scope-change'));
        } catch (failure) {if (current === selection.current) setError(errorText(failure));}
        finally {if (current === selection.current) setLoadingSession(false);}
    }, [request, restoreScope]);

    useEffect(() => {
        const controller = new AbortController();
        sessionAbort.current?.abort();
        pollingAbort.current?.abort();submitActive.current=false;setSubmitting(false);
        ++selection.current;
        setDetail(null); setRuns([]); setSessionId(''); setRunId(''); setSessions([]); setDatasets([]); setDatasetId('');
        taskWriteAbort.current?.abort();setSavingTaskState(false);recoveryKeys.current.clear();
        setCapability(null); setError(''); setLoading(true); setLearningScope(initialLearningScope()); pendingRequest.current = null;
        if (!token) {setLoading(false); return () => controller.abort();}
        void Promise.allSettled([
            request<AgentCapability>('/api/agent', undefined, controller.signal, true),
            request<DatasetVO[]>('/api/education/datasets', undefined, controller.signal),
            request<AgentSessionVO[]>('/api/agent/sessions', undefined, controller.signal),
        ]).then(results => {
            if (controller.signal.aborted) return;
            const [manifest, data, history] = results;
            if (manifest.status === 'fulfilled') setCapability(manifest.value);
            else setCapability({status: 'error', message: errorText(manifest.reason), data: null});
            const errors: string[] = [];
            if (data.status === 'fulfilled') {
                const next = data.value.data ?? [];
                setDatasets(next);
                const incomingLearning = learningSelectionFromSearch(window.location.search), incoming = selectionFromSearch(window.location.search);
                const incomingId = new URLSearchParams(window.location.search).get('datasetId')??incomingLearning?.datasetId ?? incoming?.datasetId;
                const first = next.find(dataset=>dataset.id===incomingId)??next.find(dataset => dataset.origin === 'simulated' && dataset.schemaVersion === '3')??next.find(dataset => dataset.origin === 'simulated' && dataset.schemaVersion === '2') ?? next.find(dataset => dataset.origin === 'simulated') ?? next[0];
                if (first) {
                    setDatasetId(first.id);
                    if(datasetAnalysisType(first)==='finance'){setFinanceScope(financeFromLocation());}
                    else if (datasetAnalysisType(first)==='learning') setLearningScope(incomingLearning?.datasetId === first.id ? incomingLearning.learningScope : initialLearningScope());
                    else setScope(incoming?.datasetId===first.id?incoming.scope:{startDate: dayjs(first.dataCutoff).subtract(1, 'month').startOf('month').format('YYYY-MM-DD'), endDate: dayjs(first.dataCutoff).subtract(1, 'month').endOf('month').format('YYYY-MM-DD'), campusIds: [], courseIds: [], channelIds: [], dataCutoff: first.dataCutoff});
                }
            } else errors.push('数据集加载失败：' + errorText(data.reason));
            if (history.status === 'fulfilled') setSessions(history.value.data ?? []);
            else errors.push('会话加载失败：' + errorText(history.reason));
            setError(errors.join(' ')); setLoading(false);
            const params=new URLSearchParams(window.location.search),savedId=params.get('sessionId'),savedRunId=params.get('runId');
            if(!savedId&&savedRunId)void request<AgentRunVO>('/api/agent/runs/'+encodeURIComponent(savedRunId)).then(body=>{if(body.data)void loadSession(body.data.sessionId,savedRunId);}).catch(e=>setError(errorText(e)));
            if(savedId)void loadSession(savedId,params.get('runId')??undefined);
        });
        return () => controller.abort();
    }, [request, token, loadSession]);

    useEffect(() => {
        const controller = new AbortController();
        setCatalog([]); setCatalogError('');
        if (!datasetId || !token) return () => controller.abort();
        void request<{catalog: CatalogEntry[]}>('/api/education/datasets/' + encodeURIComponent(datasetId), undefined, controller.signal)
            .then(body => {if (!controller.signal.aborted) setCatalog(body.data?.catalog ?? []);})
            .catch(failure => {if (!controller.signal.aborted) setCatalogError('范围选项加载失败：' + errorText(failure));});
        return () => controller.abort();
    }, [datasetId, request, token, catalogRefresh]);

    const channelCatalogKey=JSON.stringify({datasetId,endDate:scope.endDate,dataCutoff:scope.dataCutoff,campusIds:scope.campusIds,courseIds:scope.courseIds});
    useEffect(()=>{
        const controller=new AbortController();setChannelError('');
        if(!datasetId||!token||publicMode||financeMode){setChannelOptions([]);return()=>controller.abort();}
        void request<{id:string;name:string}[]>('/api/analytics/channels/catalog',{datasetId,scope:{...publicScope(scope),channelIds:[]}},controller.signal)
            .then(body=>{if(!controller.signal.aborted)setChannelOptions(body.data??[]);})
            .catch(failure=>{if(!controller.signal.aborted){setChannelOptions([]);setChannelError('渠道选项加载失败：'+errorText(failure));}});
        return()=>controller.abort();
    },[channelCatalogKey,request,token,publicMode,financeMode,catalogRefresh]);

    const updateRun = useCallback((next: AgentRunVO) => {
        setRuns(current => current.some(run => run.id === next.id) ? current.map(run => run.id === next.id ? next : run) : [...current, next]);
    }, []);

    useEffect(() => {
        if (!runningRun || loading || loadingSession || submitting || executionExpired) return;
        const controller = new AbortController();
        const current = selection.current;
        let inFlight = false;
        const timer = setInterval(async () => {
            if (inFlight) return;
            inFlight = true;
            try {
                const progress=await request<AgentProgressVO>('/api/agent/runs/progress?runId='+encodeURIComponent(runningRun.id),undefined,controller.signal);
                if(controller.signal.aborted||current!==selection.current)return;
                if(progress.data?.expired){setExecutionExpired(true);setProgressMessage('本次执行已超过时限，可查看已保存结果。');clearInterval(timer);return;}
                const body:CapabilityResult<AgentRunVO>={status:'ready',message:'',data:progress.data?.run??null};
                if (controller.signal.aborted || current !== selection.current || !body.data) return;
                if (active(body.data)) updateRun(body.data);
                else {
                    const finished = body.data;
                    try {
                        const saved = await request<AgentSessionDetailVO>('/api/agent/sessions/' + encodeURIComponent(finished.sessionId), undefined, controller.signal);
                        if (controller.signal.aborted || current !== selection.current) return;
                        if (saved.data) {setDetail(saved.data); setRuns(saved.data.runs);}
                        else updateRun(finished);
                    } catch (failure) {
                        if (controller.signal.aborted || current !== selection.current) return;
                        updateRun(finished); setError('分析已结束，会话记录更新失败：' + errorText(failure));
                    }
                    await loadSessions();
                }
            } catch (failure) {if (!controller.signal.aborted && current === selection.current) setError('执行状态更新失败：' + errorText(failure));}
            finally {inFlight = false;}
        }, 2000);
        return () => {controller.abort(); clearInterval(timer);};
    }, [runningRun, request, updateRun, loadSessions, loading, loadingSession,submitting,executionExpired]);

    const chooseDataset = (id: string) => {
        setDatasetId(id); setError(''); pendingRequest.current = null;
        const dataset = datasets.find(item => item.id === id);
        if(dataset&&datasetAnalysisType(dataset)==='finance')setFinanceScope({years:[]});
        else if (dataset&&datasetAnalysisType(dataset)==='learning') setLearningScope(initialLearningScope());
        else setScope(dataset ? {startDate: dayjs(dataset.dataCutoff).subtract(1, 'month').startOf('month').format('YYYY-MM-DD'), endDate: dayjs(dataset.dataCutoff).subtract(1, 'month').endOf('month').format('YYYY-MM-DD'), campusIds: [], courseIds: [], channelIds: [], dataCutoff: dataset.dataCutoff} : initialScope());
    };
    const newSession = () => {
        sessionAbort.current?.abort();pollingAbort.current?.abort();taskWriteAbort.current?.abort();
        ++selection.current; pendingRequest.current = null;submitActive.current=false;setSubmitting(false);
        setExecutionExpired(false);setSavingTaskState(false);setSessionId(''); setDetail(null); setRuns([]); setRunId(''); setError(''); setLoadingSession(false);
        const url=new URL(window.location.href);['sessionId','runId','proposalId','snapshotId','reportId','taskId','prompt'].forEach(key=>url.searchParams.delete(key));window.history.replaceState(null,'',url);
    };

    // 下一轮可修改范围，每轮结果继续显示自身冻结范围。
    const applySelection = (next: {datasetId:string;scope?:AnalysisScope;learningScope?:LearningScope;financeScope?:FinanceScope}) => {
        pendingRequest.current=null;setError('');
        setDatasetId(next.datasetId);
        if (next.financeScope) setFinanceScope({years:[...next.financeScope.years]});
        else if (next.learningScope) setLearningScope(publicLearningScope(next.learningScope));
        else if (next.scope) setScope(publicScope(next.scope));
        const params=new URLSearchParams({datasetId:next.datasetId,...(sessionId?{sessionId}:{}),...(runId?{runId}:{}),...(next.financeScope?{financeScope:JSON.stringify(next.financeScope)}:next.learningScope?{learningScope:JSON.stringify(publicLearningScope(next.learningScope))}:next.scope?{scope:JSON.stringify(publicScope(next.scope))}:{})});
        window.history.replaceState(null,'',window.location.pathname+'?'+params);window.dispatchEvent(new Event('education-scope-change'));
    };

    const send = async (message: string) => {
        if (submitActive.current || !canChat || !sessionEditable || submitting || confirming || loadingSession || runningRun || capability?.status !== 'ready') return false;
        const range=financeMode?{datasetId,financeScope:{years:[...financeScope.years]}}:publicMode?{datasetId,learningScope:publicLearningScope(learningScope)}:{datasetId,scope:publicScope(scope)};
        const input={message:message.trim(),...(sessionId?{sessionId}:{}),...range};
        const signature = JSON.stringify(input);
        if (pendingRequest.current?.signature !== signature) pendingRequest.current = {signature, requestKey: crypto.randomUUID()};
        const payload: AgentRunDTO = {...input, requestKey: pendingRequest.current.requestKey};
        submitActive.current=true;setExecutionExpired(false);setSubmitting(true);setError('');setElapsed(0);setProgressMessage('正在准备分析，已有结果将自动显示。');
        const started=Date.now(),controller=new AbortController(),generation=selection.current,viewedRunId=runId;pollingAbort.current?.abort();pollingAbort.current=controller;let pollBusy=false,announcedRunId:string|undefined;
        const timer=setInterval(async()=>{if(controller.signal.aborted||generation!==selection.current){clearInterval(timer);return;}setElapsed(Math.floor((Date.now()-started)/1000));if(pollBusy)return;pollBusy=true;
         try{const progress=await request<AgentProgressVO>('/api/agent/runs/progress?requestKey='+payload.requestKey,undefined,controller.signal);const run=progress.data?.run;
          if(controller.signal.aborted||generation!==selection.current)return;
          if(run){updateRun(run);if(!announcedRunId){announcedRunId=run.id;setSessionId(run.sessionId);setRunId(previous=>!previous||previous===viewedRunId?run.id:previous);void loadSessions().catch(()=>{});}const activeStep=run.steps.find(s=>s.status==='pending'),recovery=run.steps.find(step=>step.runtime)?.runtime?.recovery;setProgressMessage(progress.data?.expired?'本次执行已超过时限，可查看保存结果。':recovery?.status==='waiting'?'模型暂时繁忙，正在自动再试一次；不会重复执行已完成的业务操作。':activeStep?'正在执行工具，已返回的事实和草稿会自动更新。':run.steps.length?'已完成以上步骤，正在继续分析。':'分析已开始，等待执行步骤。');if(progress.data?.expired)setExecutionExpired(true);if(!active(run)||progress.data?.expired)clearInterval(timer);}
         }catch{if(!controller.signal.aborted&&generation===selection.current)setProgressMessage('进度连接暂时中断，原分析仍在执行。');}finally{pollBusy=false;}
        },2000);
        try {
            const result = await request<AgentRunVO>('/api/agent/runs', payload, controller.signal, true);
            if(generation!==selection.current)return false;
            if (result.data) {
                const run = result.data;
                if (!publicMode&&!financeMode) {
                    rememberReviewRecord('runId',run.id);
                    if(run.proposals.length)rememberReviewRecord('proposalId',run.proposals.at(-1)!.id);
                }
                pendingRequest.current = null;
                setSessionId(run.sessionId); updateRun(run); setRunId(current=>!announcedRunId||current===announcedRunId?run.id:current);
                const current = selection.current;
                try {
                    const saved = await request<AgentSessionDetailVO>('/api/agent/sessions/' + encodeURIComponent(run.sessionId),undefined,controller.signal);
                    if (current === selection.current && saved.data) {setDetail(saved.data); setRuns(saved.data.runs); setDatasetId(saved.data.session.datasetId); restoreScope(saved.data.session);}
                    await loadSessions();
                } catch (failure) {if(generation===selection.current&&!controller.signal.aborted)setError('执行已保存，会话更新失败：' + errorText(failure));}
            }
            if(generation!==selection.current||controller.signal.aborted)return false;
            if (result.status !== 'ready') {
                setError(result.message || result.data?.errorMessage || '本次分析未完成，请查看执行记录。');
                if (result.status === 'unconfigured' || result.status === 'not_implemented') setCapability(previous => ({status: result.status, message: result.message, data: previous?.data ?? null}));
                return !!result.data;
            }
            if (!result.data) {setError('此次请求没有返回执行结果，请重试。'); return false;}
            return true;
        } catch (failure) {if(generation===selection.current&&!controller.signal.aborted)setError(errorText(failure) + ' 重试相同问题会沿用本次请求，避免重复执行。'); return false;}
        finally {clearInterval(timer);controller.abort();if(pollingAbort.current===controller){submitActive.current=false;if(generation===selection.current)setSubmitting(false);}}
    };

    // Only task memory is merged here. In particular, do not restore the session's saved
    // scope over a range the user has already prepared for the next question.
    const saveTaskState=async(input:{action:'update'|'clear';expectedRevision:number;goal?:string;userConditions?:string[]}):Promise<TaskStateSaveResult>=>{
        if(taskWriteActive.current||!sessionId||!sessionEditable||!canChat||submitting||confirming||runningRun||loadingSession)return {saved:false,message:'请等待当前操作结束后再修改任务。'};
        taskWriteActive.current=true;setSavingTaskState(true);
        const id=sessionId,generation=selection.current,controller=new AbortController();taskWriteAbort.current?.abort();taskWriteAbort.current=controller;
        try{
            const result=await request<TaskState>('/api/agent/sessions/'+encodeURIComponent(id)+'/task-state',input,controller.signal,false,'PATCH');
            if(controller.signal.aborted||generation!==selection.current)return {saved:false};
            if(!result.data)return {saved:false,message:'任务状态未返回，请刷新后核对。'};
            setDetail(previous=>previous?.session.id===id?{...previous,session:{...previous.session,taskState:result.data!}}:previous);
            return {saved:true};
        }catch(failure){
            if(controller.signal.aborted||generation!==selection.current)return {saved:false};
            if(failure instanceof AgentRequestError&&failure.status===409){
                try{
                    const latest=await request<AgentSessionDetailVO>('/api/agent/sessions/'+encodeURIComponent(id),undefined,controller.signal);
                    if(!controller.signal.aborted&&generation===selection.current&&latest.data)setDetail(previous=>previous?.session.id===id?{...previous,session:{...previous.session,taskState:latest.data!.session.taskState}}:previous);
                }catch{/* The form retains its draft until a later successful refresh. */}
                return {saved:false,conflict:true,message:'当前任务已被更新，输入已保留。请核对最新任务后再保存。'};
            }
            return {saved:false,message:errorText(failure)};
        }finally{taskWriteActive.current=false;if(generation===selection.current)setSavingTaskState(false);}
    };

    const retryInterpretation=async(source:AgentRunVO)=>{
        if(submitActive.current||taskWriteActive.current||!canChat||!sessionEditable||submitting||confirming||loadingSession||runningRun||source.status!=='failed'||source.sessionId!==sessionId||source.recoveryEligibility?.eligible!==true)return false;
        if(!recoveryKeys.current.has(source.id))recoveryKeys.current.set(source.id,crypto.randomUUID());
        const requestKey=recoveryKeys.current.get(source.id)!,generation=selection.current,controller=new AbortController();
        pollingAbort.current?.abort();pollingAbort.current=controller;submitActive.current=true;
        setExecutionExpired(false);setSubmitting(true);setError('');setElapsed(0);setProgressMessage('正在使用已保存的数据重新解读，不会重新查询或执行操作。');
        const started=Date.now();let pollBusy=false,announcedRunId:string|undefined;
        const viewedRunId=runId;
        const adopt=(run:AgentRunVO)=>{updateRun(run);if(!announcedRunId){announcedRunId=run.id;setRunId(previous=>!previous||previous===viewedRunId?run.id:previous);}};
        const timer=setInterval(async()=>{
            if(controller.signal.aborted||generation!==selection.current)return;
            setElapsed(Math.floor((Date.now()-started)/1000));if(pollBusy)return;pollBusy=true;
            try{
                const progress=await request<AgentProgressVO>('/api/agent/runs/progress?requestKey='+encodeURIComponent(requestKey),undefined,controller.signal);
                if(controller.signal.aborted||generation!==selection.current)return;
                if(progress.data?.run)adopt(progress.data.run);
                if(progress.data?.expired){setExecutionExpired(true);setProgressMessage('本次重新解读已超过时限，可查看已保存结果。');clearInterval(timer);}
                else if(progress.data?.run&&!active(progress.data.run))clearInterval(timer);
            }catch{if(!controller.signal.aborted&&generation===selection.current)setProgressMessage('进度连接暂时中断，重新解读仍在执行。');}
            finally{pollBusy=false;}
        },2000);
        try{
            const result=await request<AgentRunVO>('/api/agent/runs/'+encodeURIComponent(source.id)+'/retry-interpretation',{requestKey},controller.signal,true);
            if(controller.signal.aborted||generation!==selection.current)return false;
            if(result.data){
                const recovered=result.data;updateRun(recovered);setRunId(current=>!announcedRunId||current===announcedRunId?recovered.id:current);
                try{
                    const saved=await request<AgentSessionDetailVO>('/api/agent/sessions/'+encodeURIComponent(source.sessionId),undefined,controller.signal);
                    if(!controller.signal.aborted&&generation===selection.current&&saved.data){setDetail(saved.data);setRuns(saved.data.runs);}
                    await loadSessions();
                }catch(failure){if(!controller.signal.aborted&&generation===selection.current)setError('解读已保存，会话更新失败：'+errorText(failure));}
            }
            if(result.status!=='ready'||!result.data){setError(result.message||result.data?.errorMessage||'本次解读未完成，原结果仍可查看。');return false;}
            return true;
        }catch(failure){if(!controller.signal.aborted&&generation===selection.current)setError(errorText(failure)+' 再次点击将沿用本次请求，避免重复生成。');return false;}
        finally{clearInterval(timer);controller.abort();if(pollingAbort.current===controller){submitActive.current=false;if(generation===selection.current)setSubmitting(false);}}
    };

    const confirm = async (input: AgentConfirmationDTO) => {
        if (!writable || submitting || confirming) return false;
        const run = runs.find(item => item.id === input.runId);
        if(run?.context&&(isLearningScope(run.context.scope)||isFinanceScope(run.context.scope)))return false;
        const proposal = run?.proposals.find(item => item.id === input.proposalId);
        if (!proposal || proposal.status !== 'awaiting_confirmation' || proposal.version !== input.version || proposal.previewToken !== input.previewToken) {
            setError('草稿或覆盖预览已变化，请刷新结果后重新确认。'); return false;
        }
        setConfirming(true); setError('');
        try {
            const result = await request<AgentRunVO>('/api/agent/proposals/confirm', input, undefined, true);
            if (result.data) updateRun(result.data);
            if(result.data)rememberReviewRecord('proposalId',input.proposalId);
            const published = result.data?.proposals.find(proposal => proposal.id === input.proposalId && proposal.version === input.version && proposal.status === 'published' && proposal.publishedTagId);
            if (result.status !== 'ready' || !published) {setError(result.message || '确认失败，请刷新结果后核对草稿版本。'); return false;}
            try {await loadSessions();} catch (failure) {setError('标签已发布，会话列表更新失败：' + errorText(failure));}
            return true;
        } catch (failure) {setError(errorText(failure)); return false;}
        finally {setConfirming(false);}
    };

    const actionKeys=useRef(new Map<string,string>());
    const confirmAction=async(plan:ActionPlanVO)=>{
        if(!writable||submitting||confirming||loadingSession||runningRun||!selectedRun||selectedRun.id!==plan.runId)return false;
        const key=plan.id+':'+plan.version;if(!actionKeys.current.has(key))actionKeys.current.set(key,crypto.randomUUID());
        setConfirming(true);setError('');
        try{
            const result=await request<AgentRunVO>('/api/agent/actions/confirm',{runId:plan.runId,planId:plan.id,version:plan.version,requestKey:actionKeys.current.get(key)},undefined,true);
            if(result.data)updateRun(result.data);
            if(result.status!=='ready'||result.data?.actionPlan?.status!=='completed'){setError(result.message||result.data?.actionPlan?.errorMessage||'部分操作未完成，请查看各步结果后恢复。');return false;}
            return true;
        }catch(failure){setError(errorText(failure));return false;}finally{setConfirming(false);}
    };
    const editAction=async(input:{runId:string;planId:string;version:number;segmentName?:string;task?:{action:string;ownerId?:string;priority:string;dueDate:string;reviewMethod:string};report?:{kind:string;anchorDate:string}})=>{
        if(!writable||submitting||confirming||loadingSession||runningRun)return false;setConfirming(true);setError('');
        try{const result=await request<AgentRunVO>('/api/agent/actions',input,undefined,true,'PATCH');if(result.data)updateRun(result.data);if(result.status!=='ready'){setError(result.message||'修改未保存，请重新核对计划。');return false;}return true;}
        catch(failure){setError(errorText(failure));return false;}finally{setConfirming(false);}
    };

    const refresh = async () => {
        setError(''); setLoading(true);
        try {
            const [manifest, data, history] = await Promise.allSettled([
                request<AgentCapability>('/api/agent', undefined, undefined, true),
                request<DatasetVO[]>('/api/education/datasets'),
                request<AgentSessionVO[]>('/api/agent/sessions'),
            ]);
            const errors: string[] = [];
            if (manifest.status === 'fulfilled') setCapability(manifest.value);
            else setCapability({status: 'error', message: errorText(manifest.reason), data: null});
            if (data.status === 'fulfilled') {
                const next = data.value.data ?? [];
                setDatasets(next);
                if (!datasetId && !sessionId) {
                    const first = next.find(item=>item.origin==='simulated'&&item.schemaVersion==='3')??next.find(item => item.origin === 'simulated' && item.schemaVersion === '2') ?? next.find(item => item.origin === 'simulated') ?? next[0];
                    if (first) {
                        setDatasetId(first.id);
                        if(datasetAnalysisType(first)==='finance'){setFinanceScope(financeFromLocation());}
                    else if (datasetAnalysisType(first)==='learning') setLearningScope(initialLearningScope());
                        else setScope({startDate: dayjs(first.dataCutoff).subtract(1, 'month').startOf('month').format('YYYY-MM-DD'), endDate: dayjs(first.dataCutoff).subtract(1, 'month').endOf('month').format('YYYY-MM-DD'), campusIds: [], courseIds: [], channelIds: [], dataCutoff: first.dataCutoff});
                    }
                }
            } else errors.push('数据集加载失败：' + errorText(data.reason));
            if (history.status === 'fulfilled') setSessions(history.value.data ?? []);
            else errors.push('会话加载失败：' + errorText(history.reason));
            setCatalogRefresh(value => value + 1);
            if (sessionId) await loadSession(sessionId, runId, true);
            if (errors.length) setError(previous => [previous, ...errors].filter(Boolean).join(' '));
        } finally {setLoading(false);}
    };

    return {writable,canChat,user,sessionEditable, capability, datasets, catalog, channelOptions,channelError,sessions, detail, sessionId, datasetId, scope, setScope, learningScope, setLearningScope, financeScope,setFinanceScope,financeMode,publicMode, runs, selectedRun, runId, setRunId, loading, loadingSession, submitting, confirming,savingTaskState,saveTaskState,retryInterpretation, error, catalogError, running: !!runningRun&&!executionExpired,executionExpired,elapsed,progressMessage,chooseDataset, newSession, applySelection, loadSession, send, confirm,confirmAction,editAction, refresh};
}
