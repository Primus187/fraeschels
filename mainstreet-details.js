import * as T from 'three';

export function pointSegmentDistance(p,a,b){const dx=b[0]-a[0],dz=b[1]-a[1],t=T.MathUtils.clamp(((p[0]-a[0])*dx+(p[1]-a[1])*dz)/(dx*dx+dz*dz||1),0,1);return Math.hypot(p[0]-a[0]-t*dx,p[1]-a[1]-t*dz);}

export function buildMainstreetDetails(ctx){
 const {detail,W,D,streetPaths,roadSegments,height,appendTriangle,groups,stats,surface,mesh,geometry,material}=ctx;
 groups.streetspace.userData={source:detail.source,accuracy:detail.accuracy};
 const pixel=([x,y])=>[x/detail.referenceSize[0]*2*W-W,y/detail.referenceSize[1]*2*D-D];
 const named=streetPaths.filter(p=>p.name==='Hauptstrasse').flatMap(p=>p.segments);
 const mainRoads=roadSegments.filter(s=>s.type!=='rail'&&named.some(([a,b])=>pointSegmentDistance([(s.a[0]+s.b[0])/2,(s.a[1]+s.b[1])/2],a,b)<1.2));
 const others=roadSegments.filter(s=>!mainRoads.includes(s)&&['primary','secondary','minor'].includes(s.type));
 const sidewalkPositions=[],curbPositions=[],walkways=[];
 const paving=material('#bcb8aa'),concrete=material('#c8c5b8');
 for(const area of detail.surfaces){surface(area.pixels.map(pixel),area.type==='asphalt'?material('#777b73'):paving,groups.streetspace,.115,area.name);stats.forecourts++;}
 const rampHeight=(x,z)=>{let distance=Infinity;for(const road of others)distance=Math.min(distance,pointSegmentDistance([x,z],road.a,road.b)-road.width/2);return .19+.12*T.MathUtils.clamp((distance-1)/2,0,1);};
 function drape(tri,out){const temp=[];appendTriangle(tri,.31,temp);for(let k=0;k<temp.length;k+=3)temp[k+1]+=rampHeight(temp[k],temp[k+2])-.31;out.push(...temp);}
 for(const setting of detail.sidewalks){for(const road of mainRoads){let [a,b]=[road.a,road.b];if(a[1]<b[1])[a,b]=[b,a];const length=Math.hypot(b[0]-a[0],b[1]-a[1]);if(length<.1)continue;const tx=(b[0]-a[0])/length,tz=(b[1]-a[1])/length,nx=-tz,nz=tx,sign=setting.side==='east'?1:-1;
  const start=-D+setting.toPixelY/detail.referenceSize[1]*2*D,end=-D+setting.fromPixelY/detail.referenceSize[1]*2*D;
  const walk=[];const steps=Math.ceil(length);for(let k=0;k<steps;k++){const t0=k/steps,t1=(k+1)/steps,p=[a[0]+tx*length*t0,a[1]+tz*length*t0],q=[a[0]+tx*length*t1,a[1]+tz*length*t1];if((p[1]+q[1])/2<start||(p[1]+q[1])/2>end)continue;
   const inner=road.width/2+.35,outer=inner+setting.width;
   const at=(v,d)=>[v[0]+nx*sign*d,v[1]+nz*sign*d];const pi=at(p,inner),po=at(p,outer),qi=at(q,inner),qo=at(q,outer);
   if(!walk.length)walk.push(at(p,(inner+outer)/2));walk.push(at(q,(inner+outer)/2));
   drape([pi,po,qi],sidewalkPositions);drape([po,qo,qi],sidewalkPositions);
   const py=height(...pi)+rampHeight(...pi),qy=height(...qi)+rampHeight(...qi);
   // Real vertical kerb face. It drops at street junctions and driveway openings.
   curbPositions.push(pi[0],py,pi[1],qi[0],qy,qi[1],pi[0],height(...pi)+.17,pi[1],qi[0],qy,qi[1],qi[0],height(...qi)+.17,qi[1],pi[0],height(...pi)+.17,pi[1]);
   stats.sidewalkMetres+=length/steps;
  }
  if(walk.length>1)walkways.push(walk);
  // Rounded end joins close the narrow wedges at polyline bends.
  for(const p of [a,b]){if(p[1]<start||p[1]>end)continue;const centre=[p[0]+nx*sign*(road.width/2+.35+setting.width/2),p[1]+nz*sign*(road.width/2+.35+setting.width/2)];for(let k=0;k<12;k++){const angle=k*Math.PI/6,next=(k+1)*Math.PI/6,r=setting.width/2;drape([centre,[centre[0]+Math.cos(angle)*r,centre[1]+Math.sin(angle)*r],[centre[0]+Math.cos(next)*r,centre[1]+Math.sin(next)*r]],sidewalkPositions);}}
 }}
 if(sidewalkPositions.length){const top=mesh(geometry(sidewalkPositions),concrete,groups.streetspace,'Trottoirs_Hauptstrasse');top.castShadow=false;}
 if(curbPositions.length){const kerb=mesh(geometry(curbPositions),material('#b4b2a8',{side:T.DoubleSide}),groups.streetspace,'Bordsteine_Hauptstrasse');kerb.castShadow=false;}
 for(const crossing of detail.crosswalks){const location=pixel(crossing.pixel);let closest=null,best=Infinity;
  for(const road of mainRoads){const distance=pointSegmentDistance(location,road.a,road.b);if(distance<best){best=distance;closest=road;}}
  if(!closest||best>15)continue;const {a,b,width}=closest,dx=b[0]-a[0],dz=b[1]-a[1],length=Math.hypot(dx,dz),tx=dx/length,tz=dz/length,nx=-tz,nz=tx,t=T.MathUtils.clamp(((location[0]-a[0])*dx+(location[1]-a[1])*dz)/(length*length),0,1),centre=[a[0]+dx*t,a[1]+dz*t],positions=[];
  for(let stripe=0;stripe<6;stripe++){const shift=(stripe-2.5)*width/6,bar=Math.min(.48,width/9);const p=(along,across)=>[centre[0]+tx*along+nx*(shift+across),centre[1]+tz*along+nz*(shift+across)];appendTriangle([p(-1.35,-bar/2),p(-1.35,bar/2),p(1.35,-bar/2)],.215,positions);appendTriangle([p(-1.35,bar/2),p(1.35,bar/2),p(1.35,-bar/2)],.215,positions);}
  const obj=mesh(geometry(positions),material('#e6bd4d'),groups.streetspace,crossing.name);obj.castShadow=false;obj.userData={source:'SWISSIMAGE',accuracy:'Crossing location interpreted from imagery; stripe spacing approximated.'};stats.crosswalks++;
 }
 stats.sidewalkMetres=Math.round(stats.sidewalkMetres);
 return {viewpoints:detail.viewpoints.map(v=>({...v,camera:pixel(v.cameraPixel),look:pixel(v.lookPixel)})),mainRoads,walkways,sidewalkHeight:rampHeight};
}

