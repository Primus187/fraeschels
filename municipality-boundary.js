import * as T from 'three';

export function createBoundary(rings){
 const outer=rings[0],holes=rings.slice(1),vertices=[...outer,...holes.flat()],indices=T.ShapeUtils.triangulateShape(outer.map(p=>new T.Vector2(...p)),holes.map(r=>r.map(p=>new T.Vector2(...p))));
 const triangles=indices.map(ids=>{let points=ids.map(i=>vertices[i]);if(cross(points[0],points[1],points[2])<0)points=[points[0],points[2],points[1]];return {points,minX:Math.min(...points.map(p=>p[0])),maxX:Math.max(...points.map(p=>p[0])),minZ:Math.min(...points.map(p=>p[1])),maxZ:Math.max(...points.map(p=>p[1]))};});
 const borderCells=new Set(),cache=new Map(),cell=16,key=(x,z)=>x+'|'+z;
 for(const ring of rings)for(let i=0;i<ring.length-1;i++){const a=ring[i],b=ring[i+1],n=Math.ceil(Math.hypot(b[0]-a[0],b[1]-a[1])/8);for(let k=0;k<=n;k++){const x=Math.floor((a[0]+(b[0]-a[0])*k/(n||1))/cell),z=Math.floor((a[1]+(b[1]-a[1])*k/(n||1))/cell);for(let dx=-1;dx<=1;dx++)for(let dz=-1;dz<=1;dz++)borderCells.add(key(x+dx,z+dz));}}
 const contains=p=>pointIn(p,outer)&&!holes.some(h=>pointIn(p,h));
 function clipTriangle(points){const xs=points.map(p=>p[0]),zs=points.map(p=>p[1]),minX=Math.min(...xs),maxX=Math.max(...xs),minZ=Math.min(...zs),maxZ=Math.max(...zs);let border=false;for(let x=Math.floor(minX/cell);x<=Math.floor(maxX/cell)&&!border;x++)for(let z=Math.floor(minZ/cell);z<=Math.floor(maxZ/cell);z++)if(borderCells.has(key(x,z))){border=true;break;}
  if(!border){const x=Math.floor((minX+maxX)/2/cell),z=Math.floor((minZ+maxZ)/2/cell),id=key(x,z);if(!cache.has(id))cache.set(id,contains([(x+.5)*cell,(z+.5)*cell]));return cache.get(id)?[points]:[];}
  const result=[];for(const tri of triangles){if(tri.maxX<minX||tri.minX>maxX||tri.maxZ<minZ||tri.minZ>maxZ)continue;let poly=points;for(let i=0;i<3;i++)poly=clip(poly,tri.points[i],tri.points[(i+1)%3]);if(poly.length>=3)result.push(poly);}return result;
 }
 function clipSegment(a,b){const times=[0,1],dx=b[0]-a[0],dz=b[1]-a[1];for(const ring of rings)for(let i=0;i<ring.length-1;i++){const p=ring[i],q=ring[i+1],ex=q[0]-p[0],ez=q[1]-p[1],det=dx*ez-dz*ex;if(Math.abs(det)<1e-10)continue;const t=((p[0]-a[0])*ez-(p[1]-a[1])*ex)/det,u=((p[0]-a[0])*dz-(p[1]-a[1])*dx)/det;if(t>1e-8&&t<1-1e-8&&u>=0&&u<=1)times.push(t);}times.sort((x,y)=>x-y);const at=t=>[a[0]+dx*t,a[1]+dz*t],result=[];for(let i=1;i<times.length;i++)if(times[i]-times[i-1]>1e-8&&contains(at((times[i]+times[i-1])/2)))result.push([at(times[i-1]),at(times[i])]);return result;}
 return {rings,contains,clipTriangle,clipSegment,triangles};
}
function cross(a,b,p){return (b[0]-a[0])*(p[1]-a[1])-(b[1]-a[1])*(p[0]-a[0]);}
function clip(poly,a,b){const out=[];for(let i=0;i<poly.length;i++){const p=poly[i],q=poly[(i+1)%poly.length],u=cross(a,b,p),v=cross(a,b,q);if(u>=-1e-8)out.push(p);if((u>=0)!==(v>=0)){const t=u/(u-v);out.push([p[0]+(q[0]-p[0])*t,p[1]+(q[1]-p[1])*t]);}}return out;}
export function pointIn(p,ring){let inside=false;for(let i=0,j=ring.length-1;i<ring.length;j=i++){const a=ring[i],b=ring[j];if((a[1]>p[1])!==(b[1]>p[1])&&p[0]<(b[0]-a[0])*(p[1]-a[1])/(b[1]-a[1])+a[0])inside=!inside;}return inside;}
