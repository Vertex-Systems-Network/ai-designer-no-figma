import { discoverBridge } from './bridge-discovery';
const defaultBridgeUrl = 'http://localhost:8788';
import React, { useEffect, useMemo, useRef, useState } from 'react';
import { createRoot } from 'react-dom/client';
import { auditDesignQuality, parseDesignSpec, type DesignSpec, type ValidationIssue } from '../shared/spec';
import type { EditPatch, HostToUi, UiToHost } from '../shared/protocol';
import { MAX_PATCH_IMAGE_BYTES, parseEditPatch } from '../shared/edit-patch';
import { encodeBase64 } from '../shared/base64';
import { buildDesignPrompt, buildDesignSystemPrompt, buildFigmaReferencePrompt, buildPatchPrompt } from '../shared/prompts';
import { sanitizeSvg } from '../shared/assets';
import { utf8ByteLength } from '../shared/utf8';
import { clearStoredAssets, configureStoredAssetBridge, deleteStoredAsset, initializeAssetLibraryBridge, listStoredAssets, readStoredAsset, saveStoredAsset, type AssetPayload, type AssetSummary } from './asset-library';
import './styles.css';

const vsnLogo = document.querySelector<HTMLImageElement>('.boot-logo')?.src ?? '';

type Tab = 'Generate' | 'Edit' | 'Design System' | 'Import' | 'AI Assets' | 'History' | 'Agent Activity' | 'Settings';
type Model = { name: string; details?: { parameter_size?: string } };
type HistoryItem = { id: string; prompt: string; model: string; createdAt: string; spec: DesignSpec };
type Token = { id: string; name: string; color: string };
type TypographyToken = {id:string;name:string;fontFamily:string;fontSize:number;fontWeight:number;lineHeight:number};
type SpacingToken = {id:string;name:string;value:number};
type DesignPreset = {id:string;name:string;createdAt:string;colors:Token[];typography:TypographyToken[];spacing:SpacingToken[]};
type GenerationMode = 'handoff' | 'ollama';
type AssetRecord=AssetSummary;
const defaultUrl = 'http://localhost:8787';
function safeEndpoint(value: string): string {
  try {
    const url = new URL(value);
    if (url.protocol === 'http:' && ['localhost','127.0.0.1','[::1]'].includes(url.hostname) && url.port === '8787') return defaultUrl;
  } catch { /* Use the safe default for invalid stored settings. */ }
  return defaultUrl;
}
const promptTemplate = `Return one JSON object only. Use this schema: {"schemaVersion":"1.0","name":"Design name","pages":[{"id":"page-1","name":"Page name","children":[{"type":"frame","id":"frame-1","name":"Main frame","width":1440,"height":900,"fill":"#FFFFFF","children":[{"type":"text","id":"title-1","name":"Title","x":48,"y":48,"width":600,"height":60,"text":"A clear heading","fontSize":36,"fontWeight":700,"color":"#171A1E"}]}]}]}. Supported types: frame, group, text, rectangle, ellipse, line. Give every id a unique stable value and make all layers editable. Do not include markdown.`;
const navTabs: Tab[] = ['Generate', 'Edit', 'Design System', 'Import', 'AI Assets', 'History', 'Agent Activity'];
function post(message: UiToHost) { parent.postMessage({ pluginMessage: message }, '*'); }
function createLocalId(prefix='item'): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') return crypto.randomUUID();
  return `${prefix}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2,10)}`;
}
function HeaderIcon({kind}:{kind:'sun'|'moon'|'settings'|'resize'|'refresh'|'copy'|'clear'|'remove'|'apply'|'undo'}) {
  if(kind==='sun')return <svg aria-hidden="true" viewBox="0 0 20 20" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round"><circle cx="10" cy="10" r="3.2"/><path d="M10 1.8v2M10 16.2v2M1.8 10h2M16.2 10h2M4.2 4.2l1.4 1.4m8.8 8.8 1.4 1.4m0-11.6-1.4 1.4m-8.8 8.8-1.4 1.4"/></svg>;
  if(kind==='moon')return <svg aria-hidden="true" viewBox="0 0 20 20" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"><path d="M16.7 12.7A7.2 7.2 0 0 1 7.3 3.3 7.3 7.3 0 1 0 16.7 12.7Z"/></svg>;
  if(kind==='settings')return <svg aria-hidden="true" viewBox="0 0 20 20" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><circle cx="10" cy="10" r="2.5"/><path d="m8.4 2.5.4-1h2.4l.4 1a7.8 7.8 0 0 1 1.5.6l1-.5 1.7 1.7-.5 1a7.8 7.8 0 0 1 .6 1.5l1 .4v2.4l-1 .4a7.8 7.8 0 0 1-.6 1.5l.5 1-1.7 1.7-1-.5a7.8 7.8 0 0 1-1.5.6l-.4 1H8.8l-.4-1a7.8 7.8 0 0 1-1.5-.6l-1 .5-1.7-1.7.5-1a7.8 7.8 0 0 1-.6-1.5l-1-.4V7.2l1-.4a7.8 7.8 0 0 1 .6-1.5l-.5-1 1.7-1.7 1 .5a7.8 7.8 0 0 1 1.5-.6Z"/></svg>;
  if(kind==='resize')return <svg aria-hidden="true" viewBox="0 0 20 20" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round"><path d="M3 13v4h4M17 7V3h-4M3 17l5-5M17 3l-5 5"/></svg>;
  if(kind==='refresh')return <svg aria-hidden="true" viewBox="0 0 20 20" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round"><path d="M16.8 8A7 7 0 0 0 4.5 5.2L3 7m0 0V3.5M3 7h3.5M3.2 12A7 7 0 0 0 15.5 14.8L17 13m0 0v3.5M17 13h-3.5"/></svg>;
  if(kind==='copy')return <svg aria-hidden="true" viewBox="0 0 20 20" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"><rect x="7" y="6" width="10" height="11" rx="1.5"/><path d="M13 6V4.5A1.5 1.5 0 0 0 11.5 3h-7A1.5 1.5 0 0 0 3 4.5v8A1.5 1.5 0 0 0 4.5 14H7"/></svg>;
  if(kind==='clear')return <svg aria-hidden="true" viewBox="0 0 20 20" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"><path d="m5 5 10 10M15 5 5 15"/></svg>;
  if(kind==='remove')return <svg aria-hidden="true" viewBox="0 0 20 20" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><path d="M3.5 5.5h13M8 5.5V3.7h4v1.8m3.2 0-.7 10.8H5.5L4.8 5.5M8 8.5v5m4-5v5"/></svg>;
  if(kind==='undo')return <svg aria-hidden="true" viewBox="0 0 20 20" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round"><path d="M4 7h7a5 5 0 1 1-4.7 6.7M4 7l3-3M4 7l3 3"/></svg>;
  return <svg aria-hidden="true" viewBox="0 0 20 20" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="m4 10.5 4 4 8-9"/></svg>;
}
function load<T>(key: string, fallback: T): T { try { const value = localStorage.getItem(key); return value ? JSON.parse(value) as T : fallback; } catch { return fallback; } }
function save(key: string, value: unknown): void { try { localStorage.setItem(key, JSON.stringify(value)); } catch { /* Figma may deny iframe storage; keep the current session usable. */ } }
function ensureIds<T extends {id?:string}>(values:T[],prefix:string):(T&{id:string})[]{const used=new Set<string>();return values.map(value=>{let id=typeof value.id==='string'&&value.id.trim()?value.id: createLocalId(prefix);if(used.has(id))id=createLocalId(prefix);used.add(id);return{...value,id};});}
function App() {
  const [tab, setTab] = useState<Tab>('Generate');
  const [loaderPhase, setLoaderPhase] = useState<'visible'|'leaving'|'hidden'>('visible');
  const [theme, setTheme] = useState<'dark'|'light'>(() => load('adnf-theme','dark'));
  const [baseUrl, setBaseUrl] = useState(() => safeEndpoint(load<string>('adnf-endpoint',defaultUrl)));
  const [generationMode, setGenerationMode] = useState<GenerationMode>(() => load<GenerationMode>('adnf-generation-mode','handoff')==='ollama'?'ollama':'handoff');
  const [endpointDraft, setEndpointDraft] = useState(baseUrl);
  const [runtime, setRuntime] = useState<'checking'|'connected'|'disconnected'>('checking');
  const [models, setModels] = useState<Model[]>([]);
  const [model, setModel] = useState('');
  const [prompt, setPrompt] = useState('');
  const [figmaReference, setFigmaReference] = useState('');
  const [preparedPrompt, setPreparedPrompt] = useState('');
  const [preparedPatchPrompt, setPreparedPatchPrompt] = useState('');
  const [externalPatchJson, setExternalPatchJson] = useState('');
  const [category, setCategory] = useState('Website');
  const [style, setStyle] = useState('Refined editorial');
  const [platform, setPlatform] = useState('Desktop');
  const [canvasSize, setCanvasSize] = useState('1440x900');
  const [customWidth, setCustomWidth] = useState(1440);
  const [customHeight, setCustomHeight] = useState(900);
  const [brandColor, setBrandColor] = useState('#0D8A60');
  const [density, setDensity] = useState('Balanced');
  const [typography, setTypography] = useState('Inter / system UI');
  const [complexity, setComplexity] = useState('Standard');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('Ready');
  const [copyFallback, setCopyFallback] = useState('');
  const [issues, setIssues] = useState<ValidationIssue[]>([]);
  const [spec, setSpec] = useState<DesignSpec|null>(null);
  const [jsonInput, setJsonInput] = useState('');
  const [selection, setSelection] = useState<Extract<HostToUi,{type:'selection'}>['summary']>(null);
  const [editPrompt, setEditPrompt] = useState('');
  const [imageScaleMode,setImageScaleMode]=useState<'FILL'|'FIT'|'CROP'|'TILE'>('FILL');
  const [imageTransformText,setImageTransformText]=useState('[[1,0,0],[0,1,0]]');
  const [imageScalingFactor,setImageScalingFactor]=useState(1);
  const [patch, setPatch] = useState<EditPatch|null>(null);
  const [undoCount, setUndoCount] = useState(0);
  const [history, setHistory] = useState<HistoryItem[]>(() => load('adnf-history',[]));
  const [tokens, setTokens] = useState<Token[]>(() => load('adnf-tokens',[
    {id:'brand-primary',name:'Primary',color:'#0D8A60'}, {id:'ink',name:'Ink',color:'#171A1E'}, {id:'surface',name:'Surface',color:'#F6F7F8'},
  ]));
  const [tokenName, setTokenName] = useState('');
  const [tokenColor, setTokenColor] = useState('#0D8A60');
  const [typeTokens,setTypeTokens]=useState<TypographyToken[]>(()=>load('adnf-type-tokens',[
    {id:'type-heading',name:'Heading',fontFamily:'Inter',fontSize:28,fontWeight:700,lineHeight:34},
    {id:'type-body',name:'Body',fontFamily:'Inter',fontSize:14,fontWeight:400,lineHeight:20},
    {id:'type-label',name:'Label',fontFamily:'Inter',fontSize:12,fontWeight:500,lineHeight:16},
  ]));
  const [spacingTokens,setSpacingTokens]=useState<SpacingToken[]>(()=>load('adnf-spacing-tokens',[4,8,12,16,24,32].map(value=>({id:`space-${value}`,name:`Space ${value}`,value}))));
  const [typeName,setTypeName]=useState('');
  const [typeSize,setTypeSize]=useState(16);
  const [spaceValue,setSpaceValue]=useState(20);
  const [presets,setPresets]=useState<DesignPreset[]>(()=>load('adnf-design-presets',[]));
  const [presetName,setPresetName]=useState('');
  const [selectedPreset,setSelectedPreset]=useState('');
  const [fontFallback, setFontFallback] = useState(() => load('adnf-font-fallback','Inter'));
  const [assetSvg,setAssetSvg]=useState('');
  const [assetName,setAssetName]=useState('Imported asset');
  const [assetBusy,setAssetBusy]=useState(false);
  const [assetRecords,setAssetRecords]=useState<AssetRecord[]>([]);
  const [assetPreview,setAssetPreview]=useState<{url:string;name:string}|null>(null);
  const [bridgeUrl, setBridgeUrl] = useState(() => load('adnf-bridge-url',defaultBridgeUrl));
  const [bridgeToken, setBridgeToken] = useState(() => load('adnf-bridge-token',''));
  const [agentStatus, setAgentStatus] = useState<Extract<HostToUi,{type:'agent-status'}>>({type:'agent-status',status:'disconnected',message:'Pair a local MCP client from Settings.'});
  const [agentEvents, setAgentEvents] = useState<Array<Extract<HostToUi,{type:'agent-event'}>>>([]);
  const [figmaUser,setFigmaUser]=useState<Extract<HostToUi,{type:'current-user'}>>({type:'current-user',name:'Figma user',photoUrl:null,signedIn:false});
  const activeController = useRef<AbortController|null>(null);
  const reconnectingAgent = useRef(false);
  const bridgeEpoch=useRef(0);
  const bridgeSession=useRef('');
  const bridgeWaiters=useRef(new Map<string,(message:Extract<HostToUi,{type:'bridge-job-result'}>)=>void>());
  const historySource = useRef<{prompt:string;model:string}|null>(null);
  const pendingRenderHistory = useRef<HistoryItem|null>(null);
  const pendingAsset = useRef<{payload:AssetPayload}|null>(null);
  const cropTarget=selection?.nodes.find(node=>node.hasImageFill);

  useEffect(() => {
    const leave=setTimeout(()=>setLoaderPhase('leaving'),850);
    const remove=setTimeout(()=>setLoaderPhase('hidden'),1180);
    return()=>{clearTimeout(leave);clearTimeout(remove);};
  },[]);
  useEffect(() => { document.documentElement.dataset.theme=theme; save('adnf-theme',theme); },[theme]);
  useEffect(() => {
    const width=Math.max(360,Math.min(760,load<number>('adnf-panel-width',440)));
    const height=Math.max(520,Math.min(1000,load<number>('adnf-panel-height',720)));
    post({type:'resize-ui',width,height});
  },[]);
  useEffect(() => { save('adnf-history',history.slice(0,40)); },[history]);
  useEffect(()=>{setImageScaleMode(cropTarget?.imageScaleMode??'FILL');setImageTransformText(JSON.stringify(cropTarget?.imageTransform??[[1,0,0],[0,1,0]]));setImageScalingFactor(cropTarget?.imageScalingFactor??1);},[cropTarget?.id,cropTarget?.imageScaleMode,cropTarget?.imageScalingFactor,JSON.stringify(cropTarget?.imageTransform)]);
  useEffect(() => { save('adnf-tokens',tokens); },[tokens]);
  useEffect(()=>{save('adnf-type-tokens',typeTokens);},[typeTokens]);
  useEffect(()=>{save('adnf-spacing-tokens',spacingTokens);},[spacingTokens]);
  useEffect(()=>{save('adnf-design-presets',presets.slice(0,20));},[presets]);
  useEffect(()=>()=>{if(assetPreview?.url)URL.revokeObjectURL(assetPreview.url);},[assetPreview]);
  useEffect(() => {
    initializeAssetLibraryBridge();
    if(bridgeToken){configureStoredAssetBridge(bridgeUrl,bridgeToken);void listStoredAssets().then(setAssetRecords).catch(()=>{});}
    post({type:'inspect-selection'});
    if (bridgeToken) void connectLocalAgent(false);
    const receive=(event:MessageEvent)=>{ const msg=event.data?.pluginMessage as HostToUi|undefined; if(!msg)return;
      if(msg.type==='current-user')setFigmaUser(msg);
      if(msg.type==='bridge-job-result')bridgeWaiters.current.get(msg.jobId)?.(msg);
      if(msg.type==='agent-status'){
        setAgentStatus(msg);
        if(msg.status==='connected') { setNotice('Claude is connected to Figma. Ready for your request.'); setError(''); }
        else if(msg.status==='error') {
          setError(msg.message??'Could not connect Claude to Figma.');
          if(msg.message?.startsWith('UNAUTHORIZED:')&&!reconnectingAgent.current){
            reconnectingAgent.current=true;setNotice('Restoring the Claude connection…');
            window.setTimeout(()=>{void connectLocalAgent().finally(()=>{reconnectingAgent.current=false;});},250);
          }
        }
        else if(msg.status==='disconnected'&&msg.message) { setError(msg.message); }
      }
      if(msg.type==='agent-event')setAgentEvents(items=>[msg,...items.filter(item=>item.id!==msg.id)].slice(0,50));
      if(msg.type==='asset-result'){
        setAssetBusy(false);
        if(msg.ok&&msg.kind&&msg.name&&msg.nodeId&&typeof msg.width==='number'&&typeof msg.height==='number'){
          const pending=pendingAsset.current;pendingAsset.current=null;
          if(pending){void saveStoredAsset({name:msg.name,kind:msg.kind,createdAt:new Date().toISOString(),width:msg.width,height:msg.height,nodeId:msg.nodeId,...(msg.mimeType?{mimeType:msg.mimeType}:{}),bytes:msg.bytes??(pending.payload.kind==='svg'?utf8ByteLength(pending.payload.content):pending.payload.content.byteLength),payload:pending.payload}).then(result=>{setAssetRecords(items=>[result.asset,...items.filter(item=>item.sha256!==result.asset.sha256)].slice(0,50));setNotice(result.duplicate?'Asset inserted; its existing local library entry was updated.':'Asset inserted and saved to the local library.');}).catch(error=>{setNotice(msg.message);setError(`Inserted into Figma, but local library save failed: ${error instanceof Error?error.message:'storage unavailable'}`);});}
          else setNotice(msg.message);
          setError('');
        }else if(!msg.ok)setError(msg.message);
      }
      if(msg.type==='selection')setSelection(msg.summary);
      if(msg.type==='export-result'){
        setBusy(false);
        if(msg.ok&&msg.spec){setSpec(msg.spec);setJsonInput(JSON.stringify(msg.spec,null,2));setIssues([]);setError('');setNotice(msg.message);}
        else setError(msg.message);
      }
      if(msg.type==='render-result'){
        setBusy(false);setError('');setNotice(msg.message);
        const item=pendingRenderHistory.current;pendingRenderHistory.current=null;
        if(msg.ok&&item)setHistory(items=>[item,...items].slice(0,40));
      }
      if(msg.type==='patch-result'){setBusy(false);setError('');setNotice(msg.message);if(typeof msg.undoCount==='number')setUndoCount(msg.undoCount);}
      if(msg.type==='error'){pendingRenderHistory.current=null;pendingAsset.current=null;setAssetBusy(false);setBusy(false);setError(`${msg.code}: ${msg.message}`);}
    };
    window.addEventListener('message',receive);post({type:'ui-ready'}); return ()=>window.removeEventListener('message',receive);
  },[]);
  async function connectLocalAgent(hideOnConnect=true){
    setAgentStatus({type:'agent-status',status:'connecting',message:'Connecting Claude to this Figma file…'});
    setError('');setNotice('Connecting Claude to Figma…');
    try{
      const result=await discoverBridge();
      setBridgeUrl(result.endpoint);setBridgeToken(result.token);
      configureStoredAssetBridge(result.endpoint,result.token);
      save('adnf-bridge-url',result.endpoint);save('adnf-bridge-token',result.token);
      void listStoredAssets().then(setAssetRecords).catch(()=>{});
      setNotice('Claude found. Connecting to this Figma file…');
      await startBridgePolling(result.endpoint,result.token);
      setNotice('Claude connected. Figma work will continue in the background.');
      if(hideOnConnect)post({type:'hide-ui'});
    }catch(error){
      const reason=error instanceof Error?error.message:'No local AI Designer bridge found.';
      setAgentStatus({type:'agent-status',status:'disconnected',message:reason});setError(reason);setNotice('');
    }
  }

  async function startBridgePolling(endpoint:string,token:string):Promise<void>{
    const epoch=++bridgeEpoch.current;
    if(!bridgeSession.current)bridgeSession.current=load('adnf-bridge-session',`figma-${Date.now().toString(36)}-${Math.random().toString(36).slice(2,10)}`);
    save('adnf-bridge-session',bridgeSession.current);
    const sessionId=bridgeSession.current;
    let readyResolved=false;
    let resolveReady!:()=>void;
    let rejectReady!:(error:Error)=>void;
    const ready=new Promise<void>((resolve,reject)=>{resolveReady=resolve;rejectReady=reject;});
    const request=async<T,>(path:string,method:'GET'|'POST',body?:unknown):Promise<T>=>{
      const controller=new AbortController();const timer=window.setTimeout(()=>controller.abort(),8000);
      try{
        const response=await fetch(`${endpoint.replace(/\/$/,'')}${path}`,{method,headers:{Authorization:`Bearer ${token}`,...(body?{'Content-Type':'application/json'}:{})},...(body?{body:JSON.stringify(body)}:{}),signal:controller.signal});
        const data=await response.json() as T&{error?:{code?:string;message?:string}};
        if(!response.ok)throw new Error(`${data.error?.code??'BRIDGE_HTTP_ERROR'}: ${data.error?.message??`Bridge returned ${response.status}.`}`);
        return data;
      }finally{window.clearTimeout(timer);}
    };
    const pause=(ms:number)=>new Promise<void>(resolve=>window.setTimeout(resolve,ms));
    let registered=false;let connected=false;let heartbeatTimer=0;
    void (async()=>{
      try{
       while(epoch===bridgeEpoch.current){
        try{
          if(!registered){await request('/bridge/sessions/connect','POST',{sessionId,pluginVersion:'0.2.0'});registered=true;post({type:'configure-bridge',endpoint,token,sessionId});}
          const next=await request<{job:import('../shared/bridge-contract').BridgeJob|null}>(`/bridge/sessions/${sessionId}/jobs/next`,'GET');
          if(!connected){connected=true;readyResolved=true;resolveReady();setAgentStatus({type:'agent-status',status:'connected',sessionId,message:'Claude is connected to this Figma file.'});}
          if(next.job){
            const job=next.job;setAgentStatus({type:'agent-status',status:'working',sessionId,jobId:job.jobId,agentLabel:job.agentLabel,operation:job.operation.type});
            heartbeatTimer=window.setInterval(()=>{void request('/bridge/sessions/heartbeat','POST',{sessionId}).catch(()=>{});},15000);
            const result=await new Promise<Extract<HostToUi,{type:'bridge-job-result'}>>((resolve,reject)=>{
              const timeout=window.setTimeout(()=>{bridgeWaiters.current.delete(job.jobId);reject(new Error('Figma did not return a result within five minutes. Reopen the plugin and reconnect.'));},300000);
              bridgeWaiters.current.set(job.jobId,message=>{window.clearTimeout(timeout);bridgeWaiters.current.delete(job.jobId);resolve(message);});
              post({type:'bridge-job',job});
            });
            await request(`/bridge/jobs/${job.jobId}/result`,'POST',{sessionId,ok:result.ok,...(result.ok?{result:result.result}:{error:result.error})});
            setAgentStatus({type:'agent-status',status:'connected',sessionId,message:result.ok?'Figma finished the requested operation.':'Figma could not complete the requested operation.'});
          }else await pause(900);
        }catch(error){
          if(epoch!==bridgeEpoch.current)return;
          registered=false;connected=false;
          const message=error instanceof Error?error.message:'Local bridge connection failed.';
          setAgentStatus({type:'agent-status',status:'error',sessionId,message});
          if(!readyResolved){readyResolved=true;rejectReady(error instanceof Error?error:new Error(message));}
          await pause(1800);
        }finally{if(heartbeatTimer){window.clearInterval(heartbeatTimer);heartbeatTimer=0;}}
       }
      }finally{if(heartbeatTimer)window.clearInterval(heartbeatTimer);}
    })();
    return ready;
  }

  async function refreshModels() {
    setRuntime('checking');
    try {
      const health=await fetch(`${baseUrl}/api/health`,{signal:AbortSignal.timeout(2500)}); if(!health.ok)throw new Error('Local service is not responding.');
      const response=await fetch(`${baseUrl}/api/models`,{signal:AbortSignal.timeout(3500)}); if(!response.ok)throw new Error('Runtime connected, but Ollama is unavailable.');
      const result=await response.json() as {models?:Model[]}; const found=result.models??[]; setModels(found); setRuntime('connected');
      setModel(current=>current&&found.some(m=>m.name===current)?current:found[0]?.name??'');
      setError('');if(!found.length)setNotice('Ollama is connected, but no local models are installed. Manual JSON import remains available.');
    } catch(err) {setModels([]);setRuntime('disconnected');setError(err instanceof Error?err.message:'Could not connect to the local service.');}
  }
  useEffect(()=>{
    save('adnf-generation-mode',generationMode);
    if(generationMode==='ollama')void refreshModels();
    else{setRuntime('disconnected');setModels([]);setError('');setNotice('External AI handoff is ready. No API key or Ollama runtime required.');}
  },[baseUrl,generationMode]);
  async function callModel(input:{prompt:string;mode?:'design'|'patch'}) {
    if(!model)throw new Error('Choose an installed local model first.');
    const controller=new AbortController();activeController.current=controller;const timeout=setTimeout(()=>controller.abort(),185000);
    try {
      const resolvedCanvas=canvasSize==='custom'?`${customWidth}x${customHeight}`:canvasSize;
      const response=await fetch(`${baseUrl}/api/generate`,{method:'POST',headers:{'Content-Type':'application/json','X-AI-Designer-Local':'1'},body:JSON.stringify({model,prompt:input.prompt,category,style,mode:input.mode??'design',platform,canvasSize:resolvedCanvas,brandColor,density,typography,complexity}),signal:controller.signal});
      if(!response.ok){const data=await response.json() as {error?:{message?:string}};throw new Error(data.error?.message??`Generation failed (${response.status}).`);}
      if(response.headers.get('content-type')?.includes('application/json')){const data=await response.json() as {response?:string;error?:{message?:string}};if(data.error)throw new Error(data.error.message??'Local model request failed.');return data.response??'';}
      if(!response.body)throw new Error('The local model did not return a response stream.');
      const reader=response.body.getReader();const decoder=new TextDecoder();let pending='';let output='';let chunks=0;let lastProgress=0;
      const consume=(line:string)=>{if(!line.trim())return;const item=JSON.parse(line) as {response?:unknown;error?:{message?:string};done?:boolean};if(item.error)throw new Error(item.error.message??'Local model stream failed.');if(typeof item.response==='string'){output+=item.response;chunks++;if(output.length>512_000)throw new Error('Local model response exceeded the 500 KB limit.');const now=Date.now();if(chunks===1||now-lastProgress>350){setNotice(`Receiving local model output (${output.length.toLocaleString()} characters)…`);lastProgress=now;}}};
      try{while(true){const {value,done}=await reader.read();if(done)break;pending+=decoder.decode(value,{stream:true});const lines=pending.split('\n');pending=lines.pop()??'';for(const line of lines)consume(line);}pending+=decoder.decode();if(pending.trim())consume(pending);}finally{reader.releaseLock();}
      return output;
    } finally {clearTimeout(timeout);activeController.current=null;}
  }
  async function generate() {
    if(generationMode==='handoff'){
      if(!prompt.trim()){setError('Describe the interface you want to create.');return;}
      if(!/^#[0-9a-f]{6}$/i.test(brandColor)){setError('Brand color must be a six-digit hex value.');return;}
      let referenceBrief:string;
      try{referenceBrief=buildFigmaReferencePrompt(figmaReference);}catch(err){setError(err instanceof Error?err.message:'Invalid reference context.');return;}
      historySource.current={prompt:prompt.trim(),model:'External AI handoff'};
      setPreparedPrompt(`${buildDesignPrompt(prompt,{category,platform,canvasSize:canvasSize==='custom'?`${customWidth}x${customHeight}`:canvasSize,style,brandColor,density,typography,complexity})}${designSystemBrief()}${referenceBrief}`);
      setError('');setNotice('Prompt is ready. Copy it to the AI desktop app or chat you already use, then paste its JSON response in Import.');return;
    }
    if(!prompt.trim()){setError('Describe the interface you want to create.');return;}
    if(!/^#[0-9a-f]{6}$/i.test(brandColor)){setError('Brand color must be a six-digit hex value.');return;}
    setBusy(true);setError('');setNotice('Asking the selected local model for structured design JSON…');setIssues([]);setSpec(null);
    try {const output=await callModel({prompt:`${prompt}${designSystemBrief()}`});const result=parseDesignSpec(output);setIssues(result.issues);
      if(!result.valid||!result.value)throw new Error(result.issues.map(i=>`${i.path}: ${i.message}`).join('\n')||'Model returned an invalid specification.');
      historySource.current={prompt:prompt.trim(),model};setSpec(result.value);setJsonInput(JSON.stringify(result.value,null,2));setNotice('Specification validated. Review it, then insert editable layers into Figma.');
    }catch(err){if(err instanceof DOMException&&err.name==='AbortError')setNotice('Generation cancelled.');else setError(err instanceof Error?err.message:'Generation failed.');}finally{setBusy(false);}
  }
  async function copyText(value:string,success:string){
    setCopyFallback('');
    try{if(!navigator.clipboard)throw new Error('Clipboard API unavailable.');await navigator.clipboard.writeText(value);setNotice(success);setError('');return;}
    catch{ /* Fall back to the legacy clipboard command used by embedded plugin iframes. */ }
    try{
      const field=document.createElement('textarea');field.value=value;field.setAttribute('readonly','');
      field.style.position='fixed';field.style.left='-10000px';field.style.top='0';document.body.appendChild(field);field.focus();field.select();
      const copied=document.execCommand('copy');field.remove();
      if(copied){setNotice(success);setError('');return;}
    }catch{ /* Keep a visible, selectable copy field below. */ }
    setCopyFallback(value);setNotice('Automatic clipboard access is blocked here. Copy the selected text below with Ctrl+C.');setError('');
  }
  function validateImport(){const result=parseDesignSpec(jsonInput);setIssues(result.issues);setError('');if(!result.valid||!result.value){setSpec(null);setError('Review the validation findings and correct the JSON.');return;}setSpec(result.value);if(preparedPrompt){historySource.current={prompt:prompt.trim(),model:'External AI handoff'};setPreparedPrompt('');}else{historySource.current={prompt:`Imported JSON: ${result.value.name}`,model:'Manual JSON import'};}setNotice('Specification is valid. Insert is ready.');}
  function insert(){if(!spec)return;const source=historySource.current??{prompt:`Imported JSON: ${spec.name}`,model:'Manual JSON import'};pendingRenderHistory.current={id:createLocalId('history'),prompt:source.prompt,model:source.model,createdAt:new Date().toISOString(),spec};setBusy(true);setError('');setNotice('Creating editable native Figma layers…');post({type:'render',spec,fontFallback});}
  function reuseHistoryItem(item:HistoryItem){
    historySource.current={prompt:item.prompt,model:item.model};
    pendingRenderHistory.current={id:createLocalId('history'),prompt:item.prompt,model:item.model,createdAt:new Date().toISOString(),spec:item.spec};
    setPrompt(item.prompt);setSpec(item.spec);setJsonInput(JSON.stringify(item.spec,null,2));setBusy(true);setError('');setNotice(`Re-inserting ${item.spec.name} into Figma…`);post({type:'render',spec:item.spec,fontFallback});
  }
  async function fileText(file?:File){if(!file)return;if(file.size>512000){setError('File exceeds the 512 KB import limit.');return;}setJsonInput(await file.text());setError('');setIssues([]);}
  function importSvg(source=assetSvg,name=assetName){if(!source.trim()){setError('Paste or choose SVG markup first.');return;}try{const safe=sanitizeSvg(source);pendingAsset.current={payload:{kind:'svg',content:safe.svg}};setAssetBusy(true);setError('');setNotice('Validating and importing editable SVG geometry…');post({type:'import-svg',name,svg:safe.svg});}catch(err){setError(err instanceof Error?err.message:'SVG validation failed.');}}
  async function importImage(file?:File){if(!file)return;if(file.size>5*1024*1024){setError('Image exceeds the 5 MB limit.');return;}const extension=file.name.toLowerCase().split('.').pop();const extensions:Record<string,string>={png:'image/png',jpg:'image/jpeg',jpeg:'image/jpeg',gif:'image/gif'};const mime=file.type||extensions[extension??'']||'';if(!['image/png','image/jpeg','image/gif'].includes(mime)){setError('Choose a PNG, JPEG, or GIF file.');return;}setAssetBusy(true);setError('');setNotice('Checking image bytes and inserting a native Figma image fill…');try{const payload:AssetPayload={kind:'image',mimeType:mime as 'image/png'|'image/jpeg'|'image/gif',content:new Uint8Array(await file.arrayBuffer())};pendingAsset.current={payload};post({type:'import-image',name:file.name,mimeType:mime,bytes:Array.from(payload.content)});}catch(err){pendingAsset.current=null;setAssetBusy(false);setError(err instanceof Error?err.message:'Could not read image file.');}}
  async function previewAsset(sha:string){try{const entry=await readStoredAsset(sha);if(!entry)throw new Error('Saved asset bytes are missing.');const mime=entry.kind==='svg'?'image/svg+xml':entry.payload.kind==='image'?entry.payload.mimeType:'image/svg+xml';const parts:BlobPart[]=entry.payload.kind==='svg'?[sanitizeSvg(entry.payload.content).svg]:[new Uint8Array(entry.payload.content) as BlobPart];const url=URL.createObjectURL(new Blob(parts,{type:mime}));setAssetPreview({url,name:entry.name});setError('');}catch(error){setError(error instanceof Error?error.message:'Could not preview saved asset.');}}
  async function reuseAsset(sha:string){try{const entry=await readStoredAsset(sha);if(!entry)throw new Error('Saved asset bytes are missing.');pendingAsset.current={payload:entry.payload};setAssetName(entry.name);setAssetBusy(true);setError('');setNotice(`Inserting saved asset “${entry.name}”…`);if(entry.payload.kind==='svg')post({type:'import-svg',name:entry.name,svg:entry.payload.content});else post({type:'import-image',name:entry.name,mimeType:entry.payload.mimeType,bytes:Array.from(entry.payload.content)});}catch(error){pendingAsset.current=null;setAssetBusy(false);setError(error instanceof Error?error.message:'Could not reuse saved asset.');}}
  async function removeAsset(sha:string){if(!window.confirm('Delete this saved asset and its local bytes? This cannot be undone.'))return;try{await deleteStoredAsset(sha);setAssetRecords(items=>items.filter(item=>item.sha256!==sha));setError('');setNotice('Saved asset removed from this device.');}catch(error){setError(error instanceof Error?error.message:'Could not remove saved asset.');}}
  async function clearAssetLibrary(){if(!assetRecords.length)return;if(!window.confirm(`Delete all ${assetRecords.length} saved assets and their local bytes? This cannot be undone.`))return;try{await clearStoredAssets();setAssetRecords([]);setError('');setNotice('Local asset library cleared.');}catch(error){setError(error instanceof Error?error.message:'Could not clear local asset library.');}}
  async function proposePatch(){
    if(!selection){setError('Select a frame in Figma before proposing an edit.');return;}if(!editPrompt.trim()){setError('Describe the change you want.');return;}
    if(generationMode==='handoff'){
      setPreparedPatchPrompt(buildPatchPrompt(selection,editPrompt));setExternalPatchJson('');setPatch(null);setError('');setNotice('Edit prompt is ready. Send it to your AI app, then paste the operations JSON below and validate it.');return;
    }
    setBusy(true);setError('');setNotice('Preparing a targeted patch…');setPatch(null);
    try {const raw=await callModel({mode:'patch',prompt:buildPatchPrompt(selection,editPrompt)});
      const result=parseEditPatch(raw,new Set(selection.nodes.map(node=>node.id)));if(!result.valid)throw new Error(result.message);
      setPatch(result.value);setNotice(`${result.value.operations.length} proposed change(s). Review before applying.`);
    }catch(err){if(err instanceof DOMException&&err.name==='AbortError')setNotice('Patch generation cancelled.');else setError(err instanceof Error?err.message:'Could not prepare patch.');}finally{setBusy(false);}
  }
  async function prepareImageReplacement(file?:File){
    if(!file)return;
    if(!selection){setError('Select the design tree containing the target image first.');return;}
    const target=selection.nodes.find(node=>node.hasImageFill);
    if(!target){setError('The current selection summary has no supported image-fill layer. Select a frame containing one visible image fill.');return;}
    if(file.size>MAX_PATCH_IMAGE_BYTES){setError(`Replacement image exceeds ${Math.floor(MAX_PATCH_IMAGE_BYTES/1024)} KB. Use a smaller PNG/JPEG so the patch remains safe to review.`);return;}
    const mime=file.type||(/\.png$/i.test(file.name)?'image/png':/\.jpe?g$/i.test(file.name)?'image/jpeg':'');
    if(!['image/png','image/jpeg'].includes(mime)){setError('Replacement supports PNG or JPEG images.');return;}
    try{const data=encodeBase64(new Uint8Array(await file.arrayBuffer()));const value={mimeType:mime,data};const result=parseEditPatch(JSON.stringify({operations:[{op:'replace-image',targetId:target.id,value}]}),new Set(selection.nodes.map(node=>node.id)));if(!result.valid)throw new Error(result.message);setPatch(result.value);setPreparedPatchPrompt('');setError('');setNotice(`Replacement proposed for “${target.name}”. Review the patch, then apply it.`);}catch(error){setError(error instanceof Error?error.message:'Could not prepare image replacement.');}
  }
  function proposeImageCrop(){
    if(!selection||!cropTarget){setError('Select a layer with one visible image fill first.');return;}
    try{const value=imageScaleMode==='CROP'?{scaleMode:imageScaleMode,imageTransform:JSON.parse(imageTransformText)}:imageScaleMode==='TILE'?{scaleMode:imageScaleMode,scalingFactor:imageScalingFactor}:{scaleMode:imageScaleMode};const result=parseEditPatch(JSON.stringify({operations:[{op:'set-image-crop',targetId:cropTarget.id,value}]}),new Set(selection.nodes.map(node=>node.id)));if(!result.valid)throw new Error(result.message);setPatch(result.value);setPreparedPatchPrompt('');setError('');setNotice(`Image fill adjustment proposed for “${cropTarget.name}”. Review it, then apply.`);}catch(error){setError(error instanceof Error?error.message:'Invalid image transform or scaling factor.');}
  }
  function validateExternalPatch(){
    if(!selection){setError('Select a frame in Figma before validating an edit.');return;}
    const result=parseEditPatch(externalPatchJson,new Set(selection.nodes.map(node=>node.id)));
    if(!result.valid){setPatch(null);setError(result.message);return;}
    setPatch(result.value);setError('');setNotice(`${result.value.operations.length} proposed change(s). Review before applying.`);
  }
  function proposeAutoLayout(mode:'HORIZONTAL'|'VERTICAL'){
    if(!selection||selection.type!=='FRAME'||!selection.nodes[0]){setError('Select one Figma frame before proposing Auto Layout.');return;}
    const root=selection.nodes[0];const result=parseEditPatch(JSON.stringify({operations:[{op:'set-auto-layout',targetId:root.id,value:{mode,gap:16,padding:16,alignment:'MIN'}}]}),new Set(selection.nodes.map(node=>node.id)));
    if(!result.valid){setError(result.message);return;}setPreparedPatchPrompt('');setPatch(result.value);setError('');setNotice(`${mode==='VERTICAL'?'Vertical':'Horizontal'} Auto Layout proposed for the selected frame. Review and apply it below.`);
  }
  function applyPatch(){if(!patch)return;setBusy(true);setError('');setNotice('Applying reviewed changes…');post({type:'apply-patch',patch});}
  function addToken(){if(!tokenName.trim()||!/^#[0-9a-f]{6}$/i.test(tokenColor)){setError('Enter a token name and valid six-digit hex color.');return;}setTokens(items=>[{id:createLocalId('token'),name:tokenName.trim(),color:tokenColor.toUpperCase()},...items]);setTokenName('');setError('');setNotice('Token saved locally.');}
  function designSystemBrief(){return buildDesignSystemPrompt({colors:tokens,typography:typeTokens,spacing:spacingTokens});}
  function addTypographyToken(){if(!typeName.trim()||!Number.isFinite(typeSize)||typeSize<8||typeSize>96){setError('Enter a name and font size from 8 to 96 px.');return;}const safeName=typeName.trim().slice(0,60);setTypeTokens(items=>[{id:createLocalId('type'),name:safeName,fontFamily:'Inter',fontSize:typeSize,fontWeight:400,lineHeight:Math.round(typeSize*1.45)},...items].slice(0,50));setTypeName('');setError('');setNotice('Typography token saved locally and included in design prompts.');}
  function addSpacingToken(){if(!Number.isInteger(spaceValue)||spaceValue<0||spaceValue>256){setError('Spacing value must be a whole number from 0 to 256 px.');return;}if(spacingTokens.some(item=>item.value===spaceValue)){setError('That spacing value already exists.');return;}setSpacingTokens(items=>[{id:createLocalId('space'),name:`Space ${spaceValue}`,value:spaceValue},...items].slice(0,50));setError('');setNotice('Spacing token saved locally and included in design prompts.');}
  function exportDesignTokens(){download({version:'1.1',colors:tokens,typography:typeTokens,spacing:spacingTokens},'design-system-tokens.json');}
  function saveDesignPreset(){const name=presetName.trim().slice(0,60);if(!name){setError('Enter a name for this design-system preset.');return;}if(presets.length>=20){setError('The local library is limited to 20 design-system presets. Delete one before saving another.');return;}const preset:DesignPreset={id:createLocalId('preset'),name,createdAt:new Date().toISOString(),colors:tokens.map(item=>({...item})),typography:typeTokens.map(item=>({...item})),spacing:spacingTokens.map(item=>({...item}))};setPresets(items=>[preset,...items]);setSelectedPreset(preset.id);setPresetName('');setError('');setNotice(`“${name}” preset saved on this device.`);}
  function duplicateDesignPreset(){const preset=presets.find(item=>item.id===selectedPreset);if(!preset){setError('Choose a saved preset to duplicate.');return;}if(presets.length>=20){setError('The local library is limited to 20 design-system presets. Delete one before duplicating.');return;}const copy:DesignPreset={...preset,id:createLocalId('preset'),name:`${preset.name} copy`.slice(0,60),createdAt:new Date().toISOString(),colors:preset.colors.map(item=>({...item,id:createLocalId('color')})),typography:preset.typography.map(item=>({...item,id:createLocalId('type')})),spacing:preset.spacing.map(item=>({...item,id:createLocalId('space')}))};setPresets(items=>[copy,...items]);setSelectedPreset(copy.id);setNotice(`“${copy.name}” preset duplicated.`);setError('');}
  function loadDesignPreset(){const preset=presets.find(item=>item.id===selectedPreset);if(!preset){setError('Choose a saved preset to load.');return;}setTokens(preset.colors.map(item=>({...item})));setTypeTokens(preset.typography.map(item=>({...item})));setSpacingTokens(preset.spacing.map(item=>({...item})));setNotice(`Loaded “${preset.name}” into the active design system.`);setError('');}
  function deleteDesignPreset(){const preset=presets.find(item=>item.id===selectedPreset);if(!preset)return;if(!window.confirm(`Delete the saved preset “${preset.name}”?`))return;setPresets(items=>items.filter(item=>item.id!==preset.id));setSelectedPreset('');setNotice('Saved preset removed from this device.');setError('');}
  async function importDesignTokens(file?:File){if(!file)return;if(file.size>256000){setError('Design-system token file exceeds 256 KB.');return;}try{const data=JSON.parse(await file.text()) as {version?:string;colors?:unknown;tokens?:unknown;typography?:unknown;spacing?:unknown};if(data.version!==undefined&&!['1.0','1.1'].includes(data.version))throw new Error('Unsupported design-system token version.');const colors=data.colors??data.tokens;if(!Array.isArray(colors)||colors.length>200||colors.some((item:unknown)=>!item||typeof item!=='object'||typeof(item as Token).name!=='string'||(item as Token).name.length>100||!/^#[0-9a-f]{6}$/i.test((item as Token).color)))throw new Error('File must contain up to 200 color tokens with names and #RRGGBB values.');let nextTypes=typeTokens,nextSpacing=spacingTokens;if(data.typography!==undefined){if(!Array.isArray(data.typography)||data.typography.length>50||data.typography.some((item:unknown)=>!item||typeof item!=='object'||typeof(item as TypographyToken).name!=='string'||(item as TypographyToken).name.length>60||typeof(item as TypographyToken).fontFamily!=='string'||(item as TypographyToken).fontFamily.length>80||!Number.isInteger((item as TypographyToken).fontSize)||(item as TypographyToken).fontSize<8||(item as TypographyToken).fontSize>96||!Number.isInteger((item as TypographyToken).fontWeight)||(item as TypographyToken).fontWeight<100||(item as TypographyToken).fontWeight>900||!Number.isInteger((item as TypographyToken).lineHeight)||(item as TypographyToken).lineHeight<8||(item as TypographyToken).lineHeight>160))throw new Error('Typography tokens must have a name, family and valid size, weight, and line height.');nextTypes=ensureIds(data.typography as TypographyToken[],'type');}if(data.spacing!==undefined){if(!Array.isArray(data.spacing)||data.spacing.length>50||data.spacing.some((item:unknown)=>!item||typeof item!=='object'||typeof(item as SpacingToken).name!=='string'||(item as SpacingToken).name.length>60||!Number.isInteger((item as SpacingToken).value)||(item as SpacingToken).value<0||(item as SpacingToken).value>256))throw new Error('Spacing tokens must have a name and whole-number value from 0 to 256.');nextSpacing=ensureIds(data.spacing as SpacingToken[],'space');}setTokens(ensureIds(colors as Token[],'color'));setTypeTokens(nextTypes);setSpacingTokens(nextSpacing);setError('');setNotice('Design-system tokens imported and saved locally.');}catch(error){setError(error instanceof Error?error.message:'Could not import token file.');}}
  function download(value:unknown,filename:string){const url=URL.createObjectURL(new Blob([JSON.stringify(value,null,2)],{type:'application/json'}));const link=document.createElement('a');link.href=url;link.download=filename;link.click();URL.revokeObjectURL(url);}
  function startPanelResize(event:React.PointerEvent<HTMLButtonElement>){
    event.preventDefault();event.currentTarget.setPointerCapture(event.pointerId);
    const startX=event.clientX,startY=event.clientY,startWidth=window.innerWidth,startHeight=window.innerHeight;
    let width=startWidth,height=startHeight;
    const move=(pointer:PointerEvent)=>{width=Math.max(360,Math.min(760,Math.round(startWidth+pointer.clientX-startX)));height=Math.max(520,Math.min(1000,Math.round(startHeight+pointer.clientY-startY)));post({type:'resize-ui',width,height});};
    const finish=()=>{window.removeEventListener('pointermove',move);window.removeEventListener('pointerup',finish);save('adnf-panel-width',width);save('adnf-panel-height',height);};
    window.addEventListener('pointermove',move);window.addEventListener('pointerup',finish,{once:true});
  }
  const modelSize=useMemo(()=>models.find(m=>m.name===model)?.details?.parameter_size??'', [models,model]);

  return <main className={`app-shell ${loaderPhase!=='visible'?'ready':''}`}>
    {loaderPhase!=='hidden'&&<div className={`startup-overlay ${loaderPhase==='leaving'?'leaving':''}`} role="status" aria-live="polite"><div className="startup-brand"><img src={vsnLogo} alt="Vertex Systems Network"/><div><strong>AI Designer</strong><span>Vertex Systems Network</span></div></div><div className="startup-loader"><span className="loader-spinner" aria-hidden="true"/><div><strong>Preparing your design workspace</strong><small>Loading tools and local settings</small></div></div><div className="loader-track" aria-hidden="true"><span/></div></div>}
    <header className="topbar"><div className="brand"><div className="brand-mark">AD</div><div><strong>AI Designer</strong><small>Figma design studio</small></div></div><div className="top-actions"><span className={`status status-${generationMode==='handoff'?'connected':runtime}`}><i/>{generationMode==='handoff'?'AI handoff ready':runtime==='connected'?(models.length?'Ollama ready':'Runtime connected'):runtime==='checking'?'Checking':'Local model offline'}</span><button className="icon-button header-icon-button" aria-label={`Switch to ${theme==='dark'?'light':'dark'} theme`} title={`Switch to ${theme==='dark'?'light':'dark'} theme`} onClick={()=>setTheme(theme==='dark'?'light':'dark')}><HeaderIcon kind={theme==='dark'?'sun':'moon'}/></button><button className="icon-button header-icon-button" aria-label="Settings" title="Settings" onClick={()=>setTab('Settings')}><HeaderIcon kind="settings"/></button></div></header>
    <nav className="nav-tabs" aria-label="Main navigation">{navTabs.map(item=><button key={item} className={tab===item?'nav-tab active':'nav-tab'} onClick={()=>{setTab(item);setError('');}}>{item}</button>)}</nav>
    <section className="workspace" key={tab}>
      {tab==='Generate'&&<>
        <div className="section-heading"><div><p className="eyebrow">CREATE FROM A BRIEF</p><h1>Generate a design</h1><p className="muted">Use the AI app you already have, or an optional local model.</p></div></div>
        <label className="field-label" htmlFor="prompt">Design brief</label><textarea id="prompt" className="prompt-input" value={prompt} maxLength={12000} onChange={e=>setPrompt(e.target.value)} placeholder="Describe the screen, its users, key content, and visual direction…"/><div className="counter">{prompt.length.toLocaleString()} / 12,000</div>
        <label className="field-label" htmlFor="figma-reference">Figma reference context · optional</label><textarea id="figma-reference" className="prompt-input compact" value={figmaReference} maxLength={8000} onChange={e=>setFigmaReference(e.target.value)} placeholder="Paste relevant frame layout, colors, typography, and content from Figma or an MCP client…"/><p className="hint">A Figma URL alone cannot be inspected here. Paste the relevant design details; this field is included in the external AI handoff only.</p>
        <div className="form-grid"><label className="field-label full">AI workflow<select value={generationMode} onChange={e=>{setGenerationMode(e.target.value as GenerationMode);setPreparedPrompt('');setError('');}}><option value="handoff">Use any AI app · no API key</option><option value="ollama">Optional local Ollama model</option></select></label><label className="field-label">Category<select value={category} onChange={e=>setCategory(e.target.value)}>{['Website','Dashboard','Mobile Application','Admin Panel','WordPress Admin','E-commerce','Landing Page','Custom Interface'].map(x=><option key={x}>{x}</option>)}</select></label><label className="field-label">Platform<select value={platform} onChange={e=>setPlatform(e.target.value)}>{['Desktop','Tablet','Mobile','Custom size'].map(x=><option key={x}>{x}</option>)}</select></label><label className="field-label">Canvas size<select value={canvasSize} onChange={e=>setCanvasSize(e.target.value)}><option value="1440x900">Desktop · 1440 × 900</option><option value="1024x768">Tablet · 1024 × 768</option><option value="390x844">Mobile · 390 × 844</option><option value="custom">Custom</option></select></label><label className="field-label">Visual direction<select value={style} onChange={e=>setStyle(e.target.value)}>{['Refined editorial','Minimal','Professional product UI','Warm and approachable','Bold typography','Dark technical'].map(x=><option key={x}>{x}</option>)}</select></label>{canvasSize==='custom'&&<><label className="field-label">Custom width<input type="number" min={240} max={4000} value={customWidth} onChange={e=>setCustomWidth(Math.max(240,Math.min(4000,Number(e.target.value))))}/></label><label className="field-label">Custom height<input type="number" min={240} max={4000} value={customHeight} onChange={e=>setCustomHeight(Math.max(240,Math.min(4000,Number(e.target.value))))}/></label></>}<label className="field-label">Brand color<div className="color-entry"><input type="color" value={brandColor} onChange={e=>setBrandColor(e.target.value)}/><input value={brandColor} onChange={e=>setBrandColor(e.target.value)} maxLength={7}/></div></label><label className="field-label">Layout density<select value={density} onChange={e=>setDensity(e.target.value)}>{['Spacious','Balanced','Compact'].map(x=><option key={x}>{x}</option>)}</select></label><label className="field-label">Typography<select value={typography} onChange={e=>setTypography(e.target.value)}>{['Inter / system UI','Editorial serif headings','Geometric sans','System UI only'].map(x=><option key={x}>{x}</option>)}</select></label><label className="field-label">Component complexity<select value={complexity} onChange={e=>setComplexity(e.target.value)}>{['Simple','Standard','Detailed'].map(x=><option key={x}>{x}</option>)}</select></label>{generationMode==='ollama'&&<label className="field-label full">Installed local model<select value={model} onChange={e=>setModel(e.target.value)} disabled={!models.length}><option value="">{models.length?'Choose a model':'No installed model found'}</option>{models.map(m=><option key={m.name} value={m.name}>{m.name}{m.details?.parameter_size?` · ${m.details.parameter_size}`:''}</option>)}</select></label>}</div>
        {generationMode==='ollama'&&modelSize&&<p className="hint">Model details are reported by your local Ollama runtime.</p>}<div className="button-row"><button className="primary-button" onClick={()=>void generate()} disabled={busy||!prompt.trim()||(generationMode==='ollama'&&!model)}>{busy?'Generating…':generationMode==='handoff'?'Prepare prompt for AI app':'Generate with Ollama'}</button>{busy&&<button className="secondary-button" onClick={()=>{if(activeController.current)activeController.current.abort();else post({type:'cancel-render'});}}>Cancel</button>}<button className="secondary-button" onClick={()=>setTab('Import')}>Import JSON instead</button></div>
        {generationMode==='handoff'&&<p className="hint">No subscription API or key is used by this plugin. Copy a prepared prompt into Claude Desktop or any AI app you can use, then bring its JSON answer back here.</p>}
        {preparedPrompt&&<div className="template-panel"><div className="preview-head"><strong>Prompt for your AI app</strong><button className="icon-button icon-only-button" aria-label="Copy prompt" title="Copy prompt" onClick={()=>void copyText(preparedPrompt,'Prompt copied. Paste it into the AI app you use.')}><HeaderIcon kind="copy"/></button></div><textarea className="handoff-text" aria-label="Prepared design prompt" readOnly value={preparedPrompt}/><div className="button-row"><button className="secondary-button" onClick={()=>setTab('Import')}>Paste AI response in Import</button><button className="icon-button icon-only-button" aria-label="Clear prepared prompt" title="Clear prepared prompt" onClick={()=>setPreparedPrompt('')}><HeaderIcon kind="clear"/></button></div></div>}
        {spec&&<div className="result-panel"><div><strong>{spec.name}</strong><span>{spec.pages.length} page(s) · validated</span></div><button className="primary-button small" onClick={insert} disabled={busy}>Insert into Figma</button></div>}
      </>}
      {tab==='Edit'&&<>
        <div className="section-heading"><div><p className="eyebrow">SELECTION-AWARE WORKFLOW</p><h1>Edit selection</h1><p className="muted">Review explicit changes before applying them.</p></div><button className="secondary-button small icon-only-button" aria-label="Refresh selection" title="Refresh selection" onClick={()=>post({type:'inspect-selection'})}><HeaderIcon kind="refresh"/></button></div>
        <div className="selection-card"><div className={selection?'selection-icon':'selection-icon muted-icon'}>{selection?'F':'—'}</div><div><strong>{selection?.name??'No frame selected'}</strong><p>{selection?`${selection.type} · ${selection.width} × ${selection.height} · ${selection.layerCount} layers`:'Select a frame in Figma, then refresh.'}</p></div></div>
        <label className="field-label" htmlFor="edit-prompt">What should change?</label><textarea id="edit-prompt" className="prompt-input compact" value={editPrompt} onChange={e=>setEditPrompt(e.target.value)} placeholder="For example: rename layers or change the selected colors to a warmer palette."/><div className="quick-actions">{['Improve spacing','Improve typography','Change to dark theme','Update colors','Auto Layout · vertical','Auto Layout · horizontal'].map(x=><button className="chip" key={x} onClick={()=>x==='Auto Layout · vertical'?proposeAutoLayout('VERTICAL'):x==='Auto Layout · horizontal'?proposeAutoLayout('HORIZONTAL'):setEditPrompt(x)}>{x}</button>)}</div>
        <div className="button-row"><button className="primary-button" onClick={()=>void proposePatch()} disabled={busy||!selection||(generationMode==='ollama'&&!model)}>{busy?'Preparing…':generationMode==='handoff'?'Prepare edit prompt':'Propose with Ollama'}</button>{busy&&<button className="secondary-button" onClick={()=>activeController.current?.abort()}>Cancel</button>}</div>
        <div className="settings-card"><strong>Adjust image crop and position</strong><p className="hint">Select one image fill. Choose Fill, Fit, Tile, or a custom crop transform. The image bytes, opacity, blend mode and other fills stay intact.</p>{cropTarget?<><p className="hint">Target: {cropTarget.name}</p><label className="field-label">Image scale mode<select value={imageScaleMode} onChange={e=>setImageScaleMode(e.target.value as 'FILL'|'FIT'|'CROP'|'TILE')}><option value="FILL">Fill</option><option value="FIT">Fit</option><option value="CROP">Custom crop</option><option value="TILE">Tile</option></select></label>{imageScaleMode==='CROP'&&<label className="field-label" htmlFor="image-transform">Crop / position transform · 2×3 JSON<textarea id="image-transform" className="json-input compact-json" spellCheck={false} value={imageTransformText} onChange={e=>setImageTransformText(e.target.value)}/></label>}{imageScaleMode==='TILE'&&<label className="field-label" htmlFor="image-scaling-factor">Tile scale factor<input id="image-scaling-factor" type="number" min="0.01" max="10" step="0.05" value={imageScalingFactor} onChange={e=>setImageScalingFactor(Number(e.target.value))}/></label>}<button className="secondary-button" onClick={proposeImageCrop} disabled={busy}>Review image adjustment</button></>:<p className="hint">No image fill is present in the current selection summary.</p>}</div>
        <div className="settings-card"><strong>Replace an image fill</strong><p className="hint">Choose one image in the selected design. PNG/JPEG up to 128 KB. The existing image fill’s scale and opacity are preserved.</p><label className="secondary-button file-button">Choose replacement image<input type="file" accept="image/png,image/jpeg" disabled={busy||!selection} onChange={e=>{void prepareImageReplacement(e.target.files?.[0]);e.currentTarget.value='';}}/></label></div>{preparedPatchPrompt&&<div className="template-panel"><div className="preview-head"><strong>Prompt for your AI app</strong><button className="icon-button icon-only-button" aria-label="Copy edit prompt" title="Copy edit prompt" onClick={()=>void copyText(preparedPatchPrompt,'Edit prompt copied. Paste it into your AI app.')}><HeaderIcon kind="copy"/></button></div><textarea className="handoff-text" aria-label="Prepared edit prompt" readOnly value={preparedPatchPrompt}/><label className="field-label" htmlFor="edit-json">Paste the AI patch JSON</label><textarea id="edit-json" className="json-input compact-json" spellCheck={false} value={externalPatchJson} onChange={e=>setExternalPatchJson(e.target.value)} placeholder='{"operations":[{"op":"set-text","targetId":"...","value":"..."}]}'/><button className="secondary-button" onClick={validateExternalPatch}>Validate patch</button></div>}
        {patch&&<div className="preview-panel"><div className="preview-head"><strong>Proposed changes</strong><span>{patch.operations.length} operation(s)</span></div>{patch.operations.map((op,i)=><div key={`${op.targetId}-${i}`} className="preview-row"><code>{op.targetId}</code><span>{op.op} → {typeof op.value==='string'?op.value:JSON.stringify(op.value)}</span></div>)}<p className="hint">Only listed IDs are targeted. Review each operation before applying.</p><div className="button-row"><button className="primary-button small icon-only-button" aria-label="Apply reviewed changes" title="Apply reviewed changes" onClick={applyPatch} disabled={busy||patch.operations.length===0}><HeaderIcon kind="apply"/></button>{undoCount>0&&<button className="secondary-button small icon-only-button" aria-label="Undo latest plugin patch" title="Undo latest plugin patch" onClick={()=>{setBusy(true);post({type:'undo-patch'});}} disabled={busy}><HeaderIcon kind="undo"/></button>}</div></div>}
      </>}
      {tab==='Design System'&&<>
        <div className="section-heading"><div><p className="eyebrow">LOCAL TOKENS</p><h1>Design system</h1><p className="muted">Manage color, typography and spacing tokens. They are included in generation prompts.</p></div></div>
        <div className="token-create"><label className="field-label">Token name<input value={tokenName} onChange={e=>setTokenName(e.target.value)} placeholder="e.g. Brand accent"/></label><label className="field-label">Hex color<div className="color-entry"><input type="color" value={tokenColor} onChange={e=>setTokenColor(e.target.value)}/><input value={tokenColor} onChange={e=>setTokenColor(e.target.value)} maxLength={7}/></div></label><button className="secondary-button" onClick={addToken}>Add token</button></div>
        <div className="token-list">{tokens.map(t=><div className="token-row" key={t.id}><span className="swatch" style={{backgroundColor:t.color}}/><div className="token-info"><strong>{t.name}</strong><code>{t.color}</code></div><button className="secondary-button small icon-only-button" aria-label={`Apply ${t.name} to selection`} title={`Apply ${t.name} to selection`} onClick={()=>post({type:'apply-color-selection',color:t.color})}><HeaderIcon kind="apply"/></button><button className="icon-button icon-only-button danger-text" aria-label={`Remove ${t.name}`} title={`Remove ${t.name}`} onClick={()=>setTokens(items=>items.filter(x=>x.id!==t.id))}><HeaderIcon kind="remove"/></button></div>)}</div>
        <div className="settings-card"><div className="preview-head"><strong>Typography scale</strong><span>{typeTokens.length}/50</span></div><div className="token-create scale-editor"><label className="field-label">Style name<input value={typeName} maxLength={60} onChange={e=>setTypeName(e.target.value)} placeholder="e.g. Caption"/></label><label className="field-label">Font size · px<input type="number" min={8} max={96} value={typeSize} onChange={e=>setTypeSize(Number(e.target.value))}/></label><button className="secondary-button" onClick={addTypographyToken} disabled={typeTokens.length>=50}>Add style</button></div><div className="token-list">{typeTokens.map(item=><div className="token-row" key={item.id}><div className="token-info"><strong>{item.name}</strong><code>{item.fontFamily} · {item.fontSize}px / {item.fontWeight} · {item.lineHeight}px</code></div><button className="icon-button icon-only-button danger-text" aria-label={`Remove typography style ${item.name}`} title="Remove style" onClick={()=>setTypeTokens(items=>items.filter(value=>value.id!==item.id))}><HeaderIcon kind="remove"/></button></div>)}</div></div>
        <div className="settings-card"><div className="preview-head"><strong>Spacing scale</strong><span>{spacingTokens.length}/50</span></div><div className="token-create scale-editor"><label className="field-label">Spacing · px<input type="number" min={0} max={256} step={1} value={spaceValue} onChange={e=>setSpaceValue(Number(e.target.value))}/></label><button className="secondary-button" onClick={addSpacingToken} disabled={spacingTokens.length>=50}>Add spacing</button></div><div className="token-list">{spacingTokens.map(item=><div className="token-row" key={item.id}><div className="token-info"><strong>{item.name}</strong><code>{item.value}px</code></div><span className="spacing-sample" style={{width:`${Math.min(item.value,96)}px`}}/><button className="icon-button icon-only-button danger-text" aria-label={`Remove ${item.name}`} title="Remove spacing" onClick={()=>setSpacingTokens(items=>items.filter(value=>value.id!==item.id))}><HeaderIcon kind="remove"/></button></div>)}</div></div>
        <div className="settings-card"><div className="preview-head"><strong>Saved presets</strong><span>{presets.length}/20</span></div><div className="token-create scale-editor"><label className="field-label">Preset name<input value={presetName} maxLength={60} onChange={e=>setPresetName(e.target.value)} placeholder="e.g. Northstar product UI"/></label><button className="secondary-button" onClick={saveDesignPreset} disabled={presets.length>=20}>Save current</button></div>{presets.length>0&&<><label className="field-label">Saved design system<select value={selectedPreset} onChange={e=>setSelectedPreset(e.target.value)}><option value="">Choose a preset</option>{presets.map(item=><option key={item.id} value={item.id}>{item.name} · {new Date(item.createdAt).toLocaleDateString()}</option>)}</select></label><div className="button-row"><button className="secondary-button" onClick={loadDesignPreset} disabled={!selectedPreset}>Load</button><button className="secondary-button" onClick={duplicateDesignPreset} disabled={!selectedPreset||presets.length>=20}>Duplicate</button><button className="icon-button icon-only-button danger-text" aria-label="Delete selected preset" title="Delete selected preset" onClick={deleteDesignPreset} disabled={!selectedPreset}><HeaderIcon kind="remove"/></button></div></>}{!presets.length&&<p className="hint">Save the active colors, typography and spacing as a reusable local preset.</p>}</div>
        <div className="button-row"><button className="secondary-button" onClick={exportDesignTokens}>Export design system</button><label className="secondary-button file-button">Import design system<input type="file" accept="application/json,.json" onChange={e=>void importDesignTokens(e.target.files?.[0])}/></label></div>
      </>}
      {tab==='Import'&&<>
        <div className="section-heading"><div><p className="eyebrow">STRUCTURED SPECIFICATION</p><h1>Import or export</h1><p className="muted">Paste a spec from any assistant or choose a local JSON file.</p></div></div>
        <label className="field-label" htmlFor="spec-json">Design JSON</label><textarea id="spec-json" className="json-input" spellCheck={false} value={jsonInput} onChange={e=>{setJsonInput(e.target.value);setSpec(null);setIssues([]);}} placeholder='{"schemaVersion":"1.0","name":"My design","pages":[…]}'/>
        <div className="button-row"><button className="primary-button" onClick={validateImport}>Validate specification</button><label className="secondary-button file-button">Choose JSON file<input type="file" accept="application/json,.json" onChange={e=>void fileText(e.target.files?.[0])}/></label><button className="secondary-button" onClick={()=>spec&&download(spec,'design-spec.json')} disabled={!spec}>Export valid spec</button><button className="secondary-button" onClick={()=>{setBusy(true);setError('');setNotice('Exporting selected Figma layers…');post({type:'export-selection'});}} disabled={busy||!selection}>Export selection</button></div>
        <div className="template-panel"><div className="preview-head"><strong>Prompt template</strong><button className="icon-button icon-only-button" aria-label="Copy prompt template" title="Copy prompt template" onClick={()=>void copyText(promptTemplate,'Compatible JSON prompt copied.') }><HeaderIcon kind="copy"/></button></div><p className="hint">Paste this into Claude, ChatGPT, or another assistant. External chat tools are not automatically connected.</p><pre>{promptTemplate}</pre></div>
        {spec&&<div className="result-panel"><div><strong>{spec.name}</strong><span>{spec.pages.length} page(s) · ready to insert</span></div><button className="primary-button small" onClick={insert} disabled={busy}>Insert into Figma</button></div>}
        {spec&&auditDesignQuality(spec).length>0&&<div className="validation-list quality-findings"><strong>Design quality review · {auditDesignQuality(spec).length} suggestion(s)</strong>{auditDesignQuality(spec).slice(0,6).map((finding,index)=><p key={`${finding.path}-${index}`}><code>{finding.path}</code> {finding.message}</p>)}{auditDesignQuality(spec).length>6&&<p>Additional findings are available in the full specification review.</p>}</div>}
      </>}
      {tab==='AI Assets'&&<>
        <div className="section-heading"><div><p className="eyebrow">LOCAL ASSET WORKSPACE</p><h1>AI assets</h1><p className="muted">Import local images or sanitized SVG vectors. No image-generation service is required.</p></div></div>
        <div className="settings-card"><div className="preview-head"><strong>AI client capabilities</strong><span className="status status-disconnected"><i/>not detected</span></div><p className="hint">MCP connectivity does not prove an agent can create or transfer image files. Use its actual file output with the import below; no client file access is assumed.</p><div className="capability-list"><span>SVG from pasted markup <b>Available</b></span><span>PNG / JPEG / GIF local file <b>Available</b></span><span>Automatic AI asset transfer <b>Not verified</b></span><span>Paid image API <b>Not used</b></span></div></div>
        <div className="settings-card"><strong>Import editable vector</strong><label className="field-label">Asset name<input value={assetName} maxLength={160} onChange={e=>setAssetName(e.target.value)}/></label><label className="field-label">Paste SVG markup<textarea className="json-input compact-json" spellCheck={false} value={assetSvg} onChange={e=>setAssetSvg(e.target.value)} placeholder={'<svg viewBox="0 0 128 128"><circle cx="64" cy="64" r="48" fill="#0D8A60"/></svg>'}/></label><div className="button-row"><button className="primary-button" onClick={()=>importSvg()} disabled={assetBusy||!assetSvg.trim()}>Validate and insert SVG</button><label className="secondary-button file-button">Choose SVG<input type="file" accept="image/svg+xml,.svg" onChange={async e=>{const file=e.target.files?.[0];if(!file)return;if(file.size>512*1024){setError('SVG exceeds the 512 KB limit.');return;}setAssetName(file.name);setAssetSvg(await file.text());setError('');}}/></label><button className="icon-button icon-only-button" aria-label="Clear SVG" title="Clear SVG" onClick={()=>setAssetSvg('')}><HeaderIcon kind="clear"/></button></div></div>
        <div className="settings-card"><strong>Import raster image</strong><p className="hint">PNG, JPEG, or GIF up to 5 MB and 4096 × 4096 pixels. The image is inserted as an editable native image fill.</p><label className="secondary-button file-button">Choose image<input type="file" accept="image/png,image/jpeg,image/gif" disabled={assetBusy} onChange={e=>void importImage(e.target.files?.[0])}/></label></div>
        <div className="settings-card"><div className="preview-head"><strong>Local asset library · {assetRecords.length}/50</strong><button className="icon-button icon-only-button" aria-label="Clear local asset library" title="Clear local asset library" onClick={()=>void clearAssetLibrary()} disabled={!assetRecords.length}><HeaderIcon kind="remove"/></button></div><p className="hint">Assets are stored on this device through Figma plugin storage (up to 50 items / 2 MiB of source bytes). Matching content hashes update one library entry.</p>{!assetRecords.length?<p className="hint">Imported assets saved successfully will appear here for preview and reuse.</p>:<div className="history-list">{assetRecords.map(item=><article className="history-item" key={item.sha256}><div className="history-head"><strong>{item.name}</strong><time>{new Date(item.createdAt).toLocaleDateString()}</time></div><p>{item.kind.toUpperCase()} · {item.width} × {item.height}{item.mimeType?` · ${item.mimeType}`:''} · {(item.bytes/1024).toFixed(1)} KB</p><code className="asset-hash">SHA-256 · {item.sha256.slice(0,16)}…</code><div className="button-row compact-row"><button className="secondary-button small" onClick={()=>void previewAsset(item.sha256)}>Preview</button><button className="secondary-button small" onClick={()=>void reuseAsset(item.sha256)} disabled={assetBusy}>Reuse</button><button className="secondary-button small" onClick={()=>post({type:'select-node',nodeId:item.nodeId})}>Select in Figma</button><button className="icon-button icon-only-button danger-text" aria-label={`Remove ${item.name} from local asset library`} title="Remove saved asset" onClick={()=>void removeAsset(item.sha256)}><HeaderIcon kind="remove"/></button></div></article>)}</div>}</div>
        {assetPreview&&<div className="asset-preview-panel"><div className="preview-head"><strong>{assetPreview.name}</strong><button className="icon-button icon-only-button" aria-label="Close asset preview" title="Close preview" onClick={()=>setAssetPreview(null)}><HeaderIcon kind="clear"/></button></div><img src={assetPreview.url} alt={`Preview of ${assetPreview.name}`}/></div>}
      </>}
      {tab==='History'&&<>
        <div className="section-heading"><div><p className="eyebrow">THIS DEVICE</p><h1>History</h1><p className="muted">Recent prompts and results stay in this browser profile.</p></div><button className="icon-button icon-only-button danger-text" aria-label="Clear history" title="Clear history" onClick={()=>setHistory([])}><HeaderIcon kind="remove"/></button></div>
        {!history.length?<div className="empty-state"><strong>No completed designs yet</strong><p>Successfully inserted designs appear here, including manual JSON imports.</p></div>:<div className="history-list">{history.map(item=><article className="history-item" key={item.id}><div className="history-head"><strong>{item.spec.name}</strong><time>{new Date(item.createdAt).toLocaleString()}</time></div><p>{item.prompt}</p><span className="history-meta">{item.model||'Manual import'} · {item.spec.pages.length} page(s)</span><div className="button-row compact-row"><button className="secondary-button small" onClick={()=>reuseHistoryItem(item)} disabled={busy}>{busy?'Inserting…':'Reuse & insert'}</button><button className="secondary-button small" onClick={()=>download(item.spec,`${item.spec.name.toLowerCase().replace(/[^a-z0-9]+/g,'-')}.json`)}>Export</button><button className="secondary-button small" onClick={()=>{setSpec(item.spec);setJsonInput(JSON.stringify(item.spec,null,2));setTab('Import');}}>View JSON</button><button className="icon-button danger-text" aria-label="Delete history item" onClick={()=>setHistory(items=>items.filter(x=>x.id!==item.id))}>Delete</button></div></article>)}</div>}
      </>}
      {tab==='Agent Activity'&&<>
        <div className="section-heading"><div><p className="eyebrow">LOCAL MCP BRIDGE</p><h1>Agent activity</h1><p className="muted">See real work accepted from a paired local MCP client.</p></div><span className={`status status-${agentStatus.status==='connected'||agentStatus.status==='working'?'connected':agentStatus.status==='connecting'?'checking':'disconnected'}`}><i/>{agentStatus.status}</span></div>
        <div className="settings-card"><div className="preview-head"><strong>Figma operator</strong><span className={`status ${figmaUser.signedIn?'status-connected':'status-disconnected'}`}><i/>{figmaUser.signedIn?'Signed in':'Not signed in'}</span></div><p className="muted"><strong>{figmaUser.name}</strong>{agentStatus.status==='working'?` is working in this file · ${agentStatus.operation??'Processing request'}`:agentStatus.status==='connected'?' is online and waiting for Claude.':' will appear here when the plugin connects.'}</p></div>
        <div className="settings-card"><strong>{agentStatus.agentLabel??'No active agent job'}</strong><p className="muted">{agentStatus.operation??agentStatus.message??(agentStatus.status==='connected'?'Bridge connected; waiting for a request.':'Pair a local MCP client in Settings.')}</p>{agentStatus.jobId&&<code>Job {agentStatus.jobId}</code>}</div>
        {!agentEvents.length?<div className="empty-state"><strong>No agent activity yet</strong><p>Once paired, MCP requests and their actual Figma results will appear here.</p></div>:<div className="history-list">{agentEvents.map(item=><article className="history-item" key={item.id}><div className="history-head"><strong>{item.operation}</strong><time>{new Date(item.timestamp).toLocaleString()}</time></div><p>{item.message}</p><span className="history-meta">{item.agentLabel} · {item.status} · {item.jobId}</span></article>)}</div>}
      </>}
      {tab==='Settings'&&<>
        <div className="section-heading"><div><p className="eyebrow">OPTIONAL LOCAL MODEL</p><h1>Settings</h1><p className="muted">External AI handoff works without a local runtime or API key.</p></div></div>
        <div className="settings-card"><div className="preview-head"><strong>Optional Ollama service</strong><span className={`status status-${runtime}`}><i/>{runtime}</span></div><label className="field-label">Loopback endpoint URL<input value={endpointDraft} onChange={e=>setEndpointDraft(e.target.value)}/></label><p className="hint">Only needed if you choose Ollama. Use http://localhost:8787; the service itself binds only to loopback.</p><div className="button-row"><button className="primary-button small" onClick={()=>{try{const u=new URL(endpointDraft);if(u.hostname!=='localhost'||u.protocol!=='http:'||u.port!=='8787')throw new Error('Use http://localhost:8787.');const value=endpointDraft.replace(/\/$/,'');setBaseUrl(value);save('adnf-endpoint',value);setNotice('Optional local endpoint saved.');setError('');}catch(err){setError(err instanceof Error?err.message:'Invalid endpoint.');}}}>Save endpoint</button><button className="secondary-button small" onClick={()=>{setGenerationMode('ollama');void refreshModels();}}>Test Ollama</button></div></div>
        <div className="settings-card"><strong>Font fallback</strong><label className="field-label">Preferred fallback<select value={fontFallback} onChange={e=>{setFontFallback(e.target.value);save('adnf-font-fallback',e.target.value);}}><option>Inter</option><option>Arial</option><option>Roboto</option></select></label><p className="hint">The renderer substitutes a safe font when the preferred face is unavailable.</p></div>
        <div className="settings-card"><div className="preview-head"><strong>Claude connection</strong><span className={`status status-${agentStatus.status==='connected'||agentStatus.status==='working'?'connected':agentStatus.status==='connecting'?'checking':'disconnected'}`}><i/>{agentStatus.status==='connected'||agentStatus.status==='working'?'Connected':agentStatus.status==='connecting'?'Connecting':'Not connected'}</span></div><p className="hint">Connect Claude Desktop to the open Figma file once. After the connection is confirmed, the panel hides and the plugin keeps processing jobs in this file. Keep Figma Desktop and this document open.</p><div className="button-row"><button className="primary-button small" onClick={()=>void connectLocalAgent()} disabled={['connecting','connected','working'].includes(agentStatus.status)}>{agentStatus.status==='connecting'?'Connecting…':agentStatus.status==='connected'||agentStatus.status==='working'?'Connected':'Connect & hide panel'}</button>{(agentStatus.status==='connected'||agentStatus.status==='working')&&<button className="secondary-button small" onClick={()=>post({type:'hide-ui'})}>Hide panel</button>}{bridgeToken&&<button className="secondary-button small" disabled={agentStatus.status==='working'} onClick={()=>{bridgeEpoch.current++;setBridgeToken('');save('adnf-bridge-token','');configureStoredAssetBridge(bridgeUrl,'');setAgentStatus({type:'agent-status',status:'disconnected',message:'Claude disconnected.'});post({type:'configure-bridge',endpoint:bridgeUrl,token:'',sessionId:bridgeSession.current||'disconnect-session'});setNotice('Claude disconnected.');setError('');}}>Disconnect</button>}</div><details className="advanced-pairing"><summary>Connection troubleshooting</summary><p className="hint">If Claude is installed but cannot connect, check that the AI Designer extension is enabled in Claude Desktop, then select Connect again.</p></details></div>
        <div className="privacy-note"><strong>Privacy</strong><p>No telemetry is included. Prompt history and tokens remain in local browser storage. External AI handoff sends no prompt from this plugin; you choose what to copy into the AI app. The optional companion service binds to loopback and contacts a local Ollama endpoint only.</p></div>
      </>}
    </section>
    {copyFallback&&<div className="template-panel copy-fallback"><label className="field-label" htmlFor="copy-fallback">Copy manually · press Ctrl+C</label><textarea id="copy-fallback" className="handoff-text" readOnly value={copyFallback} onFocus={e=>e.currentTarget.select()} onClick={e=>e.currentTarget.select()}/></div>}
    <footer className="status-footer">{error?<p className="message error-message">{error}</p>:<p className="message">{notice||'Ready'} · No Figma AI credits or paid API required</p>}{issues.length>0&&<div className="validation-list"><strong>{issues.length} validation finding(s)</strong>{issues.slice(0,8).map((i,n)=><p key={`${i.path}-${n}`}><code>{i.path}</code> {i.message}</p>)}</div>}</footer>
    <button className="resize-handle" aria-label="Resize plugin panel" title="Drag to resize panel" onPointerDown={startPanelResize}><HeaderIcon kind="resize"/></button>
  </main>;
}
function showRuntimeFailure(reason: unknown) {
  const container = document.getElementById('root');
  if (!container) return;
  const details = reason instanceof Error ? `${reason.name}: ${reason.message}` : String(reason);
  const panel = document.createElement('main');
  panel.className = 'boot-error';
  panel.setAttribute('role', 'alert');
  const title = document.createElement('strong');
  title.textContent = 'AI Designer UI stopped';
  const message = document.createElement('p');
  message.textContent = 'The plugin UI hit a browser runtime error. Copy this detail when reporting the problem.';
  const detail = document.createElement('pre');
  detail.textContent = details.slice(0, 1200);
  const hint = document.createElement('small');
  hint.textContent = 'Re-import the updated dist/manifest.json after replacing the plugin build.';
  panel.append(title, message, detail, hint);
  container.replaceChildren(panel);
}

window.addEventListener('error', event => showRuntimeFailure(event.error ?? event.message));
window.addEventListener('unhandledrejection', event => showRuntimeFailure(event.reason));

try {
  const container = document.getElementById('root');
  if (!container) throw new Error('Plugin UI root element is missing.');
  createRoot(container, { onUncaughtError: error => showRuntimeFailure(error) })
    .render(<React.StrictMode><App/></React.StrictMode>);
} catch (error) {
  showRuntimeFailure(error);
}
