import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const hostSource = readFileSync('src/plugin/code.ts', 'utf8');
const paintSource = readFileSync('src/plugin/paint.ts', 'utf8');
const manifest = JSON.parse(readFileSync('manifest.json', 'utf8')) as { permissions?: string[] };

describe('Figma plugin host compatibility', () => {
  it('keeps browser networking and timer globals out of the Figma JSVM host', () => {
    expect(hostSource).not.toMatch(/\bfetch\s*\(/);
    expect(hostSource).not.toMatch(/\bnew\s+URL\s*\(/);
    expect(hostSource).not.toMatch(/\bAbortController\b|\bAbortSignal\b/);
    expect(hostSource).not.toMatch(/\bsetTimeout\s*\(|\bsetInterval\s*\(/);
  });

  it('asks Figma only for the signed-in operator identity permission', () => {
    expect(manifest.permissions).toContain('currentuser');
    expect(hostSource).toContain("type:'current-user'");
    expect(hostSource).toContain('figma.currentUser');
  });

  it('supports hiding the panel while keeping the plugin UI alive', () => {
    expect(hostSource).toContain("message.type==='hide-ui'");
    expect(hostSource).toContain('figma.ui.hide()');
    expect(hostSource).toContain("message.type==='bridge-job'");
  });

  it('swaps only selected instances to selected components and snapshots their previous component for rollback',()=>{
    expect(hostSource).toContain("operation.op==='swap-component'");
    expect(hostSource).toContain('target.swapComponent(item.source as ComponentNode)');
    expect(hostSource).toContain('target.swapComponent(snapshot.mainComponent)');
    expect(hostSource).toContain('getMainComponentAsync()');
  });

  it('exports one selected frame as a bounded visual preview and selects the first rendered frame', () => {
    expect(hostSource).toContain("operation.type==='capture-selection'");
    expect(hostSource).toContain("format:'JPG'");
    expect(hostSource).toContain('700 * 1024');
    expect(hostSource).toContain('figma.currentPage.selection = [firstFrame]');
  });

  it('renders native components, instances, vectors, gradients, and shadows', () => {
    expect(hostSource).toContain('figma.createComponent()');
    expect(hostSource).toContain('component.createInstance()');
    expect(hostSource).toContain('figma.createVector()');
    expect(hostSource).toContain('vector.vectorPaths=');
    expect(hostSource).toContain("type:'GRADIENT_LINEAR'");
    expect(paintSource).toContain("type:'DROP_SHADOW'");
  });

  it('renders and exports bounded solid, gradient and embedded image fill stacks',()=>{
    expect(hostSource).toContain('paints?.length)node.fills=buildPaintStack(paints,item=>figma.createImage');
    expect(hostSource).toContain('paints=await Promise.all(visible.map(item=>toStackItem');
    expect(hostSource).toContain("type:'image',mimeType,data:encodeBase64(bytes)");
    expect(hostSource).toContain("item.type==='GRADIENT_RADIAL'");
    expect(hostSource).toContain("type:'radial-gradient',gradient:toRadial(item)");
    expect(hostSource).toContain("item.type==='GRADIENT_ANGULAR'");
    expect(hostSource).toContain("item.type==='GRADIENT_DIAMOND'");
    expect(hostSource).toContain('combines a paint type unsupported by portable export');
  });

  it('imports and exports text case, decoration and letter spacing',()=>{
    expect(hostSource).toContain('text.letterSpacing=spec.letterSpacing');
    expect(hostSource).toContain('text.textAlignVertical=spec.textAlignVertical');
    expect(hostSource).toContain('text.textAutoResize=spec.textAutoResize');
    expect(hostSource).toContain('text.paragraphSpacing=spec.paragraphSpacing');
    expect(hostSource).toContain('text.textDecoration=spec.textDecoration');
    expect(hostSource).toContain('text.textCase=spec.textCase');
    expect(hostSource).toContain('style.letterSpacing=token.letterSpacing');
    expect(hostSource).toContain('style.textDecoration=token.textDecoration');
    expect(hostSource).toContain('style.textCase=token.textCase');
    expect(hostSource).toContain('style.paragraphSpacing=token.paragraphSpacing');
    expect(hostSource).toContain('textAlignVertical:node.textAlignVertical');
    expect(hostSource).toContain('textAutoResize:node.textAutoResize');
    expect(hostSource).toContain('has mixed character styling');
    expect(hostSource).toContain('letterSpacing:{unit:node.letterSpacing.unit,value:node.letterSpacing.value}');
  });

  it('renders solid rectangle/ellipse strokes and exports losslessly supported outline metadata',()=>{
    expect(hostSource).toContain('node.strokes=[paint(spec.stroke,spec.strokeOpacity??1)]');
    expect(hostSource).toContain("node.strokeAlign=spec.strokeAlign??'CENTER'");
    expect(hostSource).toContain('uses multiple strokes which schema 1.0 cannot preserve');
    expect(hostSource).toContain('strokeAlign:node.strokeAlign');
  });

  it('renders and exports bounded native drop-shadow stacks',()=>{
    expect(hostSource).toContain('buildShadowStack(shadows?.length?shadows:shadow?[shadow]:[])');
    expect(hostSource).toContain('else if(exported.length>1)shadows=exported');
    expect(hostSource).toContain('more than four effects');
  });
  it('renders and exports bounded inner-shadow and blur effects',()=>{
    expect(hostSource).toContain('buildEffectStack(effects)');
    expect(hostSource).toContain("effect.type==='INNER_SHADOW'?'inner-shadow':'drop-shadow'");
    expect(hostSource).toContain("effect.type==='BACKGROUND_BLUR'");
    expect(hostSource).toContain('more than four effects');
    expect(hostSource).toContain("effect.blurType==='PROGRESSIVE'");
    expect(hostSource).toContain("type:'progressive-background-blur'");
  });

  it('supports embedded images, responsive grids, native tokens/styles, and advanced export paths',()=>{
    expect(hostSource).toContain('figma.createImage(bytes)');
    expect(hostSource).toContain('frame.layoutGrids=makeLayoutGrids');
    expect(hostSource).toContain('applyConstraints(node,spec.constraints)');
    expect(hostSource).toContain('figma.variables.createVariableCollection');
    expect(hostSource).toContain('figma.createTextStyle()');
    expect(hostSource).toContain('setBoundVariableForPaint');
    expect(hostSource).toContain("type:'vector',path");
    expect(hostSource).toContain('getBytesAsync()');
  });
});
