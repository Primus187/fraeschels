import * as T from 'three';
// Seeded, seamless material maps. No aerial imagery or external assets.
const cache=new Map();
export function surfaceMaps(kind){
 if(cache.has(kind))return cache.get(kind);
 const size=256,canvas=document.createElement('canvas');canvas.width=canvas.height=size;const ctx=canvas.getContext('2d'),pixels=ctx.createImageData(size,size),heights=new Float32Array(size*size);let seed=3284;
 const rand=()=>{seed=(seed*1664525+1013904223)>>>0;return seed/4294967296;};
 for(let y=0;y<size;y++)for(let x=0;x<size;x++){
  const i=y*size+x,noise=rand(),grain=rand(),u=x/size,v=y/size;let value=.92+(noise-.5)*.12,h=noise*.08;
  if(kind==='roof'){const row=Math.floor(v*4),tx=((u*4+(row%2)*.5)%1),ty=(v*4)%1,joint=tx<.035||ty<.04,curve=Math.sin(tx*Math.PI);value=joint?.43:.75+curve*.20+(noise-.5)*.10;h=joint?0:.18+curve*.55+ty*.12;}
  else if(kind==='gravel'){const pebble=noise>.73;value=.65+noise*.35;h=pebble?.45+grain*.35:grain*.12;}
  else if(kind==='asphalt'){value=.68+noise*.18;h=noise*.12;}
  else if(kind==='paving'){const joint=(x%64<2||y%64<2);value=joint?.55:.88+(noise-.5)*.1;h=joint?0:.14+grain*.015;}
  else if(kind==='wood'||kind==='bark'){const fibre=Math.sin(u*Math.PI*40+Math.sin(v*Math.PI*2)*1.4);value=.79+fibre*.12+(noise-.5)*.1;h=.1+fibre*.08+noise*.04;}
  else if(kind==='metal'){value=.94+(noise-.5)*.04;h=noise*.02;}
  else if(kind==='grass'){value=.90+noise*.08;h=noise*.03;}
  else {value=.92+(noise-.5)*.07;h=noise*.04;}
  heights[i]=h;for(let k=0;k<3;k++)pixels.data[i*4+k]=Math.round(T.MathUtils.clamp(value,0,1)*255);pixels.data[i*4+3]=255;
 }
 ctx.putImageData(pixels,0,0);const map=new T.CanvasTexture(canvas);map.colorSpace=T.SRGBColorSpace;
 const normalCanvas=document.createElement('canvas');normalCanvas.width=normalCanvas.height=size;const nctx=normalCanvas.getContext('2d'),n=nctx.createImageData(size,size),at=(x,y)=>heights[((y+size)%size)*size+(x+size)%size];
 for(let y=0;y<size;y++)for(let x=0;x<size;x++){const i=(y*size+x)*4,v=new T.Vector3((at(x-1,y)-at(x+1,y))*2.5,(at(x,y-1)-at(x,y+1))*2.5,1).normalize();n.data[i]=(v.x*.5+.5)*255;n.data[i+1]=(v.y*.5+.5)*255;n.data[i+2]=(v.z*.5+.5)*255;n.data[i+3]=255;}
 nctx.putImageData(n,0,0);const normalMap=new T.CanvasTexture(normalCanvas);
 const roughCanvas=document.createElement('canvas');roughCanvas.width=roughCanvas.height=size;const rctx=roughCanvas.getContext('2d');rctx.fillStyle=kind==='metal'?'#777777':kind==='roof'?'#bfbfbf':'#ededed';rctx.fillRect(0,0,size,size);const roughnessMap=new T.CanvasTexture(roughCanvas);
 for(const [name,t]of Object.entries({map,normalMap,roughnessMap})){t.wrapS=t.wrapT=T.RepeatWrapping;t.anisotropy=4;t.name='Local_'+kind+'_'+name;t.userData={source:'seeded procedural material',aerialImage:false};}
 const result={map,normalMap,roughnessMap};cache.set(kind,result);return result;
}
export function qualityMaterial(kind,color='#ffffff',options={}){
 const m=new T.MeshStandardMaterial({color,roughness:kind==='metal'?.52:.88,metalness:kind==='metal'?.55:0,...surfaceMaps(kind),...options});m.normalScale.set(kind==='roof'?.7:.35,kind==='roof'?.7:.35);m.userData={qualityMaterial:kind,source:'Locally generated repeating surface maps; no imagery overlay.'};return m;
}
export function worldUV(g,metres=4){const p=g.getAttribute('position'),uv=[];for(let i=0;i<p.count;i++)uv.push(p.getX(i)/metres,p.getZ(i)/metres);g.setAttribute('uv',new T.Float32BufferAttribute(uv,2));return g;}
export function dressQualityBuilding(obj){
 const g=obj.geometry,p=g.getAttribute('position'),n=g.getAttribute('normal'),uv=[],roof=[],wall=[];
 for(let i=0;i<p.count;i++){const nx=n.getX(i),ny=n.getY(i),nz=n.getZ(i);if(ny>.3){const len=Math.hypot(nx,nz),tx=len>.01?-nz/len:1,tz=len>.01?nx/len:0;uv.push((p.getX(i)*tx+p.getZ(i)*tz)/1.28,len>.01?(p.getX(i)*nx+p.getZ(i)*nz)/len/Math.max(ny,.25)/1.56:p.getZ(i)/1.56);}else {const tx=Math.abs(nz),tz=-Math.sign(nx*nz||1)*Math.abs(nx);uv.push((p.getX(i)*tx+p.getZ(i)*tz)/2.4,p.getY(i)/2.4);}}
 for(let i=0;i<p.count;i+=3)(n.getY(i)>.3?roof:wall).push(i,i+1,i+2);
 g.setAttribute('uv',new T.Float32BufferAttribute(uv,2));g.setIndex([...roof,...wall]);g.clearGroups();g.addGroup(0,roof.length,0);g.addGroup(roof.length,wall.length,1);
 const materials=[qualityMaterial('roof','#ffffff',{vertexColors:true,side:T.DoubleSide}),qualityMaterial('plaster','#ffffff',{vertexColors:true,side:T.DoubleSide})];obj.userData.qualityBuilding=true;return materials;
}
