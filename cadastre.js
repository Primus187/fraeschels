// Amtliche Vermessung (AV): Vorplätze und Zufahrten, Gartenanlagen, Strassen- und Wegflächen, Trottoirs,
// Mauern, Unterstände, Kleinbauten, Vordächer, Hochspannungsleitung und Liegenschaftsgrenzen als Geometrie auf dem Gelände.
// Lage und Umrisse stammen aus der AV (data/cadastre.json). Höhen von Mauern, Unterständen und Kleinbauten
// sowie alle Beläge und Farben sind angenähert – die AV kennt weder Material noch Höhe.
import * as T from 'three';
import {terrainGeometry} from './terrain-geometry.js';

// Flächenarten der Bodenbedeckung, die gezeichnet werden. Äcker, Wiesen und Wald bleiben beim bisherigen Modell.
const SURFACES={
  uebrige_befestigte:{role:'paved',name:'AV_Vorplaetze_Zufahrten',color:'#b8b1a0',offset:.075,label:'Vorplätze, Zufahrten und Hofflächen'},
  Gartenanlage:{role:'garden',name:'AV_Gartenanlagen',color:'#86a85f',offset:.05,label:'Gartenanlagen'},
  Strasse_Weg:{role:'road',name:'AV_Strassen_Wege',color:'#777b73',offset:.09,label:'Strassen- und Wegflächen'},
  Trottoir:{role:'walk',name:'AV_Trottoirs',color:'#c4c0b2',offset:.10,label:'Trottoirs'},
  Bahn:{role:'rail',name:'AV_Bahnareal',color:'#9a958a',offset:.06,label:'Bahnareal'},
  uebrige_humusierte:{role:'green',name:'AV_Gruenflaechen',color:'#8fa866',offset:.05,label:'Übrige Grünflächen'},
  uebrige_bestockte:{role:'wood',name:'AV_Gehoelze',color:'#5f7d44',offset:.06,label:'Gehölze'},
  uebrige_Intensivkultur:{role:'green',name:'AV_Intensivkultur',color:'#7d9a4a',offset:.05,label:'Intensivkultur'},
  Abbau_Deponie:{role:'paved',name:'AV_Abbau_Deponie',color:'#a89f8a',offset:.06,label:'Abbau und Deponie'},
  Gewaesser_fliessendes:{role:'water',name:'AV_Fliessgewaesser',color:'#58a6af',offset:.07,label:'Fliessgewässer'},
  Schilfguertel:{role:'wood',name:'AV_Schilf',color:'#8a9a55',offset:.06,label:'Schilf'},
  Wasserbecken:{role:'water',name:'AV_Wasserbecken',color:'#58a6af',offset:.12,label:'Wasserbecken'},
};
// Belag der Vorplätze und Zufahrten: aus der Luftbildfarbe geschätzt (tools/sample-cadastre-imagery.mjs).
const COVERS={
  asphalt:{role:'asphalt',name:'AV_Vorplaetze_Asphalt',color:'#8f8d86',label:'Vorplätze und Zufahrten: Asphalt (geschätzt)'},
  kies:{role:'gravel',name:'AV_Vorplaetze_Kies',color:'#c2b697',label:'Vorplätze und Zufahrten: Kies oder Mergel (geschätzt)'},
  platten:{role:'slab',name:'AV_Vorplaetze_Platten',color:'#c3c0b6',label:'Vorplätze und Zufahrten: Platten oder Beton (geschätzt)'},
  unbestimmt:{role:'paved',name:'AV_Vorplaetze_Belag_unbestimmt',color:'#b8b1a0',label:'Vorplätze und Zufahrten: Belag unbestimmt'},
  begruent:{role:'garden',name:'AV_Vorplaetze_begruent',color:'#86a85f',label:'Begrünte Teile befestigter Flächen (aus Luftbild)'},
};
const area=ring=>{let a=0;for(let i=0,j=ring.length-1;i<ring.length;j=i++)a+=(ring[j][0]+ring[i][0])*(ring[j][1]-ring[i][1]);return Math.abs(a/2);};
const pointIn=(p,ring)=>{let yes=false;for(let i=0,j=ring.length-1;i<ring.length;j=i++){const a=ring[i],b=ring[j];if((a[1]>p[1])!==(b[1]>p[1])&&p[0]<(b[0]-a[0])*(p[1]-a[1])/(b[1]-a[1])+a[0])yes=!yes;}return yes;};
const bounds=ring=>{let minX=Infinity,maxX=-Infinity,minZ=Infinity,maxZ=-Infinity;for(const [x,z] of ring){minX=Math.min(minX,x);maxX=Math.max(maxX,x);minZ=Math.min(minZ,z);maxZ=Math.max(maxZ,z);}return {minX,maxX,minZ,maxZ};};
const inside=(p,poly)=>p[0]>=poly.box.minX&&p[0]<=poly.box.maxX&&p[1]>=poly.box.minZ&&p[1]<=poly.box.maxZ&&pointIn(p,poly.rings[0])&&!poly.rings.slice(1).some(h=>pointIn(p,h));
// Ein Punkt sicher im Innern (für «steht hier schon ein Gebäude?»).
function interiorPoint(rings){const box=bounds(rings[0]),c=[(box.minX+box.maxX)/2,(box.minZ+box.maxZ)/2],poly={rings,box};if(inside(c,poly))return c;
  for(let k=1;k<40;k++){const p=[box.minX+(box.maxX-box.minX)*((k*.618)%1),box.minZ+(box.maxZ-box.minZ)*((k*.382)%1)];if(inside(p,poly))return p;}return c;}

