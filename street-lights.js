// Strassenbeleuchtung: LED-Leuchten entlang der Hauptstrasse, ältere Natriumdampflampen in den Quartieren.
// Standorte sind nicht erhoben. Sie werden regelmässig am Strassenrand gesetzt – nie auf einer vermessenen Strassenfläche, nie in
// einem Gebäude, nur im bebauten Gebiet: an der Hauptstrasse innerorts durchgehend alle 30 m (wechselseitig, ohne Lücke), in den
// Quartieren mindestens 44 m auseinander. Die Hauptstrasse ist innerorts durchgehend beleuchtet: hell unter den Leuchten, dazwischen schwächer, nirgends dunkel.
// Aus Angaben des Auftraggebers: LED an der Hauptstrasse mit hellem, klar begrenztem Licht auf der Fahrbahn; in den Quartieren
// Natriumdampflampen mit rötlichem, rundum strahlendem Licht. Masthöhen, Formen und die genaue Lichtfarbe sind Gestaltung.
import * as T from 'three';

const pointIn=(p,ring)=>{let yes=false;for(let i=0,j=ring.length-1;i<ring.length;j=i++){const a=ring[i],b=ring[j];if((a[1]>p[1])!==(b[1]>p[1])&&p[0]<(b[0]-a[0])*(p[1]-a[1])/(b[1]-a[1])+a[0])yes=!yes;}return yes;};
const hash=n=>{const s=Math.sin(n*127.1+311.7)*43758.5453;return s-Math.floor(s);};

