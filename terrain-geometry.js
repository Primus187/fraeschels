// Use precisely the same triangle planes for terrain and all draped meshes.
export function terrainGeometry(terrain,W,D,H,mask) {
 const n=terrain.count,dx=2*W/(n-1),dz=2*D/(n-1);
 const clamp=(v,lo,hi)=>Math.max(lo,Math.min(hi,v));
 function height(x,z){const u=clamp((x+W)/dx,0,n-1),v=clamp((D-z)/dz,0,n-1),i=Math.min(n-2,Math.floor(u)),j=Math.min(n-2,Math.floor(v)),a=u-i,b=v-j;
  const h00=terrain.heights[j*n+i],h10=terrain.heights[j*n+i+1],h01=terrain.heights[(j+1)*n+i],h11=terrain.heights[(j+1)*n+i+1];
  return (a+b<=1?h00+(h10-h00)*a+(h01-h00)*b:h11+(h01-h11)*(1-a)+(h10-h11)*(1-b))-H;
 }
 function clip(poly,signed){const out=[];for(let k=0;k<poly.length;k++){const a=poly[k],b=poly[(k+1)%poly.length],sa=signed(a),sb=signed(b);if(sa>=-1e-9)out.push(a);if((sa>=0)!==(sb>=0)){const t=sa/(sa-sb);out.push([a[0]+t*(b[0]-a[0]),a[1]+t*(b[1]-a[1])]);}}return out;}
 function appendTriangle(tri,offset,out){
  const xs=tri.map(p=>p[0]),zs=tri.map(p=>p[1]);
  const i0=clamp(Math.floor((Math.min(...xs)+W)/dx),0,n-2),i1=clamp(Math.floor((Math.max(...xs)+W)/dx),0,n-2);
  const j0=clamp(Math.floor((D-Math.max(...zs))/dz),0,n-2),j1=clamp(Math.floor((D-Math.min(...zs))/dz),0,n-2);
  for(let j=j0;j<=j1;j++)for(let i=i0;i<=i1;i++){
   const x0=-W+i*dx,x1=x0+dx,z1=D-j*dz,z0=z1-dz;
   let poly=tri;for(const fn of [p=>p[0]-x0,p=>x1-p[0],p=>p[1]-z0,p=>z1-p[1]])poly=clip(poly,fn);
   if(poly.length<3)continue;
   const diagonal=p=>1-(p[0]-x0)/dx-(z1-p[1])/dz;
   for(const sign of [1,-1]){const piece=clip(poly,p=>sign*diagonal(p));for(let k=1;k<piece.length-1;k++){
    const t=[piece[0],piece[k],piece[k+1]],area=(t[1][0]-t[0][0])*(t[2][1]-t[0][1])-(t[1][1]-t[0][1])*(t[2][0]-t[0][0]);
    if(Math.abs(area)<1e-8)continue;if(area>0)[t[1],t[2]]=[t[2],t[1]];
    for(const poly of mask?mask.clipTriangle(t):[t])for(let q=1;q<poly.length-1;q++)for(const [x,z]of [poly[0],poly[q],poly[q+1]])out.push(x,height(x,z)+offset,z);
   }}
  }
 }
 return {height,appendTriangle};
}
