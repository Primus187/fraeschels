// Tiere: Kühe auf den grossen gemeldeten Weiden (eingezäunt), Störche auf Wiesen und Äckern, ein Vogelschwarm über den Feldern.
// Dass eine Fläche als Weide gemeldet ist, stammt aus den Nutzungsflächen. Alles andere ist Gestaltung:
// ob und wie viele Tiere dort stehen, die Weidezeit, wo sich Störche aufhalten und der Flug der Vögel.
import * as T from 'three';
import {boxes,mulberry} from './daily-life.js';

const pointIn=(p,ring)=>{let yes=false;for(let i=0,j=ring.length-1;i<ring.length;j=i++){const a=ring[i],b=ring[j];if((a[1]>p[1])!==(b[1]>p[1])&&p[0]<(b[0]-a[0])*(p[1]-a[1])/(b[1]-a[1])+a[0])yes=!yes;}return yes;};
const MIN_PASTURE=4000; // m²: Kühe stehen nur auf grossen Weiden
const COW_COLOURS=['#8a4a2a','#7a3f24','#9a5a34','#2b2927','#3a3532','#a8683c'];

export function buildWildlife(model){
  if(!model.crops?.fields){model.wildlife=null;return null;}
  const height=model.height,rand=mulberry(4711),group=new T.Group();group.name='Tiere';group.userData={accuracy:'Illustrative animals. Pastures are reported land use; presence, number and behaviour of cows, storks and birds are made up.'};model.groups.life.add(group);
  const dummy=new T.Object3D(),hidden=new T.Matrix4().compose(new T.Vector3(0,-400,0),new T.Quaternion(),new T.Vector3(1e-4,1e-4,1e-4)),tint=new T.Color();
  const within=(f,p)=>p[0]>=f.box[0]&&p[0]<=f.box[1]&&p[1]>=f.box[2]&&p[1]<=f.box[3]&&pointIn(p,f.rings[0])&&!f.rings.slice(1).some(h=>pointIn(p,h))&&model.boundary.contains(p)&&!(model.cadastre?.inFootprint(p[0],p[1],3));
  const spot=f=>{for(let k=0;k<40;k++){const p=[f.box[0]+rand()*(f.box[1]-f.box[0]),f.box[2]+rand()*(f.box[3]-f.box[2])];if(within(f,p))return p;}return null;};
  const instanced=(geometry,count,name)=>{const m=new T.InstancedMesh(geometry,new T.MeshStandardMaterial({color:'#ffffff',vertexColors:true,roughness:1}),Math.max(1,count));m.name=name;m.castShadow=true;m.receiveShadow=true;m.frustumCulled=false;for(let i=0;i<m.count;i++){m.setMatrixAt(i,hidden);m.setColorAt(i,tint.set('#ffffff'));}group.add(m);return m;};
  const place=(mesh,i,x,z,angle,lift=0,scale=1,pitch=0)=>{dummy.position.set(x,height(x,z)+lift,z);dummy.rotation.set(pitch,angle,0,'YXZ');dummy.scale.setScalar(scale);dummy.updateMatrix();mesh.setMatrixAt(i,dummy.matrix);};

  // ---- Kühe: je Weide einige Tiere, die langsam umhergehen und grasen
  const pastures=model.crops.fields.filter(f=>/Weiden/.test(f.crop)&&!/ohne Weiden\)/.test(f.crop.replace(/übrige Weiden ohne Sömmerungsweiden/,''))&&f.count>0&&f.area>=MIN_PASTURE),cows=[]; // «Wiesen (ohne Weiden)» sind keine Weiden; kleine Hausweiden bleiben leer
  // Weidezaun um jede dieser Weiden: Holzpfosten alle 5 m und zwei Drähte, dem Gelände folgend. Der Zaun steht 1,2 m innerhalb der
  // gemeldeten Fläche; ob und wie die Weide wirklich eingezäunt ist, ist nicht erhoben.
  const fenceParts=[];let fenceMetres=0;const inset=(ring,d)=>{const c=[ring.reduce((s,p)=>s+p[0],0)/ring.length,ring.reduce((s,p)=>s+p[1],0)/ring.length];return ring.map(p=>{const l=Math.hypot(p[0]-c[0],p[1]-c[1])||1;return [p[0]-(p[0]-c[0])/l*d,p[1]-(p[1]-c[1])/l*d];});};
  const bar=(a,b,w,colour)=>{const d=new T.Vector3().subVectors(b,a),len=d.length();if(len<.02)return;const g=new T.BoxGeometry(w,len,w).toNonIndexed(),m=new T.Matrix4().makeRotationFromQuaternion(new T.Quaternion().setFromUnitVectors(new T.Vector3(0,1,0),d.normalize()));m.setPosition(a.clone().add(b).multiplyScalar(.5));g.applyMatrix4(m);fenceParts.push({g,colour});};
  for(const f of pastures){const ring=inset(f.rings[0],1.2);for(let i=0;i<ring.length;i++){const a=ring[i],b=ring[(i+1)%ring.length],len=Math.hypot(b[0]-a[0],b[1]-a[1]),n=Math.max(1,Math.round(len/5));
      for(let k=0;k<n;k++){const p=[a[0]+(b[0]-a[0])*k/n,a[1]+(b[1]-a[1])*k/n],q=[a[0]+(b[0]-a[0])*(k+1)/n,a[1]+(b[1]-a[1])*(k+1)/n];if(!model.boundary.contains(p)||!model.boundary.contains(q))continue;const yp=height(p[0],p[1]),yq=height(q[0],q[1]);
        bar(new T.Vector3(p[0],yp-.1,p[1]),new T.Vector3(p[0],yp+1.15,p[1]),.11,'#7a6248');for(const h of [.55,1.0])bar(new T.Vector3(p[0],yp+h,p[1]),new T.Vector3(q[0],yq+h,q[1]),.035,'#b9bcbb');fenceMetres+=len/n;}}}
  if(fenceParts.length){const position=[],normal=[],colour=[];for(const {g,colour:hex} of fenceParts){const c=new T.Color(hex);position.push(...g.getAttribute('position').array);normal.push(...g.getAttribute('normal').array);for(let i=0;i<g.getAttribute('position').count;i++)colour.push(c.r,c.g,c.b);g.dispose();}
    const g=new T.BufferGeometry();g.setAttribute('position',new T.Float32BufferAttribute(position,3));g.setAttribute('normal',new T.Float32BufferAttribute(normal,3));g.setAttribute('color',new T.Float32BufferAttribute(colour,3));const fence=new T.Mesh(g,new T.MeshStandardMaterial({vertexColors:true,roughness:.9}));fence.name='Weidezaun_illustrativ';fence.castShadow=true;fence.receiveShadow=true;
    fence.userData={accuracy:'Illustrative pasture fence 1.2 m inside the reported pasture outline; real fencing not surveyed.'};model.groups.world.add(fence);}
  // Innerhalb des Zauns bleiben
  const fenced=new Map(pastures.map(f=>[f,inset(f.rings[0],2.4)])),inPasture=(f,p)=>within(f,p)&&pointIn(p,fenced.get(f));
  for(const f of pastures){const n=Math.max(4,Math.min(12,Math.round(f.area/2400)));for(let k=0;k<n;k++){let p=null;for(let t=0;t<12&&!p;t++){const q=spot(f);if(q&&inPasture(f,q))p=q;}if(p)cows.push({f,fenced:true,x:p[0],z:p[1],angle:rand()*6.28,target:null,pause:rand()*20,speed:.18+rand()*.14,colour:COW_COLOURS[Math.floor(rand()*COW_COLOURS.length)],size:.9+rand()*.2});}}
  const cowMesh=instanced(boxes([[.78,.92,2.05,0,1.0,0,'#ffffff'],[.8,.5,.7,0,1.1,.25,'#efe9dd'],[.42,.46,.6,0,.98,1.25,'#ffffff'],[.3,.2,.3,0,.82,1.58,'#d9b9a6'],[.82,.3,.5,0,1.34,-.72,'#efe9dd'],
    ...[[-.26,.72],[.26,.72],[-.26,-.72],[.26,-.72]].map(([x,z])=>[.2,.62,.2,x,.31,z,'#ffffff',.8]),[.1,.5,.1,0,.9,-1.08,'#2b2927']]),cows.length,'Kuehe_illustrativ');
  cows.forEach((c,i)=>cowMesh.setColorAt(i,tint.set(c.colour)));

  // ---- Störche: einzelne Vögel, die über Wiesen und offene Äcker schreiten
  const meadows=model.crops.fields.filter(f=>['wiese','extensiv','brache','wintergetreide','gemuese'].includes(f.group)&&f.area>4000&&f.count>0),storks=[];
  for(let k=0;k<7&&meadows.length;k++){const f=meadows[Math.floor(rand()*meadows.length)],p=spot(f);if(p)storks.push({f,x:p[0],z:p[1],angle:rand()*6.28,target:null,pause:rand()*10,speed:.35+rand()*.2});}
  const storkMesh=instanced(boxes([[.26,.3,.62,0,.92,0,'#f4f2ea'],[.27,.22,.3,0,.95,-.3,'#1e1f20'],[.1,.42,.1,0,1.2,.3,'#f4f2ea'],[.14,.14,.16,0,1.44,.33,'#f4f2ea'],[.05,.05,.34,0,1.42,.56,'#c8452c'],[.04,.78,.04,-.07,.39,0,'#c8452c'],[.04,.78,.04,.07,.39,0,'#c8452c']]),storks.length,'Stoerche_illustrativ');

  // ---- Vogelschwarm: kleine dunkle Vögel, die gemeinsam Schleifen über den Feldern ziehen
  const FLOCK=54,birdGeometry=new T.BufferGeometry();birdGeometry.setAttribute('position',new T.Float32BufferAttribute([0,0,.22, -.5,.05,-.12, 0,0,-.05,  0,0,.22, 0,0,-.05, .5,.05,-.12],3));birdGeometry.computeVertexNormals();
  const birdMesh=new T.InstancedMesh(birdGeometry,new T.MeshBasicMaterial({color:'#2a2c30',side:T.DoubleSide}),FLOCK);birdMesh.name='Vogelschwarm_illustrativ';birdMesh.frustumCulled=false;for(let i=0;i<FLOCK;i++)birdMesh.setMatrixAt(i,hidden);group.add(birdMesh);
  const birds=[...Array(FLOCK)].map(()=>({a:rand()*6.28,r:3+rand()*16,h:(rand()-.5)*9,w:.5+rand()*.9,f:rand()*6.28})),centre={x:-300,z:200},range={x:Math.min(900,model.halfWidth*.6),z:Math.min(600,model.halfDepth*.6)};

  let clock=0,state={cows:false,storks:false,birds:0,dark:false};
  // Wer zu sehen ist: Kühe von Mitte April bis Ende Oktober ohne Schnee, Störche von März bis Mitte September am Tag, der Schwarm am Tag (im Herbst grösser).
  function setConditions({day=180,dark=0,snow=false}={}){const night=dark>.5,next={cows:day>=105&&day<=304&&!snow,storks:day>=60&&day<=258&&!night&&!snow,birds:night?0:day>=244&&day<=320?FLOCK:Math.round(FLOCK*.45),dark:night};
    const changed=next.cows!==state.cows||next.storks!==state.storks||next.birds!==state.birds;state=next;cowMesh.visible=state.cows;storkMesh.visible=state.storks;birdMesh.visible=state.birds>0;if(changed){draw();}}
  const stay=a=>a.fenced?inPasture:within;
  function wander(a,dt,active){if(!active)return;if(a.pause>0){a.pause-=dt;return;}if(!a.target){for(let k=0;k<8&&!a.target;k++){const p=[a.x+(rand()-.5)*40,a.z+(rand()-.5)*40];if(stay(a)(a.f,p))a.target=p;}if(!a.target){a.pause=5;return;}}
    const dx=a.target[0]-a.x,dz=a.target[1]-a.z,d=Math.hypot(dx,dz);if(d<.4){a.target=null;a.pause=6+rand()*26;return;}const want=Math.atan2(dx,dz);a.angle+=Math.atan2(Math.sin(want-a.angle),Math.cos(want-a.angle))*Math.min(1,dt*1.5);const nx=a.x+Math.sin(a.angle)*a.speed*dt,nz=a.z+Math.cos(a.angle)*a.speed*dt;if(!stay(a)(a.f,[nx,nz])){a.target=null;a.pause=2+rand()*6;return;}a.x=nx;a.z=nz;} // nie über den Rand der Fläche hinaus
  function draw(){if(state.cows)cows.forEach((c,i)=>place(cowMesh,i,c.x,c.z,c.angle,0,c.size,c.pause>0?.0:.0));if(state.storks)storks.forEach((s,i)=>place(storkMesh,i,s.x,s.z,s.angle,0,1.25));
    if(state.birds){const t=clock,cx=centre.x+Math.sin(t*.045)*range.x,cz=centre.z+Math.sin(t*.031+1.3)*range.z,head=Math.atan2(Math.cos(t*.045)*.045*range.x,Math.cos(t*.031+1.3)*.031*range.z),base=Math.max(height(cx,cz),0)+34+Math.sin(t*.11)*9;
      for(let i=0;i<FLOCK;i++){if(i>=state.birds){birdMesh.setMatrixAt(i,hidden);continue;}const b=birds[i],a=b.a+t*b.w*.25,x=cx+Math.cos(a)*b.r,z=cz+Math.sin(a*.8)*b.r*.7;dummy.position.set(x,base+b.h+Math.sin(t*.9+b.f)*1.5,z);dummy.rotation.set(0,head+Math.sin(t*.4+b.f)*.3,Math.sin(t*9+b.f)*.5,'YXZ');dummy.scale.set(1.5,Math.max(.2,1+Math.sin(t*11+b.f)*1.4),1.5);dummy.updateMatrix();birdMesh.setMatrixAt(i,dummy.matrix);}
      birdMesh.instanceMatrix.needsUpdate=true;}
    cowMesh.instanceMatrix.needsUpdate=true;storkMesh.instanceMatrix.needsUpdate=true;}
  function update(dt){if(!(dt>0))return;clock+=dt;for(const c of cows)wander(c,dt,state.cows&&!state.dark);for(const s of storks)wander(s,dt,state.storks);draw();}
  setConditions({});
  const stats={pastures:pastures.length,pastureMinM2:MIN_PASTURE,fenceMetres:Math.round(fenceMetres),cows:cows.length,storks:storks.length,flock:FLOCK};model.stats.wildlife=stats;
  model.wildlife={group,update,setConditions,stats,diagnostics:()=>({...stats,shown:{...state},clock:+clock.toFixed(2)}),
    positions:()=>({cows:cows.map(c=>({at:[c.x,c.z],inField:inPasture(c.f,[c.x,c.z]),crop:c.f.crop,area:c.f.area})),storks:storks.map(s=>({at:[s.x,s.z],inField:within(s.f,[s.x,s.z])}))})};
  return model.wildlife;
}
