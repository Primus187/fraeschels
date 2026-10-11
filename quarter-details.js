// Details aus dem Luftbild für alle bebauten Teile der Gemeinde: Hecken, Zäune, Mauern, Treppen, Gartenwege, Sträucher, Pools, Teiche,
// Trampoline, Kleinbauten, Sitzplätze, Gemüse- und Zierbeete, Solaranlagen auf Dächern, Siloballen, Baumschulreihen und Carports.
// Die Angaben in data/quarter-details.json sind von Hand aus SWISSIMAGE abgelesen (Lage rund 1 m genau); Höhen, Breiten und Formen
// sind geschätzt. Erfasst: die Schmiedstrasse (20 Bildausschnitte), alle übrigen bebauten Teile der Gemeinde (63 Ausschnitte) und ein
// zweiter, genauerer Durchgang über das ganze Dorf (59 Ausschnitte von 60 × 52 m), in dem der Stand eingezeichnet und berichtigt wurde.
//
// Vorrang: Was die amtliche Vermessung oder das Gebäudemodell schon enthält, gilt. Ein aus dem Luftbild abgelesener Kleinbau, Pool,
// Teich oder ein Beet wird nur gesetzt, wenn an seiner Stelle noch nichts steht – kein amtliches Gebäude, kein Unterstand, kein
// Wasserbecken, kein Gebäude des 3D-Modells, kein Pool, kein Tank – und wenn es kein anderes Luftbild-Element überschneidet.
// Liegt es mehrheitlich auf etwas Vorhandenem, entfällt es als Doppel; berührt es nur den Rand, rückt es bis 2 m zur Seite oder entfällt.
import * as T from 'three';

const pointIn=(p,ring)=>{let yes=false;for(let i=0,j=ring.length-1;i<ring.length;j=i++){const a=ring[i],b=ring[j];if((a[1]>p[1])!==(b[1]>p[1])&&p[0]<(b[0]-a[0])*(p[1]-a[1])/(b[1]-a[1])+a[0])yes=!yes;}return yes;};
const hash=n=>{const s=Math.sin(n*127.1+311.7)*43758.5453;return s-Math.floor(s);};
const boxOf=ring=>{let minX=Infinity,maxX=-Infinity,minZ=Infinity,maxZ=-Infinity;for(const p of ring){minX=Math.min(minX,p[0]);maxX=Math.max(maxX,p[0]);minZ=Math.min(minZ,p[1]);maxZ=Math.max(maxZ,p[1]);}return {minX,maxX,minZ,maxZ};};
const OFFICIAL_SURFACES=['Gebaeude','Wasserbecken'],OFFICIAL_OBJECTS=['Unterstand','Reservoir','Silo_Turm_Gasometer','massiver_Sockel','Bahnsteig'];
const FLAT=/Fahrsilo|Palettenlager|Anhänger|Mulde|Hochbeet|Stapel|stapel|lager|Platte|platte|Trog|trog|Becken|Raufe|Kompost|Terrasse|Wohn|Zelt|Sitzplatz|Bienen|Feuerstelle|Container|Güllefass|Brunnen|Bank|Frühbeet|Harassen|Fass|Landmaschine|Leitern|Schacht|Kellerabgang|Spielturm|Sandkasten|Schaukel|Gartentisch/;
// offene Dächer: Pfosten und eine dünne Decke statt eines geschlossenen Körpers
const CANOPY=/Sonnensegel|Sonnenstore|Pergola|Glasdach/,PARASOL=/Sonnenschirm/;
const PATIO={platten:'#b3afa4',kies:'#bfb394',asphalt:'#8f8d86',pflaster:'#a7a096'};

