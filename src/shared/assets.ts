import { utf8ByteLength } from './utf8';

export const MAX_RASTER_BYTES = 5 * 1024 * 1024;
export const MAX_MCP_ASSET_BYTES = 192 * 1024;
export const MCP_ASSET_CHUNK_BYTES = 64 * 1024;
export const MAX_SVG_BYTES = 512 * 1024;
export const MAX_IMAGE_DIMENSION = 4096;
export type RasterInfo = { mimeType:'image/png'|'image/jpeg'|'image/gif'; width:number; height:number; size:number };
export type VectorInfo = { svg:string; width:number; height:number; elements:number; size:number };

export function validateRasterAsset(bytes:Uint8Array,mimeType:string):RasterInfo {
  if(bytes.byteLength<10||bytes.byteLength>MAX_RASTER_BYTES)throw new Error(`Image must be between 10 bytes and ${MAX_RASTER_BYTES} bytes.`);
  let actual:'image/png'|'image/jpeg'|'image/gif';let width=0;let height=0;
  if(starts(bytes,[137,80,78,71,13,10,26,10])){
    actual='image/png';({width,height}=pngDimensions(bytes));
  }else if(bytes[0]===0xff&&bytes[1]===0xd8&&bytes[2]===0xff){
    actual='image/jpeg';if(bytes[bytes.length-2]!==0xff||bytes[bytes.length-1]!==0xd9)throw new Error('JPEG file is truncated.');({width,height}=jpegDimensions(bytes));
  }else if(starts(bytes,[71,73,70,56])&&(bytes[4]===55||bytes[4]===57)&&bytes[5]===97){
    actual='image/gif';width=bytes[6]!|(bytes[7]!<<8);height=bytes[8]!|(bytes[9]!<<8);if(bytes[bytes.length-1]!==0x3b)throw new Error('GIF file is truncated or has no trailer.');
  }else throw new Error('Unsupported or invalid image bytes. Use a real PNG, JPEG, or GIF file.');
  if(mimeType!==actual)throw new Error(`MIME type mismatch: file bytes are ${actual}, not ${mimeType}.`);
  if(!width||!height||width>MAX_IMAGE_DIMENSION||height>MAX_IMAGE_DIMENSION)throw new Error(`Image dimensions must be 1–${MAX_IMAGE_DIMENSION} pixels on each side.`);
  return {mimeType:actual,width,height,size:bytes.byteLength};
}

