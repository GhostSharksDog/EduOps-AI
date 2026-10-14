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

interface CatalogEntry {id: string; kind: string; name: string;}
function financeFromLocation():FinanceScope {
    const params=new URLSearchParams(window.location.search);
    try {const parsed=financeScopeSchema.safeParse(params.has('financeScope')?JSON.parse(params.get('financeScope')!):{years:JSON.parse(params.get('financeYears')??'[]')});return parsed.success?parsed.data:{years:[]};} catch {return {years:[]};}
}
interface AgentCapability {tools: ToolDefinition[];}
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
    const user = useAuthStore(state => state.user);
    const writable = user?.role === 'admin' || user?.role === 'operator';
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
    const pollingAbort=useRef<AbortController|null>(null),submitActive=useRef(false);
    useEffect(()=>()=>pollingAbort.current?.abort(),[]);
    const [confirming, setConfirming] = useState(false);
    const [error, setError] = useState('');
    const [catalogError, setCatalogError] = useState('');
    const [catalogRefresh, setCatalogRefresh] = useState(0);
    const selection = useRef(0);
    const pendingRequest = useRef<{signature: string; requestKey: string} | null>(null);
    const selectedRun = runs.find(run => run.id === runId);
    const runningRun = runs.find(active);
    const sessionEditable = !sessionId || (!!detail && 'editable' in detail.session && detail.session.editable === true);
    const publicMode = detail?.session.id === sessionId ? isLearningScope(detail.session.scope) : datasetAnalysisType(datasets.find(dataset => dataset.id === datasetId)??{key:'',origin:'simulated'}) === 'learning';

    const financeMode=detail?.session.id===sessionId?isFinanceScope(detail.session.scope):datasetAnalysisType(datasets.find(d=>d.id===datasetId)??{key:'',origin:'simulated'})==='finance';
    const restoreScope = useCallback((session: AgentSessionVO) => {
        if(isFinanceScope(session.scope))setFinanceScope({years:[...session.scope.years]});
        else if (isLearningScope(session.scope)) setLearningScope(publicLearningScope(session.scope));
        else setScope(publicScope(session.scope));
    }, []);

    const request = useCallback(async <T,>(path: string, input?: unknown, signal?: AbortSignal, retainFailure = false): Promise<CapabilityResult<T>> => {
        let response: Response;
        try {
            response = await fetch(path, {
                method: input === undefined ? 'GET' : 'POST',
                headers: {Authorization: 'Bearer ' + token, ...(input === undefined ? {} : {'Content-Type': 'application/json'})},
                ...(input === undefined ? {} : {body: JSON.stringify(input)}), signal,
            });
        } catch (failure) {
            if (signal?.aborted) throw failure;
            throw new Error('连接失败，请检查网络后重试。');
        }
        let body: CapabilityResult<T> & {error?: string};
        try {body = await response.json();} catch {throw new Error('服务暂时没有返回有效结果，请稍后重试。');}
        if ((!response.ok || body.status !== 'ready') && !retainFailure) throw new Error(body.message || body.error || '请求失败，请重试。');
        return body;
    }, [token]);

    const loadSessions = useCallback(async () => {
        const body = await request<AgentSessionVO[]>('/api/agent/sessions');
        setSessions(body.data ?? []);
    }, [request]);

    const loadSession = useCallback(async (id: string, preferredRunId?: string, preserve = false) => {
        const current = ++selection.current;
        setSessionId(id);
        if (!preserve) {setDetail(null); setRuns([]); setRunId('');}
        setError(''); setLoadingSession(true);
        try {
            const body = await request<AgentSessionDetailVO>('/api/agent/sessions/' + encodeURIComponent(id));
            if (current !== selection.current || !body.data) return;
            setDetail(body.data); setDatasetId(body.data.session.datasetId); restoreScope(body.data.session);
            setRuns(body.data.runs);
            setRunId(preferredRunId && body.data.runs.some(run => run.id === preferredRunId) ? preferredRunId : body.data.runs.at(-1)?.id ?? '');
            const savedRun=body.data.runs.find(r=>r.id===preferredRunId)??body.data.runs.at(-1);if(savedRun&&!isFinanceScope(body.data.session.scope)&&!isLearningScope(body.data.session.scope))rememberReviewRecord('runId',savedRun.id,{datasetId:body.data.session.datasetId,scope:body.data.session.scope});
            const session=body.data.session,extra={sessionId:session.id,...(savedRun?{runId:savedRun.id}:{})};
            const href=isFinanceScope(session.scope)?'/dashboard/agent?'+new URLSearchParams({datasetId:session.datasetId,financeScope:JSON.stringify({years:session.scope.years}),...extra}):isLearningScope(session.scope)?'/dashboard/agent?'+new URLSearchParams({datasetId:session.datasetId,learningScope:JSON.stringify(publicLearningScope(session.scope)),...extra}):analysisHref('/dashboard/agent',{datasetId:session.datasetId,scope:publicScope(session.scope)},extra);
            window.history.replaceState(window.history.state,'',href);window.dispatchEvent(new Event('education-scope-change'));
        } catch (failure) {if (current === selection.current) setError(errorText(failure));}
        finally {if (current === selection.current) setLoadingSession(false);}
    }, [request, restoreScope]);

    useEffect(() => {
        const controller = new AbortController();
        ++selection.current;
        setDetail(null); setRuns([]); setSessionId(''); setRunId(''); setSessions([]); setDatasets([]); setDatasetId('');
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
            if(savedId&&history.status==='fulfilled'&&history.value.data?.some(s=>s.id===savedId))void loadSession(savedId,params.get('runId')??undefined);
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
        if (sessionId) return;
        setDatasetId(id); setError(''); pendingRequest.current = null;
        const dataset = datasets.find(item => item.id === id);
        if(dataset&&datasetAnalysisType(dataset)==='finance')setFinanceScope({years:[]});
        else if (dataset&&datasetAnalysisType(dataset)==='learning') setLearningScope(initialLearningScope());
        else setScope(dataset ? {startDate: dayjs(dataset.dataCutoff).subtract(1, 'month').startOf('month').format('YYYY-MM-DD'), endDate: dayjs(dataset.dataCutoff).subtract(1, 'month').endOf('month').format('YYYY-MM-DD'), campusIds: [], courseIds: [], channelIds: [], dataCutoff: dataset.dataCutoff} : initialScope());
    };
    const newSession = () => {
        ++selection.current; pendingRequest.current = null;
        setExecutionExpired(false);setSessionId(''); setDetail(null); setRuns([]); setRunId(''); setError(''); setLoadingSession(false);
        const url=new URL(window.location.href);['sessionId','runId','proposalId','snapshotId','reportId','taskId','prompt'].forEach(key=>url.searchParams.delete(key));window.history.replaceState(window.history.state,'',url);
    };

    // 编辑中的范围不会触发查询；应用时一起切换，已有会话继续保留原范围。
    const applySelection = (next: {datasetId:string;scope?:AnalysisScope;learningScope?:LearningScope;financeScope?:FinanceScope}) => {
        newSession();
        setDatasetId(next.datasetId);
        if (next.financeScope) setFinanceScope({years:[...next.financeScope.years]});
        else if (next.learningScope) setLearningScope(publicLearningScope(next.learningScope));
        else if (next.scope) setScope(publicScope(next.scope));
        const params=new URLSearchParams({datasetId:next.datasetId,...(next.financeScope?{financeScope:JSON.stringify(next.financeScope)}:next.learningScope?{learningScope:JSON.stringify(publicLearningScope(next.learningScope))}:next.scope?{scope:JSON.stringify(publicScope(next.scope))}:{})});
        window.history.replaceState(window.history.state,'',window.location.pathname+'?'+params);window.dispatchEvent(new Event('education-scope-change'));
    };

    const send = async (message: string) => {
        if (submitActive.current || !writable || !sessionEditable || submitting || confirming || loadingSession || runningRun || capability?.status !== 'ready') return false;
        const input = sessionId ? {message: message.trim(), sessionId} : financeMode ? {message:message.trim(),datasetId,financeScope:{years:[...financeScope.years]}} : publicMode ? {message: message.trim(), datasetId, learningScope: publicLearningScope(learningScope)} : {message: message.trim(), datasetId, scope: publicScope(scope)};
        const signature = JSON.stringify(input);
        if (pendingRequest.current?.signature !== signature) pendingRequest.current = {signature, requestKey: crypto.randomUUID()};
        const payload: AgentRunDTO = {...input, requestKey: pendingRequest.current.requestKey};
        submitActive.current=true;setExecutionExpired(false);setSubmitting(true);setError('');setElapsed(0);setProgressMessage('正在准备分析，已有结果将自动显示。');
        const started=Date.now(),controller=new AbortController();pollingAbort.current?.abort();pollingAbort.current=controller;let pollBusy=false;
        const timer=setInterval(async()=>{setElapsed(Math.floor((Date.now()-started)/1000));if(pollBusy||controller.signal.aborted)return;pollBusy=true;
         try{const progress=await request<AgentProgressVO>('/api/agent/runs/progress?requestKey='+payload.requestKey,undefined,controller.signal);const run=progress.data?.run;
          if(run){updateRun(run);setRunId(run.id);const activeStep=run.steps.find(s=>s.status==='pending');setProgressMessage(progress.data?.expired?'本次执行已超过时限，可查看保存结果。':activeStep?'正在执行工具，已返回的事实和草稿会自动更新。':run.steps.length?'已完成以上步骤，正在继续分析。':'分析已开始，等待执行步骤。');if(progress.data?.expired)setExecutionExpired(true);if(!active(run)||progress.data?.expired)clearInterval(timer);}
         }catch{if(!controller.signal.aborted)setProgressMessage('进度连接暂时中断，原分析仍在执行。');}finally{pollBusy=false;}
        },2000);
        try {
            const result = await request<AgentRunVO>('/api/agent/runs', payload, undefined, true);
            if (result.data) {
                const run = result.data;
                if (!publicMode&&!financeMode) {
                    rememberReviewRecord('runId',run.id);
                    if(run.proposals.length)rememberReviewRecord('proposalId',run.proposals.at(-1)!.id);
                }
                pendingRequest.current = null;
                setSessionId(run.sessionId); updateRun(run); setRunId(run.id);
                const current = selection.current;
                try {
                    const saved = await request<AgentSessionDetailVO>('/api/agent/sessions/' + encodeURIComponent(run.sessionId));
                    if (current === selection.current && saved.data) {setDetail(saved.data); setRuns(saved.data.runs); setDatasetId(saved.data.session.datasetId); restoreScope(saved.data.session);}
                    await loadSessions();
                } catch (failure) {setError('执行已保存，会话更新失败：' + errorText(failure));}
            }
            if (result.status !== 'ready') {
                setError(result.message || result.data?.errorMessage || '本次分析未完成，请查看执行记录。');
                if (result.status === 'unconfigured' || result.status === 'not_implemented') setCapability(previous => ({status: result.status, message: result.message, data: previous?.data ?? null}));
                return !!result.data;
            }
            if (!result.data) {setError('此次请求没有返回执行结果，请重试。'); return false;}
            return true;
        } catch (failure) {setError(errorText(failure) + ' 重试相同问题会沿用本次请求，避免重复执行。'); return false;}
        finally {clearInterval(timer);controller.abort();submitActive.current=false;setSubmitting(false);}
    };

    const confirm = async (input: AgentConfirmationDTO) => {
        if (!writable || publicMode || financeMode || submitting || confirming) return false;
        const run = runs.find(item => item.id === input.runId);
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

    return {writable, sessionEditable, capability, datasets, catalog, channelOptions,channelError,sessions, detail, sessionId, datasetId, scope, setScope, learningScope, setLearningScope, financeScope,setFinanceScope,financeMode,publicMode, runs, selectedRun, runId, setRunId, loading, loadingSession, submitting, confirming, error, catalogError, running: !!runningRun&&!executionExpired,executionExpired,elapsed,progressMessage,chooseDataset, newSession, applySelection, loadSession, send, confirm, refresh};
}

