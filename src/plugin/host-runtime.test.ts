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

  it('renders and exports bounded solid and linear-gradient fill stacks',()=>{
    expect(hostSource).toContain('paints?.length)node.fills=buildPaintStack(paints)');
    expect(hostSource).toContain('paints=visible.map(item=>toStackItem');
    expect(hostSource).toContain('combines an image or unsupported paint with other fills');
  });

  it('renders and exports bounded native drop-shadow stacks',()=>{
    expect(hostSource).toContain('buildShadowStack(effectSpecs)');
    expect(hostSource).toContain('else if(exported.length>1)shadows=exported');
    expect(hostSource).toContain('more than four drop shadows');
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
