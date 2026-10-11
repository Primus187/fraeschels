// Gemeindehaus (ehemaliges Schulhaus, Brünnenrain 15) nach einem Foto des Auftraggebers: Riegwerk im Obergeschoss, Uhrtürmchen mit
// vier Zifferblättern und Wetterfahne, vier Lukarnen, Balkon über dem Eingang, Rampe mit Geländer und Treppe an der Strassenseite sowie
// der Zugang zum Sportplatz. Die Gebäudeform bleibt die aus swissBUILDINGS3D; Balkenteilung, Masse und Farben sind angenähert.
import * as T from 'three';

export const TOWN_HALL_EGID=1534823;

export function buildTownHall(model){
  const mesh=model.buildingMeshes.find(o=>o.userData.egid===TOWN_HALL_EGID);if(!mesh||!mesh.visible){model.townHall=null;return null;}
  mesh.updateWorldMatrix(true,false);const source=mesh.geometry.index?mesh.geometry.toNonIndexed():mesh.geometry,p=source.getAttribute('position'),a=new T.Vector3(),b=new T.Vector3(),c=new T.Vector3(),n=new T.Vector3(),wall=[],tris=[];let eave=-Infinity,ridge=-Infinity,base=Infinity,roofLow=Infinity;const lowest=new T.Box3().setFromObject(mesh).min.y;
  for(let i=0;i<p.count;i+=3){a.fromBufferAttribute(p,i).applyMatrix4(mesh.matrixWorld);b.fromBufferAttribute(p,i+1).applyMatrix4(mesh.matrixWorld);c.fromBufferAttribute(p,i+2).applyMatrix4(mesh.matrixWorld);ridge=Math.max(ridge,a.y,b.y,c.y);n.crossVectors(b.clone().sub(a),c.clone().sub(a));if(n.length()<1e-6)continue;n.normalize();if(Math.abs(n.y)>.3)roofLow=Math.min(roofLow,...[a.y,b.y,c.y].filter(y=>y>lowest+2.5));if(Math.abs(n.y)>.15)continue;tris.push([a.clone(),b.clone(),c.clone()]);base=Math.min(base,a.y,b.y,c.y);}
  // Wände reichen bis zum Boden; senkrechte Flächen nur am Dachrand (Traufbretter) zählen nicht
  for(const t of tris){if(Math.min(t[0].y,t[1].y,t[2].y)>base+1.5)continue;for(const v of t){wall.push([v.x,v.z]);eave=Math.max(eave,v.y);}}
  if(Number.isFinite(roofLow))eave=Math.min(eave,roofLow+.12); // sichtbare Wand endet an der Dachkante
  if(source!==mesh.geometry)source.dispose();if(wall.length<6){model.townHall=null;return null;}
  // kleinstes umschliessendes Rechteck der Wände
  let best=null;for(let deg=0;deg<90;deg+=.5){const t=deg*Math.PI/180,u=[Math.cos(t),Math.sin(t)],v=[-u[1],u[0]];let u0=Infinity,u1=-Infinity,v0=Infinity,v1=-Infinity;for(const q of wall){const pu=q[0]*u[0]+q[1]*u[1],pv=q[0]*v[0]+q[1]*v[1];u0=Math.min(u0,pu);u1=Math.max(u1,pu);v0=Math.min(v0,pv);v1=Math.max(v1,pv);}const area=(u1-u0)*(v1-v0);if(!best||area<best.area)best={area,u,v,u0,u1,v0,v1};}
  const {u,v}=best,cu=(best.u0+best.u1)/2,cv=(best.v0+best.v1)/2,hu=(best.u1-best.u0)/2,hv=(best.v1-best.v0)/2,centre=[u[0]*cu+v[0]*cv,u[1]*cu+v[1]*cv],ground=model.height(centre[0],centre[1]);
  const position=[],normal=[],colour=[],add=(g,hex)=>{const col=new T.Color(hex),k=g.index?g.toNonIndexed():g;position.push(...k.getAttribute('position').array);normal.push(...k.getAttribute('normal').array);for(let i=0;i<k.getAttribute('position').count;i++)colour.push(col.r,col.g,col.b);g.dispose();if(k!==g)k.dispose();};
  const RED='#8e2f2a',stats={posts:0,rails:0,clocks:0};
  // ---- Riegwerk im Obergeschoss: Schwelle, Brustriegel, Rähm und Pfosten auf allen vier Seiten
  const top=eave-.12,sill=Math.max(ground+3.2,eave-3.05),rail=sill+.85;
  for(const [axis,other,half,length] of [[u,v,hu,hv],[[-u[0],-u[1]],v,hu,hv],[v,u,hv,hu],[[-v[0],-v[1]],u,hv,hu]]){const angle=Math.atan2(-other[1],other[0]),at=(s,y,out=.07)=>[centre[0]+axis[0]*(half+out)+other[0]*s,y,centre[1]+axis[1]*(half+out)+other[1]*s];
    for(const y of [sill,rail,top]){const g=new T.BoxGeometry(length*2+.16,y===rail?.13:.2,.1);g.rotateY(angle);g.translate(...at(0,y));add(g,RED);stats.rails++;}
    const bays=Math.max(1,Math.floor(length*2/3.5)),posts=new Set([-length,length]);for(let k=1;k<bays;k++)posts.add(-length+k*length*2/bays);
    for(const s of posts){const g=new T.BoxGeometry(.2,top-sill,.1);g.rotateY(angle);g.translate(...at(s,(top+sill)/2));add(g,RED);stats.posts++;}
    // kurze Pfosten in der Brüstung unter den Fenstern
    for(let k=0;k<bays;k++)for(const d of [-.42,.42]){const s=-length+(k+.5)*length*2/bays+d,g=new T.BoxGeometry(.13,rail-sill,.1);g.rotateY(angle);g.translate(...at(s,(rail+sill)/2));add(g,RED);stats.posts++;}}
  // ---- Uhrtürmchen auf dem First
  const ty=ridge-.35,size=1.5,body=2.3;{const g=new T.BoxGeometry(size,body,size);g.rotateY(Math.atan2(-u[1],u[0]));g.translate(centre[0],ty+body/2,centre[1]);add(g,'#6d3b2d');
    const eaves=new T.BoxGeometry(size+.5,.12,size+.5);eaves.rotateY(Math.atan2(-u[1],u[0]));eaves.translate(centre[0],ty+body+.06,centre[1]);add(eaves,'#5a3024');
    const roof=new T.ConeGeometry((size+.5)*.72,2.3,4);roof.rotateY(Math.PI/4+Math.atan2(-u[1],u[0]));roof.translate(centre[0],ty+body+1.27,centre[1]);add(roof,'#70402f');
    const pole=new T.CylinderGeometry(.03,.03,1.5,6);pole.translate(centre[0],ty+body+3,centre[1]);add(pole,'#3c3f42');const ball=new T.SphereGeometry(.11,8,6);ball.translate(centre[0],ty+body+2.55,centre[1]);add(ball,'#c9a548');
    const vane=new T.BoxGeometry(.5,.2,.03);vane.translate(centre[0]+.25,ty+body+3.55,centre[1]);add(vane,'#3c3f42');
    for(const axis of [u,[-u[0],-u[1]],v,[-v[0],-v[1]]]){const turn=Math.atan2(axis[0],axis[1]),place=(g,out,dy=0)=>{g.rotateY(turn);g.translate(centre[0]+axis[0]*(size/2+out),ty+body*.62+dy,centre[1]+axis[1]*(size/2+out));};
      const face=new T.CylinderGeometry(.52,.52,.04,20);face.rotateX(Math.PI/2);place(face,.02);add(face,'#f3f1ea');const ring=new T.TorusGeometry(.52,.035,6,20);place(ring,.05);add(ring,'#2f4f8a');
      const hour=new T.BoxGeometry(.05,.28,.02);hour.translate(0,.14,0);hour.rotateZ(-1.05);place(hour,.06);add(hour,'#1d1f22');const minute=new T.BoxGeometry(.035,.42,.02);minute.translate(0,.21,0);minute.rotateZ(.5);place(minute,.07);add(minute,'#1d1f22');stats.clocks++;}}
  // ---- Nach Foto und Luftbild des Auftraggebers: Lukarnen, Balkon über dem Eingang, Rampe mit Geländer und Treppe an der Strassenseite,
  // Zugang zum Sportplatz. Lage der Lukarnen, der Rampe und der Treppe aus SWISSIMAGE (10 cm); Masse und Höhen sind geschätzt.
  {const rc=new T.Raycaster(),down=new T.Vector3(0,-1,0),roof=(x,z)=>{rc.set(new T.Vector3(x,ridge+20,z),down);const h=rc.intersectObject(mesh,false)[0];if(!h)return null;const n=h.face.normal.clone().transformDirection(mesh.matrixWorld);if(n.y<0)n.negate();return {y:h.point.y,n};};
    const bx=(w,h,d,x,y,z,angle,hex)=>{const g=new T.BoxGeometry(w,h,d);g.rotateY(angle);g.translate(x,y,z);add(g,hex);};stats.dormers=0;
    for(const [x,z] of [[1.5,-2],[5.5,2],[-4.5,3.5],[-1,8]]){const r=roof(x,z);if(!r||r.n.y>.985||r.n.y<.4)continue;const l=Math.hypot(r.n.x,r.n.z),d=[r.n.x/l,r.n.z/l],angle=Math.atan2(d[0],d[1]),drop=1.2*l/r.n.y,front=Math.min(1.7,.75+drop);
      bx(2.4,front+.6,2.4,x,r.y+.75-(front+.6)/2,z,angle,'#b9b5ab');bx(2.75,.1,2.8,x+d[0]*.1,r.y+.8,z+d[1]*.1,angle,'#6e5a4c');
      const fx=x+d[0]*1.21,fz=z+d[1]*1.21,wy=r.y+.75-front*.5+.05;bx(1.7,Math.min(1,front*.62)+.14,.05,fx,wy,fz,angle,'#f1efe8');bx(1.5,Math.min(1,front*.62),.06,fx+d[0]*.01,wy,fz+d[1]*.01,angle,'#2b3440');bx(.05,Math.min(1,front*.62),.07,fx+d[0]*.02,wy,fz+d[1]*.02,angle,'#f1efe8');stats.dormers++;}
    // Strassenseite: die Längsfassade, die nach Nordosten zur Strasse schaut; s läuft vom nördlichen zum östlichen Ende
    const sides=[[u,v,hu,hv],[[-u[0],-u[1]],v,hu,hv],[v,u,hv,hu],[[-v[0],-v[1]],u,hv,hu]].map(([axis,other,half,length])=>({axis,other,half,length,score:axis[0]*.73-axis[1]*.68})).sort((a,b)=>b.score-a.score);let {axis,other,half,length}=sides[0];if(other[0]*.68+other[1]*.73<0)other=[-other[0],-other[1]];
    const P=(sv,out)=>[centre[0]+axis[0]*(half+out)+other[0]*sv,centre[1]+axis[1]*(half+out)+other[1]*sv],turn=Math.atan2(axis[0],axis[1]),H=(sv,out)=>model.height(...P(sv,out));
    // Balkon über dem Eingang am östlichen Ende: Platte, weisse Brüstung, Blumenkästen, zwei Konsolen
    {const s0=length-4.4,s1=length-.7,mid=(s0+s1)/2,w=s1-s0,by=sill-.12,[x,z]=P(mid,.6);bx(w,.14,1.2,x,by,z,turn,'#d9d6cc');const [fx,fz]=P(mid,1.17);bx(w,.95,.06,fx,by+.54,fz,turn,'#f4f2ec');for(const e of [s0+.03,s1-.03]){const [ex,ez]=P(e,.6);bx(.06,.95,1.2,ex,by+.54,ez,turn,'#f4f2ec');}
      const [px,pz]=P(mid,1.28);bx(w-.3,.2,.2,px,by+.98,pz,turn,'#6b4a33');bx(w-.4,.2,.22,px,by+1.14,pz,turn,'#c9343f');for(const e of [s0+.5,s1-.5]){const [kx,kz]=P(e,.5);bx(.12,.5,1,kx,by-.3,kz,turn,'#8e2f2a');}
      const [dx,dz]=P(mid,.06);bx(1.3,2.1,.08,dx,Math.max(H(mid,0),ground)+1.2,dz,turn,'#5b3a2a');stats.balcony=1;}
    // Rampe und Podest: vom nördlichen Ende steigt die Rampe an, ab der Mitte liegt das Podest auf Höhe des Eingangs; Treppe zur Strasse
    {const W=2.1,sA=-length+.6,sFlat=-length*.15,sB=length+.2,stairs=[1.4,3.6],floor=Math.max(...[...Array(9)].map((_,k)=>H(sA+(sB-sA)*k/8,0)))+.1,level=Math.max(floor,H((stairs[0]+stairs[1])/2,W+2.4)+.85),topAt=sv=>sv>=sFlat?level:H(sA,W/2)+.05+(level-H(sA,W/2)-.05)*(sv-sA)/(sFlat-sA);
      const n=Math.ceil((sB-sA)/.3),piece=(sB-sA)/n;for(let k=0;k<n;k++){const sv=sA+(k+.5)*piece,[x,z]=P(sv,W/2),t=topAt(sv),low=Math.min(H(sv,0),H(sv,W))-.4;bx(piece+.02,t-low,W,x,(t+low)/2,z,turn,'#c9c5ba');}
      // Geländer an der Aussenkante, an der Treppe unterbrochen
      const posts=Math.ceil((sB-sA)/1.4);for(let k=0;k<=posts;k++){const sv=sA+(sB-sA)*k/posts;if(sv>stairs[0]-.1&&sv<stairs[1]+.1)continue;const [x,z]=P(sv,W-.06);bx(.06,1,.06,x,topAt(sv)+.5,z,turn,'#55595d');}
      for(const [a,b] of [[sA,stairs[0]],[stairs[1],sB]]){const m=Math.ceil((b-a)/.8);for(let k=0;k<m;k++){const sv=a+(k+.5)*(b-a)/m,[x,z]=P(sv,W-.06),t0=topAt(sv-(b-a)/m/2),t1=topAt(sv+(b-a)/m/2),tilt=Math.atan2(t1-t0,(b-a)/m);for(const h of [.52,.98]){const g=new T.BoxGeometry((b-a)/m+.03,.045,.045);g.rotateZ(tilt*(axis[1]*other[0]-axis[0]*other[1]>=0?1:-1));g.rotateY(turn);g.translate(x,(t0+t1)/2+h,z);add(g,'#55595d');}}}
      {const [ex,ez]=P(sB,W/2);bx(.06,1,W,ex,level+.5,ez,turn,'#55595d');}
      const mid=(stairs[0]+stairs[1])/2,foot=H(mid,W+2.4),count=Math.max(3,Math.round((level-foot)/.17)),run=2.4/count;for(let k=0;k<count;k++){const out=W+(k+.5)*run,[x,z]=P(mid,out),t=level-(k+1)*(level-foot)/(count+0),low=Math.min(H(mid,out),t)-.35;bx(stairs[1]-stairs[0],Math.max(.2,t-low),run+.02,x,(t+low)/2,z,turn,k%2?'#bdb9ae':'#c9c5ba');}
      for(const e of stairs){for(const out of [W,W+2.4]){const [x,z]=P(e,out),t=out===W?level:foot;bx(.06,1,.06,x,t+.5,z,turn,'#55595d');}}
      stats.ramp={level:+(level-ground).toFixed(2),steps:count,length:+(sB-sA).toFixed(1)};}
    // Zugang zum Sportplatz: Plattenweg von der Südecke des Gemeindehauses zur Ecke des roten Platzes
    {const a=[1.2,15.6],b=[-3.9,21.6],len=Math.hypot(b[0]-a[0],b[1]-a[1]),angle=Math.atan2(b[0]-a[0],b[1]-a[1]),m=Math.round(len/.9);for(let k=0;k<m;k++){const t=(k+.5)/m,x=a[0]+(b[0]-a[0])*t,z=a[1]+(b[1]-a[1])*t;bx(1.8,.3,len/m-.07,x,model.height(x,z)+.04,z,angle,k%2?'#b9b4a8':'#c2bdb1');}
      for(const side of [-1,1]){const x=b[0]+Math.cos(angle)*side*1.05,z=b[1]-Math.sin(angle)*side*1.05;bx(.1,2.2,.1,x,model.height(x,z)+1.1,z,angle,'#55595d');}
      {const x=b[0]+Math.cos(angle)*1.5,z=b[1]-Math.sin(angle)*1.5,y=model.height(x,z);bx(.08,1.5,.08,x,y+.75,z,angle,'#55595d');bx(.7,.35,.04,x,y+1.45,z,angle,'#2f6fb0');}
      stats.sportAccess={from:a,to:b,metres:+len.toFixed(1)};}}
  const geometry=new T.BufferGeometry();geometry.setAttribute('position',new T.Float32BufferAttribute(position,3));geometry.setAttribute('normal',new T.Float32BufferAttribute(normal,3));geometry.setAttribute('color',new T.Float32BufferAttribute(colour,3));
  const detail=new T.Mesh(geometry,new T.MeshStandardMaterial({vertexColors:true,roughness:.85}));detail.name='Gemeindehaus_Riegwerk_Uhrtuermchen';detail.castShadow=true;detail.receiveShadow=true;
  detail.userData={source:'Foto des Auftraggebers',accuracy:'Timber framing, clock turret and colours approximated from one photograph; building volume from swissBUILDINGS3D.'};model.groups.details.add(detail);
  model.townHall={mesh:detail,stats,centre,size:[hu*2,hv*2],eave:eave-ground,turretTop:ty+body+3.75-ground};model.stats.townHall=stats;return model.townHall;
}