export async function buildCadastre(model){
  const group=new T.Group();group.name='Amtliche_Vermessung';model.groups.cadastre=group;model.root.add(group);
  const parcelGroup=new T.Group();parcelGroup.name='Liegenschaftsgrenzen';parcelGroup.visible=false;model.groups.parcels=parcelGroup;model.root.add(parcelGroup);
  const data=await fetch('data/cadastre.json').then(r=>r.ok?r.json():null).catch(()=>null);
  if(!data){model.cadastre=null;return null;}
  // Strassenflächen nach Luftbild (tools/sample-road-surfaces.mjs): Asphaltton je Fläche, Kies- und Grasteile als Raster
  const roadData=await fetch('data/road-surfaces.json').then(r=>r.ok?r.json():null).catch(()=>null);
  group.userData={source:data.source,acquiredOn:data.acquiredOn,calibration:data.calibration,accuracy:'Outlines and positions from the official cadastral survey (AV). Surfacing, colours and all heights of walls, shelters and small buildings are approximated.'};
  const parcels=(data.parcels||[]).filter(p=>p.rings?.[0]?.length>=3).map(p=>({number:p.number,egrid:p.egrid,area:p.area,rings:p.rings,box:bounds(p.rings[0])}));
  const {appendTriangle}=terrainGeometry(model.terrain,model.halfWidth,model.halfDepth,model.terrain.centerHeight,model.boundary),height=model.height;
  const stats={surfaces:{},areaM2:{},walls:0,shelters:0,smallBuildings:0,paths:0,skippedBasins:0,calibrationRms:data.calibration.rmsMetres};
  function mesh(positions,color,name,role,options={}){
    if(!positions.length)return null;const geometry=new T.BufferGeometry();geometry.setAttribute('position',new T.Float32BufferAttribute(positions,3));
    if(options.drape){const normals=[];for(let i=0;i<positions.length;i+=3){const x=positions[i],z=positions[i+2];normals.push(...new T.Vector3(-(height(x+3,z)-height(x-3,z))/6,1,-(height(x,z+3)-height(x,z-3))/6).normalize().toArray());}geometry.setAttribute('normal',new T.Float32BufferAttribute(normals,3));}else geometry.computeVertexNormals();
    if(options.colours){geometry.setAttribute('color',new T.Float32BufferAttribute(options.colours,3));geometry.setAttribute('aGreen',new T.Float32BufferAttribute(options.green,1));}
    const material=new T.MeshStandardMaterial({color:options.colours&&!options.tint?'#ffffff':color,vertexColors:!!options.colours,roughness:role==='water'?.22:.92,metalness:role==='water'?.15:0,side:options.drape?T.FrontSide:T.DoubleSide,polygonOffset:!!options.drape,polygonOffsetFactor:role==='road'?-1:-2,polygonOffsetUnits:role==='road'?-1:-2});
    const obj=new T.Mesh(geometry,material);obj.name=name;obj.castShadow=!options.drape;obj.receiveShadow=true;obj.userData={kind:'cadastre',role,source:'Amtliche Vermessung',baseColor:color,...options.userData};group.add(obj);return obj;
  }
  const drape=(rings,offset,out)=>{const all=[...rings[0],...rings.slice(1).flat()],triangles=T.ShapeUtils.triangulateShape(rings[0].map(p=>new T.Vector2(p[0],p[1])),rings.slice(1).map(r=>r.map(p=>new T.Vector2(p[0],p[1]))));for(const [a,b,c] of triangles)appendTriangle([all[a],all[b],all[c]],offset,out);};

  // ---- Bodenbedeckung
  model.root.updateMatrixWorld(true);
  const poolBoxes=model.groups.pools.children.filter(o=>o.userData.kind==='pool').map(o=>new T.Box3().setFromObject(o).expandByScalar(1.5));
  const byKind=new Map(),polygons={},paved=Object.fromEntries(['asphalt','kies','platten','unbestimmt'].map(k=>[k,{positions:[],colours:[],green:[]}]));stats.pavedM2={};
  // Unterteilt die Dreiecke einer befestigten Fläche fein und gibt jedem Eckpunkt seinen Grünanteil (0 Belag … 1 Rasen).
  // Farbe und Shader blenden damit weich zwischen Belag und begrüntem Teil, statt an Dreieckskanten zu springen.
  const smooth=(a,b,v)=>{const t=Math.max(0,Math.min(1,(v-a)/(b-a)));return t*t*(3-2*t);},lawnColour=new T.Color(COVERS.begruent.color);
  // Ton je Fläche: Die im Luftbild gemessene mittlere Farbe verschiebt die Belagsfarbe leicht (heller oder dunkler Asphalt, wärmerer Kies).
  // Begrenzt auf −16 % bis +14 % Helligkeit, damit Schatten im Bild keine schwarzen Plätze ergeben.
  const MEDIAN={asphalt:135,kies:138,platten:180},tinted=(cover,image)=>{const base=new T.Color(COVERS[cover].color);if(!image||!MEDIAN[cover])return base;const c=new T.Color(image),l=(.299*c.r+.587*c.g+.114*c.b)*255;if(l<40)return base;
    const k=Math.max(.84,Math.min(1.14,l/MEDIAN[cover])),mean=(c.r+c.g+c.b)/3||1,hue=new T.Color(c.r/mean,c.g/mean,c.b/mean);stats.tintedSurfaces=(stats.tintedSurfaces||0)+1;return base.multiplyScalar(k).multiply(new T.Color(1,1,1).lerp(hue,.3));};
  // Strassen: Die Eckpunktfarbe ist ein Faktor zur Strassenfarbe (1 = mittlerer Asphalt), damit sie in jeder Darstellung mit deren
  // Strassenfarbe zusammenwirkt. Heller oder dunkler Asphalt −12 % bis +12 %, Kies und Grasstreifen weich eingeblendet.
  const road={positions:[],colours:[],green:[]},ROAD_TONE=155,roadBase=new T.Color(SURFACES.Strasse_Weg.color),factor=hex=>{const c=new T.Color(hex);return new T.Color(c.r/roadBase.r,c.g/roadBase.g,c.b/roadBase.b);},GRAVEL=factor('#b9ae93'),GRASS=factor('#7f9a58');stats.roadM2={asphalt:0,kies:0,gras:0};
  function splitRoad(flat,info){
    const k=info?.asphaltTone?Math.max(.88,Math.min(1.12,info.asphaltTone/ROAD_TONE)):1,base=new T.Color(k,k,k),colour=new T.Color();if(info?.asphaltTone)stats.roadsToned=(stats.roadsToned||0)+1;
    const reader=text=>{if(!text)return null;const raw=atob(text),bit=(i,j)=>{i=Math.max(0,Math.min(info.nx-1,i));j=Math.max(0,Math.min(info.nz-1,j));const q=j*info.nx+i;return (raw.charCodeAt(q>>3)&(1<<(q&7)))?1:0;};
      return (x,z)=>{const u=(x-info.x0)/info.step-.5,v=(z-info.z0)/info.step-.5,i=Math.floor(u),j=Math.floor(v),fu=u-i,fv=v-j;return (bit(i,j)*(1-fu)+bit(i+1,j)*fu)*(1-fv)+(bit(i,j+1)*(1-fu)+bit(i+1,j+1)*fu)*fv;};},gravel=reader(info?.kies),grass=reader(info?.gras);
    const emit=(a,b,c)=>{const size=Math.abs((b[0]-a[0])*(c[2]-a[2])-(b[2]-a[2])*(c[0]-a[0]))/2;let q=0,g=0;for(const v of [a,b,c]){const vq=gravel?gravel(v[0],v[2]):0,vg=grass?grass(v[0],v[2]):0;q+=vq/3;g+=vg/3;road.positions.push(v[0],v[1],v[2]);road.green.push(0);colour.copy(base).lerp(GRAVEL,smooth(.35,.65,vq)).lerp(GRASS,smooth(.35,.65,vg));road.colours.push(colour.r,colour.g,colour.b);}
      stats.roadM2.kies+=size*q*(1-g);stats.roadM2.gras+=size*g;stats.roadM2.asphalt+=size*(1-q)*(1-g);};
    const mid=(p,q)=>[(p[0]+q[0])/2,(p[1]+q[1])/2,(p[2]+q[2])/2];
    const divide=(a,b,c,depth)=>{const ab=Math.hypot(b[0]-a[0],b[2]-a[2]),bc=Math.hypot(c[0]-b[0],c[2]-b[2]),ca=Math.hypot(a[0]-c[0],a[2]-c[2]),longest=Math.max(ab,bc,ca);if((!gravel&&!grass)||longest<=2.2||depth>10)return emit(a,b,c);
      if(longest===ab){const m=mid(a,b);divide(a,m,c,depth+1);divide(m,b,c,depth+1);}else if(longest===bc){const m=mid(b,c);divide(a,b,m,depth+1);divide(a,m,c,depth+1);}else{const m=mid(c,a);divide(a,b,m,depth+1);divide(m,b,c,depth+1);}};
    for(let i=0;i<flat.length;i+=9)divide(flat.slice(i,i+3),flat.slice(i+3,i+6),flat.slice(i+6,i+9),0);
  }
  function split(flat,green,cover,image){
    const out=paved[cover],base=tinted(cover,image),colour=new T.Color();
    const emit=(a,b,c)=>{let share=0;for(const v of [a,b,c]){const g=green?green(v[0],v[2]):0;share+=g/3;out.positions.push(v[0],v[1],v[2]);out.green.push(g);colour.copy(base).lerp(lawnColour,smooth(.35,.65,g));out.colours.push(colour.r,colour.g,colour.b);}
      const size=Math.abs((b[0]-a[0])*(c[2]-a[2])-(b[2]-a[2])*(c[0]-a[0]))/2;stats.pavedM2[cover]=(stats.pavedM2[cover]||0)+size*(1-share);stats.pavedM2.begruent=(stats.pavedM2.begruent||0)+size*share;};
    const mid=(p,q)=>[(p[0]+q[0])/2,(p[1]+q[1])/2,(p[2]+q[2])/2];
    const divide=(a,b,c,depth)=>{const ab=Math.hypot(b[0]-a[0],b[2]-a[2]),bc=Math.hypot(c[0]-b[0],c[2]-b[2]),ca=Math.hypot(a[0]-c[0],a[2]-c[2]),longest=Math.max(ab,bc,ca);if(!green||longest<=1.6||depth>9)return emit(a,b,c);
      if(longest===ab){const m=mid(a,b);divide(a,m,c,depth+1);divide(m,b,c,depth+1);}else if(longest===bc){const m=mid(b,c);divide(a,b,m,depth+1);divide(a,m,c,depth+1);}else{const m=mid(c,a);divide(a,b,m,depth+1);divide(m,b,c,depth+1);}};
    for(let i=0;i<flat.length;i+=9)divide(flat.slice(i,i+3),flat.slice(i+3,i+6),flat.slice(i+6,i+9),0);
  }
  for(const [surfaceIndex,s] of data.surfaces.entries()){const style=SURFACES[s.kind];if(!style||s.rings[0].length<3)continue;
    if(s.kind==='Wasserbecken'){const [x,z]=interiorPoint(s.rings);if(poolBoxes.some(b=>x>b.min.x&&x<b.max.x&&z>b.min.z&&z<b.max.z)){stats.skippedBasins++;continue;}}
    let green=null;
    if(s.kind==='uebrige_befestigte'){const m=s.greenMask;
      if(m){const raw=atob(m.bits),bit=(i,j)=>{i=Math.max(0,Math.min(m.nx-1,i));j=Math.max(0,Math.min(m.nz-1,j));const k=j*m.nx+i;return (raw.charCodeAt(k>>3)&(1<<(k&7)))?1:0;};
        green=(x,z)=>{const u=(x-m.x0)/m.step-.5,v=(z-m.z0)/m.step-.5,i=Math.floor(u),j=Math.floor(v),fu=u-i,fv=v-j;return (bit(i,j)*(1-fu)+bit(i+1,j)*fu)*(1-fv)+(bit(i,j+1)*(1-fu)+bit(i+1,j+1)*fu)*fv;};}
      const flat=[];drape(s.rings,style.offset,flat);split(flat,green,COVERS[s.cover]?s.cover:'unbestimmt',s.imageColour);}
    else if(s.kind==='Strasse_Weg'){if(!byKind.has(s.kind))byKind.set(s.kind,[]);const flat=[];drape(s.rings,style.offset,flat);splitRoad(flat,roadData?.surfaces?.[surfaceIndex]);}
    else{if(!byKind.has(s.kind))byKind.set(s.kind,[]);drape(s.rings,style.offset,byKind.get(s.kind));}
    stats.surfaces[s.kind]=(stats.surfaces[s.kind]||0)+1;stats.areaM2[s.kind]=Math.round((stats.areaM2[s.kind]||0)+area(s.rings[0])-s.rings.slice(1).reduce((sum,h)=>sum+area(h),0));
    (polygons[style.role]||(polygons[style.role]=[])).push({rings:s.rings,box:bounds(s.rings[0]),green});}
  for(const [cover,part] of Object.entries(paved)){const style=COVERS[cover];mesh(part.positions,style.color,style.name,style.role,{drape:true,colours:part.colours,green:part.green,userData:{avKind:'uebrige_befestigte',cover,label:style.label,accuracy:'Outline from AV; surfacing and green parts estimated from aerial image colour.'}});}
  for(const key of Object.keys(stats.pavedM2))stats.pavedM2[key]=Math.round(stats.pavedM2[key]);
  {const style=SURFACES.Strasse_Weg;mesh(road.positions,style.color,style.name,style.role,{drape:true,tint:true,colours:road.colours,green:road.green,userData:{avKind:'Strasse_Weg',label:style.label,accuracy:roadData?'Outline from AV; asphalt tone, gravel and grass parts estimated from aerial image colour.':undefined}});for(const key of Object.keys(stats.roadM2))stats.roadM2[key]=Math.round(stats.roadM2[key]);}
  for(const [kind,positions] of byKind){const style=SURFACES[kind];mesh(positions,style.color,style.name,style.role,{drape:true,userData:{avKind:kind,label:style.label}});}

  // ---- Schmale Wege (Linien) als 1,2 m breite Bänder
  const pathPositions=[];for(const path of data.paths.filter(p=>p.kind==='schmaler_Weg'))for(let i=0;i<path.points.length-1;i++){const a=path.points[i],b=path.points[i+1],len=Math.hypot(b[0]-a[0],b[1]-a[1]);if(len<.05)continue;const nx=-(b[1]-a[1])/len*.6,nz=(b[0]-a[0])/len*.6;
    appendTriangle([[a[0]+nx,a[1]+nz],[a[0]-nx,a[1]-nz],[b[0]+nx,b[1]+nz]],.09,pathPositions);appendTriangle([[a[0]-nx,a[1]-nz],[b[0]-nx,b[1]-nz],[b[0]+nx,b[1]+nz]],.09,pathPositions);stats.paths+=len;}
  stats.paths=Math.round(stats.paths);mesh(pathPositions,'#b5a98c','AV_Schmale_Wege','walk',{drape:true,userData:{avKind:'schmaler_Weg',label:'Schmale Wege'}});

  // ---- Körper: Mauern, Unterstände, Kleinbauten
  // Prisma über einem Umriss: Deckfläche auf Höhe y1, Seiten bis y0 (oder ohne y0 bis leicht unter das Gelände).
  const ground=rings=>Math.max(...rings[0].map(p=>height(p[0],p[1])));
  function prism(rings,y0,y1,out){
    for(const ring of rings)for(let i=0;i<ring.length;i++){const a=ring[i],b=ring[(i+1)%ring.length],ya=y0??height(a[0],a[1])-.3,yb=y0??height(b[0],b[1])-.3;out.push(a[0],ya,a[1],b[0],yb,b[1],b[0],y1,b[1],a[0],ya,a[1],b[0],y1,b[1],a[0],y1,a[1]);}
    // Die Dreieckszerlegung füllt bei schmalen, gewundenen Umrissen (Mauer um den oberen Friedhof) vereinzelt eine Fläche ausserhalb des Umrisses.
    // Deshalb wird die Dreiecksfläche mit der Fläche des Umrisses verglichen und bei Abweichung mit anderem Anfangspunkt neu zerlegt.
    const ringArea=r=>{let a=0;for(let i=0,j=r.length-1;i<r.length;j=i++)a+=(r[j][0]+r[i][0])*(r[j][1]-r[i][1]);return Math.abs(a/2);},wanted=ringArea(rings[0])-rings.slice(1).reduce((sum,r)=>sum+ringArea(r),0),holes=rings.slice(1).map(r=>r.map(p=>new T.Vector2(p[0],p[1])));
    let best=null;for(let turn=0;turn<6;turn++){const k=Math.floor(rings[0].length*turn/6),outer=turn?[...rings[0].slice(k),...rings[0].slice(0,k)]:rings[0],all=[...outer,...rings.slice(1).flat()],triangles=T.ShapeUtils.triangulateShape(outer.map(p=>new T.Vector2(p[0],p[1])),holes);
      let sum=0;for(const [a,b,c] of triangles)sum+=Math.abs((all[b][0]-all[a][0])*(all[c][1]-all[a][1])-(all[b][1]-all[a][1])*(all[c][0]-all[a][0]))/2;const error=Math.abs(sum-wanted);if(!best||error<best.error)best={all,triangles,error};if(error<=Math.max(.05,wanted*.02))break;}
    for(const [a,b,c] of best.triangles)for(const k of [a,c,b])out.push(best.all[k][0],y1,best.all[k][1]);
  }
  const square=(x,z,r)=>[[[x-r,z-r],[x+r,z-r],[x+r,z+r],[x-r,z+r]]];
  const inMunicipality=rings=>model.boundary.contains(interiorPoint(rings));
  const walls=[];for(const o of data.objects.filter(o=>o.kind==='Mauer'&&o.rings[0].length>=3)){if(!inMunicipality(o.rings))continue;prism(o.rings,null,ground(o.rings)+.9,walls);stats.walls++;}
  for(const path of data.paths.filter(p=>p.kind==='Mauer'))for(let i=0;i<path.points.length-1;i++){const a=path.points[i],b=path.points[i+1],len=Math.hypot(b[0]-a[0],b[1]-a[1]);if(len<.2||!model.boundary.contains(a))continue;const nx=-(b[1]-a[1])/len*.15,nz=(b[0]-a[0])/len*.15,rings=[[[a[0]+nx,a[1]+nz],[b[0]+nx,b[1]+nz],[b[0]-nx,b[1]-nz],[a[0]-nx,a[1]-nz]]];prism(rings,null,ground(rings)+.9,walls);stats.walls++;}
  mesh(walls,'#b9b2a2','AV_Mauern','wall',{userData:{avKind:'Mauer',label:'Mauern',accuracy:'Wall outline from AV; height of 0.9 m assumed.'}});
  // Steht an dieser Stelle bereits ein Gebäude des 3D-Modells? (Strahl von oben auf die Gebäudegeometrie)
  const ray=new T.Raycaster(),down=new T.Vector3(0,-1,0),buildingBoxes=model.buildingMeshes.map(o=>({o,box:new T.Box3().setFromObject(o)}));
  const hit=([x,z])=>{ray.set(new T.Vector3(x,400,z),down);return buildingBoxes.some(({o,box})=>x>=box.min.x&&x<=box.max.x&&z>=box.min.z&&z<=box.max.z&&ray.intersectObject(o,false).length>0);};
  // Mehrere Punkte im Umriss prüfen und nach Mehrheit entscheiden (robust bei Dachvorsprüngen und Anbauten).
  const covered=rings=>{const c=interiorPoint(rings),ring=rings[0],step=Math.max(1,Math.floor(ring.length/6)),samples=[c];for(let i=0;i<ring.length;i+=step)samples.push([(c[0]+ring[i][0])/2,(c[1]+ring[i][1])/2]);return samples.filter(hit).length*2>=samples.length;};
  const roofs=[],posts=[];const waitingRoom=model.world?.station?.shelter?.point; // dieser Unterstand ist als verglaster Warteraum ausgearbeitet (station-details.js) und wird hier nicht nochmals gezeichnet
  for(const o of data.objects.filter(o=>o.kind==='Unterstand'&&o.rings[0].length>=3)){if(!inMunicipality(o.rings)||covered(o.rings))continue;if(waitingRoom){const c=interiorPoint(o.rings);if(Math.hypot(c[0]-waitingRoom[0],c[1]-waitingRoom[1])<2.5){stats.sheltersDetailed=(stats.sheltersDetailed||0)+1;continue;}}
    const top=ground(o.rings)+2.5,ring=o.rings[0],centre=interiorPoint(o.rings),step=Math.max(1,Math.ceil(ring.length/6));prism(o.rings,top-.16,top,roofs);
    for(let i=0;i<ring.length;i+=step){const [x,z]=ring[i],dx=centre[0]-x,dz=centre[1]-z,l=Math.hypot(dx,dz)||1;prism(square(x+dx/l*.25,z+dz/l*.25,.07),null,top-.16,posts);}
    stats.shelters++;}
  mesh(roofs,'#8d8a82','AV_Unterstaende_Daecher','roof',{userData:{avKind:'Unterstand',label:'Unterstände',accuracy:'Shelter outline from AV; roof height of 2.5 m and posts assumed.'}});
  mesh(posts,'#6f6a60','AV_Unterstaende_Stuetzen','wall',{userData:{avKind:'Unterstand'}});
  const small=[],smallRoofs=[],footprints=[];for(const s of data.surfaces.filter(s=>s.kind==='Gebaeude'&&s.rings[0].length>=3)){footprints.push({rings:s.rings,box:bounds(s.rings[0])});if(!inMunicipality(s.rings)||covered(s.rings))continue;
    const top=ground(s.rings)+2.7;prism(s.rings,null,top,small);prism(s.rings.slice(0,1),top,top+.12,smallRoofs);stats.smallBuildings++;}
  mesh(small,'#ddd3bb','AV_Kleinbauten','wall',{userData:{avKind:'Gebaeude',label:'Kleinbauten ohne 3D-Modell',accuracy:'Footprint from AV; building missing in swissBUILDINGS3D. Height of 2.7 m and flat roof assumed.'}});
  mesh(smallRoofs,'#7d7468','AV_Kleinbauten_Daecher','roof',{userData:{avKind:'Gebaeude'}});

  // ---- Gebäudeteile: Vordächer und Podeste. Umriss aus AV-Linien, Höhe aus Laserdaten (tools/sample-building-parts.mjs).
  // Teile, über denen bereits das Dach des 3D-Gebäudes liegt, werden nicht doppelt gezeichnet.
  const canopies=[],platforms=[];Object.assign(stats,{canopies:0,platforms:0,partsUnderRoof:0});
  for(const part of data.buildingParts||[]){if(!inMunicipality(part.rings))continue;if(covered(part.rings)){stats.partsUnderRoof++;continue;}
    if(part.kind==='Vordach'){const top=ground(part.rings)+part.height;prism(part.rings,top-.14,top,canopies);stats.canopies++;}else{prism(part.rings,null,ground(part.rings)+part.height,platforms);stats.platforms++;}}
  mesh(canopies,'#8d8a82','AV_Vordaecher','roof',{userData:{avKind:'uebriger_Gebaeudeteil',label:'Vordächer',accuracy:'Outline from AV lines closed along the building footprint; height from swisstopo lidar where plausible, otherwise 2.6 m assumed. The survey does not state the type of building part.'}});
  mesh(platforms,'#bdb6a6','AV_Podeste','wall',{userData:{avKind:'uebriger_Gebaeudeteil',label:'Podeste (Treppe, Rampe oder Terrasse)',accuracy:'Outline from AV lines; height from swisstopo lidar. Steps and railings are not surveyed.'}});

  // ---- Hochspannungsleitung: Maststandorte und Leitungsachse aus der AV. Masthöhe (28 m), Mastform, Zahl der Seile und Durchhang sind angenommen.
  const MAST_HEIGHT=28,powerLine=data.paths.find(p=>p.kind==='Hochspannungsfreileitung'),mastPoints=data.points.filter(p=>p.kind==='Mast_Antenne'&&model.boundary.contains(p.point)),mastPositions=[],wirePositions=[];Object.assign(stats,{masts:0,polesOffLine:0,powerLineMetres:0});
  const beam=(a,b,w,out)=>{const d=new T.Vector3().subVectors(b,a),len=d.length();if(len<.01)return;const m=new T.Matrix4().makeRotationFromQuaternion(new T.Quaternion().setFromUnitVectors(new T.Vector3(0,1,0),d.normalize()));m.setPosition(a.clone().add(b).multiplyScalar(.5));const g=new T.BoxGeometry(w,len,w).toNonIndexed().applyMatrix4(m);out.push(...g.getAttribute('position').array);g.dispose();};
  const ARMS=[[-6.5,.70],[6.5,.70],[-4.8,.84],[4.8,.84],[0,1]],onLine=new Set();
  if(powerLine){const pts=powerLine.points,supports=pts.map((p,i)=>{const a=pts[Math.max(0,i-1)],b=pts[Math.min(pts.length-1,i+1)],l=Math.hypot(b[0]-a[0],b[1]-a[1])||1,dir=[(b[0]-a[0])/l,(b[1]-a[1])/l],mast=mastPoints.find(m=>Math.hypot(m.point[0]-p[0],m.point[1]-p[1])<3),H=mast?.height||MAST_HEIGHT,y=height(p[0],p[1]);if(mast)onLine.add(mast);
      return {p,mast,H,y,normal:[-dir[1],dir[0]],dir,attach:ARMS.map(([s,f])=>new T.Vector3(p[0]-dir[1]*s,y+H*f-(f<1?1.3:0),p[1]+dir[0]*s))};});
    for(const s of supports){if(!s.mast)continue;stats.masts++;const [x,z]=s.p,at=(u,v,f,half)=>new T.Vector3(x+s.normal[0]*u*half+s.dir[0]*v*half,s.y+s.H*f,z+s.normal[1]*u*half+s.dir[1]*v*half),half=f=>2.6-(2.6-.45)*Math.min(1,f/.9),corners=[[-1,-1],[1,-1],[1,1],[-1,1]];
      // Gittermast vereinfacht: vier Eckstiele, Querriegel und Diagonalen, Spitze, zwei Traversen
      for(const [u,v] of corners){beam(at(u,v,-.01,2.6),at(u,v,.9,.45),.22,mastPositions);beam(at(u,v,.9,.45),at(0,0,1,0),.16,mastPositions);}
      const levels=[0,.2,.4,.58,.74,.9];for(let k=1;k<levels.length;k++)for(let c=0;c<4;c++){const [u0,v0]=corners[c],[u1,v1]=corners[(c+1)%4],f0=levels[k-1],f1=levels[k];beam(at(u0,v0,f1,half(f1)),at(u1,v1,f1,half(f1)),.1,mastPositions);beam(at(u0,v0,f0,half(f0)),at(u1,v1,f1,half(f1)),.08,mastPositions);}
      for(const [side,f] of ARMS.slice(0,4)){const tip=new T.Vector3(x+s.normal[0]*side,s.y+s.H*f,z+s.normal[1]*side),axis=new T.Vector3(x,s.y+s.H*f,z);beam(axis,tip,.26,mastPositions);beam(new T.Vector3(x,s.y+s.H*(f+.07),z),tip,.12,mastPositions);beam(tip,tip.clone().setY(tip.y-1.3),.1,mastPositions);}}
    // Seile mit Durchhang; über die Gemeindegrenze hinaus wird nicht gezeichnet.
    for(let i=0;i<supports.length-1;i++){const A=supports[i],B=supports[i+1],span=Math.hypot(B.p[0]-A.p[0],B.p[1]-A.p[1]),sag=span*.028,steps=14,insideAt=t=>model.boundary.contains([A.p[0]+(B.p[0]-A.p[0])*t,A.p[1]+(B.p[1]-A.p[1])*t]);
      for(let k=0;k<steps;k++){const t0=k/steps,t1=(k+1)/steps;if(insideAt(t0)&&insideAt(t1))stats.powerLineMetres+=span/steps;
        A.attach.forEach((a,w)=>{const b=B.attach[w],point=t=>new T.Vector3().lerpVectors(a,b,t).setY(a.y+(b.y-a.y)*t-sag*4*t*(1-t));const p0=point(t0),p1=point(t1);if(model.boundary.contains([p0.x,p0.z])&&model.boundary.contains([p1.x,p1.z]))beam(p0,p1,w===4?.1:.14,wirePositions);});}}
    stats.powerLineMetres=Math.round(stats.powerLineMetres);}
  // Masten abseits der Leitung (Antennen, einzelne Masten): schlichter Mast von 12 m
  for(const m of mastPoints){if(onLine.has(m))continue;const [x,z]=m.point,y=height(x,z);beam(new T.Vector3(x,y-.2,z),new T.Vector3(x,y+12,z),.3,mastPositions);stats.polesOffLine++;}
  mesh(mastPositions,'#8f969b','AV_Hochspannungsmasten','mast',{userData:{avKind:'Mast_Antenne',label:'Hochspannungsmasten',accuracy:'Mast positions from AV. Height of 28 m, lattice shape and crossarms assumed (masts are filtered out of the lidar surface model).'}});
  mesh(wirePositions,'#5b6066','AV_Hochspannungsleitung','wire',{userData:{avKind:'Hochspannungsfreileitung',label:'Hochspannungsleitung',accuracy:'Line axis from AV. Number of conductors, attachment heights and sag assumed.'}});

  // ---- Liegenschaftsgrenzen: eigene Ebene, anfangs ausgeblendet. Bänder folgen dem Gelände; gemeinsame Grenzen werden nur einmal gezeichnet.
  // (Bänder statt Linien: Linien sind im Browser immer nur einen Bildpunkt breit und kaum zu sehen.)
  const ribbon=(a,b,width,lift,out)=>{const len=Math.hypot(b[0]-a[0],b[1]-a[1]);if(len<.05)return;const n=Math.max(1,Math.ceil(len/5)),nx=-(b[1]-a[1])/len*width/2,nz=(b[0]-a[0])/len*width/2;
    for(let k=0;k<n;k++){const x0=a[0]+(b[0]-a[0])*k/n,z0=a[1]+(b[1]-a[1])*k/n,x1=a[0]+(b[0]-a[0])*(k+1)/n,z1=a[1]+(b[1]-a[1])*(k+1)/n,y0=height(x0,z0)+lift,y1=height(x1,z1)+lift;out.push(x0+nx,y0,z0+nz,x0-nx,y0,z0-nz,x1+nx,y1,z1+nz,x0-nx,y0,z0-nz,x1-nx,y1,z1-nz,x1+nx,y1,z1+nz);}};
  const ribbonMesh=(positions,color,name)=>{const geometry=new T.BufferGeometry();geometry.setAttribute('position',new T.Float32BufferAttribute(positions,3));const obj=new T.Mesh(geometry,new T.MeshBasicMaterial({color,side:T.DoubleSide,polygonOffset:true,polygonOffsetFactor:-4,polygonOffsetUnits:-4}));obj.name=name;return obj;};
  {const seen=new Set(),positions=[];for(const parcel of parcels)for(const ring of parcel.rings)for(let i=0;i<ring.length;i++){const a=ring[i],b=ring[(i+1)%ring.length],ka=a[0].toFixed(1)+','+a[1].toFixed(1),kb=b[0].toFixed(1)+','+b[1].toFixed(1);if(ka===kb)continue;const key=ka<kb?ka+'|'+kb:kb+'|'+ka;if(seen.has(key))continue;seen.add(key);ribbon(a,b,.4,.3,positions);}
    const lines=ribbonMesh(positions,'#c2255c','AV_Liegenschaftsgrenzen');lines.userData={kind:'parcels',source:'Amtliche Vermessung',label:'Liegenschaftsgrenzen',accuracy:'Parcel boundaries from the official cadastral survey; shown for orientation, not legally binding. Line width of 0.4 m is a drawing choice.'};parcelGroup.add(lines);stats.parcels=parcels.length;stats.parcelEdges=seen.size;}
  // Umriss einer einzelnen Liegenschaft zum Hervorheben
  const parcelOutline=parcel=>{const positions=[];for(const ring of parcel.rings)for(let i=0;i<ring.length;i++)ribbon(ring[i],ring[(i+1)%ring.length],1.1,.38,positions);return ribbonMesh(positions,'#f2c14e','Liegenschaft_Auswahl');};

  // Solange die vermessenen Strassenflächen sichtbar sind, treten die aus Achsen erzeugten Asphaltbänder zurück.
  const any=(role,p)=>(polygons[role]||[]).some(poly=>inside(p,poly));
  const ribbons=model.groups.roads.children.filter(o=>['Asphaltflächen','Strassenränder'].includes(o.name)),hasRoads=byKind.has('Strasse_Weg');
  // Unbefestigte Wege und Gleisbett des Modells bleiben, ausser dort, wo die Vermessung eine Strasse, einen Platz oder ein Trottoir kennt.
  const tracks=model.groups.roads.children.find(o=>o.name==='Wege_und_Gleisbett');
  if(tracks&&hasRoads){const p=tracks.geometry.getAttribute('position'),keep=[];for(let i=0;i<p.count;i+=3){const c=[(p.getX(i)+p.getX(i+1)+p.getX(i+2))/3,(p.getZ(i)+p.getZ(i+1)+p.getZ(i+2))/3];if(any('road',c)||any('walk',c)||(polygons.paved||[]).some(poly=>inside(c,poly)&&!(poly.green&&poly.green(c[0],c[1])>.5)))continue;for(let k=i;k<i+3;k++)keep.push(p.getX(k),p.getY(k),p.getZ(k));}
    mesh(keep,'#'+tracks.material.color.getHexString(),'Wege_und_Gleisbett_neben_vermessenen_Flaechen','path',{drape:true,userData:{label:'Unbefestigte Wege und Gleisbett',source:'swisstopo-Vektordaten, auf vermessene Flächen zugeschnitten'}});ribbons.push(tracks);}
  const sync=()=>{for(const o of ribbons)o.visible=!(hasRoads&&group.visible);};sync();
  model.stats.cadastre=stats;
  model.cadastre={group,stats,sync,source:data.source,acquiredOn:data.acquiredOn,polygons,footprints,
    inGarden:(x,z)=>any('garden',[x,z]),inGreen:(x,z)=>any('garden',[x,z])||any('green',[x,z])||(polygons.paved||[]).some(poly=>poly.green&&inside([x,z],poly)&&poly.green(x,z)>.5),
    vegetation:data.vegetation||null,imagery:data.imagery||null,parcels:parcelGroup,parcelOutline,parcelAt:(x,z)=>parcels.find(p=>inside([x,z],p))||null,
    onHard:(x,z)=>(polygons.paved||[]).some(poly=>inside([x,z],poly)&&!(poly.green&&poly.green(x,z)>.5))||any('road',[x,z])||any('walk',[x,z])||any('rail',[x,z])||any('water',[x,z]),
    inFootprint:(x,z,margin=0)=>footprints.some(f=>x>=f.box.minX-margin&&x<=f.box.maxX+margin&&z>=f.box.minZ-margin&&z<=f.box.maxZ+margin&&(margin>0||inside([x,z],f)))};
  return model.cadastre;
}
