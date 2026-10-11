// Gemeindeleben nach den Unterlagen der Gemeinde Fräschels (data/community.json, tools/build-community.mjs):
// Kehrichtabfuhrplätze mit Abfuhrtagen und Kehrichtwagen, Schulbus nach Kerzers mit Schulkindern, Natur- und Freizeitorte,
// Stationsschild am Bahnhof. Aus den Unterlagen: die 43 Abfuhrplätze, die Abfuhrtage 2026, Haltestellen und Zeiten des
// Schulbusses, Namen und Texte der Orte. Gestaltung: Fahrzeuge, Fahrwege und Reihenfolge der Abfuhr, Uhrzeit des
// Kehrichtwagens, Zahl und Wohnort der Schulkinder, Form der Gegenstände. Alles hängt nur von der dargestellten Zeit ab.
import * as T from 'three';
import {boxes,mulberry} from './daily-life.js';
import {zurichParts} from './sun-season.js';

const clock=text=>{const [h,m]=text.split(':').map(Number);return h*60+m;};
// Abfuhr an einem Datum: laut Abfuhrplan im Planjahr, in anderen Jahren derselbe Zweiwochenrhythmus als Annahme (Kehricht donnerstags, Grüngut montags Februar bis November).
export function collectionOn(waste,{year,month,day,weekday,dayOfYear}){
  const key=String(month).padStart(2,'0')+'-'+String(day).padStart(2,'0');
  if(year===waste.year)return waste.household.includes(key)?'household':waste.green.includes(key)?'green':null;
  const week=Math.floor((dayOfYear-1)/7);return weekday===4&&week%2===0?'household':weekday===1&&week%2===1&&month>=2&&month<=11?'green':null;
}