export function facadeIsTimber(config,b,point){return config?.type==='mixed-farm'&&point.x>b.min[0]+(b.max[0]-b.min[0])*.45;}

export function addFacadeDetails({config,b,planes,height,instances,groups,stats,material,roadSegments}){
 if(!config)return;const shutters=[],sills=[],boards=[],doors=[],gates=[];
 let doorPlaced=false,gatePlaced=false;
 for(const p of planes.values()){
  const tangent=new T.Vector3(p.n.z,0,-p.n.x),horizontal=p.vertices.map(v=>v.dot(tangent)),min=Math.min(...horizontal),max=Math.max(...horizontal),ground=height((b.min[0]+b.max[0])/2,(b.min[2]+b.max[2])/2),y0=Math.max(Math.min(...p.vertices.map(v=>v.y)),ground),y1=Math.max(...p.vertices.map(v=>v.y));
  if(max-min<3||max-min>70||y1-y0<2.6)continue;
  const at=(u,y)=>{const v=tangent.clone().multiplyScalar(u).add(p.n.clone().multiplyScalar(p.constant));v.y=y;return v;};
  const fits=(u,y,w,h)=>[-1,1].every(sx=>[-1,1].every(sy=>p.triangles.some(tri=>tri.containsPoint(at(u+sx*w/2,y+sy*h/2)))));
  const transform=(point,offset=.10,extra={})=>{const v=point.clone().addScaledVector(p.n,offset);return {x:v.x,y:v.y,z:v.z,angle:Math.atan2(p.n.x,p.n.z),...extra};};
  const num=Math.max(1,Math.floor((max-min)/3.5));
  for(let y=y0+2;y<y1-.7;y+=2.9)for(let k=0;k<num;k++){const u=min+(k+.5)*(max-min)/num,point=at(u,y);if(facadeIsTimber(config,b,point)||!p.triangles.some(tri=>tri.containsPoint(point)))continue;
   sills.push(transform(at(u,y-.73),.15));if(config.shutters)for(const side of [-1,1]){const su=u+side*.9;if(fits(su,y,.5,1.35))shutters.push(transform(at(su,y),.14));}
  }
  if(config.timber)for(let u=min+.2;u<max-.2;u+=.34)for(let y=y0+1.1;y<y1-.5;y+=1){const point=at(u,y);if(facadeIsTimber(config,b,point)&&fits(u,y,.27,.92))boards.push(transform(point,.075));}
  const u=min+(max-min)*.5,point=at(u,y0+1.15),nearRoad=roadSegments.some(r=>r.type!=='rail'&&pointSegmentDistance([point.x,point.z],r.a,r.b)<25);
  if(!doorPlaced&&nearRoad&&!facadeIsTimber(config,b,point)&&fits(u,y0+1.15,1.05,2.1)){doors.push(transform(point,.18));doorPlaced=true;}
  const gateU=min+(max-min)*.72,gatePoint=at(gateU,y0+1.85);
  if(config.timber&&!gatePlaced&&nearRoad&&facadeIsTimber(config,b,gatePoint)&&fits(gateU,y0+1.85,2.8,3.2)){gates.push(transform(gatePoint,.16));gatePlaced=true;}
 }
 const add=(geo,color,transforms,name)=>{const obj=instances(geo,material(color),transforms,groups.details,name+'_'+b.egid);if(obj)obj.userData={refinement:true,accuracy:'Provisional facade interpretation; dimensions and placement approximated.',source:'Street video 6rLXfpWQRno'};};
 add(new T.BoxGeometry(.5,1.35,.085),config.shutters||'#594c3c',shutters,'Fensterläden');
 add(new T.BoxGeometry(1.4,.12,.3),'#c6bfb0',sills,'Fensterbänke');
 add(new T.BoxGeometry(.27,.92,.065),config.timber||'#695541',boards,'Holzverschalung');
 add(new T.BoxGeometry(1.05,2.1,.1),'#6f6555',doors,'Hauseingang_angenähert');
 add(new T.BoxGeometry(2.8,3.2,.12),config.timber||'#695541',gates,'Ökonomietor_angenähert');
 stats.shutters+=shutters.length;stats.timberPanels+=boards.length;stats.facadesRefined++;
}