// ---- Ofenhaus (Hauptstrasse 51a) nach zwei Fotos des Auftraggebers: an der Fassade zur Hauptstrasse links der Giebelteil mit Bogentür,
// zwei Fenstern mit Steingewänden und Blumen sowie der Luke im Giebel, rechts zwei Holztore mit schrägen Latten und das Schriftband.
// Dazu Ziegeldach, Kamin, Südwand, gepflästerter Vorplatz mit Pollern und Lattenzaun (zweites Foto und Luftbild).
// Die Gebäudeform bleibt die aus swissBUILDINGS3D; Masse und Aufteilung sind aus dem Foto geschätzt.
export const OFENHAUS_EGID=502021788;
function wallFrame(mesh){
  mesh.updateWorldMatrix(true,false);const source=mesh.geometry.index?mesh.geometry.toNonIndexed():mesh.geometry,p=source.getAttribute('position'),a=new T.Vector3(),b=new T.Vector3(),c=new T.Vector3(),n=new T.Vector3(),tris=[],wall=[];let base=Infinity,eave=-Infinity,roofLow=Infinity;const lowest=new T.Box3().setFromObject(mesh).min.y;
  for(let i=0;i<p.count;i+=3){a.fromBufferAttribute(p,i).applyMatrix4(mesh.matrixWorld);b.fromBufferAttribute(p,i+1).applyMatrix4(mesh.matrixWorld);c.fromBufferAttribute(p,i+2).applyMatrix4(mesh.matrixWorld);n.crossVectors(b.clone().sub(a),c.clone().sub(a));if(n.length()<1e-6)continue;n.normalize();
    if(Math.abs(n.y)>.3)roofLow=Math.min(roofLow,...[a.y,b.y,c.y].filter(y=>y>lowest+2));if(Math.abs(n.y)>.15)continue;tris.push([a.clone(),b.clone(),c.clone()]);base=Math.min(base,a.y,b.y,c.y);}
  for(const t of tris){if(Math.min(t[0].y,t[1].y,t[2].y)>base+1.5)continue;for(const v of t){wall.push([v.x,v.z]);eave=Math.max(eave,v.y);}}
  if(source!==mesh.geometry)source.dispose();if(wall.length<6)return null;if(Number.isFinite(roofLow))eave=Math.min(eave,roofLow+.12);
  let best=null;for(let deg=0;deg<90;deg+=.5){const t=deg*Math.PI/180,u=[Math.cos(t),Math.sin(t)],v=[-u[1],u[0]];let u0=Infinity,u1=-Infinity,v0=Infinity,v1=-Infinity;for(const q of wall){const pu=q[0]*u[0]+q[1]*u[1],pv=q[0]*v[0]+q[1]*v[1];u0=Math.min(u0,pu);u1=Math.max(u1,pu);v0=Math.min(v0,pv);v1=Math.max(v1,pv);}const area=(u1-u0)*(v1-v0);if(!best||area<best.area)best={area,u,v,u0,u1,v0,v1};}
  const {u,v}=best,cu=(best.u0+best.u1)/2,cv=(best.v0+best.v1)/2;return {u,v,hu:(best.u1-best.u0)/2,hv:(best.v1-best.v0)/2,centre:[u[0]*cu+v[0]*cv,u[1]*cu+v[1]*cv],eave};
}
export function buildOfenhaus(model){
  const mesh=model.buildingMeshes.find(o=>o.userData.egid===OFENHAUS_EGID),frame=mesh&&mesh.visible?wallFrame(mesh):null;if(!frame){model.ofenhaus=null;return null;}
  const {u,v,hu,hv,centre}=frame,main=model.roadSegments.filter(s=>s.type==='secondary'),toMain=q=>Math.min(...main.map(s=>{const dx=s.b[0]-s.a[0],dz=s.b[1]-s.a[1],t=Math.max(0,Math.min(1,((q[0]-s.a[0])*dx+(q[1]-s.a[1])*dz)/(dx*dx+dz*dz||1)));return Math.hypot(q[0]-s.a[0]-t*dx,q[1]-s.a[1]-t*dz);}));
  // Fassade zur Hauptstrasse; «links» ist vom Trottoir aus gesehen das südliche Ende
  const sides=[[u,v,hu,hv],[[-u[0],-u[1]],v,hu,hv],[v,u,hv,hu],[[-v[0],-v[1]],u,hv,hu]].map(([axis,other,half,length])=>({axis,other,half,length,d:toMain([centre[0]+axis[0]*half,centre[1]+axis[1]*half])})).sort((p,q)=>p.d-q.d),side=sides[0];let {axis,other,half,length}=side;if(other[1]<0)other=[-other[0],-other[1]];
  const L=length*2,ground=model.height(centre[0]+axis[0]*(half+.4),centre[1]+axis[1]*(half+.4)),turn=Math.atan2(axis[0],axis[1]),at=(s,y,out)=>[centre[0]+axis[0]*(half+out)+other[0]*(length-s),ground+y,centre[1]+axis[1]*(half+out)+other[1]*(length-s)];
  const position=[],normal=[],colour=[],add=(g,hex)=>{const col=new T.Color(hex),k=g.index?g.toNonIndexed():g;position.push(...k.getAttribute('position').array);normal.push(...k.getAttribute('normal').array);for(let i=0;i<k.getAttribute('position').count;i++)colour.push(col.r,col.g,col.b);g.dispose();if(k!==g)k.dispose();};
  // Teil auf der Fassade: Breite entlang der Wand, Höhe, Tiefe; s = Abstand vom linken (südlichen) Ende
  const part=(w,h,d,s,y,out,hex,roll=0)=>{const g=new T.BoxGeometry(w,h,d);if(roll)g.rotateZ(roll);g.rotateY(turn);g.translate(...at(s,y,out));add(g,hex);};
  const STONE='#b9aa8d',WOOD='#8a5b38',DARK='#6a4329',stats={windows:0,doors:0,gates:0,slats:0};
  const gable=Math.min(5.8,L*.42),k=gable/5.6;
  for(const s of [1.25*k,4.4*k]){part(1.25,1.35,.08,s,1.4,.05,STONE);part(.8,.9,.06,s,1.45,.1,'#2b3440');part(.05,.9,.07,s,1.45,.12,'#e9e6dd');part(.8,.05,.07,s,1.45,.12,'#e9e6dd');part(1.3,.1,.22,s,.74,.12,STONE);part(1,.22,.22,s,.9,.2,'#6b4a33');part(.95,.2,.24,s,1.08,.2,'#c9343f');stats.windows++;}
  part(1.75,2.5,.08,2.85*k,1.25,.05,STONE);part(1.15,2.05,.07,2.85*k,1.03,.1,WOOD);{const arch=new T.CylinderGeometry(.575,.575,.07,16,1,false,0,Math.PI);arch.rotateX(Math.PI/2);arch.rotateZ(Math.PI/2);arch.rotateY(turn);arch.translate(...at(2.85*k,2.05,.1));add(arch,WOOD);}part(.04,2,.08,2.85*k,1.03,.12,DARK);part(1.9,.14,.5,2.85*k,.07,.3,STONE);stats.doors++;
  // Luke im Giebel mit Steingewände
  part(1.3,1.7,.08,2.85*k,3.35,.05,STONE);part(1,1.45,.07,2.85*k,3.38,.1,WOOD);part(.04,1.45,.08,2.85*k,3.38,.12,DARK);for(const y of [3.05,3.75])part(1,.07,.09,2.85*k,y,.12,DARK);stats.doors++;
  // zwei Holztore mit schrägen Latten, darüber das Schriftband
  const rest=L-gable,gw=Math.min(2.9,rest*.36),gh=2.2;for(const f of [.28,.75]){const s=gable+rest*f;part(gw,gh,.07,s,gh/2+.05,.08,WOOD);part(gw+.24,.14,.1,s,gh+.14,.08,DARK);for(const e of [-1,1])part(.12,gh,.1,s+e*(gw/2+.06),gh/2+.05,.08,DARK);part(.05,gh,.09,s,gh/2+.05,.12,DARK);
    for(const leaf of [-1,1])for(let n=0;n<5;n++){part(.09,gw*.62,.09,s+leaf*gw/4,.3+n*.4,.12,DARK,leaf*(n%2?1:-1)*.95);stats.slats++;}stats.gates++;}
  part(rest*.9,.16,.05,gable+rest*.5,gh+.34,.06,'#d9d3c3');part(rest*.84,.05,.06,gable+rest*.5,gh+.34,.08,'#4a4037');
  // ---- Rundherum, nach dem zweiten Foto (Blick von Süden) und dem Luftbild: Ziegeldach, Kamin, schlichte Südwand mit Sockel und Tafel,
  // gepflästerter Vorplatz mit drei Steinpollern, Strassenschild, Lattenzaun am Nordende. West- und Nordseite sind auf keinem Bild zu sehen.
  part(.9,.16,.03,2.85*k,2.42,.13,'#2f7d4f');
  {const col=mesh.geometry.getAttribute('color'),nor=mesh.geometry.getAttribute('normal'),tile=new T.Color('#8f4a38'),c=new T.Color();let recoloured=0;if(col&&nor){for(let i=0;i<col.count;i++)if(nor.getY(i)>.3){const v=.86+.24*((Math.sin(i*12.9898)*43758.5453)%1+1)%1;c.copy(tile).multiplyScalar(v);col.setXYZ(i,c.r,c.g,c.b);recoloured++;}col.needsUpdate=true;}stats.roofVertices=recoloured;}
  const rc=new T.Raycaster(),roofY=(x,z)=>{rc.set(new T.Vector3(x,ground+40,z),new T.Vector3(0,-1,0));const h=rc.intersectObject(mesh,false)[0];return h?h.point.y:null;};
  {const x=centre[0]-axis[0]*half*.3+other[0]*length*.45,z=centre[1]-axis[1]*half*.3+other[1]*length*.45,y=roofY(x,z);if(y!=null){const g=new T.BoxGeometry(.75,1.7,.75);g.rotateY(turn);g.translate(x,y+.45,z);add(g,'#2f2f31');const cap=new T.BoxGeometry(.95,.1,.95);cap.rotateY(turn);cap.translate(x,y+1.36,z);add(cap,'#1f1f21');const hood=new T.BoxGeometry(.5,.3,.5);hood.rotateY(turn);hood.translate(x,y+1.55,z);add(hood,'#6b3a2c');stats.chimney=1;}}
  // Südwand: Sockelband und Tafel; am Sockel der Strassenfront ebenfalls ein Band
  {const turnS=Math.atan2(other[0],other[1]),W2=half*2,atS=(t,y,out)=>[centre[0]+other[0]*(length+out)+axis[0]*(half-t),model.height(centre[0]+other[0]*(length+.4),centre[1]+other[1]*(length+.4))+y,centre[1]+other[1]*(length+out)+axis[1]*(half-t)];
    const band=new T.BoxGeometry(W2,.4,.06);band.rotateY(turnS);band.translate(...atS(W2/2,.2,.04));add(band,'#b9b3a6');const plaque=new T.BoxGeometry(.55,.5,.06);plaque.rotateY(turnS);plaque.translate(...atS(W2*.32,1.15,.05));add(plaque,'#8d8a84');
    part(L,.4,.05,L/2,.2,.03,'#b9b3a6');
    // die allgemeinen Fenster und Läden der Südwand entfallen: die Wand ist auf dem Foto schlicht
    const m4=new T.Matrix4(),q=new T.Vector3(),gone=new T.Matrix4().compose(new T.Vector3(0,-400,0),new T.Quaternion(),new T.Vector3(1e-4,1e-4,1e-4));let removed=0;for(const g of [model.groups.details,model.groups.buildings,model.groups.quality])g?.traverse(o=>{if(!o.isInstancedMesh)return;let changed=false;for(let i=0;i<o.count;i++){o.getMatrixAt(i,m4);q.setFromMatrixPosition(m4);const dx=q.x-centre[0],dz=q.z-centre[1],da=dx*other[0]+dz*other[1],db=dx*axis[0]+dz*axis[1];if(Math.abs(da-length)<.7&&Math.abs(db)<half+.6&&q.y>ground-1&&q.y<ground+12){o.setMatrixAt(i,gone);changed=true;removed++;}}if(changed)o.instanceMatrix.needsUpdate=true;});stats.removedSouth=removed;}
  // Vorplatz: Pflästerung zwischen Fassade und Strasse, drei Steinpoller am Strassenrand
  {const depth=Math.max(1.4,Math.min(4.5,side.d-3.5)),cell=.9,nu=Math.ceil((L+2)/cell),nv=Math.ceil(depth/cell);for(let i=0;i<nu;i++)for(let j=0;j<nv;j++){const sv=-1+(i+.5)*(L+2)/nu,out=.12+(j+.5)*depth/nv,[x,,z]=at(sv,0,out),g=new T.BoxGeometry((L+2)/nu+.02,.3,depth/nv+.02);g.rotateY(turn);g.translate(x,model.height(x,z)+.045,z);add(g,(i+j)%2?'#a59b8e':'#9b9185');}
    for(const f of [.16,.5,.84]){const [x,,z]=at(L*f,0,depth-.35),g=new T.CylinderGeometry(.15,.3,.95,10);g.translate(x,model.height(x,z)+.5,z);add(g,'#a8a49b');const cap=new T.SphereGeometry(.15,10,6);cap.translate(x,model.height(x,z)+.97,z);add(cap,'#a8a49b');}stats.bollards=3;stats.forecourt=+depth.toFixed(1);}
  // weisser Lattenzaun am Nordende
  {const n=22;for(let k=0;k<n;k++){const [x,,z]=at(L+.3+k*.22,0,.5),g=new T.BoxGeometry(.1,.85,.04);g.rotateY(turn);g.translate(x,model.height(x,z)+.45,z);add(g,'#f2f2ee');}for(const y of [.25,.65]){const [x,,z]=at(L+.3+n*.11,0,.47),g=new T.BoxGeometry(n*.22,.06,.04);g.rotateY(turn);g.translate(x,model.height(x,z)+y,z);add(g,'#f2f2ee');}stats.picketFence=1;}
  const geometry=new T.BufferGeometry();geometry.setAttribute('position',new T.Float32BufferAttribute(position,3));geometry.setAttribute('normal',new T.Float32BufferAttribute(normal,3));geometry.setAttribute('color',new T.Float32BufferAttribute(colour,3));
  const detail=new T.Mesh(geometry,new T.MeshStandardMaterial({vertexColors:true,roughness:.9}));detail.name='Ofenhaus_Tore_Fenster';detail.castShadow=true;detail.receiveShadow=true;detail.userData={source:'Fotos des Auftraggebers',accuracy:'Doors, gates and windows on the street front approximated from two photographs; building volume from swissBUILDINGS3D.'};model.groups.details.add(detail);
  // die allgemeinen Fenster, Läden und Simse an dieser Fassade entfallen
  {const m4=new T.Matrix4(),q=new T.Vector3(),gone=new T.Matrix4().compose(new T.Vector3(0,-400,0),new T.Quaternion(),new T.Vector3(1e-4,1e-4,1e-4));let removed=0;for(const g of [model.groups.details,model.groups.buildings,model.groups.quality])g?.traverse(o=>{if(!o.isInstancedMesh)return;let changed=false;for(let i=0;i<o.count;i++){o.getMatrixAt(i,m4);q.setFromMatrixPosition(m4);const dx=q.x-centre[0],dz=q.z-centre[1],da=dx*axis[0]+dz*axis[1],db=dx*other[0]+dz*other[1];if(Math.abs(da-half)<.7&&Math.abs(db)<length+.6&&q.y>ground-1&&q.y<ground+12){o.setMatrixAt(i,gone);changed=true;removed++;}}if(changed)o.instanceMatrix.needsUpdate=true;});stats.removedParts=removed;}
  model.ofenhaus={mesh:detail,stats,facade:{length:L,toMainRoad:side.d}};model.stats.ofenhaus=stats;return model.ofenhaus;
}
