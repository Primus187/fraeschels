import * as T from 'three';

// Architectural detail follows measured walls and roofs; placements are approximations.
export function architectureDetails({b,planes,groups,instances,material,height,roofColor,roadSegments,stats,batches}){
 const bars=[],gutters=[],ridges=[],pipes=[],sockets=[],doors=[],doorFrames=[],shutters=[],hinges=[],roofPlanes=new Map(),edges=new Map();
 const key=v=>v.toArray().map(x=>Math.round(x*40)).join(',');
 for(let i=0;i<b.positions.length;i+=9){const a=new T.Vector3().fromArray(b.positions,i),bb=new T.Vector3().fromArray(b.positions,i+3),c=new T.Vector3().fromArray(b.positions,i+6),n=bb.clone().sub(a).cross(c.clone().sub(a)).normalize(),centroid=a.clone().add(bb).add(c).multiplyScalar(1/3);const pitched=n.y>.3&&n.y<.98&&centroid.y>height(centroid.x,centroid.z)+2;
  if(pitched){const constant=n.dot(a),id=[n.x,n.y,n.z,constant].map((x,k)=>Math.round(x*(k===3?10:40))).join(',');if(!roofPlanes.has(id))roofPlanes.set(id,{n,constant,triangles:[],vertices:[]});const p=roofPlanes.get(id);p.triangles.push(new T.Triangle(a,bb,c));p.vertices.push(a,bb,c);}
  for(const [v,w]of [[a,bb],[bb,c],[c,a]]){const id=[key(v),key(w)].sort().join('|');if(!edges.has(id))edges.set(id,{a:v,b:w,faces:[]});edges.get(id).faces.push({n,pitched});}
 }
 function beam(a,b,r,out){const direction=b.clone().sub(a),l=direction.length();if(l<.3)return;const q=new T.Quaternion().setFromUnitVectors(new T.Vector3(0,1,0),direction.normalize()),e=new T.Euler().setFromQuaternion(q);out.push({x:(a.x+b.x)/2,y:(a.y+b.y)/2,z:(a.z+b.z)/2,rx:e.x,angle:e.y,rz:e.z,sx:r,sy:l,sz:r});}
 for(const edge of edges.values()){const roofs=edge.faces.filter(f=>f.pitched);if(!roofs.length)continue;const exterior=edge.faces.some(f=>Math.abs(f.n.y)<.1)||edge.faces.length===1;if(exterior){const n=roofs[0].n,a=edge.a.clone().addScaledVector(n,.08),bb=edge.b.clone().addScaledVector(n,.08);beam(a,bb,.12,bars);if(Math.abs(a.y-bb.y)<.25){beam(a.clone().add(new T.Vector3(0,-.11,0)),bb.clone().add(new T.Vector3(0,-.11,0)),.085,gutters);if(a.distanceTo(bb)>3){const down=a.clone().setY(height(a.x,a.z)+.15);beam(a.clone().add(new T.Vector3(0,-.11,0)),down,.055,pipes);}}}else if(roofs.length>1&&roofs[0].n.dot(roofs[1].n)<.97&&Math.abs(edge.a.y-edge.b.y)<.1)beam(edge.a.clone().add(new T.Vector3(0,.065,0)),edge.b.clone().add(new T.Vector3(0,.065,0)),.14,ridges);}
 const at=(p,tangent,u,y,offset)=>tangent.clone().multiplyScalar(u).addScaledVector(p.n,p.constant+offset).setY(y);
 let hasDoor=false;
 for(const p of planes.values()){const tangent=new T.Vector3(p.n.z,0,-p.n.x),us=p.vertices.map(v=>v.dot(tangent)),min=Math.min(...us),max=Math.max(...us),ys=p.vertices.map(v=>v.y),y0=Math.max(Math.min(...ys),height((b.min[0]+b.max[0])/2,(b.min[2]+b.max[2])/2)),y1=Math.max(...ys),angle=Math.atan2(p.n.x,p.n.z);
  const fits=(u,y,w,h)=>[-1,1].every(sx=>[-1,1].every(sy=>p.triangles.some(t=>t.containsPoint(at(p,tangent,u+sx*w/2,y+sy*h/2,0)))));
  const transform=(u,y,extra={})=>{const v=at(p,tangent,u,y,.13);return {x:v.x,y:v.y,z:v.z,angle,...extra};};
  if(max-min<3||y1-y0<2.6||max-min>60)continue;
  // A masonry plinth fits only the existing wall, without enlarging its footprint.
  for(let u=min+.55;u<max-.5;u+=1.1)if(fits(u,y0+.3,1.05,.45))sockets.push(transform(u,y0+.3));
  const num=Math.max(1,Math.floor((max-min)/3.5));if(max-min<27&&y1-y0<14)for(let y=y0+2;y<y1-.7;y+=2.9)for(let k=0;k<num;k++){const u=min+(k+.5)*(max-min)/num;for(const side of [-1,1])if(fits(u+side*.85,y,.46,1.3)){shutters.push(transform(u+side*.85,y));for(let yy of [-.43,.43])hinges.push(transform(u+side*.85,y+yy));}}
  const u=(min+max)/2,point=at(p,tangent,u,y0+1.05,0),near=roadSegments.some(r=>r.type!=='rail'&&distance([point.x,point.z],r.a,r.b)<22);
  if(!hasDoor&&near&&fits(u,y0+1.05,1.3,2.08)){doors.push(transform(u,y0+1.05));doorFrames.push(transform(u,y0+1.05));hasDoor=true;}
 }
 const add=(geo,color,transforms,name)=>{if(!transforms.length){geo.dispose();return null;}if(batches&&name!=='Einzelne_Dachziegel'){const key=name+'|'+new T.Color(color).getHexString();if(!batches.has(key))batches.set(key,{geo,color,transforms:[],name,owners:new Set()});else geo.dispose();const batch=batches.get(key);batch.transforms.push(...transforms);batch.owners.add(b.egid||b.id);return null;}const obj=instances(geo,material(color),transforms,groups.details,name+'_'+b.egid);if(obj)obj.userData={architecturalApproximation:true,accuracy:'Style, detail dimensions and positions approximated on measured building geometry.'};return obj;};
 add(new T.BoxGeometry(1,1,1),'#72604b',bars,'Dachabschluss');add(new T.CylinderGeometry(1,1,1,8),'#777c73',gutters,'Dachrinnen');add(new T.CylinderGeometry(1,1,1,8),'#777c73',pipes,'Regenfallrohre');add(new T.CylinderGeometry(1,1,1,8),roofColor,ridges,'Firstabdeckung');
 add(new T.BoxGeometry(1.05,.45,.09),'#a6a093',sockets,'Sockelmauerwerk');add(new T.BoxGeometry(1.3,2.15,.12),'#cfc7b6',doorFrames,'Tuergewande');add(new T.BoxGeometry(1.1,1.94,.19),'#75604c',doors,'Eingangstuer');
 // Existing referenced shutters take precedence; generic shutters are openly approximated.
 if(!b.referencedFacade){add(new T.BoxGeometry(.46,1.3,.095),'#586b55',shutters,'Fensterladen');add(new T.BoxGeometry(.38,.045,.12),'#344536',hinges,'Ladenbeschlag');}
 stats.architectureBuildings=(stats.architectureBuildings||0)+1;stats.roofEdges=(stats.roofEdges||0)+bars.length;
 const placeholder=new T.Group();placeholder.name='Dachziegel_Detail_'+b.egid;placeholder.userData={detailLOD:true,buildingEGID:b.egid,focus:[(b.min[0]+b.max[0])/2,(b.min[1]+b.max[1])/2,(b.min[2]+b.max[2])/2]};groups.details.add(placeholder);stats.roofTiles=stats.roofTiles||0;let created=false;placeholder.createDetails=()=>{if(created)return;created=true;
 const transforms=[];
 for(const p of roofPlanes.values()){const u=new T.Vector3().crossVectors(new T.Vector3(0,1,0),p.n).normalize(),v=new T.Vector3().crossVectors(p.n,u),us=p.vertices.map(a=>a.dot(u)),vs=p.vertices.map(a=>a.dot(v)),umin=Math.min(...us),umax=Math.max(...us),vmin=Math.min(...vs),vmax=Math.max(...vs),q=new T.Quaternion().setFromRotationMatrix(new T.Matrix4().makeBasis(u,p.n,v.clone().negate())),e=new T.Euler().setFromQuaternion(q);
  const at=(x,y)=>u.clone().multiplyScalar(x).addScaledVector(v,y).addScaledVector(p.n,p.constant);
  for(let y=vmin+.22,row=0;y<vmax-.2;y+=.39,row++)for(let x=umin+.17+(row%2)*.16;x<umax-.16;x+=.32){if(![-1,1].every(sx=>[-1,1].every(sy=>p.triangles.some(t=>t.containsPoint(at(x+sx*.145,y+sy*.175))))))continue;const point=at(x,y).addScaledVector(p.n,.037);transforms.push({x:point.x,y:point.y,z:point.z,rx:e.x,angle:e.y,rz:e.z});}
 }
 const tileGeo=tileGeometry();const tiles=add(tileGeo,roofColor,transforms,'Einzelne_Dachziegel');if(tiles){placeholder.add(tiles);for(let i=0;i<transforms.length;i++)tiles.setColorAt(i,new T.Color().setScalar(.97+((i*16807)%997)/997*.06));tiles.castShadow=false;}
 stats.roofTiles+=transforms.length;
 };
}
function tileGeometry(){const p=[];const ys=[.006,.018,.023,.018,.006];for(let i=0;i<4;i++){const x=-.155+i*.0775,xx=x+.0775;p.push(x,ys[i],-.195,x,ys[i],.195,xx,ys[i+1],-.195,x,ys[i],.195,xx,ys[i+1],.195,xx,ys[i+1],-.195);}const g=new T.BufferGeometry();g.setAttribute('position',new T.Float32BufferAttribute(p,3));g.computeVertexNormals();const positions=g.getAttribute('position'),normals=g.getAttribute('normal');for(let i=0;i<positions.count;i++){const k=Math.round((positions.getX(i)+.155)/.0775),a=Math.max(0,k-1),b=Math.min(4,k+1),normal=new T.Vector3(-(ys[b]-ys[a])/((b-a)*.0775),1,0).normalize();normals.setXYZ(i,normal.x,normal.y,normal.z);}return g;}
function distance(p,a,b){const x=b[0]-a[0],z=b[1]-a[1],t=T.MathUtils.clamp(((p[0]-a[0])*x+(p[1]-a[1])*z)/(x*x+z*z||1),0,1);return Math.hypot(p[0]-a[0]-t*x,p[1]-a[1]-t*z);}