export async function buildQuarterDetails(model){
  const load=file=>fetch(file).then(r=>r.ok?r.json():null).catch(()=>null),[data,av,world]=await Promise.all([load('data/quarter-details.json'),load('data/cadastre.json'),load('data/world-details.json')]);
  if(!data||!av||!model.cadastre){model.quarter=null;return null;}
  const height=model.height,roads=[...(model.cadastre.polygons.road||[]),...(model.cadastre.polygons.rail||[])],onRoad=(x,z)=>roads.some(s=>x>=s.box.minX&&x<=s.box.maxX&&z>=s.box.minZ&&z<=s.box.maxZ&&pointIn([x,z],s.rings[0])&&!s.rings.slice(1).some(h=>pointIn([x,z],h)));
  const group=new T.Group();group.name='Quartierdetails';group.userData={source:data.source,accuracy:data.accuracy};model.groups.world.add(group);
  const stats={hedgeMetres:0,fenceMetres:0,wallMetres:0,stairs:0,steps:0,shrubs:0,pools:0,trampolines:0,carports:0,pathMetres:0,skipped:0,duplicates:0,noRoom:0,moved:0};
  const batch=()=>({position:[],normal:[],colour:[]}),add=(b,g,hex,shade=1)=>{const c=new T.Color(hex).multiplyScalar(shade),n=g.index?g.toNonIndexed():g;b.position.push(...n.getAttribute('position').array);b.normal.push(...n.getAttribute('normal').array);for(let i=0;i<n.getAttribute('position').count;i++)b.colour.push(c.r,c.g,c.b);g.dispose();if(n!==g)n.dispose();};
  const finish=(b,name,options={})=>{if(!b.position.length)return null;const g=new T.BufferGeometry();g.setAttribute('position',new T.Float32BufferAttribute(b.position,3));g.setAttribute('normal',new T.Float32BufferAttribute(b.normal,3));g.setAttribute('color',new T.Float32BufferAttribute(b.colour,3));const m=new T.Mesh(g,new T.MeshStandardMaterial({vertexColors:true,roughness:.95,flatShading:true,...options}));m.name=name;m.castShadow=true;m.receiveShadow=true;m.userData={source:data.source,accuracy:data.accuracy};group.add(m);return m;};
  const box=(w,h,d,x,y,z,angle)=>{const g=new T.BoxGeometry(w,h,d);g.rotateY(angle);g.translate(x,y,z);return g;};
  const things=batch();

  // ---- Carports: das Gebäude wird durch ein offenes Dach auf Pfosten ersetzt
  const bounds=new T.Box3();for(const c of data.carports){const mesh=model.buildingMeshes.find(o=>o.userData.egid===c.egid);if(!mesh)continue;bounds.setFromObject(mesh);const x0=bounds.min.x,x1=bounds.max.x,z0=bounds.min.z,z1=bounds.max.z,y=Math.min(height(x0,z0),height(x1,z0),height(x0,z1),height(x1,z1)),top=Math.max(height(x0,z0),height(x1,z0),height(x0,z1),height(x1,z1))+2.5;
    mesh.visible=false;mesh.userData.replacedBy='Quartier_Carport';
    // Fenster, Läden und Simse des ersetzten Gebäudes verschwinden mit (verkleinert und unter das Gelände gelegt, nicht auf null skaliert)
    {const m4=new T.Matrix4(),at=new T.Vector3(),gone=new T.Matrix4().compose(new T.Vector3(0,-400,0),new T.Quaternion(),new T.Vector3(1e-4,1e-4,1e-4));for(const g of [model.groups.details,model.groups.buildings,model.groups.quality])g?.traverse(o=>{if(!o.isInstancedMesh)return;let changed=false;for(let i=0;i<o.count;i++){o.getMatrixAt(i,m4);at.setFromMatrixPosition(m4);if(at.x>x0-.6&&at.x<x1+.6&&at.z>z0-.6&&at.z<z1+.6&&at.y>y-1){o.setMatrixAt(i,gone);changed=true;stats.removedParts=(stats.removedParts||0)+1;}}if(changed)o.instanceMatrix.needsUpdate=true;});}
    for(const x of [x0+.15,x1-.15])for(const z of [z0+.15,(z0+z1)/2,z1-.15])add(things,box(.14,top-y,.14,x,(top+y)/2,z,0),'#5b4a3a');
    add(things,box(x1-x0+.5,.16,z1-z0+.5,(x0+x1)/2,top+.08,(z0+z1)/2,0),'#7a4f3d');for(const z of [z0+.15,z1-.15])add(things,box(x1-x0,.18,.12,(x0+x1)/2,top-.09,z,0),'#5b4a3a');stats.carports++;c.box=[x0,z0,x1,z1].map(v=>+v.toFixed(1));}

  // ---- Was schon da ist: amtliche Vermessung, Gebäudemodell, Pools und Tanks des Modells
  const present=[],put=(ring,kind)=>{if(ring&&ring.length>=3)present.push({ring,box:boxOf(ring),kind});};
  for(const s of av.surfaces)if(OFFICIAL_SURFACES.includes(s.kind))put(s.rings[0],s.kind);
  for(const o of av.objects)if(OFFICIAL_OBJECTS.includes(o.kind))put(o.rings[0],o.kind);
  for(const part of av.buildingParts||[])put(part.rings[0],part.kind);
  for(const o of model.groups.pools?.children||[]){bounds.setFromObject(o);if(!bounds.isEmpty())put([[bounds.min.x,bounds.min.z],[bounds.max.x,bounds.min.z],[bounds.max.x,bounds.max.z],[bounds.min.x,bounds.max.z]],'Pool');}
  for(const t of world?.tanks||[]){const [x,z]=t.points[0],r=t.radius||3;put([...Array(14)].map((_,k)=>[x+Math.cos(k*Math.PI/7)*r,z+Math.sin(k*Math.PI/7)*r]),'Tank');}
  // früher von Hand eingezeichnete Gärten, Sitzplätze, Spiel- und Sportplatz
  for(const g of [...(world?.gardens||[]),...(world?.patios||[]),world?.playground,world?.sport])if(g?.points?.length>=3)put(g.points,'gezeichnet');
  const ray=new T.Raycaster(),down=new T.Vector3(0,-1,0),from=new T.Vector3(),solids=model.buildingMeshes.filter(o=>o.visible).map(o=>({o,b:new T.Box3().setFromObject(o),n:new T.Matrix3().getNormalMatrix(o.matrixWorld)}));
  // oberster Treffer am Gebäudemodell unter einem Punkt (Dach), mit Flächennormale
  const roofAt=(x,z)=>{let best=null;for(const s of solids){if(x<s.b.min.x||x>s.b.max.x||z<s.b.min.z||z>s.b.max.z)continue;ray.set(from.set(x,s.b.max.y+5,z),down);const hit=ray.intersectObject(s.o,false)[0];if(hit&&(!best||hit.point.y>best.y)){const n=hit.face.normal.clone().applyMatrix3(s.n).normalize();if(n.y<0)n.negate();best={y:hit.point.y,n};}}return best;};
  const inPresentSolid=(x,z)=>present.some(q=>q.kind!=='gezeichnet'&&x>=q.box.minX&&x<=q.box.maxX&&z>=q.box.minZ&&z<=q.box.maxZ&&pointIn([x,z],q.ring))||!!roofAt(x,z);
  const inPresent=(x,z)=>present.some(q=>x>=q.box.minX&&x<=q.box.maxX&&z>=q.box.minZ&&z<=q.box.maxZ&&pointIn([x,z],q.ring))||!!roofAt(x,z);
  const own=[],inOwn=(x,z)=>own.some(q=>x>=q.box.minX&&x<=q.box.maxX&&z>=q.box.minZ&&z<=q.box.maxZ&&pointIn([x,z],q.ring));
  const blocked=(x,z)=>onRoad(x,z)||inPresent(x,z)||inOwn(x,z);

  // ---- Platz suchen für Körper mit Grundfläche (Rechteck oder Kreis)
  const outline=(i,dx=0,dz=0,grow=0)=>{const x=i.x+dx,z=i.z+dz;if(i.radius)return [...Array(14)].map((_,k)=>[x+Math.cos(k*Math.PI/7)*(i.radius+grow),z+Math.sin(k*Math.PI/7)*(i.radius+grow)]);const a=i.angle||0,c=Math.cos(a),s=Math.sin(a),w=i.width/2+grow,d=i.depth/2+grow;return [[-w,-d],[w,-d],[w,d],[-w,d]].map(([u,v])=>[x+c*u+s*v,z-s*u+c*v]);};
  const probes=(i,dx,dz)=>{const x=i.x+dx,z=i.z+dz,out=[[x,z]];if(i.radius){for(const f of [.5,1])for(let k=0;k<10;k++)out.push([x+Math.cos(k*Math.PI/5)*i.radius*f,z+Math.sin(k*Math.PI/5)*i.radius*f]);return out;}
    const a=i.angle||0,c=Math.cos(a),s=Math.sin(a),nu=Math.max(2,Math.ceil(i.width/1.2)),nv=Math.max(2,Math.ceil(i.depth/1.2));for(let p=0;p<=nu;p++)for(let q=0;q<=nv;q++){const u=(p/nu-.5)*i.width,v=(q/nv-.5)*i.depth;out.push([x+c*u+s*v,z-s*u+c*v]);}return out;};
  const share=(i,dx,dz)=>{const pts=probes(i,dx,dz);let bad=0;for(const [x,z] of pts)if(blocked(x,z))bad++;return bad/pts.length;};
  const placed=[],dropped=[];
  function place(item,type){
    const first=share(item,0,0);let shift=null;
    if(first===0)shift=[0,0];else if(first>.5){stats.duplicates++;dropped.push({type,x:item.x,z:item.z,why:'schon vorhanden'});return null;}
    else{search:for(const r of [.5,1,1.5,2])for(let k=0;k<8;k++){const dx=Math.cos(k*Math.PI/4)*r,dz=Math.sin(k*Math.PI/4)*r;if(share(item,dx,dz)===0){shift=[dx,dz];stats.moved++;break search;}}
      if(!shift){stats.noRoom++;dropped.push({type,x:item.x,z:item.z,why:'kein Platz'});return null;}}
    const at={...item,x:item.x+shift[0],z:item.z+shift[1]},ring=outline(at);own.push({ring,box:boxOf(ring),type});placed.push({type,x:+at.x.toFixed(2),z:+at.z.toFixed(2),ring:ring.map(p=>[+p[0].toFixed(2),+p[1].toFixed(2)])});return at;
  }

  // ---- Sitzplätze und befestigte Gartenteile: flache Flächen auf dem Gelände. Sie hindern keinen Körper (ein Sonnenschirm steht darauf),
  // aber die Büsche aus den Laserdaten weichen ihnen.
  const flat=[];{const position=[],colourOf=[],col=new T.Color();for(const q of data.patios||[]){const ring=q.points,c=[ring.reduce((a,v)=>a+v[0],0)/ring.length,ring.reduce((a,v)=>a+v[1],0)/ring.length];if(onRoad(c[0],c[1])||inPresentSolid(c[0],c[1])){stats.skipped++;continue;}
      flat.push({ring,box:boxOf(ring)});col.set(PATIO[q.cover]||PATIO.platten);let area=0;for(const [a,b,d] of T.ShapeUtils.triangulateShape(ring.map(v=>new T.Vector2(v[0],v[1])),[])){const tri=[ring[a],ring[d],ring[b]];area+=Math.abs((tri[1][0]-tri[0][0])*(tri[2][1]-tri[0][1])-(tri[1][1]-tri[0][1])*(tri[2][0]-tri[0][0]))/2;
        // fein unterteilt, damit die Fläche dem Gelände folgt
        const sub=(t,depth)=>{const e=[0,1,2].map(k=>Math.hypot(t[(k+1)%3][0]-t[k][0],t[(k+1)%3][1]-t[k][1])),k=e.indexOf(Math.max(...e));if(e[k]<=1.6||depth>6){const shade=.95+.1*hash(position.length);for(const v of t){position.push(v[0],height(v[0],v[1])+.09,v[1]);colourOf.push(col.r*shade,col.g*shade,col.b*shade);}return;}const m=[(t[k][0]+t[(k+1)%3][0])/2,(t[k][1]+t[(k+1)%3][1])/2];sub([t[k],m,t[(k+2)%3]],depth+1);sub([m,t[(k+1)%3],t[(k+2)%3]],depth+1);};sub(tri,0);}
      stats.patios=(stats.patios||0)+1;stats.patioM2=(stats.patioM2||0)+area;}
    if(position.length){const g=new T.BufferGeometry();g.setAttribute('position',new T.Float32BufferAttribute(position,3));g.setAttribute('color',new T.Float32BufferAttribute(colourOf,3));g.computeVertexNormals();const m=new T.Mesh(g,new T.MeshStandardMaterial({vertexColors:true,roughness:.95,side:T.DoubleSide,polygonOffset:true,polygonOffsetFactor:-3,polygonOffsetUnits:-3}));m.name='Quartier_Sitzplaetze';m.receiveShadow=true;m.userData={source:data.source,accuracy:data.accuracy};group.add(m);}stats.patioM2=Math.round(stats.patioM2||0);}
  const inFlat=(x,z)=>flat.some(q=>x>=q.box.minX&&x<=q.box.maxX&&z>=q.box.minZ&&z<=q.box.maxZ&&pointIn([x,z],q.ring));
  // ---- Kleinbauten: Gartenhäuser, Gewächshäuser, Folientunnel, Unterstände, Silos, Stapel, Anhänger, Wohnwagen
  for(const s0 of data.sheds||[]){const round=/Silo|Tank|Reservoir/.test(s0.note||'')&&Math.abs(s0.width-s0.depth)<.6,turned=!round&&s0.width>s0.depth*1.05?{...s0,width:s0.depth,depth:s0.width,angle:(s0.angle||0)+Math.PI/2}:s0,s=place(round?{...turned,radius:s0.width/2}:turned,'Kleinbau');if(!s)continue;const y=height(s.x,s.z),a=s.angle||0;
    if(round){const g=new T.CylinderGeometry(s.width/2,s.width/2,s.height,14);g.translate(s.x,y+s.height/2,s.z);add(things,g,s.colour);}
    else if(/Folientunnel|Rundbogen|Folienhalle/.test(s.note||'')){const g=new T.CylinderGeometry(s.width/2,s.width/2,s.depth,14,1,false,-Math.PI/2,Math.PI);g.rotateX(Math.PI/2);g.scale(1,s.height/(s.width/2),1);g.rotateY(a);g.translate(s.x,y-.05,s.z);add(things,g,s.colour);}
    else if(PARASOL.test(s.note||'')){add(things,box(.07,s.height,.07,s.x,y+s.height/2,s.z,0),'#6a6a6a');const top=new T.ConeGeometry(s.width/2,.55,8);top.translate(s.x,y+s.height+.1,s.z);add(things,top,s.colour);stats.canopies=(stats.canopies||0)+1;}
    else if(CANOPY.test(s.note||'')){const c=Math.cos(a),sn=Math.sin(a);for(const [fu,fv] of [[-1,-1],[1,-1],[1,1],[-1,1]]){const u=fu*(s.width/2-.1),v=fv*(s.depth/2-.1),px=s.x+c*u+sn*v,pz=s.z-sn*u+c*v;add(things,box(.09,s.height,.09,px,height(px,pz)+s.height/2,pz,a),'#6f6a62');}
      add(things,box(s.width,.07,s.depth,s.x,y+s.height+.03,s.z,a),s.colour);if(/Pergola/.test(s.note))for(let k=-2;k<=2;k++)add(things,box(s.width,.1,.08,s.x+sn*k*s.depth/5,y+s.height-.06,s.z+c*k*s.depth/5,a),'#6f6a62');stats.canopies=(stats.canopies||0)+1;}
    else{add(things,box(s.width,s.height,s.depth,s.x,y+s.height/2-.1,s.z,a),s.colour);if(!FLAT.test(s.note||'')){const roof=new T.CylinderGeometry(s.width*.58,s.width*.58,s.depth+.3,3,1);roof.rotateX(Math.PI/2);roof.scale(1,.32,1);roof.rotateY(a);roof.translate(s.x,y+s.height+s.width*.09-.1,s.z);add(things,roof,new T.Color(s.colour).multiplyScalar(.82).getStyle());}}
    stats.sheds=(stats.sheds||0)+1;}
  // ---- Pools
  for(const p0 of data.pools){const p=place(p0,'Pool');if(!p)continue;const y=height(p.x,p.z),a=p.angle||0;
    if(p.kind==='rect'){add(things,box(p.width+.6,.14,p.depth+.6,p.x,y+.05,p.z,a),'#d6d0c2');add(things,box(p.width,.1,p.depth,p.x,y+.12,p.z,a),p.colour||'#4fb6e6');}
    else if(p.kind==='covered'){add(things,box(p.width,.5,p.depth,p.x,y+.2,p.z,a),'#e4e6e4');add(things,box(p.width+.8,.12,p.depth+.8,p.x,y+.04,p.z,a),'#cfc9bb');}
    else{const wall=new T.CylinderGeometry(p.radius,p.radius,1.1,20);wall.translate(p.x,y+.55,p.z);add(things,wall,'#d7dde2');const water=new T.CylinderGeometry(p.radius-.12,p.radius-.12,.06,20);water.translate(p.x,y+1.1,p.z);add(things,water,'#4fa6cf');}stats.pools++;}
  // ---- Teiche und Biotope: flache Wasserfläche
  for(const p0 of data.ponds||[]){const p=place(p0,'Teich');if(!p)continue;const g=new T.CylinderGeometry(.5,.5,.06,18);g.scale(p.width,1,p.depth);g.rotateY(p.angle||0);g.translate(p.x,height(p.x,p.z)+.06,p.z);add(things,g,p.colour||'#5f8f9a');stats.ponds=(stats.ponds||0)+1;}
  // ---- Trampoline
  for(const t0 of data.trampolines){const t=place(t0,'Trampolin');if(!t)continue;const y=height(t.x,t.z),mat=new T.CylinderGeometry(t.radius,t.radius,.08,20);mat.translate(t.x,y+.8,t.z);add(things,mat,'#26282b');for(let k=0;k<6;k++){const a=k*Math.PI/3;add(things,box(.06,.8,.06,t.x+Math.cos(a)*t.radius*.92,y+.4,t.z+Math.sin(a)*t.radius*.92,0),'#70757a');}stats.trampolines++;}
  // ---- Beete: Gemüsebeete mit Pflanzreihen, Zierbeete mit Blüten, Steingärten
  const beds=batch(),BLOOM=['#d9486a','#e9c53c','#f0f0e6','#b05cc8','#e8843a'];for(const [n,b] of (data.beds||[]).entries()){const a=b.angle||0,c=Math.cos(a),sn=Math.sin(a),at=(u,v)=>[b.x+c*u+sn*v,b.z-sn*u+c*v];
    const base=b.kind==='stein'?'#b5ad9c':b.kind==='zier'?'#5c5a3a':b.kind==='mist'?'#7a6a45':'#5e4a36',nu=Math.max(1,Math.round(b.width/.9)),nv=Math.max(1,Math.round(b.depth/1.6)),cw=b.width/nu,cd=b.depth/nv;
    // In Felder geteilt, damit das Beet am Hang dem Gelände folgt. Ein Beet ist flach: Felder, die auf etwas Vorhandenes fielen, entfallen einzeln;
    // bleibt weniger als die Hälfte frei, entfällt das ganze Beet.
    const free=(i,j)=>{const u=(i+.5)*cw-b.width/2,v=(j+.5)*cd-b.depth/2;return ![[0,0],[-.45,-.45],[.45,-.45],[.45,.45],[-.45,.45]].some(([fu,fv])=>blocked(...at(u+fu*cw,v+fv*cd)));},open=new Set();for(let i=0;i<nu;i++)for(let j=0;j<nv;j++)if(free(i,j))open.add(i+'_'+j);
    if(open.size<nu*nv*.5){if(open.size<nu*nv*.2)stats.duplicates++;else stats.noRoom++;dropped.push({type:'Beet',x:b.x,z:b.z,why:open.size<nu*nv*.2?'schon vorhanden':'kein Platz'});continue;}
    const before=own.length,elsewhere=(x,z)=>onRoad(x,z)||inPresent(x,z)||own.some((q,k)=>k<before&&x>=q.box.minX&&x<=q.box.maxX&&z>=q.box.minZ&&z<=q.box.maxZ&&pointIn([x,z],q.ring));
    {const ring=outline(b);own.push({ring,box:boxOf(ring),type:'Beet'});placed.push({type:'Beet',x:b.x,z:b.z,ring:ring.map(q=>[+q[0].toFixed(2),+q[1].toFixed(2)]),cells:[...open].map(k=>{const [i,j]=k.split('_').map(Number);return at((i+.5)*cw-b.width/2,(j+.5)*cd-b.depth/2).map(v=>+v.toFixed(2));})});if(open.size<nu*nv)stats.bedsTrimmed=(stats.bedsTrimmed||0)+1;}
    for(let i=0;i<nu;i++)for(let j=0;j<nv;j++){if(!open.has(i+'_'+j))continue;const [x,z]=at((i+.5)*cw-b.width/2,(j+.5)*cd-b.depth/2),gy=height(x,z);add(beds,box(cw+.02,.3,cd+.02,x,gy+.03,z,a),base);if(b.kind==='gemuese')add(beds,box(.38,.22+.2*hash(n*5+i),cd-.1,x,gy+.24,z,a),hash(n*3+i)>.75?'#8aa84a':'#4f8a3a',.85+.3*hash(n+i));}
    if(b.kind==='gemuese')stats.vegetableBeds=(stats.vegetableBeds||0)+1;
    else if(b.kind!=='mist'){const count=Math.round(b.width*b.depth/(b.kind==='stein'?7:3.5));for(let k=0;k<count;k++){const [x,z]=at((hash(n*13+k)-.5)*(b.width-.6),(hash(n*17+k*3)-.5)*(b.depth-.6)),r=.3+.35*hash(k+n);if(elsewhere(x,z))continue;const g=new T.IcosahedronGeometry(r,0);g.translate(x,height(x,z)+.2+r*.6,z);add(beds,g,b.kind==='zier'&&hash(k*5+n)>.45?BLOOM[Math.floor(hash(k+n*7)*BLOOM.length)]:'#4d8a3c',.9+.2*hash(k));}stats.flowerBeds=(stats.flowerBeds||0)+1;}}
  finish(beds,'Quartier_Beete');

  // ---- Linien: Stücke auf Strassen, in Vorhandenem oder in einem gesetzten Körper entfallen. half = halbe Breite, die mitgeprüft wird.
  const along=(points,step,each,half=0)=>{let n=0;for(let i=0;i<points.length-1;i++){const a=points[i],b=points[i+1],len=Math.hypot(b[0]-a[0],b[1]-a[1]),count=Math.max(1,Math.round(len/step)),piece=len/count,angle=Math.atan2(b[0]-a[0],b[1]-a[1]),nx=Math.cos(angle),nz=-Math.sin(angle);
    for(let k=0;k<count;k++){const t=(k+.5)/count,x=a[0]+(b[0]-a[0])*t,z=a[1]+(b[1]-a[1])*t;if(blocked(x,z)||(half&&(blocked(x+nx*half,z+nz*half)||blocked(x-nx*half,z-nz*half)))){stats.skipped++;continue;}each(x,z,angle,piece,n++);}}return n;};
  // Die Laserdaten zeigen Hecken, Gartenhäuser und Pools als «Gehölz». Wo ein Luftbild-Element steht, entfallen diese Büsche (atmosphere.js
  // fragt occupied); umgekehrt entfällt ein abgelesener Strauch, wo die Laserdaten schon ein Gehölz haben.
  const spots=new Map(),cellKey=(x,z)=>Math.floor(x/6)+'_'+Math.floor(z/6),spot=(x,z,r)=>{const k=cellKey(x,z);if(!spots.has(k))spots.set(k,[]);spots.get(k).push([x,z,r]);};
  const occupied=(x,z)=>{if(inOwn(x,z)||inFlat(x,z))return true;const i=Math.floor(x/6),j=Math.floor(z/6);for(let a=-1;a<=1;a++)for(let b=-1;b<=1;b++)for(const q of spots.get((i+a)+'_'+(j+b))||[])if(Math.hypot(q[0]-x,q[1]-z)<q[2])return true;return false;};
  const measured=new Map();for(const v of model.cadastre.vegetation||[]){const k=cellKey(v.x,v.z);if(!measured.has(k))measured.set(k,[]);measured.get(k).push(v);}
  const known=(x,z,r)=>{const i=Math.floor(x/6),j=Math.floor(z/6);for(let a=-1;a<=1;a++)for(let b=-1;b<=1;b++)for(const v of measured.get((i+a)+'_'+(j+b))||[])if(Math.hypot(v.x-x,v.z-z)<(v.tree?Math.max(1.5,(v.r||2)*.6):.9)+r*.5)return true;return false;};
  // ---- Hecken: leicht unregelmässige Quader, oben etwas schmaler
  const hedges=batch();for(const [index,h] of data.hedges.entries())along(h.points,1.1,(x,z,angle,piece,n)=>{const y=height(x,z),v=hash(index*31+n),top=h.height*(.9+.2*v),g=new T.BoxGeometry(h.width*(.92+.16*hash(n+index)),top+.3,piece+.12,1,2,1),p=g.getAttribute('position');
    for(let i=0;i<p.count;i++)if(p.getY(i)>top/2)p.setX(i,p.getX(i)*.72);g.computeVertexNormals();g.rotateY(angle);g.translate(x,y+top/2-.15,z);spot(x,z,h.width/2+.4);add(hedges,g,h.note?.includes('blühend')&&v>.8?'#6f9a55':'#3f7a37',.86+.28*v);stats.hedgeMetres+=piece;},h.width*.35);
  finish(hedges,'Quartier_Hecken');
  // ---- Zäune (Pfosten und zwei Latten) und Mauern
  const fences=batch();for(const f of data.fences)along(f.points,2,(x,z,angle,piece)=>{const y=height(x,z);add(fences,box(.08,f.height,.08,x-Math.sin(angle)*piece/2,y+f.height/2,z-Math.cos(angle)*piece/2,angle),'#6f6a62');for(const t of [.45,.9])add(fences,box(.04,.07,piece,x,y+f.height*t,z,angle),'#8a857c');stats.fenceMetres+=piece;});
  finish(fences,'Quartier_Zaeune');
  const walls=batch();for(const w of data.walls)along(w.points,1,(x,z,angle,piece)=>{const y=height(x,z);add(walls,box(w.colour?.16:.32,w.height+.4,piece+.03,x,y+w.height/2-.2,z,angle),w.colour||'#a9a59b');stats.wallMetres+=piece;});
  // ---- Treppen: Stufen zwischen zwei Punkten, der Höhenunterschied kommt aus dem Gelände
  for(const s of data.stairs){const dx=s.to[0]-s.from[0],dz=s.to[1]-s.from[1],len=Math.hypot(dx,dz),angle=Math.atan2(dx,dz),y0=height(...s.from),y1=height(...s.to),count=Math.max(3,Math.round(Math.max(len/.32,Math.abs(y1-y0)/.17)*.5+2));if(blocked((s.from[0]+s.to[0])/2,(s.from[1]+s.to[1])/2)){stats.skipped++;continue;}
    for(let k=0;k<count;k++){const t=(k+.5)/count,x=s.from[0]+dx*t,z=s.from[1]+dz*t,y=y0+(y1-y0)*t;add(walls,box(s.width,.4,len/count+.02,x,y-.06,z,angle),'#b9b4a8',.92+.1*(k%2));stats.steps++;}stats.stairs++;}
  // ---- Gartenwege aus Platten
  for(const p of data.paths)along(p.points,.9,(x,z,angle,piece,n)=>{add(walls,box(p.width,.3,piece-.06,x,height(x,z)+.03,z,angle),'#b3ada0',.93+.1*hash(n));stats.pathMetres+=piece;});
  finish(walls,'Quartier_Mauern_Treppen_Wege');
  // ---- Sträucher
  const shrubs=batch();for(const [n,[x,z,r]] of data.shrubs.entries()){if(blocked(x,z)||inFlat(x,z)){stats.skipped++;continue;}if(known(x,z,r)){stats.shrubsKnown=(stats.shrubsKnown||0)+1;continue;}const g=new T.IcosahedronGeometry(r,1);g.scale(1,.85,1);g.translate(x,height(x,z)+r*.6,z);add(shrubs,g,'#4d8a3c',.85+.3*hash(n));stats.shrubs++;}
  finish(shrubs,'Quartier_Straeucher');
  // ---- Siloballen: Reihen stehender Ballen, teils in zwei Lagen
  for(const b of data.bales||[])along(b.points,1.35,(x,z,angle,piece,n)=>{for(let k=0;k<b.width;k++){const off=(k-(b.width-1)/2)*1.3,bx=x+Math.cos(angle)*off,bz=z-Math.sin(angle)*off,y=height(bx,bz);if(blocked(bx,bz))continue;for(let layer=0;layer<((n+k)%3?1:2);layer++){const g=new T.CylinderGeometry(.62,.62,1.2,8);g.translate(bx,y+.6+layer*1.2,bz);add(things,g,hash(n*7+k)>.85?'#9fd0b0':'#eef0ee',.92+.1*hash(n+k*3));stats.bales=(stats.bales||0)+1;}}});
  // ---- Baumschule: Gehölze in Reihen
  const nursery=batch();for(const r of data.rows||[]){const [a,b]=r.points,dx=b[0]-a[0],dz=b[1]-a[1],len=Math.hypot(dx,dz),nx=-dz/len,nz=dx/len;for(let k=0;k<r.count;k++)for(let d=0;d<=len;d+=r.radius*2.1){const x=a[0]+dx*d/len+nx*k*5,z=a[1]+dz*d/len+nz*k*5;if(blocked(x,z))continue;const g=new T.IcosahedronGeometry(r.radius,0);g.scale(1,1.25,1);g.translate(x,height(x,z)+r.radius*1.3,z);add(nursery,g,r.colour,.85+.3*hash(d+k*11));stats.nursery=(stats.nursery||0)+1;}}
  finish(nursery,'Quartier_Baumschule');
  finish(things,'Quartier_Kleinbauten_Pool_Carport',{flatShading:false});

  // ---- Solaranlagen. Lage und Ausdehnung stammen aus dem Luftbild, Ausrichtung und Neigung vom Dach des Gebäudemodells:
  // Die Modulreihen laufen parallel zur Traufe, jedes Modul liegt in der Ebene seiner Dachfläche. Ein Modul wird nur gesetzt,
  // wenn alle vier Ecken auf derselben Dachfläche liegen (höchstens 12 cm Abweichung) – nichts ragt über First, Grat oder Dachrand.
  {const position=[],normal=[],colour=[];let worst=0;
    for(const [n,q] of (data.solar||[]).entries()){const a=q.angle||0,ux=Math.cos(a),uz=-Math.sin(a);let seed=null;for(const [fu,fv] of [[0,0],[.25,0],[-.25,0],[0,.25],[0,-.25],[.25,.25],[-.25,-.25],[.25,-.25],[-.25,.25]]){const x=q.x+ux*fu*q.width-uz*fv*q.depth,z=q.z+uz*fu*q.width+ux*fv*q.depth,hit=roofAt(x,z);if(hit&&hit.n.y>.25&&hit.y-height(x,z)>1.8){seed=hit;break;}}
      if(!seed){stats.solarSkipped=(stats.solarSkipped||0)+1;continue;}
      // s = Fallrichtung des Dachs (waagrecht), e = Richtung der Traufe; bei Flachdach gilt die abgelesene Richtung
      const flatRoof=Math.hypot(seed.n.x,seed.n.z)<.12,sl=Math.hypot(seed.n.x,seed.n.z)||1,sx=flatRoof?-uz:seed.n.x/sl,sz=flatRoof?ux:seed.n.z/sl,ex=-sz,ez=sx,alongEave=Math.abs(ux*ex+uz*ez)>=Math.abs(ux*sx+uz*sz),lenE=alongEave?q.width:q.depth,lenS=alongEave?q.depth:q.width;
      const cols=Math.max(1,Math.round(lenE/1.1)),rowsN=Math.max(1,Math.round(lenS/1.75)),w=lenE/cols,d=lenS/rowsN;let count=0;
      for(let i=0;i<cols;i++)for(let j=0;j<rowsN;j++){const oe=(i+.5)*w-lenE/2,os=(j+.5)*d-lenS/2,cx=q.x+ex*oe+sx*os,cz=q.z+ez*oe+sz*os,hit=roofAt(cx,cz);if(!hit||hit.n.y<.25||hit.y-height(cx,cz)<1.8)continue;
        const nh=Math.hypot(hit.n.x,hit.n.z);if(!flatRoof&&nh>.12&&Math.abs(hit.n.x*ex+hit.n.z*ez)/nh>.35)continue; // Walm- oder Querfläche: andere Richtung
        const corners=[];let fits=true;for(const [fe,fs] of [[-1,-1],[1,-1],[1,1],[-1,1]]){const dx=(ex*w*fe+sx*d*fs)*.46,dz=(ez*w*fe+sz*d*fs)*.46,y=hit.y-(hit.n.x*dx+hit.n.z*dz)/hit.n.y,real=roofAt(cx+dx,cz+dz);if(!real||Math.abs(real.y-y)>.12){fits=false;break;}worst=Math.max(worst,Math.abs(real.y-y));corners.push(new T.Vector3(cx+dx,y,cz+dz).addScaledVector(hit.n,.07));}
        if(!fits)continue;const [A,B,C,D]=corners,shade=.85+.3*hash(n*31+i*7+j);for(const p of [A,D,B,B,D,C]){position.push(p.x,p.y,p.z);normal.push(hit.n.x,hit.n.y,hit.n.z);colour.push(.045*shade,.07*shade,.15*shade);}count++;}
      if(count){stats.solarFields=(stats.solarFields||0)+1;stats.solarPanels=(stats.solarPanels||0)+count;}else stats.solarSkipped=(stats.solarSkipped||0)+1;}
    stats.solarWorstGap=+worst.toFixed(3);
    if(position.length){const g=new T.BufferGeometry();g.setAttribute('position',new T.Float32BufferAttribute(position,3));g.setAttribute('normal',new T.Float32BufferAttribute(normal,3));g.setAttribute('color',new T.Float32BufferAttribute(colour,3));const m=new T.Mesh(g,new T.MeshStandardMaterial({vertexColors:true,roughness:.25,metalness:.55,side:T.DoubleSide,polygonOffset:true,polygonOffsetFactor:-2,polygonOffsetUnits:-2}));m.name='Quartier_Solaranlagen';m.receiveShadow=true;m.userData={source:data.source,accuracy:data.accuracy};group.add(m);}}

  for(const k of ['hedgeMetres','fenceMetres','wallMetres','pathMetres'])stats[k]=Math.round(stats[k]);
  model.stats.quarter=stats;model.quarter={group,stats,area:data.area,carports:data.carports,blocked,occupied,placed,dropped,roofAt,patios:flat,present:present.length};return model.quarter;
}
