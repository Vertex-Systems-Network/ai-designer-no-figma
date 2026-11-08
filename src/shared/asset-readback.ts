export type AssetReadback={id:string;type:string;width:number;height:number;childCount?:number;imageFill?:boolean};
export function verifyAssetReadback(readback:AssetReadback|null,expected:{id:string;kind:'svg'|'image';width:number;height:number}):void{
  if(!readback||readback.id!==expected.id)throw new Error('ASSET_READBACK_FAILED: Figma did not retain the inserted asset node.');
  if(Math.abs(readback.width-expected.width)>0.5||Math.abs(readback.height-expected.height)>0.5)throw new Error('ASSET_READBACK_FAILED: Inserted asset dimensions do not match the validated source.');
  if(expected.kind==='svg'&&(readback.type!=='FRAME'||(readback.childCount??0)<1))throw new Error('ASSET_READBACK_FAILED: SVG did not produce editable vector layers.');
  if(expected.kind==='image'&&(readback.type!=='RECTANGLE'||readback.imageFill!==true))throw new Error('ASSET_READBACK_FAILED: Raster node does not contain a native image fill.');
}
