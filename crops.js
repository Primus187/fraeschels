// Felder nach gemeldeter Kultur (data/crops.json, tools/acquire-crops.mjs), als eine Fläche auf dem Gelände.
// Umriss und Kultur je Feld sind gemeldete Daten. Farbe, Bedeckung, Reihen und Fahrgassen folgen dem Kalender in
// crop-calendar.js und sind Gestaltung; Reihenabstand und Reihenrichtung (längste Feldkante) sind angenommen.
import * as T from 'three';
import {terrainGeometry} from './terrain-geometry.js';
import {cropState,CROPS,SOIL_COLOUR} from './crop-calendar.js';

const REFERENCE_DAY=166; // 15. Juni: fester Stand der sachlichen Darstellung und des Exports
const pointIn=(p,ring)=>{let yes=false;for(let i=0,j=ring.length-1;i<ring.length;j=i++){const a=ring[i],b=ring[j];if((a[1]>p[1])!==(b[1]>p[1])&&p[0]<(b[0]-a[0])*(p[1]-a[1])/(b[1]-a[1])+a[0])yes=!yes;}return yes;};
const hash=n=>{const s=Math.sin(n*127.1+311.7)*43758.5453;return s-Math.floor(s);};

export async function buildCrops(model){
  const data=await fetch('data/crops.json').then(r=>r.ok?r.json():null).catch(()=>null);
  if(!data?.fields?.length){model.crops=null;return null;}
  const {appendTriangle}=terrainGeometry(model.terrain,model.halfWidth,model.halfDepth,model.terrain.centerHeight,model.boundary),height=model.height;
  const positions=[],fields=[],stats={fields:0,areaHa:0,byGroup:{},year:Number(Object.keys(data.years||{}).sort().at(-1))||null};
  data.fields.forEach((f,index)=>{if(!CROPS[f.group])return;const all=[...f.rings[0],...f.rings.slice(1).flat()],start=positions.length/3;
    for(const [a,b,c] of T.ShapeUtils.triangulateShape(f.rings[0].map(p=>new T.Vector2(p[0],p[1])),f.rings.slice(1).map(r=>r.map(p=>new T.Vector2(p[0],p[1])))))appendTriangle([all[a],all[b],all[c]],.04,positions);
    const count=positions.length/3-start;if(!count)return; // ganz ausserhalb der Gemeinde
    // Reihen laufen entlang der längsten Feldkante
    let best=0,dir=[1,0];const ring=f.rings[0];for(let i=0;i<ring.length;i++){const p=ring[i],q=ring[(i+1)%ring.length],len=Math.hypot(q[0]-p[0],q[1]-p[1]);if(len>best){best=len;dir=[(q[0]-p[0])/len,(q[1]-p[1])/len];}}
    const xs=ring.map(p=>p[0]),zs=ring.map(p=>p[1]);
    fields.push({crop:f.crop,group:f.group,year:f.year,area:f.area,rings:f.rings,start,count,across:[-dir[1],dir[0]],variation:hash(index+1),box:[Math.min(...xs),Math.max(...xs),Math.min(...zs),Math.max(...zs)]});
    stats.fields++;stats.areaHa+=f.area/10000;stats.byGroup[f.group]=(stats.byGroup[f.group]||0)+1;});
  stats.areaHa=Math.round(stats.areaHa);
  const n=positions.length/3,normals=new Float32Array(n*3),colours=new Float32Array(n*3),rows=new Float32Array(n*4),tram=new Float32Array(n);
  for(let i=0;i<n;i++){const x=positions[i*3],z=positions[i*3+2];new T.Vector3(-(height(x+3,z)-height(x-3,z))/6,1,-(height(x,z+3)-height(x,z-3))/6).normalize().toArray(normals,i*3);}
  const geometry=new T.BufferGeometry();geometry.setAttribute('position',new T.Float32BufferAttribute(positions,3));geometry.setAttribute('normal',new T.BufferAttribute(normals,3));
  geometry.setAttribute('color',new T.BufferAttribute(colours,3));geometry.setAttribute('aRow',new T.BufferAttribute(rows,4));geometry.setAttribute('aTram',new T.BufferAttribute(tram,1));
  const soil={value:new T.Color(SOIL_COLOUR)},breeze={uCropWind:{value:0},uCropWindAmt:{value:0},uCropWindDir:{value:new T.Vector2(1,0)}},material=new T.MeshStandardMaterial({color:'#ffffff',vertexColors:true,roughness:1,polygonOffset:true,polygonOffsetFactor:-1,polygonOffsetUnits:-1});
  // Bestand und offener Boden werden im Bild gemischt: flächig nach Bedeckung, bei Reihenkulturen als Streifen. Aus der Ferne blenden die Streifen aus, damit nichts flimmert.
  material.onBeforeCompile=shader=>{shader.uniforms.uCropSoil=soil;Object.assign(shader.uniforms,breeze);
    shader.vertexShader='attribute vec4 aRow;attribute float aTram;varying vec4 vRow;varying float vTram;varying vec3 vCropAt;\n'+shader.vertexShader.replace('#include <begin_vertex>','#include <begin_vertex>\nvRow=aRow;vTram=aTram;vCropAt=position;');
    shader.fragmentShader='uniform vec3 uCropSoil;uniform float uCropWind,uCropWindAmt;uniform vec2 uCropWindDir;varying vec4 vRow;varying float vTram;varying vec3 vCropAt;\nfloat cropHash(vec2 p){p=fract(p*vec2(123.34,456.21));p+=dot(p,p+45.32);return fract(p.x*p.y);}\nfloat cropNoise(vec2 p){vec2 i=floor(p),f=fract(p);f=f*f*(3.0-2.0*f);return mix(mix(cropHash(i),cropHash(i+vec2(1,0)),f.x),mix(cropHash(i+vec2(0,1)),cropHash(i+vec2(1,1)),f.x),f.y);}\n'+
      shader.fragmentShader.replace('#include <color_fragment>',`#include <color_fragment>
      {float across=dot(vCropAt.xz,vRow.xy),width=fwidth(across),near=1.0-smoothstep(.22,.5,width),cover=vRow.z;
       float stripe=sin(across*6.2832)*.5+.5,inRows=smoothstep(1.0-cover*1.15,1.0-cover*1.15+.35,stripe),plant=mix(cover,inRows,vRow.w*near);
       vec3 ground=uCropSoil*(.9+.2*cropNoise(vCropAt.xz*.6));vec3 c=mix(ground,diffuseColor.rgb,plant)*(.93+.14*cropNoise(vCropAt.xz*.045+7.0))*(.96+.08*cropNoise(vCropAt.xz*1.9));
       // Fahrgassen im Getreide und Raps: zwei schmale Spuren alle 24 m
       float lane=dot(vCropAt.xz,normalize(vRow.xy+1e-6))/24.0,lw=fwidth(lane)*24.0,track=min(abs(fract(lane)-.47),abs(fract(lane)-.53))*24.0;
       c=mix(c,ground,vTram*cover*(1.0-smoothstep(.12,.3,track))*(1.0-smoothstep(.5,1.4,lw))*.55);
       // Wind: helle und dunkle Wellen laufen über flächige Bestände (Getreide, Wiesen)
       c*=1.0+uCropWindAmt*.06*sin(dot(vCropAt.xz,uCropWindDir)*.2-uCropWind*1.7+cropNoise(vCropAt.xz*.03)*6.0)*plant*(1.0-vRow.w);diffuseColor.rgb=c;}`);};
  material.customProgramCacheKey=()=>'crops-v2';
  const mesh=new T.Mesh(geometry,material);mesh.name='Kulturen_Felder';mesh.receiveShadow=true;mesh.castShadow=false;
  mesh.userData={kind:'crops',source:data.source,acquiredOn:data.acquiredOn,label:'Felder nach gemeldeter Kultur '+stats.year,accuracy:'Field outlines and crop per field as reported for '+stats.year+'. Growth stage, colours, row spacing, row direction and tramlines are illustrative.'};
  model.groups.surfaces.add(mesh);
  // Die bisherigen, von Hand angenäherten Felder samt Feldreihen und Ackerpflanzen entfallen.
  let replaced=0;for(const o of [...model.groups.surfaces.children])if(o.userData.fieldPlot||o.name==='Feldreihen_3D'||o.name==='Pflanzenreihen_im_Acker'){o.removeFromParent();o.geometry?.dispose();replaced++;}
  stats.replaced=replaced;
  let shown={day:null,snow:null};const tone=new T.Color(); // Kalenderfarben sind sRGB, die Eckpunktfarben rechnet three.js linear
  // Stand der Felder an einem Tag im Jahr; ohne Angabe der feste Stand vom 15. Juni. Bei Schnee sind alle Felder weiss;
  // snow darf auch ein Anteil 0…1 sein, dann liegt der Schnee erst dünn (in Zwanzigsteln, damit nicht jedes Bild neu rechnet).
  function setSeason(day=null,snow=false){day=day??REFERENCE_DAY;snow=snow===true?1:Math.round(Math.max(0,Math.min(1,Number(snow)||0))*20)/20;if(shown.day===day&&shown.snow===snow)return;shown={day,snow};soil.value.set(SOIL_COLOUR).lerp(new T.Color('#e9edf3'),snow);
    for(const f of fields){const s=cropState(f.group,day,f.variation,f.crop),white=.9+.06*f.variation,[r,g,b]=tone.setRGB(...s.colour.map((v,k)=>Math.min(1,v)+([white,white+.01,white+.04][k]-Math.min(1,v))*snow),T.SRGBColorSpace).toArray(),scale=s.rows>0&&snow<.7?1/s.rows:0;
      for(let i=f.start;i<f.start+f.count;i++){colours[i*3]=r;colours[i*3+1]=g;colours[i*3+2]=b;rows[i*4]=f.across[0]*(scale||1);rows[i*4+1]=f.across[1]*(scale||1);rows[i*4+2]=s.cover+(1-s.cover)*snow;rows[i*4+3]=scale?1:0;tram[i]=snow<.7?s.tram:0;}}
    for(const name of ['color','aRow','aTram'])geometry.getAttribute(name).needsUpdate=true;planFarm(day);}
  const fieldAt=(x,z)=>fields.find(f=>x>=f.box[0]&&x<=f.box[1]&&z>=f.box[2]&&z<=f.box[3]&&pointIn([x,z],f.rings[0])&&!f.rings.slice(1).some(h=>pointIn([x,z],h))&&model.boundary.contains([x,z]))||null;
  // Arbeit des Traktors nach Jahreszeit: Er fährt auf einem gemeldeten Feld, auf dem nach dem Kalender gerade etwas ansteht –
  // ernten (Bestand wird demnächst geräumt), säen (Boden offen, Bestand läuft auf), grubbern (Stoppeln werden eingearbeitet) oder mähen (Wiesen).
  // Steht nichts an (Winter), bleibt er stehen. Welches Feld es trifft, ist ausgelost; es ist nicht die tatsächliche Arbeit eines Betriebs.
  const MOWING=[[135,150],[170,186],[215,230],[255,270]],single=f=>f.rings.length===1&&f.rings[0].length>=3&&f.rings[0].every(p=>model.boundary.contains(p)),inRing=f=>p=>pointIn(p,f.rings[0]);
  function workOn(f,day){const now=cropState(f.group,day,f.variation,f.crop),before=cropState(f.group,day-12,f.variation,f.crop),after=cropState(f.group,day+12,f.variation,f.crop);
    if(['wiese','extensiv'].includes(f.group))return MOWING.some(([a,b])=>day>=a&&day<=b)?'maehen':null;if(f.group==='brache')return null;
    if(now.cover>=.75&&after.cover<now.cover-.1)return 'ernten';if(now.cover<.06&&after.cover>.04)return 'saeen';if(before.cover>.25&&now.cover<before.cover-.15&&now.cover<.7)return 'grubbern';return null;}
  const WORK_ORDER=['ernten','saeen','grubbern','maehen'],WORK_LABEL={ernten:'Ernte',saeen:'Saat',grubbern:'Bodenbearbeitung',maehen:'Mähen',ruhe:'keine Feldarbeit'};let farm={work:'ruhe',crop:null,day:null};
  function planFarm(day){if(!model.life?.setFarmField||farm.day===day)return;farm.day=day;const [cx,cz]=model.life.farmCentre,middle=f=>[(f.box[0]+f.box[1])/2,(f.box[2]+f.box[3])/2],near=f=>Math.hypot(middle(f)[0]-cx,middle(f)[1]-cz);
    const jobs=fields.filter(f=>f.count>0&&single(f)&&f.area>2500).map(f=>({f,work:workOn(f,day)})).filter(j=>j.work).sort((a,b)=>WORK_ORDER.indexOf(a.work)-WORK_ORDER.indexOf(b.work)||near(a.f)-near(b.f));
    for(const job of jobs)if(model.life.setFarmField(job.f.rings[0],inRing(job.f))){farm={work:job.work,crop:job.f.crop,day};model.life.setWork(job.work);model.life.update(0);return;}
    // nichts zu tun: auf einem Ackerfeld in der Nähe abstellen
    if(!fieldAt(...model.life.tractorAt())){const rest=fields.filter(f=>f.count>0&&single(f)&&!['wiese','extensiv','brache'].includes(f.group)).sort((a,b)=>near(a)-near(b));for(const f of rest)if(model.life.setFarmField(f.rings[0],inRing(f))){farm.crop=f.crop;break;}}
    farm={work:'ruhe',crop:farm.crop||fieldAt(...model.life.tractorAt())?.crop||null,day};model.life.setWork('ruhe');model.life.update(0);}
  setSeason();
  model.stats.crops=stats;
  const setWind=(clock,direction,amount)=>{breeze.uCropWind.value=clock;breeze.uCropWindAmt.value=amount;breeze.uCropWindDir.value.copy(direction);};
  model.crops={mesh,stats,fields,setSeason,setWind,fieldAt,get farm(){return {...farm,label:WORK_LABEL[farm.work]};},source:data.source,year:stats.year,get shown(){return {...shown};},
    describe:(field,day)=>{const s=cropState(field.group,day??shown.day,field.variation,field.crop);return {crop:field.crop,group:s.label,area:field.area,year:field.year,cover:s.cover};}};
  return model.crops;
}
