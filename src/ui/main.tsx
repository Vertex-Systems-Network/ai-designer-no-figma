import React, { useEffect, useMemo, useRef, useState } from 'react';
import { createRoot } from 'react-dom/client';
import { parseDesignSpec, type DesignSpec, type ValidationIssue } from '../shared/spec';
import type { EditPatch, HostToUi, UiToHost } from '../shared/protocol';
import './styles.css';

type Tab = 'Generate' | 'Edit' | 'Design System' | 'Import' | 'History' | 'Settings';
type Model = { name: string; details?: { parameter_size?: string } };
type HistoryItem = { id: string; prompt: string; model: string; createdAt: string; spec: DesignSpec };
type Token = { id: string; name: string; color: string };
const defaultUrl = 'http://127.0.0.1:8787';
const promptTemplate = `Return one JSON object only. Use this schema: {"schemaVersion":"1.0","name":"Design name","pages":[{"id":"page-1","name":"Page name","children":[{"type":"frame","id":"frame-1","name":"Main frame","width":1440,"height":900,"fill":"#FFFFFF","children":[{"type":"text","id":"title-1","name":"Title","x":48,"y":48,"width":600,"height":60,"text":"A clear heading","fontSize":36,"fontWeight":700,"color":"#171A1E"}]}]}]}. Supported types: frame, group, text, rectangle, ellipse, line. Give every id a unique stable value and make all layers editable. Do not include markdown.`;
const navTabs: Tab[] = ['Generate', 'Edit', 'Design System', 'Import', 'History'];
function post(message: UiToHost) { parent.postMessage({ pluginMessage: message }, '*'); }
function load<T>(key: string, fallback: T): T { try { const value = localStorage.getItem(key); return value ? JSON.parse(value) as T : fallback; } catch { return fallback; } }
function App() {
  const [tab, setTab] = useState<Tab>('Generate');
  const [theme, setTheme] = useState<'dark'|'light'>(() => load('adnf-theme','dark'));
  const [baseUrl, setBaseUrl] = useState(() => load('adnf-endpoint',defaultUrl));
  const [endpointDraft, setEndpointDraft] = useState(baseUrl);
  const [runtime, setRuntime] = useState<'checking'|'connected'|'disconnected'>('checking');
  const [models, setModels] = useState<Model[]>([]);
  const [model, setModel] = useState('');
  const [prompt, setPrompt] = useState('');
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

  useEffect(() => { document.documentElement.dataset.theme=theme; localStorage.setItem('adnf-theme',JSON.stringify(theme)); },[theme]);
  useEffect(() => { localStorage.setItem('adnf-history',JSON.stringify(history.slice(0,40))); },[history]);
  useEffect(() => { localStorage.setItem('adnf-tokens',JSON.stringify(tokens)); },[tokens]);
  useEffect(() => {
    post({type:'inspect-selection'});
    const receive=(event:MessageEvent)=>{ const msg=event.data?.pluginMessage as HostToUi|undefined; if(!msg)return;
      if(msg.type==='selection')setSelection(msg.summary);
      if(msg.type==='render-result'||msg.type==='patch-result'){setBusy(false);setError('');setNotice(msg.message);}
      if(msg.type==='error'){setBusy(false);setError(`${msg.code}: ${msg.message}`);}
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
  useEffect(()=>{void refreshModels();},[baseUrl]);
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
    if(!prompt.trim()){setError('Describe the interface you want to create.');return;}
    if(!/^#[0-9a-f]{6}$/i.test(brandColor)){setError('Brand color must be a six-digit hex value.');return;}
    setBusy(true);setError('');setNotice('Asking the selected local model for structured design JSON…');setIssues([]);setSpec(null);
    try {const output=await callModel({prompt});const result=parseDesignSpec(output);setIssues(result.issues);
      if(!result.valid||!result.value)throw new Error(result.issues.map(i=>`${i.path}: ${i.message}`).join('\n')||'Model returned an invalid specification.');
      setSpec(result.value);setJsonInput(JSON.stringify(result.value,null,2));setHistory(items=>[{id:crypto.randomUUID(),prompt,model,createdAt:new Date().toISOString(),spec:result.value!},...items]);setNotice('Specification validated. Review it, then insert editable layers into Figma.');
    }catch(err){if(err instanceof DOMException&&err.name==='AbortError')setNotice('Generation cancelled.');else setError(err instanceof Error?err.message:'Generation failed.');}finally{setBusy(false);}
  }
  function validateImport(){const result=parseDesignSpec(jsonInput);setIssues(result.issues);setError('');if(!result.valid||!result.value){setSpec(null);setError('Review the validation findings and correct the JSON.');return;}setSpec(result.value);setNotice('Specification is valid. Insert is ready.');}
  function insert(){if(!spec)return;setBusy(true);setError('');setNotice('Creating editable native Figma layers…');post({type:'render',spec,fontFallback});}
  async function fileText(file?:File){if(!file)return;if(file.size>512000){setError('File exceeds the 512 KB import limit.');return;}setJsonInput(await file.text());setError('');setIssues([]);}
  async function proposePatch(){
    if(!selection){setError('Select a frame in Figma before proposing an edit.');return;}if(!editPrompt.trim()){setError('Describe the change you want.');return;}
    setBusy(true);setError('');setNotice('Preparing a targeted patch…');setPatch(null);
    try {const raw=await callModel({mode:'patch',prompt:`Selected frame: ${selection.name}, ${selection.width}×${selection.height}. Requested change: ${editPrompt}\nKnown selection summary: ${JSON.stringify(selection)}. Return operations only for IDs you can see. If no target IDs are available, return an empty operations array.`});
      const parsed=JSON.parse(raw) as EditPatch;if(!parsed||!Array.isArray(parsed.operations)||parsed.operations.length>100)throw new Error('Patch must contain at most 100 operations.');
      for(const op of parsed.operations){if(!['set-text','set-fill','rename'].includes(op.op)||!op.targetId||typeof op.value!=='string'||op.value.length>20000)throw new Error('Patch contains an unsupported or malformed operation.');if(op.op==='set-fill'&&!/^#[0-9a-f]{6}$/i.test(op.value))throw new Error(`Invalid fill color for ${op.targetId}.`);}
      setPatch(parsed);setNotice(`${parsed.operations.length} proposed change(s). Review before applying.`);
    }catch(err){if(err instanceof DOMException&&err.name==='AbortError')setNotice('Patch generation cancelled.');else setError(err instanceof Error?err.message:'Could not prepare patch.');}finally{setBusy(false);}
  }
  function applyPatch(){if(!patch)return;setBusy(true);setError('');setNotice('Applying reviewed changes…');post({type:'apply-patch',patch});}
  function addToken(){if(!tokenName.trim()||!/^#[0-9a-f]{6}$/i.test(tokenColor)){setError('Enter a token name and valid six-digit hex color.');return;}setTokens(items=>[{id:crypto.randomUUID(),name:tokenName.trim(),color:tokenColor.toUpperCase()},...items]);setTokenName('');setError('');setNotice('Token saved locally.');}
  function download(value:unknown,filename:string){const url=URL.createObjectURL(new Blob([JSON.stringify(value,null,2)],{type:'application/json'}));const link=document.createElement('a');link.href=url;link.download=filename;link.click();URL.revokeObjectURL(url);}
  const modelSize=useMemo(()=>models.find(m=>m.name===model)?.details?.parameter_size??'', [models,model]);

  return <main className="app-shell">
    <header className="topbar"><div className="brand"><div className="brand-mark">AD</div><div><strong>AI Designer</strong><small>Local design studio</small></div></div><div className="top-actions"><span className={`status status-${runtime}`}><i/>{runtime==='connected'?(models.length?'Local AI ready':'Runtime connected'):runtime==='checking'?'Checking':'Offline'}</span><button className="icon-button" aria-label="Toggle appearance" onClick={()=>setTheme(theme==='dark'?'light':'dark')}>{theme==='dark'?'Light':'Dark'}</button><button className="icon-button" onClick={()=>setTab('Settings')}>Settings</button></div></header>
    <nav className="nav-tabs" aria-label="Main navigation">{navTabs.map(item=><button key={item} className={tab===item?'nav-tab active':'nav-tab'} onClick={()=>{setTab(item);setError('');}}>{item}</button>)}</nav>
    <section className="workspace" key={tab}>
      {tab==='Generate'&&<>
        <div className="section-heading"><div><p className="eyebrow">CREATE FROM A BRIEF</p><h1>Generate a design</h1><p className="muted">Use a local model or bring validated JSON.</p></div></div>
        <label className="field-label" htmlFor="prompt">Design brief</label><textarea id="prompt" className="prompt-input" value={prompt} maxLength={12000} onChange={e=>setPrompt(e.target.value)} placeholder="Describe the screen, its users, key content, and visual direction…"/><div className="counter">{prompt.length.toLocaleString()} / 12,000</div>
        <div className="form-grid"><label className="field-label">Category<select value={category} onChange={e=>setCategory(e.target.value)}>{['Website','Dashboard','Mobile Application','Admin Panel','WordPress Admin','E-commerce','Landing Page','Custom Interface'].map(x=><option key={x}>{x}</option>)}</select></label><label className="field-label">Platform<select value={platform} onChange={e=>setPlatform(e.target.value)}>{['Desktop','Tablet','Mobile','Custom size'].map(x=><option key={x}>{x}</option>)}</select></label><label className="field-label">Canvas size<select value={canvasSize} onChange={e=>setCanvasSize(e.target.value)}><option value="1440x900">Desktop · 1440 × 900</option><option value="1024x768">Tablet · 1024 × 768</option><option value="390x844">Mobile · 390 × 844</option><option value="custom">Custom</option></select></label><label className="field-label">Visual direction<select value={style} onChange={e=>setStyle(e.target.value)}>{['Refined editorial','Minimal','Professional product UI','Warm and approachable','Bold typography','Dark technical'].map(x=><option key={x}>{x}</option>)}</select></label>{canvasSize==='custom'&&<><label className="field-label">Custom width<input type="number" min={240} max={4000} value={customWidth} onChange={e=>setCustomWidth(Math.max(240,Math.min(4000,Number(e.target.value))))}/></label><label className="field-label">Custom height<input type="number" min={240} max={4000} value={customHeight} onChange={e=>setCustomHeight(Math.max(240,Math.min(4000,Number(e.target.value))))}/></label></>}<label className="field-label">Brand color<div className="color-entry"><input type="color" value={brandColor} onChange={e=>setBrandColor(e.target.value)}/><input value={brandColor} onChange={e=>setBrandColor(e.target.value)} maxLength={7}/></div></label><label className="field-label">Layout density<select value={density} onChange={e=>setDensity(e.target.value)}>{['Spacious','Balanced','Compact'].map(x=><option key={x}>{x}</option>)}</select></label><label className="field-label">Typography<select value={typography} onChange={e=>setTypography(e.target.value)}>{['Inter / system UI','Editorial serif headings','Geometric sans','System UI only'].map(x=><option key={x}>{x}</option>)}</select></label><label className="field-label">Component complexity<select value={complexity} onChange={e=>setComplexity(e.target.value)}>{['Simple','Standard','Detailed'].map(x=><option key={x}>{x}</option>)}</select></label><label className="field-label full">Installed local model<select value={model} onChange={e=>setModel(e.target.value)} disabled={!models.length}><option value="">{models.length?'Choose a model':'No installed model found'}</option>{models.map(m=><option key={m.name} value={m.name}>{m.name}{m.details?.parameter_size?` · ${m.details.parameter_size}`:''}</option>)}</select></label></div>
        {modelSize&&<p className="hint">Model details are reported by your local Ollama runtime.</p>}<div className="button-row"><button className="primary-button" onClick={()=>void generate()} disabled={busy||!model||!prompt.trim()}>{busy?'Generating…':'Generate design'}</button>{busy&&<button className="secondary-button" onClick={()=>{if(activeController.current)activeController.current.abort();else post({type:'cancel-render'});}}>Cancel</button>}<button className="secondary-button" onClick={()=>setTab('Import')}>Import JSON instead</button></div>
        {spec&&<div className="result-panel"><div><strong>{spec.name}</strong><span>{spec.pages.length} page(s) · validated</span></div><button className="primary-button small" onClick={insert} disabled={busy}>Insert into Figma</button></div>}
      </>}
      {tab==='Edit'&&<>
        <div className="section-heading"><div><p className="eyebrow">SELECTION-AWARE WORKFLOW</p><h1>Edit selection</h1><p className="muted">Review explicit changes before applying them.</p></div><button className="secondary-button small" onClick={()=>post({type:'inspect-selection'})}>Refresh</button></div>
        <div className="selection-card"><div className={selection?'selection-icon':'selection-icon muted-icon'}>{selection?'F':'—'}</div><div><strong>{selection?.name??'No frame selected'}</strong><p>{selection?`${selection.type} · ${selection.width} × ${selection.height} · ${selection.layerCount} layers`:'Select a frame in Figma, then refresh.'}</p></div></div>
        <label className="field-label" htmlFor="edit-prompt">What should change?</label><textarea id="edit-prompt" className="prompt-input compact" value={editPrompt} onChange={e=>setEditPrompt(e.target.value)} placeholder="For example: rename layers or change the selected colors to a warmer palette."/><div className="quick-actions">{['Improve spacing','Improve typography','Change to dark theme','Update colors'].map(x=><button className="chip" key={x} onClick={()=>setEditPrompt(x)}>{x}</button>)}</div>
        <div className="button-row"><button className="primary-button" onClick={()=>void proposePatch()} disabled={busy||!selection||!model}>{busy?'Preparing…':'Propose changes'}</button>{busy&&<button className="secondary-button" onClick={()=>activeController.current?.abort()}>Cancel</button>}</div>
        {patch&&<div className="preview-panel"><div className="preview-head"><strong>Proposed changes</strong><span>{patch.operations.length} operation(s)</span></div>{patch.operations.map((op,i)=><div key={`${op.targetId}-${i}`} className="preview-row"><code>{op.targetId}</code><span>{op.op} → {op.value}</span></div>)}<p className="hint">Only listed IDs are targeted. Review each operation before applying.</p><button className="primary-button small" onClick={applyPatch} disabled={busy}>Apply reviewed changes</button></div>}
      </>}
      {tab==='Design System'&&<>
        <div className="section-heading"><div><p className="eyebrow">LOCAL TOKENS</p><h1>Design system</h1><p className="muted">Manage reusable color tokens and apply fills to the selection.</p></div></div>
        <div className="token-create"><label className="field-label">Token name<input value={tokenName} onChange={e=>setTokenName(e.target.value)} placeholder="e.g. Brand accent"/></label><label className="field-label">Hex color<div className="color-entry"><input type="color" value={tokenColor} onChange={e=>setTokenColor(e.target.value)}/><input value={tokenColor} onChange={e=>setTokenColor(e.target.value)} maxLength={7}/></div></label><button className="secondary-button" onClick={addToken}>Add token</button></div>
        <div className="token-list">{tokens.map(t=><div className="token-row" key={t.id}><span className="swatch" style={{backgroundColor:t.color}}/><div className="token-info"><strong>{t.name}</strong><code>{t.color}</code></div><button className="secondary-button small" onClick={()=>post({type:'apply-color-selection',color:t.color})}>Apply</button><button className="icon-button danger-text" aria-label={`Remove ${t.name}`} onClick={()=>setTokens(items=>items.filter(x=>x.id!==t.id))}>Remove</button></div>)}</div>
        <div className="button-row"><button className="secondary-button" onClick={()=>download({version:'1.0',tokens},'design-tokens.json')}>Export tokens</button><label className="secondary-button file-button">Import tokens<input type="file" accept="application/json" onChange={async e=>{try{const data=JSON.parse(await e.target.files?.[0]?.text()??'{}') as {tokens?:Token[]};if(!Array.isArray(data.tokens)||data.tokens.length>200||data.tokens.some(t=>!t.name||!/^#[0-9a-f]{6}$/i.test(t.color)))throw new Error('File must contain up to 200 name/color tokens.');setTokens(data.tokens);setNotice('Tokens imported.');}catch(err){setError(err instanceof Error?err.message:'Could not import tokens.');}}}/></label></div>
      </>}
      {tab==='Import'&&<>
        <div className="section-heading"><div><p className="eyebrow">STRUCTURED SPECIFICATION</p><h1>Import or export</h1><p className="muted">Paste a spec from any assistant or choose a local JSON file.</p></div></div>
        <label className="field-label" htmlFor="spec-json">Design JSON</label><textarea id="spec-json" className="json-input" spellCheck={false} value={jsonInput} onChange={e=>{setJsonInput(e.target.value);setSpec(null);setIssues([]);}} placeholder='{"schemaVersion":"1.0","name":"My design","pages":[…]}'/>
        <div className="button-row"><button className="primary-button" onClick={validateImport}>Validate specification</button><label className="secondary-button file-button">Choose JSON file<input type="file" accept="application/json,.json" onChange={e=>void fileText(e.target.files?.[0])}/></label><button className="secondary-button" onClick={()=>spec&&download(spec,'design-spec.json')} disabled={!spec}>Export valid spec</button></div>
        <div className="template-panel"><div className="preview-head"><strong>Prompt template</strong><button className="icon-button" onClick={()=>{void navigator.clipboard?.writeText(promptTemplate).then(()=>setNotice('Compatible JSON prompt copied.')).catch(()=>setError('Clipboard access is unavailable. Select and copy the template below.'));}}>Copy</button></div><p className="hint">Paste this into Claude, ChatGPT, or another assistant. External chat tools are not automatically connected.</p><pre>{promptTemplate}</pre></div>
        {spec&&<div className="result-panel"><div><strong>{spec.name}</strong><span>{spec.pages.length} page(s) · ready to insert</span></div><button className="primary-button small" onClick={insert} disabled={busy}>Insert into Figma</button></div>}
      </>}
      {tab==='History'&&<>
        <div className="section-heading"><div><p className="eyebrow">THIS DEVICE</p><h1>History</h1><p className="muted">Recent prompts and results stay in this browser profile.</p></div><button className="icon-button danger-text" onClick={()=>setHistory([])}>Clear history</button></div>
        {!history.length?<div className="empty-state"><strong>No saved generations</strong><p>Validated local generations will appear here.</p></div>:<div className="history-list">{history.map(item=><article className="history-item" key={item.id}><div className="history-head"><strong>{item.spec.name}</strong><time>{new Date(item.createdAt).toLocaleString()}</time></div><p>{item.prompt}</p><span className="history-meta">{item.model||'Manual import'} · {item.spec.pages.length} page(s)</span><div className="button-row compact-row"><button className="secondary-button small" onClick={()=>{setPrompt(item.prompt);setSpec(item.spec);setJsonInput(JSON.stringify(item.spec,null,2));setTab('Generate');}}>Reuse</button><button className="secondary-button small" onClick={()=>download(item.spec,`${item.spec.name.toLowerCase().replace(/[^a-z0-9]+/g,'-')}.json`)}>Export</button><button className="secondary-button small" onClick={()=>{setSpec(item.spec);setJsonInput(JSON.stringify(item.spec,null,2));setTab('Import');}}>View JSON</button><button className="icon-button danger-text" aria-label="Delete history item" onClick={()=>setHistory(items=>items.filter(x=>x.id!==item.id))}>Delete</button></div></article>)}</div>}
      </>}
      {tab==='Settings'&&<>
        <div className="section-heading"><div><p className="eyebrow">LOCAL RUNTIME</p><h1>Settings</h1><p className="muted">Connection preferences and privacy controls for this device.</p></div></div>
        <div className="settings-card"><div className="preview-head"><strong>Local service</strong><span className={`status status-${runtime}`}><i/>{runtime}</span></div><label className="field-label">Endpoint URL<input value={endpointDraft} onChange={e=>setEndpointDraft(e.target.value)}/></label><p className="hint">Use a loopback address on port 8787. The local service must not be exposed to a network.</p><div className="button-row"><button className="primary-button small" onClick={()=>{try{const u=new URL(endpointDraft);if(!['127.0.0.1','localhost','[::1]'].includes(u.hostname)||u.protocol!=='http:'||u.port!=='8787')throw new Error('Use http://127.0.0.1:8787 or a loopback host on port 8787.');const value=endpointDraft.replace(/\/$/,'');setBaseUrl(value);localStorage.setItem('adnf-endpoint',JSON.stringify(value));setNotice('Local endpoint saved.');setError('');}catch(err){setError(err instanceof Error?err.message:'Invalid endpoint.');}}}>Save endpoint</button><button className="secondary-button small" onClick={()=>void refreshModels()}>Test connection</button></div></div>
        <div className="settings-card"><strong>Font fallback</strong><label className="field-label">Preferred fallback<select value={fontFallback} onChange={e=>{setFontFallback(e.target.value);localStorage.setItem('adnf-font-fallback',JSON.stringify(e.target.value));}}><option>Inter</option><option>Arial</option><option>Roboto</option></select></label><p className="hint">The renderer substitutes a safe font when the preferred face is unavailable.</p></div>
        <div className="privacy-note"><strong>Privacy</strong><p>No telemetry is included. Prompt history and tokens remain in local browser storage. The companion service binds to loopback and only contacts a local Ollama endpoint.</p></div>
      </>}
    </section>
    <footer className="status-footer">{error?<p className="message error-message">{error}</p>:<p className="message">{notice||'Ready'} · No Figma AI credits or paid API required</p>}{issues.length>0&&<div className="validation-list"><strong>{issues.length} validation finding(s)</strong>{issues.slice(0,8).map((i,n)=><p key={`${i.path}-${n}`}><code>{i.path}</code> {i.message}</p>)}</div>}</footer>
  </main>;
}
createRoot(document.getElementById('root')!).render(<React.StrictMode><App/></React.StrictMode>);
