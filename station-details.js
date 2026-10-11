// All visible station details are meshes; aerial references are never textures.
import * as T from 'three';
export function buildStationDetails({data,stats,height,surface,mesh,geometry,material,group,roadSegments,box,beam,line,queue,mats,pois}){
 const station=data.station,yard=data.workyard;if(!station||!yard)return null;
 const steel=material('#a4aca7',{metalness:.65,roughness:.42}),blue=material('#245d88'),glass=material('#b3ccc6',{transparent:true,opacity:.32,roughness:.18,metalness:.06,depthWrite:false,side:T.DoubleSide});
 const rails=roadSegments.filter(s=>s.type==='rail');
 function railHeight(p){let best=Infinity,h=height(...p);for(const s of rails){const dx=s.b[0]-s.a[0],dz=s.b[1]-s.a[1],t=T.MathUtils.clamp(((p[0]-s.a[0])*dx+(p[1]-s.a[1])*dz)/(dx*dx+dz*dz),0,1),q=[s.a[0]+dx*t,s.a[1]+dz*t],d=Math.hypot(p[0]-q[0],p[1]-q[1]);if(d<best){best=d;h=height(...q);}}return h;}
 const [a,b,c,d]=station.platform,lerp=(a,b,t)=>a.map((v,k)=>T.MathUtils.lerp(v,b[k],t)),mid=(a,b)=>lerp(a,b,.5),length=Math.hypot(d[0]-a[0],d[1]-a[1]),steps=Math.ceil(length/1.5),positions=[],sides=[],warning=[],tactile=[];
 const point=(p,y)=>[p[0],y,p[1]],quad=(out,a,b,c,d)=>out.push(...a,...c,...b,...c,...d,...b);
 for(let i=0;i<steps;i++){const l0=lerp(a,d,i/steps),l1=lerp(a,d,(i+1)/steps),r0=lerp(b,c,i/steps),r1=lerp(b,c,(i+1)/steps),y0=railHeight(mid(l0,r0))+.65,y1=railHeight(mid(l1,r1))+.65;
  quad(positions,point(l0,y0),point(r0,y0),point(l1,y1),point(r1,y1));
  for(const [p,q]of [[l0,l1],[r1,r0]])quad(sides,point(p,p===l0?y0:y1),point(q,q===l1?y1:y0),point(p,Math.min(height(...p),y0-.12)),point(q,Math.min(height(...q),y1-.12)));
  quad(warning,point(lerp(l0,r0,.18),y0+.012),point(lerp(l0,r0,.21),y0+.012),point(lerp(l1,r1,.18),y1+.012),point(lerp(l1,r1,.21),y1+.012));
  quad(tactile,point(lerp(l0,r0,.07),y0+.009),point(lerp(l0,r0,.15),y0+.009),point(lerp(l1,r1,.07),y1+.009),point(lerp(l1,r1,.15),y1+.009));
 }
 const forecourt=surface(station.forecourt,mats.paving,group,.16,'Bahnhof_Vorplatz');forecourt.mesh.userData={kind:'place',placeId:'station',accuracy:station.source};
 const perron=mesh(geometry(positions),material('#a19f92',{side:T.DoubleSide}),group,'Bahnhof_Perron');perron.userData={kind:'place',placeId:'station',accuracy:station.source};mesh(geometry(sides),material('#b5b0a0',{side:T.DoubleSide}),group,'Perronkante');mesh(geometry(warning),mats.white,group,'Perron_Sicherheitslinie');mesh(geometry(tactile),material('#c5c3b7'),group,'Perron_Taststreifen');
 // The hut replaces the residential interpretation of the measured shelter building.
 const shelter=station.shelter,[sx,sz]=shelter.point,angle=shelter.angle,sy=height(sx,sz)+.18,[w,depth]=shelter.size;
 const p=(x,y,z)=>[sx+Math.cos(angle)*x+Math.sin(angle)*z,sy+y,sz-Math.sin(angle)*x+Math.cos(angle)*z];
 box('Wartehaeuschen_Boden',mats.paving,p(0,.06,0),[w+.3,.12,depth+.3],angle);box('Wartehaeuschen_Dach',steel,p(0,2.78,0),[w+.5,.15,depth+.5],angle);
 for(const z of [-depth/2-.18,depth/2+.18]){box('Wartehaeuschen_Dachabschluss',steel,p(0,2.72,z),[w+.5,.13,.09],angle);beam('Wartehaeuschen_Dachrinne',steel,p(-w/2-.1,2.65,z),p(w/2+.1,2.65,z),.045);}
 for(let x=-w/2;x<w/2;x+=.22)box('Wartehaeuschen_Dachfalze',steel,p(x,2.866,0),[.016,.024,depth+.4],angle);
 beam('Wartehaeuschen_Regenablauf',steel,p(w/2-.04,.08,depth/2+.12),p(w/2-.04,2.67,depth/2+.12),.027);
 for(const x of [-w/2,w/2])for(const z of [-depth/2,depth/2])box('Wartehaeuschen_Stahlstuetzen',steel,p(x,1.4,z),[.09,2.8,.09],angle);
 box('Wartehaeuschen_Glasrueckwand',glass,p(0,1.45,depth/2),[w,2.4,.035],angle);for(const x of [-w/2,w/2])box('Wartehaeuschen_Glasseiten',glass,p(x,1.45,0),[.035,2.4,depth],angle);
 for(const x of [-w/4,0,w/4])box('Wartehaeuschen_Glasrahmen',steel,p(x,1.4,depth/2),[.035,2.65,.055],angle);
 for(const y of [.22,2.64])box('Wartehaeuschen_Rahmen',steel,p(0,y,depth/2),[w,.05,.06],angle);
 for(let k=0;k<5;k++)box('Bahnhof_Banklatten',mats.wood,p(-.5,.5,.7+k*.085),[2.4,.06,.075],angle);
 for(let k=0;k<3;k++)box('Bahnhof_Banklehne',mats.wood,p(-.5,.72+k*.11,1.12),[2.4,.08,.055],angle);
 for(const x of [-1.4,.4])box('Bahnhof_Bankfuesse',steel,p(x,.25,.87),[.07,.5,.5],angle);
 box('Bahnhof_Informationstafel',blue,p(1.9,1.5,depth/2-.05),[.7,1,.075],angle);box('Bahnhof_Fahrplan',mats.white,p(1.9,1.5,depth/2-.1),[.55,.82,.018],angle);
 for(let k=0;k<8;k++)box('Bahnhof_Fahrplanzeilen',mats.metal,p(1.9,1.8-k*.08,depth/2-.115),[.43,.012,.01],angle);
 // Mesh lettering keeps the no-image-textures promise, including on collection bins.
 const glyphs={F:['11111','10000','10000','11110','10000','10000','10000'],R:['11110','10001','10001','11110','10100','10010','10001'],A:['01110','10001','10001','11111','10001','10001','10001'],E:['11111','10000','10000','11110','10000','10000','11111'],S:['01111','10000','10000','01110','00001','00001','11110'],C:['01111','10000','10000','10000','10000','10000','01111'],H:['10001','10001','10001','11111','10001','10001','10001'],L:['10000','10000','10000','10000','10000','10000','11111'],U:['10001','10001','10001','10001','10001','10001','01110'],G:['01111','10000','10000','10111','10001','10001','01111'],K:['10001','10010','10100','11000','10100','10010','10001'],I:['11111','00100','00100','00100','00100','00100','11111'],D:['11110','10001','10001','10001','10001','10001','11110']};
 function text(word,toPoint,unit=.035){let col=-(word.length*6-1)*unit/2;for(const letter of word){const glyph=glyphs[letter];for(let row=0;row<7;row++)for(let k=0;k<5;k++)if(glyph?.[row][k]==='1')box('Beschriftung_'+word,mats.white,toPoint(-(col+k*unit),(3-row)*unit,0),[unit*.8,unit*.8,.016],angle);col+=6*unit;}}
 box('Bahnhof_Stationsschild',blue,p(0,2.23,-depth/2-.04),[3,.49,.06],angle);text('FRASCHELS',(x,y)=>p(x,2.23+y,-depth/2-.083),.041);for(const x of [.48,.55])box('Stationsschild_Umlaut',mats.white,p(x,2.42,-depth/2-.083),[.027,.027,.016],angle);
 for(const t of [.12,.34,.62,.88]){const q=lerp(b,c,t),y=railHeight(q)+.65;beam('Bahnhof_Perronlampen',steel,[q[0],y,q[1]],[q[0],y+4.8,q[1]],.045);box('Bahnhof_Lampenkopf',steel,[q[0],y+4.8,q[1]],[.46,.14,.2],angle);box('Bahnhof_Lampenglas',mats.white,[q[0],y+4.72,q[1]],[.4,.025,.16],angle);}
 const base=surface(yard.points,mats.gravel,group,.095,'Werkhof_Bahnhof_Kiesplatz');base.mesh.userData={kind:'place',placeId:'workyard',accuracy:yard.source};
 for(const item of yard.containers){const [x,z]=item.point,[cw,ch,cd]=item.size,y=height(x,z)+.12,local=(dx,dy,dz)=>[x+Math.cos(angle)*dx+Math.sin(angle)*dz,y+dy,z-Math.sin(angle)*dx+Math.cos(angle)*dz],name=item.type==='alu'?'ALU':item.type==='glass'?'GLAS':'KLEIDER';
  const paint=item.type==='alu'?blue:item.type==='glass'?material('#597147'):steel;
  if(item.type==='glass'){queue('round',paint,'Altglas_Sammelbehaelter',x,y+ch*.53,z,cw/2,ch*.53,cd/2,angle);box('Altglas_Einwurf',mats.rubber,local(0,ch*.82,-cd*.35),[.29,.25,.04],angle);}
  else{box(item.type==='alu'?'Alu_Sammelcontainer':'Altkleider_Container',paint,local(0,ch/2,0),[cw,ch,cd],angle);box(name+'_Deckel',steel,local(0,ch+.03,0),[cw+.06,.06,cd+.06],angle);box(name+'_Einwurf',mats.rubber,local(0,ch*.77,-cd/2-.022),[cw*.6,.16,.035],angle);for(const dx of [-cw/2,cw/2])for(const dz of [-cd/2,cd/2])box(name+'_Eckprofile',steel,local(dx,ch/2,dz),[.045,ch,.045],angle);if(item.type==='alu')for(let k=0;k<13;k++)box('Alu_Container_Sicken',steel,local(cw/2+.025,ch*.46,-cd*.43+k*cd*.86/12),[.028,ch*.72,.034],angle);}
  text(name,(dx,dy)=>local(dx,ch*.46+dy,-cd/2-.055),name==='KLEIDER'?.025:.035);
 }
 stats.stationPlatforms=1;stats.stationShelters=1;stats.stationLights=4;stats.stationBenches=1;stats.collectionContainers=yard.containers.length;stats.workyards=1;
 pois.push({id:'station',name:'Bahnhof Fr\u00e4schels',x:sx,z:sz,cameraOffset:[-32,24,-26],description:'Perron entlang des Gleises mit Sicherheitslinie, Warteh\u00e4uschen, Sitzbank, Stationsschild und Informationstafel.',note:'Perronumriss und Geb\u00e4udeposition aus Geodaten. Ausgestaltung, Ausstattung und H\u00f6hen angen\u00e4hert.'});
 pois.push({id:'workyard',name:yard.name,x:yard.focus[0],z:yard.focus[1],cameraOffset:[-23,19,-20],description:'Kiesplatz n\u00f6rdlich des Bahnhofs mit Alu-Sammelcontainer sowie Altglas- und Altkleidersammlung.',note:'Lage und Sammelarten durch Einwohner best\u00e4tigt; Fl\u00e4che aus Luftbild nachgezeichnet. Beh\u00e4ltergestaltung und H\u00f6hen angen\u00e4hert.'});
 return {forecourt:station.forecourt,platform:station.platform,shelter:station.shelter,workyard:yard,platformLength:length,railHeight};
}
