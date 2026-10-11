import {terrainGeometry} from './terrain-geometry.js';

// Rendered cut/fill corridors, not a new survey. All draped surfaces use this same grid.
export function gradeTransportTerrain(source,W,D,center,vectors,buildings){
 const raw=terrainGeometry(source,W,D,source.centerHeight).height,n=513,dx=2*W/(n-1),dz=2*D/(n-1);
 const local=p=>[(p[0]-center[0])*111320*Math.cos(center[1]*Math.PI/180),-(p[1]-center[1])*111320];
 const segments=[];for(const f of vectors.features){if(f.properties.layer!=='transportation'||f.properties.class==='mask_terrain')continue;const type=f.properties.class;if(['path','footway','track'].includes(type))continue;const lines=f.geometry.type==='LineString'?[f.geometry.coordinates]:f.geometry.type==='MultiLineString'?f.geometry.coordinates:[];for(const line of lines)for(let i=1;i<line.length;i++){const a=local(line[i-1]),b=local(line[i]);if(Math.min(a[0],b[0])>W+30||Math.max(a[0],b[0])<-W-30||Math.min(a[1],b[1])>D+30||Math.max(a[1],b[1])<-D-30)continue;segments.push({a,b,rail:type==='rail',width:type==='rail'?3.5:({primary:6.8,secondary:6.2,minor:4.5}[type]||3)});}}
 const buckets=new Map(),buildingBuckets=new Map(),cell=40,key=(x,z)=>Math.floor(x/cell)+'|'+Math.floor(z/cell);
 const insert=(map,obj,x0,x1,z0,z1)=>{for(let x=Math.floor(x0/cell);x<=Math.floor(x1/cell);x++)for(let z=Math.floor(z0/cell);z<=Math.floor(z1/cell);z++){const k=x+'|'+z;if(!map.has(k))map.set(k,[]);map.get(k).push(obj);}};
 for(const s of segments)insert(buckets,s,Math.min(s.a[0],s.b[0])-20,Math.max(s.a[0],s.b[0])+20,Math.min(s.a[1],s.b[1])-20,Math.max(s.a[1],s.b[1])+20);
 for(const b of buildings)insert(buildingBuckets,b,b.min[0]-3,b.max[0]+3,b.min[2]-3,b.max[2]+3);
 const base=Array.from({length:n*n},(_,k)=>raw(-W+k%n*dx,D-Math.floor(k/n)*dz));
 const clamp=(v,a,b)=>Math.max(a,Math.min(b,v));
 function blur(sigma){const radius=Math.ceil(sigma*3/dx),weights=Array.from({length:radius*2+1},(_,i)=>Math.exp(-.5*((i-radius)*dx/sigma)**2));const tmp=new Float64Array(n*n),out=new Float64Array(n*n);for(let j=0;j<n;j++)for(let i=0;i<n;i++){let h=0,w=0;for(let k=-radius;k<=radius;k++){const a=weights[k+radius];h+=base[j*n+clamp(i+k,0,n-1)]*a;w+=a;}tmp[j*n+i]=h/w;}for(let j=0;j<n;j++)for(let i=0;i<n;i++){let h=0,w=0;for(let k=-radius;k<=radius;k++){const a=Math.exp(-.5*(k*dz/sigma)**2);h+=tmp[clamp(j+k,0,n-1)*n+i]*a;w+=a;}out[j*n+i]=h/w;}return out;}
 const roads=blur(9),rail=blur(24);
 function at(grid,x,z){const u=clamp((x+W)/dx,0,n-1),v=clamp((D-z)/dz,0,n-1),i=Math.min(n-2,Math.floor(u)),j=Math.min(n-2,Math.floor(v)),a=u-i,b=v-j;return (1-b)*((1-a)*grid[j*n+i]+a*grid[j*n+i+1])+b*((1-a)*grid[(j+1)*n+i]+a*grid[(j+1)*n+i+1]);}
 const smooth=t=>{t=clamp(t,0,1);return t*t*(3-2*t);},heights=[];let maxCutFill=0;
 for(let j=0;j<n;j++)for(let i=0;i<n;i++){const x=-W+i*dx,z=D-j*dz,original=base[j*n+i];let sum=0,weight=0,blend=0;
  for(const s of buckets.get(key(x,z))||[]){const ax=s.b[0]-s.a[0],az=s.b[1]-s.a[1],t=clamp(((x-s.a[0])*ax+(z-s.a[1])*az)/(ax*ax+az*az||1),0,1),px=s.a[0]+ax*t,pz=s.a[1]+az*t,d=Math.hypot(x-px,z-pz),inner=s.width/2+1,outer=inner+(s.rail?13:7);if(d>outer)continue;const w=1-smooth((d-inner)/(outer-inner)),h=at(s.rail?rail:roads,px,pz);sum+=h*w*(s.rail?5:1);weight+=w*(s.rail?5:1);blend=Math.max(blend,w);}
  // Preserve the footprint elevations under existing buildings.
  for(const b of buildingBuckets.get(key(x,z))||[]){const d=Math.hypot(Math.max(b.min[0]-x,0,x-b.max[0]),Math.max(b.min[2]-z,0,z-b.max[2]));if(d<3)blend*=smooth(d/3);}
  const h=weight?original+(sum/weight-original)*blend:original;maxCutFill=Math.max(maxCutFill,Math.abs(h-original));heights.push(h+source.centerHeight);
 }
 return {...source,count:n,heights,grading:{roadSigma:9,railSigma:24,maxCutFill,accuracy:'Approximated transport cut/fill corridors. Original building-footprint elevations preserved; not surveyed road or rail longitudinal profiles.'}};
}