export function sanitizeSvg(source:string):VectorInfo {
  const size=utf8ByteLength(source);
  if(!source.trim()||size>MAX_SVG_BYTES)throw new Error(`SVG must be non-empty and no larger than ${MAX_SVG_BYTES} UTF-8 bytes.`);
  let input=source.trim();
  input=input.replace(/^<\?xml\s+version\s*=\s*(["'])1\.[0-9]+\1(?:\s+encoding\s*=\s*(["'])UTF-8\2)?\s*\?>\s*/i,'');
  if(/<!|<\?|&(?!(?:amp|lt|gt|quot|apos|#\d+|#x[\da-f]+);)/i.test(input))throw new Error('SVG contains a declaration, processing instruction, or invalid entity.');
  const tags:string[]=[];const stack:string[]=[];const dimensions:{width?:number;height?:number;viewBox?:number[]}={};
  const allowedTags=new Set(['svg','g','path','rect','circle','ellipse','line','polyline','polygon']);
  const allowedAttrs=new Set(['xmlns','id','viewBox','width','height','d','x','y','x1','y1','x2','y2','cx','cy','r','rx','ry','points','fill','fill-rule','fill-opacity','stroke','stroke-width','stroke-linecap','stroke-linejoin','stroke-miterlimit','stroke-dasharray','stroke-dashoffset','stroke-opacity','opacity','transform']);
  let cursor=0;let count=0;let rootSeen=false;let rootClosed=false;
  while(cursor<input.length){
    const open=input.indexOf('<',cursor);
    if(open<0){if(input.slice(cursor).trim())throw new Error('SVG text nodes are unsupported; use geometric SVG markup only.');break;}
    if(input.slice(cursor,open).trim())throw new Error('SVG text nodes are unsupported; use geometric SVG markup only.');
    let quote='';let close=-1;
    for(let i=open+1;i<input.length;i++){const c=input[i]!;if(quote){if(c===quote)quote='';}else if(c==='"'||c==="'")quote=c;else if(c==='>'){close=i;break;}}
    if(close<0)throw new Error('SVG contains an unclosed tag.');
    const raw=input.slice(open+1,close);cursor=close+1;
    if(raw.startsWith('!')||raw.startsWith('?'))throw new Error('SVG declarations, comments, and processing instructions are unsupported.');
    const ending=raw.startsWith('/');const selfClosing=!ending&&/\/\s*$/.test(raw);const body=ending?raw.slice(1).trim():selfClosing?raw.replace(/\/\s*$/,'').trim():raw.trim();
    const nameMatch=body.match(/^([A-Za-z][A-Za-z0-9]*)/);if(!nameMatch)throw new Error('SVG tag name is malformed.');
    const tag=nameMatch[1]!;if(!allowedTags.has(tag))throw new Error(`Unsupported SVG element <${tag}>.`);
    if(ending){if(body.slice(tag.length).trim()||stack.pop()!==tag)throw new Error(`SVG closing tag </${tag}> does not match its parent.`);if(tag==='svg'&&stack.length===0)rootClosed=true;tags.push(`</${tag}>`);continue;}
    if(rootClosed)throw new Error('SVG contains content after the root element.');
    if(!rootSeen){if(tag!=='svg'||stack.length)throw new Error('SVG root element must be <svg>.');rootSeen=true;}else if(!stack.length)throw new Error('SVG must contain exactly one root element.');
    count+=1;if(count>5000)throw new Error('SVG exceeds the 5,000 element limit.');
    const attrs:Record<string,string>={};const rest=body.slice(tag.length);let pos=0;
    while(pos<rest.length){while(/\s/.test(rest[pos]??''))pos++;if(pos>=rest.length)break;
      const keyMatch=rest.slice(pos).match(/^([A-Za-z][A-Za-z0-9-]*)\s*=\s*/);if(!keyMatch)throw new Error('SVG attribute syntax is invalid.');
      const key=keyMatch[1]!;if(!allowedAttrs.has(key)||key.toLowerCase().startsWith('on'))throw new Error(`Unsupported SVG attribute "${key}".`);
      if(Object.hasOwn(attrs,key))throw new Error(`SVG attribute "${key}" is duplicated.`);
      pos+=keyMatch[0].length;const q=rest[pos];if(q!=='"'&&q!=="'")throw new Error(`SVG attribute "${key}" must be quoted.`);pos++;
      const end=rest.indexOf(q,pos);if(end<0)throw new Error(`SVG attribute "${key}" is not closed.`);const value=rest.slice(pos,end);pos=end+1;
      if(value.length>100_000||/[<>\u0000-\u001f]/.test(value)||/url\s*\(|javascript:|data:/i.test(value))throw new Error(`SVG attribute "${key}" contains unsafe content.`);
      if((key==='fill'||key==='stroke')&&!/^(?:none|currentColor|#[0-9a-f]{3,8}|[a-z]{1,20}|rgba?\([\d.% ,+-]+\))$/i.test(value))throw new Error(`SVG ${key} must be a simple color value.`);
      if(key==='transform'&&!/^(?:(?:matrix|translate|scale|rotate|skewX|skewY)\([\d.eE+\-,\s]+\)\s*)+$/.test(value))throw new Error('SVG transform contains unsupported syntax.');
      if(tag==='path'&&key==='d'&&!/^[MmLlHhVvCcSsQqTtAaZz0-9.eE+\-,\s]+$/.test(value))throw new Error('SVG path contains unsupported commands.');
      if(key==='xmlns'&&value!=='http://www.w3.org/2000/svg')throw new Error('SVG namespace must be the standard SVG namespace.');
      attrs[key]=value;
    }
    if(tag==='svg'){
      if(attrs.width)dimensions.width=parseDimension(attrs.width);
      if(attrs.height)dimensions.height=parseDimension(attrs.height);
      if(attrs.viewBox){const parts=attrs.viewBox.trim().split(/[ ,]+/).map(Number);if(parts.length!==4||parts.some(v=>!Number.isFinite(v))||parts[2]!<=0||parts[3]!<=0)throw new Error('SVG viewBox must contain four finite values and positive dimensions.');dimensions.viewBox=parts;}
    }
    const safeAttrs=tag==='svg'&&!attrs.xmlns?{xmlns:'http://www.w3.org/2000/svg',...attrs}:attrs;
    const attrText=Object.entries(safeAttrs).map(([key,value])=>` ${key}="${escapeAttribute(value)}"`).join('');
    tags.push(`<${tag}${attrText}${selfClosing?'/':''}>`);
    if(!selfClosing)stack.push(tag);else if(tag==='svg'&&stack.length===0)rootClosed=true;
  }
  if(!rootSeen||!rootClosed||stack.length)throw new Error('SVG root is incomplete.');
  const width=dimensions.width??dimensions.viewBox?.[2]??0;const height=dimensions.height??dimensions.viewBox?.[3]??0;
  if(!width||!height||width>MAX_IMAGE_DIMENSION||height>MAX_IMAGE_DIMENSION)throw new Error(`SVG dimensions must be 1–${MAX_IMAGE_DIMENSION}; specify width/height or a viewBox.`);
  return {svg:tags.join(''),width,height,elements:count,size};
}

function parseDimension(value:string):number{const match=value.match(/^(\d+(?:\.\d+)?)(?:px)?$/i);const n=match?Number(match[1]):NaN;if(!Number.isFinite(n)||n<=0)throw new Error('SVG dimensions must be positive pixel values.');return n;}
function escapeAttribute(value:string):string{return value.replace(/&(?!(?:amp|lt|gt|quot|apos|#\d+|#x[\da-f]+);)/gi,'&amp;').replace(/"/g,'&quot;');}
function starts(bytes:Uint8Array,signature:number[]):boolean{return signature.every((value,index)=>bytes[index]===value);}
function readU32BE(bytes:Uint8Array,index:number):number{return bytes[index]!*(2**24)+bytes[index+1]!*(2**16)+bytes[index+2]!*(2**8)+bytes[index+3]!;}
function pngDimensions(bytes:Uint8Array):{width:number;height:number}{
  let offset=8;let width=0;let height=0;let first=true;let sawData=false;let ended=false;
  while(offset+12<=bytes.length){const length=readU32BE(bytes,offset);if(length>bytes.length-offset-12)throw new Error('PNG chunk exceeds the available file bytes.');
    const type=String.fromCharCode(bytes[offset+4]!,bytes[offset+5]!,bytes[offset+6]!,bytes[offset+7]!);const dataStart=offset+8;const crcOffset=dataStart+length;
    if(crc32(bytes.subarray(offset+4,crcOffset))!==readU32BE(bytes,crcOffset))throw new Error(`PNG ${type} checksum is invalid.`);
    if(first){if(type!=='IHDR'||length!==13)throw new Error('PNG must begin with a valid IHDR chunk.');width=readU32BE(bytes,dataStart);height=readU32BE(bytes,dataStart+4);first=false;}
    else if(type==='IHDR')throw new Error('PNG must contain only one IHDR chunk.');
    if(type==='IDAT')sawData=true;
    offset=crcOffset+4;
    if(type==='IEND'){if(length!==0||!sawData||offset!==bytes.length)throw new Error('PNG end marker is invalid or file has trailing data.');ended=true;break;}
  }
  if(first||!ended)throw new Error('PNG file is truncated or missing its image data/end marker.');return {width,height};
}
const crcTable=(()=>{const table=new Uint32Array(256);for(let n=0;n<256;n++){let c=n;for(let k=0;k<8;k++)c=(c&1)?0xedb88320^(c>>>1):c>>>1;table[n]=c>>>0;}return table;})();
function crc32(bytes:Uint8Array):number{let crc=0xffffffff;for(const byte of bytes)crc=crcTable[(crc^byte)&0xff]!^(crc>>>8);return (crc^0xffffffff)>>>0;}
function jpegDimensions(bytes:Uint8Array):{width:number;height:number}{
  let i=2;while(i+4<bytes.length){if(bytes[i]!==0xff){i++;continue;}while(bytes[i]===0xff)i++;const marker=bytes[i++]!;if(marker===0xd8||marker===0xd9||marker===0x01||(marker>=0xd0&&marker<=0xd7))continue;
    if(i+2>bytes.length)break;const length=(bytes[i]!<<8)|bytes[i+1]!;if(length<2||i+length>bytes.length)break;
    if([0xc0,0xc1,0xc2,0xc3,0xc5,0xc6,0xc7,0xc9,0xca,0xcb,0xcd,0xce,0xcf].includes(marker)){if(length<7)break;return {height:(bytes[i+3]!<<8)|bytes[i+4]!,width:(bytes[i+5]!<<8)|bytes[i+6]!};}i+=length;
  }throw new Error('JPEG file is truncated or has no valid frame dimensions.');
}
