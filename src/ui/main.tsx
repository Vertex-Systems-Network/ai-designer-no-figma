import React, { useEffect, useMemo, useRef, useState } from 'react';
import { createRoot } from 'react-dom/client';
import { parseDesignSpec, type DesignSpec, type ValidationIssue } from '../shared/spec';
import type { EditPatch, HostToUi, UiToHost } from '../shared/protocol';
import { parseEditPatch } from '../shared/edit-patch';
import { buildDesignPrompt, buildPatchPrompt } from '../shared/prompts';
import './styles.css';

const vsnLogo = document.querySelector<HTMLImageElement>('.boot-logo')?.src ?? '';

type Tab = 'Generate' | 'Edit' | 'Design System' | 'Import' | 'History' | 'Settings';
type Model = { name: string; details?: { parameter_size?: string } };
type HistoryItem = { id: string; prompt: string; model: string; createdAt: string; spec: DesignSpec };
type Token = { id: string; name: string; color: string };
type GenerationMode = 'handoff' | 'ollama';
const defaultUrl = 'http://localhost:8787';
function safeEndpoint(value: string): string {
  try {
    const url = new URL(value);
    if (url.protocol === 'http:' && ['localhost','127.0.0.1','[::1]'].includes(url.hostname) && url.port === '8787') return defaultUrl;
  } catch { /* Use the safe default for invalid stored settings. */ }
  return defaultUrl;
}
const promptTemplate = `Return one JSON object only. Use this schema: {"schemaVersion":"1.0","name":"Design name","pages":[{"id":"page-1","name":"Page name","children":[{"type":"frame","id":"frame-1","name":"Main frame","width":1440,"height":900,"fill":"#FFFFFF","children":[{"type":"text","id":"title-1","name":"Title","x":48,"y":48,"width":600,"height":60,"text":"A clear heading","fontSize":36,"fontWeight":700,"color":"#171A1E"}]}]}]}. Supported types: frame, group, text, rectangle, ellipse, line. Give every id a unique stable value and make all layers editable. Do not include markdown.`;
const navTabs: Tab[] = ['Generate', 'Edit', 'Design System', 'Import', 'History'];
function post(message: UiToHost) { parent.postMessage({ pluginMessage: message }, '*'); }
function createLocalId(prefix='item'): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') return crypto.randomUUID();
  return `${prefix}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2,10)}`;
}
function HeaderIcon({kind}:{kind:'sun'|'moon'|'settings'|'resize'|'refresh'|'copy'|'clear'|'remove'|'apply'}) {
  if(kind==='sun')return <svg aria-hidden="true" viewBox="0 0 20 20" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round"><circle cx="10" cy="10" r="3.2"/><path d="M10 1.8v2M10 16.2v2M1.8 10h2M16.2 10h2M4.2 4.2l1.4 1.4m8.8 8.8 1.4 1.4m0-11.6-1.4 1.4m-8.8 8.8-1.4 1.4"/></svg>;
  if(kind==='moon')return <svg aria-hidden="true" viewBox="0 0 20 20" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"><path d="M16.7 12.7A7.2 7.2 0 0 1 7.3 3.3 7.3 7.3 0 1 0 16.7 12.7Z"/></svg>;
  if(kind==='settings')return <svg aria-hidden="true" viewBox="0 0 20 20" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><circle cx="10" cy="10" r="2.5"/><path d="m8.4 2.5.4-1h2.4l.4 1a7.8 7.8 0 0 1 1.5.6l1-.5 1.7 1.7-.5 1a7.8 7.8 0 0 1 .6 1.5l1 .4v2.4l-1 .4a7.8 7.8 0 0 1-.6 1.5l.5 1-1.7 1.7-1-.5a7.8 7.8 0 0 1-1.5.6l-.4 1H8.8l-.4-1a7.8 7.8 0 0 1-1.5-.6l-1 .5-1.7-1.7.5-1a7.8 7.8 0 0 1-.6-1.5l-1-.4V7.2l1-.4a7.8 7.8 0 0 1 .6-1.5l-.5-1 1.7-1.7 1 .5a7.8 7.8 0 0 1 1.5-.6Z"/></svg>;
  if(kind==='resize')return <svg aria-hidden="true" viewBox="0 0 20 20" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round"><path d="M3 13v4h4M17 7V3h-4M3 17l5-5M17 3l-5 5"/></svg>;
  if(kind==='refresh')return <svg aria-hidden="true" viewBox="0 0 20 20" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round"><path d="M16.8 8A7 7 0 0 0 4.5 5.2L3 7m0 0V3.5M3 7h3.5M3.2 12A7 7 0 0 0 15.5 14.8L17 13m0 0v3.5M17 13h-3.5"/></svg>;
  if(kind==='copy')return <svg aria-hidden="true" viewBox="0 0 20 20" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"><rect x="7" y="6" width="10" height="11" rx="1.5"/><path d="M13 6V4.5A1.5 1.5 0 0 0 11.5 3h-7A1.5 1.5 0 0 0 3 4.5v8A1.5 1.5 0 0 0 4.5 14H7"/></svg>;
  if(kind==='clear')return <svg aria-hidden="true" viewBox="0 0 20 20" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"><path d="m5 5 10 10M15 5 5 15"/></svg>;
  if(kind==='remove')return <svg aria-hidden="true" viewBox="0 0 20 20" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><path d="M3.5 5.5h13M8 5.5V3.7h4v1.8m3.2 0-.7 10.8H5.5L4.8 5.5M8 8.5v5m4-5v5"/></svg>;
  return <svg aria-hidden="true" viewBox="0 0 20 20" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="m4 10.5 4 4 8-9"/></svg>;
}
function load<T>(key: string, fallback: T): T { try { const value = localStorage.getItem(key); return value ? JSON.parse(value) as T : fallback; } catch { return fallback; } }
function save(key: string, value: unknown): void { try { localStorage.setItem(key, JSON.stringify(value)); } catch { /* Figma may deny iframe storage; keep the current session usable. */ } }
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
  const [patch, setPatch] = useState<EditPatch|null>(null);
  const [history, setHistory] = useState<HistoryItem[]>(() => load('adnf-history',[]));
  const [tokens, setTokens] = useState<Token[]>(() => load('adnf-tokens',[
    {id:'brand-primary',name:'Primary',color:'#0D8A60'}, {id:'ink',name:'Ink',color:'#171A1E'}, {id:'surface',name:'Surface',color:'#F6F7F8'},
  ]));
  const [tokenName, setTokenName] = useState('');
  const [tokenColor, setTokenColor] = useState('#0D8A60');
  const [fontFallback, setFontFallback] = useState(() => load('adnf-font-fallback','Inter'));
  const activeController = useRef<AbortController|null>(null);
  const historySource = useRef<{prompt:string;model:string}|null>(null);
  const pendingRenderHistory = useRef<HistoryItem|null>(null);

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
  useEffect(() => { save('adnf-tokens',tokens); },[tokens]);
  useEffect(() => {
    post({type:'inspect-selection'});
    const receive=(event:MessageEvent)=>{ const msg=event.data?.pluginMessage as HostToUi|undefined; if(!msg)return;
      if(msg.type==='selection')setSelection(msg.summary);
      if(msg.type==='render-result'){
        setBusy(false);setError('');setNotice(msg.message);
        const item=pendingRenderHistory.current;pendingRenderHistory.current=null;
        if(msg.ok&&item)setHistory(items=>[item,...items].slice(0,40));
      }
      if(msg.type==='patch-result'){setBusy(false);setError('');setNotice(msg.message);}
      if(msg.type==='error'){pendingRenderHistory.current=null;setBusy(false);setError(`${msg.code}: ${msg.message}`);}
    };
    window.addEventListener('message',receive); return ()=>window.removeEventListener('message',receive);
  },[]);
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
      const data=await response.json() as {response?:string;error?:{message?:string}}; if(!response.ok)throw new Error(data.error?.message??`Generation failed (${response.status}).`); return data.response??'';
    } finally {clearTimeout(timeout);activeController.current=null;}
  }
  async function generate() {
    if(generationMode==='handoff'){
      if(!prompt.trim()){setError('Describe the interface you want to create.');return;}
      if(!/^#[0-9a-f]{6}$/i.test(brandColor)){setError('Brand color must be a six-digit hex value.');return;}
      historySource.current={prompt:prompt.trim(),model:'External AI handoff'};
      setPreparedPrompt(buildDesignPrompt(prompt,{category,platform,canvasSize:canvasSize==='custom'?`${customWidth}x${customHeight}`:canvasSize,style,brandColor,density,typography,complexity}));
      setError('');setNotice('Prompt is ready. Copy it to the AI desktop app or chat you already use, then paste its JSON response in Import.');return;
    }
    if(!prompt.trim()){setError('Describe the interface you want to create.');return;}
    if(!/^#[0-9a-f]{6}$/i.test(brandColor)){setError('Brand color must be a six-digit hex value.');return;}
    setBusy(true);setError('');setNotice('Asking the selected local model for structured design JSON…');setIssues([]);setSpec(null);
    try {const output=await callModel({prompt});const result=parseDesignSpec(output);setIssues(result.issues);
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
  async function proposePatch(){
    if(!selection){setError('Select a frame in Figma before proposing an edit.');return;}if(!editPrompt.trim()){setError('Describe the change you want.');return;}
    if(generationMode==='handoff'){
      setPreparedPatchPrompt(buildPatchPrompt(selection,editPrompt));setExternalPatchJson('');setPatch(null);setError('');setNotice('Edit prompt is ready. Send it to your AI app, then paste the operations JSON below and validate it.');return;
    }
    setBusy(true);setError('');setNotice('Preparing a targeted patch…');setPatch(null);
    try {const raw=await callModel({mode:'patch',prompt:`Selected frame: ${selection.name}, ${selection.width}×${selection.height}. Requested change: ${editPrompt}\nKnown selection summary: ${JSON.stringify(selection)}. Return operations only for IDs you can see. If no target IDs are available, return an empty operations array.`});
      const result=parseEditPatch(raw,new Set(selection.nodes.map(node=>node.id)));if(!result.valid)throw new Error(result.message);
      setPatch(result.value);setNotice(`${result.value.operations.length} proposed change(s). Review before applying.`);
    }catch(err){if(err instanceof DOMException&&err.name==='AbortError')setNotice('Patch generation cancelled.');else setError(err instanceof Error?err.message:'Could not prepare patch.');}finally{setBusy(false);}
  }
  function validateExternalPatch(){
    if(!selection){setError('Select a frame in Figma before validating an edit.');return;}
    const result=parseEditPatch(externalPatchJson,new Set(selection.nodes.map(node=>node.id)));
    if(!result.valid){setPatch(null);setError(result.message);return;}
    setPatch(result.value);setError('');setNotice(`${result.value.operations.length} proposed change(s). Review before applying.`);
  }
  function applyPatch(){if(!patch)return;setBusy(true);setError('');setNotice('Applying reviewed changes…');post({type:'apply-patch',patch});}
  function addToken(){if(!tokenName.trim()||!/^#[0-9a-f]{6}$/i.test(tokenColor)){setError('Enter a token name and valid six-digit hex color.');return;}setTokens(items=>[{id:createLocalId('token'),name:tokenName.trim(),color:tokenColor.toUpperCase()},...items]);setTokenName('');setError('');setNotice('Token saved locally.');}
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
        <div className="form-grid"><label className="field-label full">AI workflow<select value={generationMode} onChange={e=>{setGenerationMode(e.target.value as GenerationMode);setPreparedPrompt('');setError('');}}><option value="handoff">Use any AI app · no API key</option><option value="ollama">Optional local Ollama model</option></select></label><label className="field-label">Category<select value={category} onChange={e=>setCategory(e.target.value)}>{['Website','Dashboard','Mobile Application','Admin Panel','WordPress Admin','E-commerce','Landing Page','Custom Interface'].map(x=><option key={x}>{x}</option>)}</select></label><label className="field-label">Platform<select value={platform} onChange={e=>setPlatform(e.target.value)}>{['Desktop','Tablet','Mobile','Custom size'].map(x=><option key={x}>{x}</option>)}</select></label><label className="field-label">Canvas size<select value={canvasSize} onChange={e=>setCanvasSize(e.target.value)}><option value="1440x900">Desktop · 1440 × 900</option><option value="1024x768">Tablet · 1024 × 768</option><option value="390x844">Mobile · 390 × 844</option><option value="custom">Custom</option></select></label><label className="field-label">Visual direction<select value={style} onChange={e=>setStyle(e.target.value)}>{['Refined editorial','Minimal','Professional product UI','Warm and approachable','Bold typography','Dark technical'].map(x=><option key={x}>{x}</option>)}</select></label>{canvasSize==='custom'&&<><label className="field-label">Custom width<input type="number" min={240} max={4000} value={customWidth} onChange={e=>setCustomWidth(Math.max(240,Math.min(4000,Number(e.target.value))))}/></label><label className="field-label">Custom height<input type="number" min={240} max={4000} value={customHeight} onChange={e=>setCustomHeight(Math.max(240,Math.min(4000,Number(e.target.value))))}/></label></>}<label className="field-label">Brand color<div className="color-entry"><input type="color" value={brandColor} onChange={e=>setBrandColor(e.target.value)}/><input value={brandColor} onChange={e=>setBrandColor(e.target.value)} maxLength={7}/></div></label><label className="field-label">Layout density<select value={density} onChange={e=>setDensity(e.target.value)}>{['Spacious','Balanced','Compact'].map(x=><option key={x}>{x}</option>)}</select></label><label className="field-label">Typography<select value={typography} onChange={e=>setTypography(e.target.value)}>{['Inter / system UI','Editorial serif headings','Geometric sans','System UI only'].map(x=><option key={x}>{x}</option>)}</select></label><label className="field-label">Component complexity<select value={complexity} onChange={e=>setComplexity(e.target.value)}>{['Simple','Standard','Detailed'].map(x=><option key={x}>{x}</option>)}</select></label>{generationMode==='ollama'&&<label className="field-label full">Installed local model<select value={model} onChange={e=>setModel(e.target.value)} disabled={!models.length}><option value="">{models.length?'Choose a model':'No installed model found'}</option>{models.map(m=><option key={m.name} value={m.name}>{m.name}{m.details?.parameter_size?` · ${m.details.parameter_size}`:''}</option>)}</select></label>}</div>
        {generationMode==='ollama'&&modelSize&&<p className="hint">Model details are reported by your local Ollama runtime.</p>}<div className="button-row"><button className="primary-button" onClick={()=>void generate()} disabled={busy||!prompt.trim()||(generationMode==='ollama'&&!model)}>{busy?'Generating…':generationMode==='handoff'?'Prepare prompt for AI app':'Generate with Ollama'}</button>{busy&&<button className="secondary-button" onClick={()=>{if(activeController.current)activeController.current.abort();else post({type:'cancel-render'});}}>Cancel</button>}<button className="secondary-button" onClick={()=>setTab('Import')}>Import JSON instead</button></div>
        {generationMode==='handoff'&&<p className="hint">No subscription API or key is used by this plugin. Copy a prepared prompt into Claude Desktop or any AI app you can use, then bring its JSON answer back here.</p>}
        {preparedPrompt&&<div className="template-panel"><div className="preview-head"><strong>Prompt for your AI app</strong><button className="icon-button icon-only-button" aria-label="Copy prompt" title="Copy prompt" onClick={()=>void copyText(preparedPrompt,'Prompt copied. Paste it into the AI app you use.')}><HeaderIcon kind="copy"/></button></div><textarea className="handoff-text" aria-label="Prepared design prompt" readOnly value={preparedPrompt}/><div className="button-row"><button className="secondary-button" onClick={()=>setTab('Import')}>Paste AI response in Import</button><button className="icon-button icon-only-button" aria-label="Clear prepared prompt" title="Clear prepared prompt" onClick={()=>setPreparedPrompt('')}><HeaderIcon kind="clear"/></button></div></div>}
        {spec&&<div className="result-panel"><div><strong>{spec.name}</strong><span>{spec.pages.length} page(s) · validated</span></div><button className="primary-button small" onClick={insert} disabled={busy}>Insert into Figma</button></div>}
      </>}
      {tab==='Edit'&&<>
        <div className="section-heading"><div><p className="eyebrow">SELECTION-AWARE WORKFLOW</p><h1>Edit selection</h1><p className="muted">Review explicit changes before applying them.</p></div><button className="secondary-button small icon-only-button" aria-label="Refresh selection" title="Refresh selection" onClick={()=>post({type:'inspect-selection'})}><HeaderIcon kind="refresh"/></button></div>
        <div className="selection-card"><div className={selection?'selection-icon':'selection-icon muted-icon'}>{selection?'F':'—'}</div><div><strong>{selection?.name??'No frame selected'}</strong><p>{selection?`${selection.type} · ${selection.width} × ${selection.height} · ${selection.layerCount} layers`:'Select a frame in Figma, then refresh.'}</p></div></div>
        <label className="field-label" htmlFor="edit-prompt">What should change?</label><textarea id="edit-prompt" className="prompt-input compact" value={editPrompt} onChange={e=>setEditPrompt(e.target.value)} placeholder="For example: rename layers or change the selected colors to a warmer palette."/><div className="quick-actions">{['Improve spacing','Improve typography','Change to dark theme','Update colors'].map(x=><button className="chip" key={x} onClick={()=>setEditPrompt(x)}>{x}</button>)}</div>
        <div className="button-row"><button className="primary-button" onClick={()=>void proposePatch()} disabled={busy||!selection||(generationMode==='ollama'&&!model)}>{busy?'Preparing…':generationMode==='handoff'?'Prepare edit prompt':'Propose with Ollama'}</button>{busy&&<button className="secondary-button" onClick={()=>activeController.current?.abort()}>Cancel</button>}</div>
        {preparedPatchPrompt&&<div className="template-panel"><div className="preview-head"><strong>Prompt for your AI app</strong><button className="icon-button icon-only-button" aria-label="Copy edit prompt" title="Copy edit prompt" onClick={()=>void copyText(preparedPatchPrompt,'Edit prompt copied. Paste it into your AI app.')}><HeaderIcon kind="copy"/></button></div><textarea className="handoff-text" aria-label="Prepared edit prompt" readOnly value={preparedPatchPrompt}/><label className="field-label" htmlFor="edit-json">Paste the AI patch JSON</label><textarea id="edit-json" className="json-input compact-json" spellCheck={false} value={externalPatchJson} onChange={e=>setExternalPatchJson(e.target.value)} placeholder='{"operations":[{"op":"set-text","targetId":"...","value":"..."}]}'/><button className="secondary-button" onClick={validateExternalPatch}>Validate patch</button></div>}
        {patch&&<div className="preview-panel"><div className="preview-head"><strong>Proposed changes</strong><span>{patch.operations.length} operation(s)</span></div>{patch.operations.map((op,i)=><div key={`${op.targetId}-${i}`} className="preview-row"><code>{op.targetId}</code><span>{op.op} → {op.value}</span></div>)}<p className="hint">Only listed IDs are targeted. Review each operation before applying.</p><button className="primary-button small icon-only-button" aria-label="Apply reviewed changes" title="Apply reviewed changes" onClick={applyPatch} disabled={busy}><HeaderIcon kind="apply"/></button></div>}
      </>}
      {tab==='Design System'&&<>
        <div className="section-heading"><div><p className="eyebrow">LOCAL TOKENS</p><h1>Design system</h1><p className="muted">Manage reusable color tokens and apply fills to the selection.</p></div></div>
        <div className="token-create"><label className="field-label">Token name<input value={tokenName} onChange={e=>setTokenName(e.target.value)} placeholder="e.g. Brand accent"/></label><label className="field-label">Hex color<div className="color-entry"><input type="color" value={tokenColor} onChange={e=>setTokenColor(e.target.value)}/><input value={tokenColor} onChange={e=>setTokenColor(e.target.value)} maxLength={7}/></div></label><button className="secondary-button" onClick={addToken}>Add token</button></div>
        <div className="token-list">{tokens.map(t=><div className="token-row" key={t.id}><span className="swatch" style={{backgroundColor:t.color}}/><div className="token-info"><strong>{t.name}</strong><code>{t.color}</code></div><button className="secondary-button small icon-only-button" aria-label={`Apply ${t.name} to selection`} title={`Apply ${t.name} to selection`} onClick={()=>post({type:'apply-color-selection',color:t.color})}><HeaderIcon kind="apply"/></button><button className="icon-button icon-only-button danger-text" aria-label={`Remove ${t.name}`} title={`Remove ${t.name}`} onClick={()=>setTokens(items=>items.filter(x=>x.id!==t.id))}><HeaderIcon kind="remove"/></button></div>)}</div>
        <div className="button-row"><button className="secondary-button" onClick={()=>download({version:'1.0',tokens},'design-tokens.json')}>Export tokens</button><label className="secondary-button file-button">Import tokens<input type="file" accept="application/json" onChange={async e=>{try{const data=JSON.parse(await e.target.files?.[0]?.text()??'{}') as {tokens?:Token[]};if(!Array.isArray(data.tokens)||data.tokens.length>200||data.tokens.some(t=>!t.name||!/^#[0-9a-f]{6}$/i.test(t.color)))throw new Error('File must contain up to 200 name/color tokens.');setTokens(data.tokens);setNotice('Tokens imported.');}catch(err){setError(err instanceof Error?err.message:'Could not import tokens.');}}}/></label></div>
      </>}
      {tab==='Import'&&<>
        <div className="section-heading"><div><p className="eyebrow">STRUCTURED SPECIFICATION</p><h1>Import or export</h1><p className="muted">Paste a spec from any assistant or choose a local JSON file.</p></div></div>
        <label className="field-label" htmlFor="spec-json">Design JSON</label><textarea id="spec-json" className="json-input" spellCheck={false} value={jsonInput} onChange={e=>{setJsonInput(e.target.value);setSpec(null);setIssues([]);}} placeholder='{"schemaVersion":"1.0","name":"My design","pages":[…]}'/>
        <div className="button-row"><button className="primary-button" onClick={validateImport}>Validate specification</button><label className="secondary-button file-button">Choose JSON file<input type="file" accept="application/json,.json" onChange={e=>void fileText(e.target.files?.[0])}/></label><button className="secondary-button" onClick={()=>spec&&download(spec,'design-spec.json')} disabled={!spec}>Export valid spec</button></div>
        <div className="template-panel"><div className="preview-head"><strong>Prompt template</strong><button className="icon-button icon-only-button" aria-label="Copy prompt template" title="Copy prompt template" onClick={()=>void copyText(promptTemplate,'Compatible JSON prompt copied.') }><HeaderIcon kind="copy"/></button></div><p className="hint">Paste this into Claude, ChatGPT, or another assistant. External chat tools are not automatically connected.</p><pre>{promptTemplate}</pre></div>
        {spec&&<div className="result-panel"><div><strong>{spec.name}</strong><span>{spec.pages.length} page(s) · ready to insert</span></div><button className="primary-button small" onClick={insert} disabled={busy}>Insert into Figma</button></div>}
      </>}
      {tab==='History'&&<>
        <div className="section-heading"><div><p className="eyebrow">THIS DEVICE</p><h1>History</h1><p className="muted">Recent prompts and results stay in this browser profile.</p></div><button className="icon-button icon-only-button danger-text" aria-label="Clear history" title="Clear history" onClick={()=>setHistory([])}><HeaderIcon kind="remove"/></button></div>
        {!history.length?<div className="empty-state"><strong>No completed designs yet</strong><p>Successfully inserted designs appear here, including manual JSON imports.</p></div>:<div className="history-list">{history.map(item=><article className="history-item" key={item.id}><div className="history-head"><strong>{item.spec.name}</strong><time>{new Date(item.createdAt).toLocaleString()}</time></div><p>{item.prompt}</p><span className="history-meta">{item.model||'Manual import'} · {item.spec.pages.length} page(s)</span><div className="button-row compact-row"><button className="secondary-button small" onClick={()=>reuseHistoryItem(item)} disabled={busy}>{busy?'Inserting…':'Reuse & insert'}</button><button className="secondary-button small" onClick={()=>download(item.spec,`${item.spec.name.toLowerCase().replace(/[^a-z0-9]+/g,'-')}.json`)}>Export</button><button className="secondary-button small" onClick={()=>{setSpec(item.spec);setJsonInput(JSON.stringify(item.spec,null,2));setTab('Import');}}>View JSON</button><button className="icon-button danger-text" aria-label="Delete history item" onClick={()=>setHistory(items=>items.filter(x=>x.id!==item.id))}>Delete</button></div></article>)}</div>}
      </>}
      {tab==='Settings'&&<>
        <div className="section-heading"><div><p className="eyebrow">OPTIONAL LOCAL MODEL</p><h1>Settings</h1><p className="muted">External AI handoff works without a local runtime or API key.</p></div></div>
        <div className="settings-card"><div className="preview-head"><strong>Optional Ollama service</strong><span className={`status status-${runtime}`}><i/>{runtime}</span></div><label className="field-label">Loopback endpoint URL<input value={endpointDraft} onChange={e=>setEndpointDraft(e.target.value)}/></label><p className="hint">Only needed if you choose Ollama. Use http://localhost:8787; the service itself binds only to loopback.</p><div className="button-row"><button className="primary-button small" onClick={()=>{try{const u=new URL(endpointDraft);if(u.hostname!=='localhost'||u.protocol!=='http:'||u.port!=='8787')throw new Error('Use http://localhost:8787.');const value=endpointDraft.replace(/\/$/,'');setBaseUrl(value);save('adnf-endpoint',value);setNotice('Optional local endpoint saved.');setError('');}catch(err){setError(err instanceof Error?err.message:'Invalid endpoint.');}}}>Save endpoint</button><button className="secondary-button small" onClick={()=>{setGenerationMode('ollama');void refreshModels();}}>Test Ollama</button></div></div>
        <div className="settings-card"><strong>Font fallback</strong><label className="field-label">Preferred fallback<select value={fontFallback} onChange={e=>{setFontFallback(e.target.value);save('adnf-font-fallback',e.target.value);}}><option>Inter</option><option>Arial</option><option>Roboto</option></select></label><p className="hint">The renderer substitutes a safe font when the preferred face is unavailable.</p></div>
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