export async function buildCommunity(model){
  const data=await fetch('data/community.json').then(r=>r.ok?r.json():null).catch(()=>null),net=model.daily?.network;
  if(!data||!net){model.community=null;return null;}
  const height=model.height,rand=mulberry(3284),dummy=new T.Object3D(),hidden=new T.Matrix4().compose(new T.Vector3(0,-400,0),new T.Quaternion(),new T.Vector3(1e-4,1e-4,1e-4)),tint=new T.Color();
  const group=new T.Group();group.name='Gemeindeleben';group.userData={source:data.source,accuracy:'Collection places, collection days, school bus stops and times from the municipality. Vehicles, routes, truck timing, children and object shapes are illustrative.'};model.groups.life.add(group);
  const place=(mesh,i,x,z,angle=0,lift=0,scale=1)=>{dummy.position.set(x,height(x,z)+lift,z);dummy.rotation.set(0,angle,0);dummy.scale.setScalar(scale);dummy.updateMatrix();mesh.setMatrixAt(i,dummy.matrix);};
  const instanced=(geometry,count,name,material)=>{const m=new T.InstancedMesh(geometry,material||new T.MeshStandardMaterial({color:'#ffffff',vertexColors:true,roughness:.7}),Math.max(1,count));m.name=name;m.castShadow=true;m.receiveShadow=true;m.frustumCulled=false;for(let i=0;i<m.count;i++){m.setMatrixAt(i,hidden);m.setColorAt(i,tint.set('#ffffff'));}group.add(m);return m;};

  // ---- Zeitachse eines Fahrzeugs: Fahrten und Halte hintereinander; Ort allein aus den Sekunden seit dem Start
  const lane=(kind,width)=>kind==='track'?.1:Math.min(1.5,width*.24);
  // Anfahren und Abbremsen: die Strecke wächst am Anfang und Ende einer Fahrt sanft (je rund 5 Sekunden), dazwischen gleichmässig
  const ease=(u,duration)=>{const f=Math.min(.4,5/Math.max(duration,1)),top=1/(1-f);return u<f?top*u*u/(2*f):u>1-f?1-top*(1-u)*(1-u)/(2*f):top*(u-f/2);};
  function timeline(legs){let t=0;const list=legs.map(leg=>{const start=t;t+=leg.duration;return {...leg,start,end:t};});
    return {duration:t,legs:list,at(seconds){if(seconds<0||seconds>t)return null;const leg=list.find(l=>seconds<=l.end)||list.at(-1);if(leg.wait)return {x:leg.wait[0],z:leg.wait[1],angle:leg.wait[2],waiting:true,leg};
      const p=net.along(leg.route,ease((seconds-leg.start)/leg.duration,leg.duration)*leg.route.total,{seg:0},lane);return {x:p.x,z:p.z,angle:Math.atan2(p.dx,p.dz),waiting:false,leg};}};}
  const drive=(from,toTree,speed)=>{const route=net.route(from,toTree);return route&&route.total>.5?{route,duration:route.total/speed}:null;};
  const endOf=route=>{const n=route.pts.length,a=route.pts[n-2]||route.pts[n-1],b=route.pts[n-1];return [b[0],b[1],Math.atan2(b[0]-a[0],b[1]-a[1])];};
  // Ausfahrt Richtung Kerzers: die südlichste Ausfahrt der Hauptstrasse
  const kerzers=[...net.through].sort((a,b)=>net.nodes[b.node].p[1]-net.nodes[a.node].p[1])[0];

  // Nächster Strassenpunkt, der von der Ausfahrt her befahrbar ist (einzelne Wegstücke hängen nicht am Netz)
  const reachable=p=>{let best=-1,d=300;net.nodes.forEach((n,i)=>{if(!Number.isFinite(kerzers.tree.dist[i]))return;const q=Math.hypot(n.p[0]-p[0],n.p[1]-p[1]);if(q<d){d=q;best=i;}});return best;};

  // ---- Kehrichtabfuhr
  const places=data.waste.places.map(p=>({...p,node:reachable([p.x,p.z])})).filter(p=>p.node>=0);
  for(const p of places)p.tree=net.tree(p.node,net.CAR_COST);
  // Reihenfolge der Abfuhr: jeweils der nächste noch nicht geleerte Platz entlang der Strassen (angenommen)
  const order=[];{let at=kerzers.node;const left=new Set(places);while(left.size){let best=null,d=Infinity;for(const p of left){const q=p.tree.dist[at];if(q<d){d=q;best=p;}}if(!best)break;order.push(best);left.delete(best);at=best.node;}}
  const truckLegs=[];{let at=kerzers.node;for(const p of order){const leg=drive(at,p.tree,5.5);if(leg)truckLegs.push(leg);const last=leg?endOf(leg.route):[...net.nodes[p.node].p,0];p.arrival=truckLegs.reduce((s,l)=>s+l.duration,0);truckLegs.push({wait:last,duration:14});at=p.node;}const home=drive(at,kerzers.tree,8);if(home)truckLegs.push(home);}
  const truckLine=timeline(truckLegs),TRUCK_START=8*60; // Bereitstellung laut Gemeinde 07:00–08:00, der Wagen beginnt im Modell um 08:00
  const binGeometry=boxes([[.62,.92,.72,0,.58,0,'#ffffff'],[.66,.08,.76,0,1.08,0,'#ffffff',.8],[.1,.2,.1,-.24,.1,-.28,'#1b1d1e'],[.1,.2,.1,.24,.1,-.28,'#1b1d1e']]),binMesh=instanced(binGeometry,places.length*2,'Kehrichtcontainer');
  // Container stehen leicht neben dem Platzpunkt, damit sie nicht in der Fahrbahn liegen
  places.forEach((p,i)=>{const n=net.nodes[p.node].p,dx=p.x-n[0],dz=p.z-n[1],l=Math.hypot(dx,dz)||1;p.bins=[0,1].map(k=>[p.x-dz/l*(k?.45:-.45),p.z+dx/l*(k?.45:-.45),Math.atan2(dx,dz)]);});
  // Leerung: der Container rollt ans Heck, wird angehoben, gekippt und zurückgestellt (Ablauf gestaltet, je Container gut 4 Sekunden).
  const tip=(mesh,i,bin,at,s)=>{const rx=at.x-Math.sin(at.angle)*4.95,rz=at.z-Math.cos(at.angle)*4.95,sm=(a,b)=>{const u=Math.max(0,Math.min(1,(s-a)/(b-a)));return u*u*(3-2*u);};
    const go=sm(0,1.1)-sm(3.6,4.6),up=sm(1.1,2)-sm(2.9,3.6),x=bin[0]+(rx-bin[0])*go,z=bin[1]+(rz-bin[1])*go;
    dummy.rotation.order='YXZ';dummy.position.set(x,height(x,z)+up*1.35,z);dummy.rotation.set(up*2.1+(up>.98?Math.sin(s*31)*.05:0),bin[2]+(at.angle-bin[2])*Math.min(1,go*1.4),0);dummy.scale.setScalar(1);dummy.updateMatrix();mesh.setMatrixAt(i,dummy.matrix);};
  const truck=new T.Mesh(boxes([[2.3,1.5,2.0,0,1.75,2.9,'#f1f1ec'],[2.1,.7,.1,0,2.0,3.92,'#22303a'],[2.4,2.35,5.2,0,2.05,-.75,'#2f6b4a'],[2.4,.5,5.2,0,.8,-.75,'#2a2d2e'],[2.2,1.5,1.0,0,1.9,-3.8,'#3a3f42'],[.5,.2,.2,-.8,.5,3.95,'#ffd27a',1.6],[.5,.2,.2,.8,.5,3.95,'#ffd27a',1.6],
    ...[[-1.05,2.6],[1.05,2.6],[-1.05,-1.6],[1.05,-1.6],[-1.05,-2.7],[1.05,-2.7]].map(([x,z])=>[.35,1,1,x,.5,z,'#1b1d1e'])]),new T.MeshStandardMaterial({vertexColors:true,roughness:.6}));truck.name='Kehrichtwagen';truck.castShadow=true;truck.visible=false;group.add(truck);

  // ---- Schulbus und Schulkinder
  const stops=Object.fromEntries(data.schoolBus.stops.map(s=>{const node=reachable([s.x,s.z]),foot=net.nearest([s.x,s.z],net.FOOT_COST,250);return [s.id,{...s,node,foot,tree:net.tree(node,net.CAR_COST),footTree:net.tree(foot,net.FOOT_COST)}];}));
  const BUS_SPEED=8.5,runs=data.schoolBus.runs.map(run=>{const out=run.direction==='nach Kerzers',ids=Object.keys(run.times),[first,second]=ids.map(id=>stops[id]),t1=clock(run.times[ids[0]])*60,t2=clock(run.times[ids[1]])*60;
    const inbound=drive(kerzers.node,first.tree,BUS_SPEED),between=drive(first.node,second.tree,BUS_SPEED),away=drive(second.node,kerzers.tree,BUS_SPEED);if(!inbound||!between||!away)return null;
    // Zur Abfahrtszeit laut Fahrplan steht der Bus an der Haltestelle; auf der Rückfahrt ist die Fahrplanzeit die Ankunft.
    const dwell=out?50:35,arrive1=out?t1-dwell:t1,leave1=out?t1:t1+dwell,arrive2=Math.max(leave1+between.duration,out?t2-dwell:t2),leave2=out?Math.max(t2,arrive2+20):arrive2+dwell;
    const line=timeline([inbound,{wait:endOf(inbound.route),duration:leave1-arrive1},between,{wait:endOf(between.route),duration:leave2-(leave1+between.duration)},away]);
    // halt: wo der Bus an jeder Haltestelle steht (Ort und Fahrtrichtung) – dort warten die Kinder am Strassenrand auf der Türseite.
    const start=arrive1-inbound.duration,halt={[ids[0]]:line.at(arrive1-start+.5),[ids[1]]:line.at(arrive2-start+.5)};
    return {...run,out,ids,line,start,halt,stopTimes:{[ids[0]]:[arrive1,leave1],[ids[1]]:[arrive2,leave2]}};}).filter(Boolean);
  const bus=new T.Mesh(boxes([[2.1,1.9,6.2,0,1.6,0,'#f4f3ee'],[2.12,.34,6.22,0,1.05,0,'#e8532c'],[2.14,.7,4.6,0,2.05,-.3,'#22303a'],[2.0,.8,.1,0,2.0,3.12,'#22303a'],[.4,.18,.12,-.7,.75,3.12,'#ffd27a',1.6],[.4,.18,.12,.7,.75,3.12,'#ffd27a',1.6],[.4,.14,.12,-.7,.9,-3.12,'#ff2a1a',1.4],[.4,.14,.12,.7,.9,-3.12,'#ff2a1a',1.4],
    ...[[-1.0,2.1],[1.0,2.1],[-1.0,-2.0],[1.0,-2.0]].map(([x,z])=>[.3,.8,.8,x,.4,z,'#1b1d1e'])]),new T.MeshStandardMaterial({vertexColors:true,roughness:.55}));bus.name='Schulbus';bus.castShadow=true;bus.visible=false;group.add(bus);
  // Schulkinder: je Haltestelle einige Kinder aus den nächstgelegenen Wohnhäusern (ausgelost)
  const kids=[];for(const stop of Object.values(stops)){const near=model.daily.homes.map(h=>({h,d:stop.footTree.dist[h.footNode]})).filter(x=>Number.isFinite(x.d)&&x.d>25&&x.d<520).sort((a,b)=>a.d-b.d).slice(0,14);
    for(let k=0;k<7&&near.length;k++){const {h}=near.splice(Math.floor(rand()*near.length),1)[0],route=net.route(h.footNode,stop.footTree,[h.at]);if(route)kids.push({rank:k,parent:k%2===0,stop:stop.id,route,back:net.reversed(route),pace:1.05+rand()*.25,early:60+rand()*240,offset:[(rand()-.5)*3,(rand()-.5)*3],colour:['#d9534f','#3f7fbf','#e0a72e','#5aa469','#8e5ea2','#e07b39'][Math.floor(rand()*6)]});}}
  const kerb=(kind,width)=>kind==='path'||kind==='footway'||kind==='drive'?0:width*.5+.7,kidBody=boxes([[.12,.44,.15,-.085,.22,0,'#39414f'],[.12,.44,.15,.085,.22,0,'#39414f'],[.36,.44,.21,0,.66,0,'#ffffff'],[.09,.38,.11,-.235,.66,0,'#ffffff'],[.09,.38,.11,.235,.66,0,'#ffffff'],[.3,.3,.13,0,.68,-.17,'#b5483a']]),kidHead=new T.SphereGeometry(.13,10,8);kidHead.translate(0,1.04,0); // Beine, Rumpf, Arme, Schulsack
  const kidBodies=instanced(kidBody,kids.length,'Schulkinder_Koerper'),kidHeads=instanced(kidHead,kids.length,'Schulkinder_Koepfe',new T.MeshStandardMaterial({color:'#c79e7c',roughness:1}));kids.forEach((k,i)=>kidBodies.setColorAt(i,tint.set(k.colour)));
  // Eltern (gestaltet): begleiten jedes zweite Kind zur Haltestelle, bleiben stehen, bis der Bus weg ist, und gehen dann heim.
  const adultBody=boxes([[.16,.82,.2,-.11,.41,0,'#2f3640'],[.16,.82,.2,.11,.41,0,'#2f3640'],[.46,.62,.26,0,1.13,0,'#ffffff'],[.11,.58,.13,-.3,1.12,0,'#ffffff'],[.11,.58,.13,.3,1.12,0,'#ffffff']]),adultHead=new T.SphereGeometry(.15,10,8);adultHead.translate(0,1.62,0);
  const adultBodies=instanced(adultBody,kids.length,'Eltern_Koerper'),adultHeads=instanced(adultHead,kids.length,'Eltern_Koepfe',new T.MeshStandardMaterial({color:'#c79e7c',roughness:1}));kids.forEach((k,i)=>adultBodies.setColorAt(i,tint.set(['#40566b','#6b4f4a','#4f6b52','#7a6a8c','#5c5c5c'][i%5])));

  const stats0={};
  // ---- Natur- und Freizeitorte: einfache Gegenstände und Einträge für Beschriftung und Karte
  const things=new T.Group();things.name='Natur_und_Freizeit';things.userData={accuracy:'Places named by the municipality; exact positions partly inferred (see data/community.json). Object shapes are illustrative.'};model.groups.world.add(things);
  const solid=(geometry,colour,x,y,z,name)=>{const m=new T.Mesh(geometry,new T.MeshStandardMaterial({color:colour,roughness:.95,flatShading:true}));m.position.set(x,y,z);m.name=name;m.castShadow=true;m.receiveShadow=true;things.add(m);return m;};
  const sign=(x,z,name)=>{const y=height(x,z);solid(new T.BoxGeometry(.1,1.5,.1),'#6b5740',x,y+.75,z,name+'_Pfosten');solid(new T.BoxGeometry(.9,.6,.06),'#e9e2c8',x,y+1.45,z,name+'_Tafel');};
  for(const poi of data.pois){const x=poi.x,z=poi.z,y=height(x,z);
    if(poi.model==='boulder'){const g=new T.IcosahedronGeometry(1.25,1),p=g.getAttribute('position');for(let i=0;i<p.count;i++){const f=.82+.3*Math.abs(Math.sin(p.getX(i)*3.1+p.getY(i)*5.3+p.getZ(i)*2.2));p.setXYZ(i,p.getX(i)*f*(1.15-.35*Math.max(0,p.getY(i))),p.getY(i)*f*1.1,p.getZ(i)*f*(.9-.3*Math.max(0,p.getY(i))));}g.computeVertexNormals();
      solid(g,'#9a978f',x,y+1.05,z,'Chutzenstein_Findling');sign(x+2.6,z+.6,'Chutzenstein');solid(new T.BoxGeometry(1.7,.08,.42),'#8a6946',x-2.4,y+.46,z+1.4,'Chutzenstein_Bank');for(const dx of [-.7,.7])solid(new T.BoxGeometry(.1,.45,.4),'#6b5740',x-2.4+dx,y+.22,z+1.4,'Chutzenstein_Bankfuss');}
    else if(poi.model==='grill'){const fx=x+4.2,fz=z+2.5,fy=height(fx,fz);solid(new T.CylinderGeometry(.75,.85,.35,10),'#77736c',fx,fy+.17,fz,'Grillplatz_Feuerstelle');solid(new T.CylinderGeometry(.5,.5,.1,10),'#2c2a28',fx,fy+.36,fz,'Grillplatz_Asche');
      for(const [dx,dz] of [[-3.2,1.2],[1.8,4.2]]){const tx=x+dx,tz=z+dz,ty=height(tx,tz);solid(new T.BoxGeometry(1.9,.08,.8),'#8a6946',tx,ty+.76,tz,'Grillplatz_Tisch');for(const side of [-.75,.75])solid(new T.BoxGeometry(1.9,.07,.3),'#8a6946',tx,ty+.45,tz+side,'Grillplatz_Bank');for(const ex of [-.8,.8])solid(new T.BoxGeometry(.1,.76,1.6),'#6b5740',tx+ex,ty+.38,tz,'Grillplatz_Tischbock');}}
    else if(poi.model!=='none')sign(x+1.5,z+1.5,poi.id);
    model.world.pois.push({id:poi.id,name:poi.name,x,z,description:poi.text,note:'Lage: '+poi.located+'. Angaben: Gemeinde Fräschels ('+poi.source.replace('https://','')+').'});}
  // ---- Abzweigung zum Bahnhof: Dorfbrunnen auf dem Grünspickel (links), Ofenhaus (rechts) – nach Fotos und Luftbild des Auftraggebers
  if(data.crossroads){const f=data.crossroads.fountain,o=data.crossroads.ofenhaus,u=f.axis,n=[-u[1],u[0]],turn=Math.atan2(-u[1],u[0]),fy=height(f.x,f.z),at=(a,b)=>[f.x+u[0]*a+n[0]*b,f.z+u[1]*a+n[1]*b];
    const part=(geometry,colour,a,b,y,name)=>{const [x,z]=at(a,b),m=solid(geometry,colour,x,fy+y,z,name);m.rotation.y=turn;return m;};
    part(new T.CylinderGeometry(3.3,3.3,.08,20),'#b7ae9f',0,0,.05,'Dorfbrunnen_Platz');part(new T.BoxGeometry(3.1,.62,1.15),'#a7a39a',0,0,.4,'Dorfbrunnen_Trog');part(new T.BoxGeometry(2.8,.04,.85),'#5d8ea6',0,0,.7,'Dorfbrunnen_Wasser');
    part(new T.BoxGeometry(.42,1.45,.42),'#9c988f',-1.85,0,.72,'Dorfbrunnen_Stock');part(new T.CylinderGeometry(.03,.03,.5,6).rotateZ(Math.PI/2),'#4b4f52',-1.45,0,1.02,'Dorfbrunnen_Roehre');
    for(const a of [-.9,1.1]){part(new T.CylinderGeometry(.36,.27,.46,10),'#8b5b3e',a,-1.75,.31,'Dorfbrunnen_Blumentopf');part(new T.SphereGeometry(.36,8,6),'#c9343f',a,-1.75,.66,'Dorfbrunnen_Blumen');}
    const note='Lage: '+f.located+'. Form des Brunnens angenähert. Quelle: '+data.crossroads.source+'.';
    model.world.pois.push({id:'dorfbrunnen',name:'Dorfbrunnen',x:f.x,z:f.z,description:'Brunnen mit Steintrog und Blumenschmuck an der Abzweigung von der Hauptstrasse zum Bahnhof.',note});
    model.world.pois.push({id:'ofenhaus',name:'Ofenhaus',x:o.x,z:o.z,description:'Das Ofenhaus steht an der Hauptstrasse bei der Abzweigung zum Bahnhof: weiss verputzt, Ziegeldach, Holztore. '+data.crossroads.crosswalk,note:'Lage: '+o.located+'. Fassade im Modell nur in der Farbe angepasst, Tore und Fenster sind nicht nachgebaut. Quelle: '+data.crossroads.source+'.'});}
  // Bahnhof nach Skizze, Luftbild und Foto des Auftraggebers. Am Perron stehen vier vermessene Bauten: 1 WC-Häuschen (Gebäude), 2 Station mit
  // Ortsschild und Automaten, 3 Warteraum (verglast, station-details.js), 4 Velounterstand. Hier kommen Ortsschild, Plakattafeln und Billettautomat
  // der Station sowie die Veloständer dazu. Die Dächer von 2 und 4 zeichnet cadastre.js aus der Vermessung (Höhe 2,5 m angenommen).
  if(data.station){const st=data.station,u=st.axis,facing=Math.atan2(u[0],u[1])+Math.PI/2,toTrack=(()=>{const pl=model.world.station.platform,c=[(pl[0][0]+pl[1][0]+pl[2][0]+pl[3][0])/4,(pl[0][1]+pl[1][1]+pl[2][1]+pl[3][1])/4],n=[-u[1],u[0]],side=(c[0]-st.hall.x)*n[0]+(c[1]-st.hall.z)*n[1];return side>=0?n:[-n[0],-n[1]];})();
    const extent=ring=>{const a=ring.map(p=>p[0]*u[0]+p[1]*u[1]),b=ring.map(p=>p[0]*toTrack[0]+p[1]*toTrack[1]);return {length:Math.max(...a)-Math.min(...a),depth:Math.max(...b)-Math.min(...b)};},top=(x,z)=>height(x,z)+.18,at=(o,a,b)=>[o.x+u[0]*a+toTrack[0]*b,o.z+u[1]*a+toTrack[1]*b];
    model.root.updateMatrixWorld(true);model.groups.world.traverse(o=>{if(o.name==='Bahnhof_Stationsschild')o.visible=false;}); // das bisherige einfache Schild entfällt
    // 2 Station: Ortsschild an der Dachkante zum Gleis, drei blaue Plakattafeln an der Rückseite, Billettautomat
    {const hall=extent(st.hall.ring),canvas=document.createElement('canvas');canvas.width=512;canvas.height=112;const c=canvas.getContext('2d');c.fillStyle='#1f3fa0';c.fillRect(0,0,512,112);c.fillStyle='#e2001a';c.fillRect(0,0,112,112);c.fillStyle='#ffffff';c.font='bold 64px Arial, sans-serif';c.textBaseline='middle';c.fillText('Fräschels',136,60);
      const texture=new T.CanvasTexture(canvas);texture.colorSpace=T.SRGBColorSpace;const blue=()=>new T.MeshStandardMaterial({color:'#1f3fa0',roughness:.6}),face=()=>new T.MeshStandardMaterial({map:texture,roughness:.6}),[sx,sz]=at(st.hall,0,hall.depth/2+.05);
      const board=new T.Mesh(new T.BoxGeometry(2.2,.48,.06),[blue(),blue(),blue(),blue(),face(),face()]);board.position.set(sx,top(sx,sz)+2.5+.34,sz);board.rotation.y=facing;board.name='Bahnhof_Namensschild';board.castShadow=true;things.add(board);
      const count=Math.max(2,Math.min(3,Math.floor((hall.length-1.6)/1.32)));for(let k=0;k<count;k++){const [px,pz]=at(st.hall,(k-(count-1)/2)*1.32-.6,-hall.depth/2+.25),panel=solid(new T.BoxGeometry(1.25,1.75,.07),'#2f6fd0',px,top(px,pz)+1.2,pz,'Bahnhof_Plakatwand');panel.rotation.y=facing;panel.material.roughness=.35;panel.material.flatShading=false;}
      const [mx,mz]=at(st.hall,hall.length/2-.75,-hall.depth/2+.45),machine=solid(new T.BoxGeometry(.8,1.7,.55),'#d4d7da',mx,top(mx,mz)+.85,mz,'Bahnhof_Billettautomat');machine.rotation.y=facing;machine.material.flatShading=false;const screen=solid(new T.BoxGeometry(.5,.4,.04),'#1d2a30',mx+toTrack[0]*.29,top(mx,mz)+1.2,mz+toTrack[1]*.29,'Bahnhof_Billettautomat_Bildschirm');screen.rotation.y=facing;
      const [bx,bz]=at(st.hall,-hall.length/2-1.1,0);solid(new T.CylinderGeometry(.22,.22,.85,12),'#9a9fa3',bx,top(bx,bz)+.43,bz,'Bahnhof_Abfalleimer').material.flatShading=false;}
    // 4 Velounterstand: zwei Reihen Anlehnbügel
    {const shed=extent(st.bikes.ring),n=Math.max(3,Math.floor((shed.length-.8)/1.1));for(let k=0;k<n;k++)for(const row of [-1,1]){const [x,z]=at(st.bikes,(k-(n-1)/2)*1.1,row*shed.depth*.22),hoop=solid(new T.TorusGeometry(.38,.025,6,14,Math.PI),'#8d9595',x,top(x,z),z,'Bahnhof_Velobuegel');hoop.rotation.y=Math.atan2(toTrack[0],toTrack[1])+Math.PI/2;hoop.material.flatShading=false;}}
    // 1 WC-Häuschen: Tafel an der Wand (das Gebäude selbst stammt aus dem 3D-Gebäudemodell)
    {const [x,z]=at(st.wc,0,extent(st.wc.ring).depth/2+.08),plate=solid(new T.BoxGeometry(.5,.3,.03),'#1f3fa0',x,top(x,z)+2.0,z,'Bahnhof_WC_Tafel');plate.rotation.y=facing;plate.material.flatShading=false;}
    model.world.pois.push({id:'bahnhof-bauten',name:'Station Fräschels',x:st.hall.x,z:st.hall.z,description:'Am Perron stehen vier Bauten: WC-Häuschen, Station mit Ortsschild und Billettautomat, verglaster Warteraum und Velounterstand.',note:'Lage und Umrisse aus der amtlichen Vermessung, Zuordnung nach Angaben des Auftraggebers. Höhen und Ausstattung angenähert.'});}

  // ---- Friedhof nach dem Luftbild des Auftraggebers: Hecken, Kieswege, Plattenweg, Grabreihen. Umrisse von Hand abgelesen (rund 2 m genau);
  // Zahl, Form und Bepflanzung der Gräber sind angenähert.
  if(data.cemetery){const cem=data.cemetery,merged=(parts,name,colourFallback)=>{if(!parts.length)return null;const position=[],normal=[],colour=[];for(const {g,c} of parts){const col=new T.Color(c||colourFallback);position.push(...g.getAttribute('position').array);normal.push(...g.getAttribute('normal').array);for(let i=0;i<g.getAttribute('position').count;i++)colour.push(col.r,col.g,col.b);g.dispose();}
        const g=new T.BufferGeometry();g.setAttribute('position',new T.Float32BufferAttribute(position,3));g.setAttribute('normal',new T.Float32BufferAttribute(normal,3));g.setAttribute('color',new T.Float32BufferAttribute(colour,3));const m=new T.Mesh(g,new T.MeshStandardMaterial({vertexColors:true,roughness:.95}));m.name=name;m.castShadow=true;m.receiveShadow=true;things.add(m);return m;};
    const block=(w,h,d,x,y,z,angle)=>{const g=new T.BoxGeometry(w,h,d).toNonIndexed();g.rotateY(angle);g.translate(x,y,z);return g;},steps=(a,b,size)=>{const len=Math.hypot(b[0]-a[0],b[1]-a[1]),n=Math.max(1,Math.round(len/size));return [...Array(n)].map((_,k)=>({x:a[0]+(b[0]-a[0])*(k+.5)/n,z:a[1]+(b[1]-a[1])*(k+.5)/n,len:len/n,angle:Math.atan2(b[0]-a[0],b[1]-a[1])}));};
    // Hecken: 0,8 m breit, 1,5 m hoch, in Stücken dem Gelände folgend
    const hedge=[];let hedgeMetres=0;for(const line of cem.hedges)for(let i=0;i<line.length-1;i++)for(const q of steps(line[i],line[i+1],2)){hedge.push({g:block(.8,1.5,q.len+.05,q.x,height(q.x,q.z)+.75,q.z,q.angle),c:(Math.round(q.x*3+q.z)%2)?'#3f6b2c':'#47752f'});hedgeMetres+=q.len;}
    merged(hedge,'Friedhof_Hecken','#3f6b2c');
    // Wege: Kies als flache Bänder knapp über dem Boden; der Plattenweg aus einzelnen Platten
    const gravel=[],slabs=[];for(const way of cem.paths)for(let i=0;i<way.points.length-1;i++)for(const q of steps(way.points[i],way.points[i+1],way.slabs?.9:1.5)){if(way.slabs)slabs.push({g:block(way.width*.8,.06,q.len*.82,q.x,height(q.x,q.z)+.17,q.z,q.angle),c:'#bdb7aa'});else gravel.push({g:block(way.width,.05,q.len+.12,q.x,height(q.x,q.z)+.155,q.z,q.angle),c:'#cbbfa2'});}
    const gravelMesh=merged(gravel,'Friedhof_Kieswege','#cbbfa2');if(gravelMesh)gravelMesh.castShadow=false;const slabMesh=merged(slabs,'Friedhof_Plattenweg','#bdb7aa');if(slabMesh)slabMesh.castShadow=false;
    // Gräber: Einfassung mit Erde, Grabstein am Kopfende, etwas Bepflanzung
    const stones=[],beds=[],flowers=[],FLOWER=['#d94f6b','#e9b93a','#f2f0e6','#b05cc0','#e2703a','#5aa469'];cem.graves.forEach((gr,i)=>{const y=height(gr.x,gr.z),dx=Math.sin(gr.angle),dz=Math.cos(gr.angle);
      beds.push({g:block(.85,.14,1.7,gr.x,y+.2,gr.z,gr.angle),c:'#6a5646'});stones.push({g:block(.6,.75+.25*((i*7)%3)/2,.14,gr.x-dx*.78,y+.5,gr.z-dz*.78,gr.angle),c:['#8f8f8c','#6f7376','#a59f93','#55595c'][i%4]});
      for(let k=0;k<3;k++)flowers.push({g:block(.22,.2,.22,gr.x+dx*(-.2+k*.38)+dz*(((i+k)%3)-1)*.2,y+.36,gr.z+dz*(-.2+k*.38)-dx*(((i+k)%3)-1)*.2,gr.angle),c:FLOWER[(i*3+k*5)%FLOWER.length]});});
    merged(beds,'Friedhof_Grabbeete','#6a5646');merged(stones,'Friedhof_Grabsteine','#8f8f8c');merged(flowers,'Friedhof_Grabschmuck','#d94f6b');
    Object.assign(stats0,{graves:cem.graves.length,hedgeMetres:Math.round(hedgeMetres)});}

  // ---- Ebene «Kehrichtabfuhrplätze»: nummerierte Marken, anfangs ausgeblendet
  const pins=new T.Group();pins.name='Kehrichtabfuhrplaetze';pins.visible=false;pins.userData={source:'Gemeinde Fräschels, Offizielle Abfuhrplätze 2022'};model.groups.collection=pins;model.root.add(pins);
  for(const p of places){const canvas=document.createElement('canvas');canvas.width=canvas.height=64;const c=canvas.getContext('2d');c.fillStyle='#c62828';c.beginPath();c.arc(32,32,30,0,Math.PI*2);c.fill();c.fillStyle='#ffffff';c.font='bold 32px Arial, sans-serif';c.textAlign='center';c.textBaseline='middle';c.fillText(String(p.number),32,34);
    const texture=new T.CanvasTexture(canvas);texture.colorSpace=T.SRGBColorSpace;const pin=new T.Sprite(new T.SpriteMaterial({map:texture,depthTest:false}));pin.position.set(p.x,height(p.x,p.z)+5,p.z);pin.scale.setScalar(5);pin.name='Abfuhrplatz_'+p.number;pin.userData={kind:'collection',place:p.number};pin.renderOrder=20;pins.add(pin);}

  // ---- Zeit
  let now={year:2026,month:1,day:1,weekday:4,dayOfYear:1,minutes:0},kind=null,lights=false;
  const weekdayOf=ms=>{const p=zurichParts(ms);return (new Date(Date.UTC(p.year,p.month-1,p.day)).getUTCDay()+6)%7+1;};
  function setTime(ms,{lamps=false}={}){const p=zurichParts(ms);now={year:p.year,month:p.month,day:p.day,dayOfYear:p.dayOfYear,weekday:weekdayOf(ms),minutes:p.hour*60+p.minute+new Date(ms).getUTCSeconds()/60};kind=collectionOn(data.waste,now);lights=lamps;draw();}
  function draw(){const seconds=now.minutes*60;
    // Kehricht: Container stehen am Abfuhrtag ab 05:00 bereit, bis der Wagen sie geleert hat
    const t=seconds-TRUCK_START*60,pos=kind?truckLine.at(t):null;truck.visible=!!pos&&model.boundary.contains([pos.x,pos.z]);if(pos){truck.position.set(pos.x,height(pos.x,pos.z)+.02,pos.z);truck.rotation.y=pos.angle;}
    binMesh.visible=!!kind;if(kind)places.forEach((p,i)=>{const out=now.minutes>=300&&t<p.arrival+13.2;for(let k=0;k<2;k++){if(out){const s=t-p.arrival-(1.5+k*6.4);if(pos?.waiting&&s>0&&s<4.6)tip(binMesh,i*2+k,p.bins[k],pos,s);else place(binMesh,i*2+k,p.bins[k][0],p.bins[k][1],p.bins[k][2]);binMesh.setColorAt(i*2+k,tint.set(kind==='green'?'#3f7f45':'#3b4044'));}else binMesh.setMatrixAt(i*2+k,hidden);}});
    binMesh.instanceMatrix.needsUpdate=true;if(binMesh.instanceColor)binMesh.instanceColor.needsUpdate=true;
    // Schulbus: an Werktagen nach Fahrplan
    const run=runs.find(r=>r.weekdays.includes(now.weekday)&&seconds>=r.start&&seconds<=r.start+r.line.duration),where=run?run.line.at(seconds-run.start):null;bus.visible=!!where&&model.boundary.contains([where.x,where.z]);if(where){bus.position.set(where.x,height(where.x,where.z)+.02,where.z);bus.rotation.y=where.angle;}
    kids.forEach((k,i)=>{let shown=null,adult=null;for(const r of runs){if(!r.weekdays.includes(now.weekday))continue;const [arrive,leave]=r.stopTimes[k.stop],walk=k.route.total/k.pace;
        if(r.out){const reach=leave-k.early,start=reach-walk,h=r.halt[k.stop],side=1.5+Math.floor(k.rank/4)*.95+k.offset[0]*.08,ahead=4.6+(k.rank%4)*1.15+k.offset[1]*.1,spot=h?[h.x+Math.cos(h.angle)*side+Math.sin(h.angle)*ahead,h.z-Math.sin(h.angle)*side+Math.cos(h.angle)*ahead]:[stops[k.stop].x+k.offset[0],stops[k.stop].z+k.offset[1]]; // vor dem Bus am rechten Strassenrand, in zwei Reihen
          // Einsteigen: in den letzten Sekunden vor der Abfahrt gehen die Kinder nacheinander zur Tür (rechts vorn am Bus) und verschwinden im Bus.
          const board=leave-15+k.rank*1.7,door=h?[h.x+Math.cos(h.angle)*1.35+Math.sin(h.angle)*1.7,h.z-Math.sin(h.angle)*1.35+Math.cos(h.angle)*1.7]:null; // Tür an der Halteposition – unabhängig davon, ob der Bus noch steht, sonst tauchen eingestiegene Kinder nach der Abfahrt wieder auf
          if(seconds>=start&&seconds<(door?board+2.6:leave+4)){const s=Math.min(k.route.total,(seconds-start)*k.pace),p=net.along(k.route,s,{seg:0},kerb),waiting=seconds>=reach,u=door?Math.max(0,Math.min(1,(seconds-board)/2.6)):0;
            shown=waiting?[spot[0]+((door?.[0]??spot[0])-spot[0])*u,spot[1]+((door?.[1]??spot[1])-spot[1])*u,door&&u>0?Math.atan2(door[0]-spot[0],door[1]-spot[1]):0,u>0?Math.abs(Math.sin(seconds*9+i))*.04:0]:[p.x,p.z,Math.atan2(p.dx,p.dz),Math.abs(Math.sin(s*3+i))*.04];
            if(k.parent)adult=waiting?[spot[0]+.55,spot[1]+.45,0,0]:[p.x+p.dz*.55,p.z-p.dx*.55,Math.atan2(p.dx,p.dz),Math.abs(Math.sin(s*2.6+i))*.03];}
          else if(k.parent&&seconds>=start&&seconds<leave+10)adult=[spot[0]+.55,spot[1]+.45,0,0];
          else if(k.parent&&seconds>=leave+10&&seconds<leave+10+k.route.total/1.25){const s=(seconds-leave-10)*1.25,p=net.along(k.back,s,{seg:0},kerb);adult=[p.x,p.z,Math.atan2(p.dx,p.dz),Math.abs(Math.sin(s*2.6+i))*.03];}}
        else{const start=arrive+8+i%5*3;if(seconds>=start&&seconds<start+walk){const s=(seconds-start)*k.pace,p=net.along(k.back,s,{seg:0},kerb);shown=[p.x,p.z,Math.atan2(p.dx,p.dz),Math.abs(Math.sin(s*3+i))*.04];}}}
      if(shown){place(kidBodies,i,shown[0],shown[1],shown[2],.03+shown[3]);place(kidHeads,i,shown[0],shown[1],shown[2],.03+shown[3]);}else{kidBodies.setMatrixAt(i,hidden);kidHeads.setMatrixAt(i,hidden);}k.shown=!!shown;
      if(adult){place(adultBodies,i,adult[0],adult[1],adult[2],.03+adult[3]);place(adultHeads,i,adult[0],adult[1],adult[2],.03+adult[3]);}else{adultBodies.setMatrixAt(i,hidden);adultHeads.setMatrixAt(i,hidden);}k.adultShown=!!adult;});
    kidBodies.instanceMatrix.needsUpdate=true;kidHeads.instanceMatrix.needsUpdate=true;kidBodies.instanceColor.needsUpdate=true;adultBodies.instanceMatrix.needsUpdate=true;adultHeads.instanceMatrix.needsUpdate=true;}
  function update(dt){if(!(dt>0))return;now.minutes+=dt/60;if(now.minutes>=1440)now.minutes-=1440;draw();}
  // Nächste Abfuhr ab dem dargestellten Tag (für die Karte beim Anklicken)
  function nextCollection(){const base=Date.UTC(now.year,now.month-1,now.day);for(let k=0;k<40;k++){const d=new Date(base+k*86400000),parts={year:d.getUTCFullYear(),month:d.getUTCMonth()+1,day:d.getUTCDate(),weekday:(d.getUTCDay()+6)%7+1,dayOfYear:Math.floor((d-Date.UTC(d.getUTCFullYear(),0,1))/86400000)+1},what=collectionOn(data.waste,parts);
      if(what==='household')return {...parts,inDays:k,planned:parts.year===data.waste.year};}return null;}
  const stats={...stats0,places:places.length,kids:kids.length,runs:runs.length,pois:data.pois.length,tourMinutes:+(truckLine.duration/60).toFixed(1)};model.stats.community=stats;
  model.community={group,pins,data,update,setTime,nextCollection,truckRoute:()=>truckLegs.filter(l=>l.route).flatMap(l=>l.route.pts.map(p=>[p[0],p[1]])),truckStops:()=>order.map(p=>[p.x,p.z,p.arrival]),truckStart:TRUCK_START,busHalt:id=>{const r=runs.find(r=>r.out&&r.halt[id]);return r?{x:r.halt[id].x,z:r.halt[id].z,angle:r.halt[id].angle,leave:r.stopTimes[id][1]}:null;},truckAt:seconds=>truckLine.at(seconds),place:number=>places.find(p=>p.number===number)||null,stats,
    diagnostics:()=>({...stats,date:{...now,minutes:+now.minutes.toFixed(2)},collection:kind,truck:truck.visible?[+truck.position.x.toFixed(1),+truck.position.z.toFixed(1)]:null,binsOut:kind?places.filter(p=>now.minutes>=300&&now.minutes*60-TRUCK_START*60<p.arrival+11).length:0,
      bus:bus.visible?[+bus.position.x.toFixed(1),+bus.position.z.toFixed(1)]:null,kidsShown:kids.filter(k=>k.shown).length,parentsShown:kids.filter(k=>k.adultShown).length,stops:Object.fromEntries(Object.values(stops).map(s=>[s.id,net.nodes[s.node].p.map(v=>+v.toFixed(1))])),
      runs:runs.map(r=>({direction:r.direction,weekdays:r.weekdays,start:+(r.start/60).toFixed(2),end:+((r.start+r.line.duration)/60).toFixed(2),stopTimes:Object.fromEntries(Object.entries(r.stopTimes).map(([id,t])=>[id,t.map(v=>+(v/60).toFixed(2))]))})),order:order.map(p=>p.number)})};
  return model.community;
}
