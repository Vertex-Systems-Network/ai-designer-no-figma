/** Read-only, bounded discovery in the currently open Figma document. */
export async function inventoryLocalDesignSystem(api: Pick<PluginAPI,'currentPage'|'variables'|'getLocalTextStylesAsync'|'getLocalPaintStylesAsync'|'getLocalEffectStylesAsync'>) {
  const maxScannedNodes=500, maxComponents=80, maxVariables=80, maxStyles=80;
  const components:Array<{id:string;name:string;type:'COMPONENT'|'COMPONENT_SET';width:number;height:number}>=[];
  const queue=[...api.currentPage.children];let scannedNodes=0;
  for(let index=0;index<queue.length&&scannedNodes<maxScannedNodes;index++){
    const node=queue[index]!;scannedNodes++;
    if((node.type==='COMPONENT'||node.type==='COMPONENT_SET')&&components.length<maxComponents){components.push({id:node.id,name:node.name.slice(0,120),type:node.type,width:node.width,height:node.height});}
    if('children' in node&&queue.length<maxScannedNodes+1)queue.push(...node.children.slice(0,maxScannedNodes+1-queue.length));
  }
  const [allVariables,textStyles,paintStyles,effectStyles]=await Promise.all([
    api.variables.getLocalVariablesAsync(),api.getLocalTextStylesAsync(),api.getLocalPaintStylesAsync(),api.getLocalEffectStylesAsync(),
  ]);
  const styles=[...textStyles.map(style=>({id:style.id,name:style.name.slice(0,120),type:'TEXT' as const})),...paintStyles.map(style=>({id:style.id,name:style.name.slice(0,120),type:'PAINT' as const})),...effectStyles.map(style=>({id:style.id,name:style.name.slice(0,120),type:'EFFECT' as const}))];
  return {
    scope:'current-page-components-and-local-document-tokens',page:{id:api.currentPage.id,name:api.currentPage.name.slice(0,120)},
    components,variables:allVariables.slice(0,maxVariables).map(variable=>({id:variable.id,name:variable.name.slice(0,120),type:variable.resolvedType,collectionId:variable.variableCollectionId,modeIds:Object.keys(variable.valuesByMode).slice(0,8)})),
    styles:styles.slice(0,maxStyles),
    counts:{scannedNodes,components:components.length,variables:allVariables.length,styles:styles.length},
    truncated:{nodes:queue.length>scannedNodes,components:components.length>=maxComponents&&queue.length>components.length,variables:allVariables.length>maxVariables,styles:styles.length>maxStyles},
  };
}