export async function buildStreetLights(model){
  const register=await fetch('data/gwr.json').then(r=>r.ok?r.json():null).catch(()=>null),main=model.daily?.mainRoad;
  if(!register||!model.cadastre){model.streetLights=null;return null;}
  const height=model.height,addresses=Object.values(register.buildings).filter(b=>b.addresses.length).map(b=>[b.addresses[0].x,b.addresses[0].z]);
  const builtUp=p=>{let n=0;for(const a of addresses)if(Math.abs(a[0]-p[0])<110&&Math.abs(a[1]-p[1])<110&&Math.hypot(a[0]-p[0],a[1]-p[1])<110&&++n>=3)return true;return false;};
  const surfaces=[...(model.cadastre.polygons.road||[]),...(model.cadastre.polygons.rail||[])],onRoad=(x,z)=>surfaces.some(s=>x>=s.box.minX&&x<=s.box.maxX&&z>=s.box.minZ&&z<=s.box.maxZ&&pointIn([x,z],s.rings[0])&&!s.rings.slice(1).some(h=>pointIn([x,z],h)));
  const axes=model.roadSegments.filter(s=>s.type!=='rail'&&s.type!=='path'&&s.type!=='footway'),nearAxis=(x,z)=>{let best=1e9;for(const s of axes){const dx=s.b[0]-s.a[0],dz=s.b[1]-s.a[1],t=Math.max(0,Math.min(1,((x-s.a[0])*dx+(z-s.a[1])*dz)/(dx*dx+dz*dz||1)));best=Math.min(best,Math.hypot(x-s.a[0]-t*dx,z-s.a[1]-t*dz)-s.width/2);}return best;};
  // frei: in der Gemeinde, nicht auf einer Strassen- oder Bahnfläche, nicht näher als 0,5 m an einer Fahrbahn gemäss Achse, nicht im oder dicht am Gebäude
  const free=(x,z)=>model.boundary.contains([x,z])&&!onRoad(x,z)&&nearAxis(x,z)>.5&&!model.cadastre.inFootprint(x,z,.9);
  const lamps=[],stats={led:0,sodium:0,skipped:0,replaced:0};
  // Standort neben der Fahrbahn suchen: erst die bevorzugte Seite, dann die andere, jeweils etwas weiter aussen
  const beside=(p,dir,width,first,kind)=>{for(const side of [first,-first])for(const extra of kind==='led'?[1.1,1.8,2.6,3.6,4.4]:[1.1,1.8,2.6,3.6]){const x=p[0]-dir[1]*side*(width/2+extra),z=p[1]+dir[0]*side*(width/2+extra);if(free(x,z))return {x,z,toRoad:[dir[1]*side,-dir[0]*side],along:dir,kind};}return null;};
  // ---- LED an der Hauptstrasse, innerorts (zwischen den beiden Dorfeingängen)
  // Fachgerecht geplante Anlage: gleichmässiger Abstand, kein Ausfall. Ist ein Standort verstellt (Einmündung, Gebäude), rückt die Leuchte einige Meter entlang der Strasse.
  const SPACING=30;let band=null;
  if(main&&main.zone[0]>=0){const r=main,start=r.cum[r.zone[0]],end=r.cum[Math.min(r.pts.length-1,r.zone[1]+1)];
    const at=d=>{let i=0;while(i<r.pts.length-2&&r.cum[i+1]<d)i++;const t=Math.max(0,Math.min(1,(d-r.cum[i])/(r.cum[i+1]-r.cum[i]||1)));return {p:[r.pts[i][0]+(r.pts[i+1][0]-r.pts[i][0])*t,r.pts[i][1]+(r.pts[i+1][1]-r.pts[i][1])*t],dir:r.tan[i],width:r.widths[i]||6.2};};
    let k=0,last=start-SPACING+6;const placed=[];
    while(last+SPACING<end+SPACING*.4){const target=Math.min(last+SPACING,end-2);let lamp=null,d=target;for(const shift of [0,-2,2,-4,4,-6,6,-8,8,-10,10,-12,12,-14]){d=target+shift;if(d<start||d>end||d-last<18)continue;const q=at(d);lamp=beside(q.p,q.dir,q.width,k%2?1:-1,'led');if(lamp&&lamps.some(l=>Math.hypot(l.x-lamp.x,l.z-lamp.z)<18))lamp=null;if(lamp)break;}
      if(lamp){lamp.s=d;lamps.push(lamp);placed.push(d);stats.led++;k++;last=d;}else{stats.skipped++;last=target;}if(target>=end-2)break;}
    stats.ledGap=placed.length>1?+Math.max(placed[0]-start,end-placed[placed.length-1],...placed.slice(1).map((d,n)=>d-placed[n])).toFixed(1):null;stats.ledLength=+(end-start).toFixed(0);
    band={at,start,end,placed};}
  // ---- Natriumdampflampen an den Quartierstrassen im bebauten Gebiet
  model.roadSegments.forEach((s,index)=>{if(s.type!=='minor')return;const dx=s.b[0]-s.a[0],dz=s.b[1]-s.a[1],len=Math.hypot(dx,dz);if(len<.5)return;const dir=[dx/len,dz/len];
    for(let d=Math.min(len/2,3);d<len;d+=6){const p=[s.a[0]+dir[0]*d,s.a[1]+dir[1]*d];if(!model.boundary.contains(p)||!builtUp(p)||lamps.some(l=>Math.hypot(l.x-p[0],l.z-p[1])<(l.kind==='led'?30:44)))continue;
      const lamp=beside(p,dir,s.width,hash(index*7+Math.round(d))<.5?1:-1,'sodium');if(lamp){lamps.push(lamp);stats.sodium++;}else stats.skipped++;}});

  // ---- Die bisherigen, von Hand grob gesetzten Laternen entfallen
  for(const o of [...model.groups.world.children])if(/^Strassenlaternen_/.test(o.name)){o.removeFromParent();o.geometry?.dispose();stats.replaced++;}
  // ---- Masten und Leuchten (eine Geometrie für alle, Farbe je Teil)
  const position=[],normal=[],colour=[],add=(g,hex)=>{const c=new T.Color(hex),n=g.index?g.toNonIndexed():g;position.push(...n.getAttribute('position').array);normal.push(...n.getAttribute('normal').array);for(let i=0;i<n.getAttribute('position').count;i++)colour.push(c.r,c.g,c.b);g.dispose();if(n!==g)n.dispose();};
  for(const l of lamps){const y=height(l.x,l.z),angle=Math.atan2(l.toRoad[0],l.toRoad[1]);
    if(l.kind==='led'){const H=8,arm=1.9;l.head=[l.x+l.toRoad[0]*arm,y+H-.05,l.z+l.toRoad[1]*arm];
      const pole=new T.CylinderGeometry(.06,.085,H,8);pole.translate(l.x,y+H/2,l.z);add(pole,'#8a9196');const beam=new T.BoxGeometry(.07,.07,arm+.1);beam.rotateY(angle);beam.translate(l.x+l.toRoad[0]*arm/2,y+H-.02,l.z+l.toRoad[1]*arm/2);add(beam,'#8a9196');
      const head=new T.BoxGeometry(.3,.07,.72);head.rotateY(angle);head.translate(l.head[0]-l.toRoad[0]*.15,y+H,l.head[2]-l.toRoad[1]*.15);add(head,'#6f767b');}
    else{const H=4.6;l.head=[l.x,y+H+.22,l.z];const pole=new T.CylinderGeometry(.045,.07,H,8);pole.translate(l.x,y+H/2,l.z);add(pole,'#5f665f');const collar=new T.CylinderGeometry(.16,.08,.16,10);collar.translate(l.x,y+H+.02,l.z);add(collar,'#5f665f');
      const globe=new T.SphereGeometry(.26,12,8);globe.translate(...l.head);add(globe,'#d9d2bc');const cap=new T.CylinderGeometry(.2,.27,.07,12);cap.translate(l.x,y+H+.47,l.z);add(cap,'#5f665f');}}
  const geometry=new T.BufferGeometry();geometry.setAttribute('position',new T.Float32BufferAttribute(position,3));geometry.setAttribute('normal',new T.Float32BufferAttribute(normal,3));geometry.setAttribute('color',new T.Float32BufferAttribute(colour,3));
  const masts=new T.Mesh(geometry,new T.MeshStandardMaterial({vertexColors:true,roughness:.55,metalness:.3}));masts.name='Strassenlaternen_Masten';masts.castShadow=true;masts.receiveShadow=true;
  masts.userData={accuracy:'Illustrative street lighting. Positions generated along the road edges in the built-up area, not surveyed. LED on the main road and sodium lamps in residential streets as described by the client.'};model.groups.world.add(masts);

  // ---- Licht bei Dunkelheit: leuchtende Köpfe und ein Lichtfleck am Boden. LED: kühles Weiss, länglich und scharf begrenzt auf der Fahrbahn.
  // Natriumdampf: rötlich-orange, rund und weich auslaufend in alle Richtungen.
  const glow=new T.Group();glow.name='Strassenlicht';glow.visible=false;model.groups.world.add(glow);const dummy=new T.Object3D();
  const spot=(sharp)=>{const c=document.createElement('canvas');c.width=c.height=128;const g=c.getContext('2d'),grad=g.createRadialGradient(64,64,0,64,64,64);if(sharp){grad.addColorStop(0,'rgba(255,255,255,1)');grad.addColorStop(.55,'rgba(255,255,255,.8)');grad.addColorStop(.85,'rgba(255,255,255,.18)');grad.addColorStop(1,'rgba(255,255,255,0)');}else{grad.addColorStop(0,'rgba(255,255,255,.9)');grad.addColorStop(.3,'rgba(255,255,255,.45)');grad.addColorStop(.7,'rgba(255,255,255,.1)');grad.addColorStop(1,'rgba(255,255,255,0)');}g.fillStyle=grad;g.fillRect(0,0,128,128);return new T.CanvasTexture(c);};
  const make=(list,name,texture,colour,strength,place)=>{if(!list.length)return null;const plane=new T.PlaneGeometry(1,1);plane.rotateX(-Math.PI/2);const mesh=new T.InstancedMesh(plane,new T.MeshBasicMaterial({map:texture,color:new T.Color(colour).multiplyScalar(strength),transparent:true,blending:T.AdditiveBlending,depthWrite:false,toneMapped:false,polygonOffset:true,polygonOffsetFactor:-6,polygonOffsetUnits:-6}),list.length);
    mesh.name=name;mesh.frustumCulled=false;mesh.renderOrder=4;list.forEach((l,i)=>{place(l);dummy.updateMatrix();mesh.setMatrixAt(i,dummy.matrix);});glow.add(mesh);return mesh;};
  // Fleck liegt auf dem Gelände (Neigung aus dem Gefälle)
  const lay=(x,z,angle,sx,sz)=>{const nx=-(height(x+2,z)-height(x-2,z))/4,nz=-(height(x,z+2)-height(x,z-2))/4;dummy.position.set(x,height(x,z)+.22,z);dummy.rotation.set(Math.atan(-nz)*0-0,angle,0);dummy.rotation.set(Math.atan2(-nz,1)*-1,angle,Math.atan2(nx,1)*-1,'YXZ');dummy.scale.set(sx,1,sz);};
  const led=lamps.filter(l=>l.kind==='led'),sodium=lamps.filter(l=>l.kind==='sodium');
  // LED: ein durchgehendes Lichtband über die Fahrbahn innerorts, unter jeder Leuchte hell, dazwischen auf gut 40 % abfallend
  if(band&&band.placed.length){const c=document.createElement('canvas');c.width=64;c.height=4;const g=c.getContext('2d'),grad=g.createLinearGradient(0,0,64,0);grad.addColorStop(0,'rgba(255,255,255,0)');grad.addColorStop(.16,'rgba(255,255,255,.85)');grad.addColorStop(.26,'rgba(255,255,255,1)');grad.addColorStop(.74,'rgba(255,255,255,1)');grad.addColorStop(.84,'rgba(255,255,255,.85)');grad.addColorStop(1,'rgba(255,255,255,0)');g.fillStyle=grad;g.fillRect(0,0,64,4);
    const pos=[],uv=[],col=[],idx=[],from=band.start-10,to=band.end+10;let n=0;for(let d=from;d<=to+.01;d+=2.5,n++){const q=band.at(Math.max(band.start,Math.min(band.end,d))),over=d<band.start?d-band.start:d>band.end?d-band.end:0,cx=q.p[0]+q.dir[0]*over,cz=q.p[1]+q.dir[1]*over,half=q.width/2+2.4,near=Math.min(...band.placed.map(s=>Math.abs(s-d))),level=.42+.58*Math.exp(-(near/9.5)*(near/9.5)),fade=Math.max(0,Math.min(1,Math.min(d-from,to-d)/10));
      for(const side of [-1,-.5,0,.5,1]){const x=cx-q.dir[1]*side*half,z=cz+q.dir[0]*side*half;pos.push(x,height(x,z)+.2,z);uv.push((side+1)/2,0);col.push(fade*level,fade*level,fade*level);}
      if(n)for(let a=0;a<4;a++){const i0=(n-1)*5+a,i1=n*5+a;idx.push(i0,i1,i0+1,i0+1,i1,i1+1);}}
    const bg=new T.BufferGeometry();bg.setAttribute('position',new T.Float32BufferAttribute(pos,3));bg.setAttribute('uv',new T.Float32BufferAttribute(uv,2));bg.setAttribute('color',new T.Float32BufferAttribute(col,3));bg.setIndex(idx);
    const ribbon=new T.Mesh(bg,new T.MeshBasicMaterial({map:new T.CanvasTexture(c),color:new T.Color('#dfeaff').multiplyScalar(.17),vertexColors:true,side:T.DoubleSide,transparent:true,blending:T.AdditiveBlending,depthWrite:false,toneMapped:false,polygonOffset:true,polygonOffsetFactor:-6,polygonOffsetUnits:-6}));ribbon.name='Strassenlicht_LED_Band';ribbon.frustumCulled=false;ribbon.renderOrder=4;glow.add(ribbon);}
  make(led,'Strassenlicht_LED_Fahrbahn',spot(true),'#dfeaff',.13,l=>lay(l.head[0]+l.toRoad[0]*1.2,l.head[2]+l.toRoad[1]*1.2,Math.atan2(l.along[0],l.along[1]),11,30));
  make(sodium,'Strassenlicht_Natrium_Boden',spot(false),'#ff8a36',.6,l=>lay(l.x,l.z,0,24,24));
  const bulbs=(list,name,geometry,colour,strength,place)=>{if(!list.length)return;const mesh=new T.InstancedMesh(geometry,new T.MeshBasicMaterial({color:new T.Color(colour).multiplyScalar(strength),toneMapped:false}),list.length);mesh.name=name;mesh.frustumCulled=false;list.forEach((l,i)=>{place(l);dummy.updateMatrix();mesh.setMatrixAt(i,dummy.matrix);});glow.add(mesh);};
  bulbs(led,'Strassenlicht_LED_Leuchte',new T.BoxGeometry(.24,.03,.6),'#e6efff',5,l=>{dummy.position.set(l.head[0]-l.toRoad[0]*.15,l.head[1]+.01,l.head[2]-l.toRoad[1]*.15);dummy.rotation.set(0,Math.atan2(l.toRoad[0],l.toRoad[1]),0);dummy.scale.setScalar(1);});
  bulbs(sodium,'Strassenlicht_Natrium_Kugel',new T.SphereGeometry(.275,12,8),'#ff9a4a',4.2,l=>{dummy.position.set(...l.head);dummy.rotation.set(0,0,0);dummy.scale.setScalar(1);});

  let on=false;const setOn=value=>{on=!!value;glow.visible=on;};
  model.stats.streetLights=lamps.length;if(model.world)model.world.lightChecks=lamps.map(l=>[l.x,l.z]);model.stats.lighting=stats;
  model.streetLights={masts,glow,setOn,get on(){return on;},stats,lamps:lamps.map(l=>({kind:l.kind,x:+l.x.toFixed(1),z:+l.z.toFixed(1)})),check:()=>({onRoad:lamps.filter(l=>onRoad(l.x,l.z)).length,inBuilding:lamps.filter(l=>model.cadastre.inFootprint(l.x,l.z,.5)).length,nearest:lamps.map(l=>({kind:l.kind,edge:nearAxis(l.x,l.z)}))})};
  return model.streetLights;
}
