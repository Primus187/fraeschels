// Tagesablauf im Dorf: Autos, Bahnpendler zu Fuss und mit dem Velo sowie Velofahrer nach der dargestellten Uhrzeit.
// Der meiste Verkehr ist Durchgangsverkehr auf der Hauptstrasse – Autos, tagsüber einige Lastwagen und in der warmen Jahreszeit
// bei trockenem Wetter Motorräder; in den Quartieren fahren nur einzelne Autos.
// Fräschels ist ein Wohndorf: Am Morgen fahren die Autos von den Häusern weg und die Pendler gehen zum Bahnhof,
// über Mittag und am Abend kommen sie zurück. Tagsüber stehen die meisten Vorplätze leer, nachts sind sie voll.
// Wohnhäuser, Adressen und Wohnungszahl stammen aus dem Gebäuderegister, Strassen und Wege aus dem Modell.
// Alles andere ist Gestaltung: wer wann fährt, wie viele Autos ein Haus hat, wo sie stehen, der Durchgangsverkehr
// und die Dichte des Verkehrs, die zur Lesbarkeit höher ist als in Wirklichkeit. Es sind keine Zähl- oder Live-Daten.
import * as T from 'three';

const CAR_COLOURS=['#e9e7e0','#c9ccce','#2b3136','#7d858a','#35506b','#8f2f32','#3f5a45','#d8d2c2','#1f2326','#5b6f84'];
const COAT_COLOURS=['#637c82','#a2634c','#837a58','#3f4f66','#7a3f4a','#4f6b52','#8a8f96','#b08a4a','#2f3a44','#6a5a7a'];
export function mulberry(seed){let a=seed>>>0;return ()=>{a=a+0x6D2B79F5|0;let t=Math.imul(a^a>>>15,1|a);t=t+Math.imul(t^t>>>7,61|t)^t;return ((t^t>>>14)>>>0)/4294967296;};}
const pointIn=(p,ring)=>{let yes=false;for(let i=0,j=ring.length-1;i<ring.length;j=i++){const a=ring[i],b=ring[j];if((a[1]>p[1])!==(b[1]>p[1])&&p[0]<(b[0]-a[0])*(p[1]-a[1])/(b[1]-a[1])+a[0])yes=!yes;}return yes;};

// Zusammengesetzte Geometrie aus Quadern, mit Farbe je Teil. Weisse Teile nehmen die Farbe der einzelnen Instanz an.
export function boxes(parts){const position=[],normal=[],colour=[];for(const [w,h,d,x,y,z,hex,scale=1] of parts){const g=new T.BoxGeometry(w,h,d).toNonIndexed();g.translate(x,y,z);const c=new T.Color(hex).multiplyScalar(scale);position.push(...g.getAttribute('position').array);normal.push(...g.getAttribute('normal').array);for(let i=0;i<g.getAttribute('position').count;i++)colour.push(c.r,c.g,c.b);g.dispose();}
  const out=new T.BufferGeometry();out.setAttribute('position',new T.Float32BufferAttribute(position,3));out.setAttribute('normal',new T.Float32BufferAttribute(normal,3));out.setAttribute('color',new T.Float32BufferAttribute(colour,3));return out;}

// Abwesenheiten eines Autos bzw. einer Person in Minuten des Tages; u, v, w sind feste Zufallszahlen 0…1.
export function carSchedule(u,v,w){
  const tri=(a,b)=>a+(b-a)*(v+w)/2; // um die Mitte gehäuft
  if(u<.36){const leave=tri(345,510),back=tri(975,1155);return v<.3?[[leave,715+w*30],[780+w*30,back]]:[[leave,back]];} // Pendler, ein Teil kommt über Mittag heim
  if(u<.43)return [[435+v*60,705+w*45]];                                                                             // Teilzeit, Schule: vormittags weg
  if(u<.52)return [[510+v*120,840+w*480]];                                                                           // unregelmässig
  return v<.45?[[570+w*90,620+w*90]]:[];                                                                              // meist zu Hause, allenfalls eine Besorgung
}
export function walkerSchedule(u,v,w){
  if(u<.7)return [[350+(v+w)/2*140,990+(v*.6+w*.4)*180]];   // Bahnpendler: morgens weg, abends zurück
  return v<.5?[[410+w*50,710+v*50]]:[[410+w*50,710+v*50],[790+w*20,960+v*60]]; // Schule, Teilzeit: mittags heim, teils nachmittags nochmals
}
// Anteil der Motorräder am Durchgangsverkehr: im Winter keine, ab März zunehmend, von Mai bis September am meisten; nur am Tag und bei trockenem Wetter.
export function motorcycleShare(day,minute=720,wet=false){if(wet||minute<420||minute>1260)return 0;const season=day<60||day>320?0:day<130?(day-60)/70:day<=270?1:(320-day)/50;return .12*season;}
// Anteil der Lastwagen: werktags tagsüber, nachts kaum
export const truckShare=minute=>minute>=330&&minute<=1140?.1:.02;
export const isAway=(intervals,minute)=>intervals.some(([a,b])=>minute>=a&&minute<b);
// Nächster Wechsel (weg ↔ da) nach der Minute, als fortlaufende Minutenzahl; Infinity, wenn es heute keinen mehr gibt.
const nextChange=(intervals,minute)=>{let best=Infinity;for(const [a,b] of intervals)for(const t of [a,b])if(t>minute&&t<best)best=t;return best;};

export async function buildDailyLife(model){
  const register=await fetch('data/gwr.json').then(r=>r.ok?r.json():null).catch(()=>null),community=await fetch('data/community.json').then(r=>r.ok?r.json():null).catch(()=>null);
  if(!register){model.daily=null;return null;}
  const height=model.height,inside=p=>model.boundary.contains(p),rand=mulberry(20261009),group=new T.Group();group.name='Tagesablauf';
  group.userData={accuracy:'Illustrative daily routine: cars, rail commuters on foot and cyclists follow a made-up schedule on the model road network. Not traffic counts or live data.'};model.groups.life.add(group);

  // ---- Wegnetz aus den Strassenachsen des Modells
  const key=p=>Math.round(p[0]*2)+','+Math.round(p[1]*2),nodes=[],index=new Map();
  const node=p=>{const k=key(p);if(!index.has(k)){index.set(k,nodes.length);nodes.push({p:[p[0],p[1]],edges:[],inside:inside(p)});}return index.get(k);};
  for(const s of model.roadSegments){if(s.type==='rail')continue;const a=node(s.a),b=node(s.b),len=Math.hypot(s.b[0]-s.a[0],s.b[1]-s.a[1]);if(a===b||len<.05)continue;nodes[a].edges.push({to:b,len,type:s.type,width:s.width});nodes[b].edges.push({to:a,len,type:s.type,width:s.width});}
  // Die Achse der Hauptstrasse ist in den Vektordaten an einer Kachelgrenze nicht verbunden: zwei Stücke überlappen sich um rund 26 m, ohne
  // gemeinsamen Punkt. Jedes lose Ende wird deshalb mit dem nächstgelegenen Punkt des anderen Stücks verbunden (nicht Ende mit Ende, sonst
  // führe man ein Stück zurück). Ohne diese Verbindung müsste aller Verkehr dort über Nebenstrassen ausweichen.
  {const isMain=e=>e.type==='secondary',loose=nodes.map((n,i)=>i).filter(i=>nodes[i].edges.filter(isMain).length===1),onMain=nodes.map((n,i)=>i).filter(i=>nodes[i].edges.some(isMain));
    for(const end of loose){const own=new Map([[end,0]]),queue=[end];while(queue.length){const u=queue.shift();for(const e of nodes[u].edges)if(isMain(e)&&!own.has(e.to)&&own.get(u)+e.len<90){own.set(e.to,own.get(u)+e.len);queue.push(e.to);}}
      let best=-1,d=45;for(const i of onMain){if(own.has(i))continue;const q=Math.hypot(nodes[i].p[0]-nodes[end].p[0],nodes[i].p[1]-nodes[end].p[1]);if(q<d){d=q;best=i;}}
      if(best>=0&&!nodes[end].edges.some(e=>e.to===best)){nodes[end].edges.push({to:best,len:Math.max(d,.1),type:'secondary',width:6.2,bridged:true});nodes[best].edges.push({to:end,len:Math.max(d,.1),type:'secondary',width:6.2,bridged:true});}}}
  const CAR_COST={secondary:1,primary:1,tertiary:1.1,minor:1.6,track:5},FOOT_COST={footway:.8,path:.9,minor:1,track:1,secondary:1.15,primary:1.3,tertiary:1.1};
  // Kürzeste Wege zu einem Ziel: von jedem Knoten der nächste Schritt (O(n²) genügt bei rund 1500 Knoten)
  function tree(target,cost){const n=nodes.length,dist=new Float64Array(n).fill(Infinity),next=new Int32Array(n).fill(-1),via=new Array(n),done=new Uint8Array(n);dist[target]=0;
    for(;;){let u=-1,best=Infinity;for(let i=0;i<n;i++)if(!done[i]&&dist[i]<best){best=dist[i];u=i;}if(u<0)break;done[u]=1;for(const e of nodes[u].edges){const c=cost[e.type];if(!c)continue;const d=dist[u]+e.len*c;if(d<dist[e.to]){dist[e.to]=d;next[e.to]=u;via[e.to]=e;}}}return {dist,next,via};}
  // Weg als Folge von Stützpunkten mit Strassenart je Abschnitt
  // Innerorts: wo Gebäude dicht stehen. Auf der Hauptstrasse gilt dort Tempo 50, ausserhalb 80; der Dorfeingang ist die Stelle,
  // an der die Bebauung beginnt (aus den Gebäudeadressen erschlossen, nicht die vermessene Lage der Ortstafel).
  const addresses=Object.values(register.buildings).filter(b=>b.addresses.length).map(b=>[b.addresses[0].x,b.addresses[0].z]),builtUp=p=>{let n=0;for(const a of addresses)if(Math.abs(a[0]-p[0])<110&&Math.abs(a[1]-p[1])<110&&Math.hypot(a[0]-p[0],a[1]-p[1])<110&&++n>=3)return true;return false;};
  const MAIN={secondary:1,primary:1,tertiary:1},KMH=1/3.6,LIMIT={drive:10*KMH,track:16*KMH,minor:36*KMH,path:14*KMH,footway:14*KMH}; // Quartierstrassen: gefahrenes Tempo, nicht das signalisierte
  // Fertiger Weg aus Stützpunkten: Ecken werden zu Bögen ausgerundet (radius in m), dazu Richtung je Stützpunkt und Tempo je Abschnitt.
  function finish(source,sourceKinds,sourceWidths,radius){const pts=[source[0]],kinds=[],widths=[];
    for(let i=1;i<source.length;i++){const B=source[i],A=pts.at(-1),kind=sourceKinds[i-1],width=sourceWidths[i-1];
      if(radius>0&&i<source.length-1){const C=source[i+1],l1=Math.hypot(B[0]-A[0],B[1]-A[1]),l2=Math.hypot(C[0]-B[0],C[1]-B[1]);if(l1>.4&&l2>.4){const u1=[(B[0]-A[0])/l1,(B[1]-A[1])/l1],u2=[(C[0]-B[0])/l2,(C[1]-B[1])/l2],angle=Math.acos(Math.max(-1,Math.min(1,u1[0]*u2[0]+u1[1]*u2[1])));
          if(angle>.14){const d=Math.min(l1*.46,l2*.46,radius*Math.tan(Math.min(angle,2.6)/2)),P1=[B[0]-u1[0]*d,B[1]-u1[1]*d],P2=[B[0]+u2[0]*d,B[1]+u2[1]*d],steps=Math.max(2,Math.ceil(angle/.17));pts.push(P1);kinds.push(kind);widths.push(width);
            for(let k=1;k<=steps;k++){const t=k/steps,q=1-t;pts.push([q*q*P1[0]+2*q*t*B[0]+t*t*P2[0],q*q*P1[1]+2*q*t*B[1]+t*t*P2[1]]);kinds.push(t<=.5?kind:sourceKinds[i]);widths.push(t<=.5?width:sourceWidths[i]);}continue;}}}
      pts.push(B);kinds.push(kind);widths.push(width);}
    const n=pts.length,cum=[0],dir=[];for(let i=1;i<n;i++){const len=Math.hypot(pts[i][0]-pts[i-1][0],pts[i][1]-pts[i-1][1]);cum.push(cum[i-1]+len);dir.push(len>1e-6?[(pts[i][0]-pts[i-1][0])/len,(pts[i][1]-pts[i-1][1])/len]:dir.at(-1)||[1,0]);}
    const tan=pts.map((_,i)=>{const a=dir[Math.max(0,i-1)]||[1,0],b=dir[Math.min(dir.length-1,i)]||a,x=a[0]+b[0],z=a[1]+b[1],l=Math.hypot(x,z);return l>1e-6?[x/l,z/l]:b;});
    // Tempo: Hauptstrasse 50 innerorts (zwischen dem ersten und letzten bebauten Punkt dieses Wegs), 80 ausserorts; Kurven nach Querbeschleunigung
    const main=kinds.map(k=>!!MAIN[k]),urban=pts.map(builtUp);let first=-1,last=-1;for(let i=0;i<n-1;i++)if(main[i]&&(urban[i]||urban[i+1])){if(first<0)first=i;last=i;}
    const seglim=kinds.map((k,i)=>MAIN[k]?(i>=first&&i<=last?50:80)*KMH:LIMIT[k]||30*KMH),vlim=pts.map((_,i)=>{let v=Math.min(seglim[Math.max(0,i-1)]??99,seglim[Math.min(n-2,i)]??99);if(i>0&&i<n-1){const a=dir[i-1],b=dir[i],angle=Math.acos(Math.max(-1,Math.min(1,a[0]*b[0]+a[1]*b[1])));if(angle>.02){const R=Math.min(cum[i]-cum[i-1],cum[i+1]-cum[i])/angle;v=Math.min(v,Math.sqrt(2.3*R));}}return Math.max(1.6,v);});
    return {pts,kinds,widths,cum,tan,seglim,vlim,main,zone:[first,last],total:cum.at(-1)};}
  // Weg entlang des Netzes. Ein Start- oder Zielpunkt abseits der Strasse (Abstellplatz, Haustür, Perron) wird am nächstgelegenen Punkt der
  // ersten bzw. letzten Wegstücke angeschlossen – so biegt man in Fahrtrichtung ein, statt erst zum Netzknoten zu fahren und dort zu wenden.
  const foot=(p,a,b)=>{const dx=b[0]-a[0],dz=b[1]-a[1],t=Math.max(0,Math.min(1,((p[0]-a[0])*dx+(p[1]-a[1])*dz)/(dx*dx+dz*dz||1))),q=[a[0]+dx*t,a[1]+dz*t];return {q,d:Math.hypot(p[0]-q[0],p[1]-q[1])};};
  function route(from,t,extraStart=[],extraEnd=[],radius=6){if(!Number.isFinite(t.dist[from]))return null;let pts=[nodes[from].p],kinds=[],widths=[],u=from;
    while(t.next[u]>=0){const e=t.via[u];u=t.next[u];kinds.push(e.type);widths.push(e.width);pts.push(nodes[u].p);}
    if(extraStart.length&&pts.length>1){const S=extraStart.at(-1);let best=null;for(let k=0;k<Math.min(4,pts.length-1);k++){const f=foot(S,pts[k],pts[k+1]);if(!best||f.d<best.d)best={...f,k};}
      pts=[best.q,...pts.slice(best.k+1)];kinds=kinds.slice(best.k);widths=widths.slice(best.k);if(pts.length>1&&Math.hypot(pts[0][0]-pts[1][0],pts[0][1]-pts[1][1])<.4){pts.shift();kinds.shift();widths.shift();}}
    if(extraEnd.length&&pts.length>1){const E=extraEnd[0],n=pts.length;let best=null;for(let k=n-2;k>=Math.max(0,n-5);k--){const f=foot(E,pts[k],pts[k+1]);if(!best||f.d<best.d)best={...f,k};}
      pts=[...pts.slice(0,best.k+1),best.q];kinds=kinds.slice(0,best.k+1);widths=widths.slice(0,best.k+1);const m=pts.length;if(m>1&&Math.hypot(pts[m-1][0]-pts[m-2][0],pts[m-1][1]-pts[m-2][1])<.4){pts.pop();kinds.pop();widths.pop();}}
    pts=[...extraStart.map(p=>[...p]),...pts,...extraEnd.map(p=>[...p])];kinds=[...extraStart.map(()=>'drive'),...kinds,...extraEnd.map(()=>'drive')];widths=[...extraStart.map(()=>3),...widths,...extraEnd.map(()=>3)];
    return pts.length>1?finish(pts,kinds,widths,radius):null;}
  const reversed=r=>finish([...r.pts].reverse(),[...r.kinds].reverse(),[...r.widths].reverse(),0);
  // Höchsttempo an jedem Stützpunkt, so dass vor Kurven, tieferen Limiten und am Ziel rechtzeitig gebremst wird (Verzögerung brake, Zieltempo endSpeed)
  function speedCaps(r,pace,brake,endSpeed){const n=r.pts.length,caps=new Float32Array(n);caps[n-1]=Math.min(r.vlim[n-1]*pace,endSpeed);for(let i=n-2;i>=0;i--)caps[i]=Math.min(r.vlim[i]*pace,Math.sqrt(caps[i+1]*caps[i+1]+2*brake*(r.cum[i+1]-r.cum[i])));return caps;}
  // Ort und Fahrtrichtung nach einer Strecke s; side verschiebt nach rechts (Rechtsverkehr, Gehen am Strassenrand). Richtung und Versatz gehen
  // zwischen den Stützpunkten stetig ineinander über, damit nichts ruckt.
  function along(r,s,agent,side){let i=agent.seg||0;if(i>r.cum.length-2||s<r.cum[i])i=0;while(i<r.cum.length-2&&s>r.cum[i+1])i++;agent.seg=i;const a=r.pts[i],b=r.pts[i+1],len=r.cum[i+1]-r.cum[i]||1,t=Math.max(0,Math.min(1,(s-r.cum[i])/len));
    const ta=r.tan[i],tb=r.tan[i+1];let dx=ta[0]+(tb[0]-ta[0])*t,dz=ta[1]+(tb[1]-ta[1])*t;const l=Math.hypot(dx,dz)||1;dx/=l;dz/=l;
    // seitlicher Versatz je Stützpunkt, über rund 7 m Weg geglättet: so schert man sanft auf die Fahrspur ein statt zur Seite zu springen
    if(!r.offsets)r.offsets=new Map();let offs=r.offsets.get(side);if(!offs){const n=r.pts.length,seg=j=>r.kinds[j]==='drive'?0:side(r.kinds[j],r.widths[j]),raw=r.pts.map((_,j)=>(seg(Math.max(0,j-1))+seg(Math.min(n-2,j)))/2);
      offs=raw.map((_,j)=>{let sum=0,weight=0;for(let k=j;k>=0&&r.cum[j]-r.cum[k]<=7;k--){const w=1-(r.cum[j]-r.cum[k])/7.5;sum+=raw[k]*w;weight+=w;}for(let k=j+1;k<n&&r.cum[k]-r.cum[j]<=7;k++){const w=1-(r.cum[k]-r.cum[j])/7.5;sum+=raw[k]*w;weight+=w;}return sum/weight;});r.offsets.set(side,offs);}
    const off=offs[i]*(1-t)+offs[i+1]*t;
    return {x:a[0]+(b[0]-a[0])*t-dz*off,z:a[1]+(b[1]-a[1])*t+dx*off,dx,dz,kind:r.kinds[i],limit:r.seglim[i]};}
  const nearest=(p,allowed,limit=140)=>{let best=-1,d=limit;for(let i=0;i<nodes.length;i++){const n=nodes[i];if(!n.edges.some(e=>allowed[e.type]))continue;const q=Math.hypot(n.p[0]-p[0],n.p[1]-p[1]);if(q<d){d=q;best=i;}}return best;};

  // Ausfahrten: wo eine Strasse die Gemeinde verlässt. Die Hauptstrasse zählt mehrfach.
  const exits=[];nodes.forEach((n,i)=>{if(n.inside)return;for(const e of n.edges)if(nodes[e.to].inside&&e.type!=='track'&&CAR_COST[e.type]){const weight=e.type==='minor'?1:6;const near=exits.find(x=>Math.hypot(nodes[x.node].p[0]-n.p[0],nodes[x.node].p[1]-n.p[1])<60);if(near){if(weight>near.weight){near.node=i;near.weight=weight;}}else exits.push({node:i,weight});}});
  for(const x of exits)x.tree=tree(x.node,CAR_COST);
  // Durchgangsverkehr fährt ausschliesslich auf der Hauptstrasse: eigene kürzeste Wege nur über diese Strassenart
  for(const x of exits)if(x.weight>1)x.mainTree=tree(x.node,MAIN);
  const through=exits.filter(x=>x.weight>1),pickExit=()=>{let total=0;for(const x of exits)total+=x.weight;let r=rand()*total;for(const x of exits){r-=x.weight;if(r<=0)return x;}return exits[0];};

  // Signale «50» an den beiden Dorfeingängen der Hauptstrasse (rechts in Fahrtrichtung ins Dorf); Standort wie oben erschlossen
  const entrances=[];let mainRoad=null;if(through.length>=2){const r=route(through[0].node,through[1].mainTree,[],[],9);mainRoad=r;if(r&&r.zone[0]>=0){const canvas=document.createElement('canvas');canvas.width=canvas.height=128;const c=canvas.getContext('2d');c.fillStyle='#ffffff';c.beginPath();c.arc(64,64,62,0,Math.PI*2);c.fill();c.strokeStyle='#d0121a';c.lineWidth=16;c.beginPath();c.arc(64,64,52,0,Math.PI*2);c.stroke();c.fillStyle='#111111';c.font='bold 60px Arial, sans-serif';c.textAlign='center';c.textBaseline='middle';c.fillText('50',64,68);
      const texture=new T.CanvasTexture(canvas);texture.colorSpace=T.SRGBColorSpace;const signs=new T.Group();signs.name='Signale_50_Dorfeingang';signs.userData={accuracy:'Speed signs where the built-up area begins along the main road; position inferred from building addresses, not surveyed.'};model.groups.world.add(signs);
      for(const [index,inward] of [[r.zone[0],1],[r.zone[1]+1,-1]]){const p=r.pts[index],t=r.tan[index],d=[t[0]*inward,t[1]*inward],x=p[0]-d[1]*4.4,z=p[1]+d[0]*4.4,y=height(x,z);entrances.push([+p[0].toFixed(1),+p[1].toFixed(1)]);
        const post=new T.Mesh(new T.CylinderGeometry(.04,.04,2.6,8),new T.MeshStandardMaterial({color:'#8d9595',roughness:.5}));post.position.set(x,y+1.3,z);post.castShadow=true;signs.add(post);
        const disc=new T.Mesh(new T.CircleGeometry(.36,24),new T.MeshStandardMaterial({map:texture,roughness:.6,side:T.DoubleSide}));disc.position.set(x-d[0]*.05,y+2.45,z-d[1]*.05);disc.rotation.y=Math.atan2(-d[0],-d[1]);disc.name='Signal_50';signs.add(disc);}}}

  // ---- Bahnhof: Wartepunkte auf dem Perron
  const platform=model.world.station.platform,pA=[(platform[0][0]+platform[1][0])/2,(platform[0][1]+platform[1][1])/2],pB=[(platform[2][0]+platform[3][0])/2,(platform[2][1]+platform[3][1])/2],onPlatform=u=>[pA[0]+(pB[0]-pA[0])*u,pA[1]+(pB[1]-pA[1])*u];
  // Ein- und ausgestiegen wird nur auf der Perronseite (Seite Gemeindehaus, Angabe des Auftraggebers): Der Zugang zum Perron beginnt an einem
  // Wegknoten auf dieser Gleisseite, nie am Feldweg auf der Seite der Gewächshäuser.
  const rails=model.roadSegments.filter(s=>s.type==='rail'),railSide=p=>{let side=0,best=1e9;for(const s of rails){const dx=s.b[0]-s.a[0],dz=s.b[1]-s.a[1],l2=dx*dx+dz*dz||1,t=Math.max(0,Math.min(1,((p[0]-s.a[0])*dx+(p[1]-s.a[1])*dz)/l2)),d=Math.hypot(p[0]-s.a[0]-t*dx,p[1]-s.a[1]-t*dz);if(d<best){best=d;side=(dx*(p[1]-s.a[1])-dz*(p[0]-s.a[0]))/Math.sqrt(l2);}}return side;},platformSide=Math.sign(railSide(onPlatform(.5)))||1;
  const stationNode=(()=>{const c=onPlatform(.5);let best=-1,d=400;nodes.forEach((n,i)=>{if(!n.edges.some(e=>FOOT_COST[e.type])||railSide(n.p)*platformSide<1)return;const q=Math.hypot(n.p[0]-c[0],n.p[1]-c[1]);if(q<d){d=q;best=i;}});return best>=0?best:nearest(c,FOOT_COST,400);})(),stationTree=stationNode>=0?tree(stationNode,FOOT_COST):null;

  // ---- Wohnhäuser, Autos und Bahnpendler
  const paved=(model.cadastre?.polygons.paved||[]),isPaved=(x,z)=>paved.some(poly=>x>=poly.box.minX&&x<=poly.box.maxX&&z>=poly.box.minZ&&z<=poly.box.maxZ&&pointIn([x,z],poly.rings[0])&&!poly.rings.slice(1).some(h=>pointIn([x,z],h))&&!(poly.green&&poly.green(x,z)>.5));
  const footprint=(x,z,m)=>model.cadastre?model.cadastre.inFootprint(x,z,m):false,taken=[],cars=[],walkers=[],homes=[];
  const stats={villageEntrances:entrances,homes:0,cars:0,carsWithoutForecourt:0,walkers:0,exits:exits.length,throughExits:through.length};
  for(const [egid,b] of Object.entries(register.buildings)){if(![1020,1030,1040].includes(b.category)||!b.addresses.length)continue;const at=[b.addresses[0].x,b.addresses[0].z];if(!inside(at))continue;
    const carNode=nearest(at,CAR_COST),footNode=nearest(at,FOOT_COST);if(carNode<0)continue;const home={egid:Number(egid),at,carNode,footNode,label:b.addresses[0].label};homes.push(home);stats.homes++;
    const dwellings=Math.max(1,Math.min(6,b.dwellings||1)),wanted=Math.min(3,dwellings+(rand()<.35?1:0)),toRoad=Math.atan2(nodes[carNode].p[0]-at[0],nodes[carNode].p[1]-at[1]);
    for(let c=0;c<wanted;c++){let spot=null;
      // Abstellplatz: befestigte Fläche in der Nähe des Eingangs, nicht im Gebäude und nicht auf einem anderen Auto
      search:for(let r=3;r<=17;r+=1.5)for(let k=0;k<14;k++){const a=toRoad+(k%2?1:-1)*Math.ceil(k/2)*Math.PI/7,x=at[0]+Math.sin(a)*r,z=at[1]+Math.cos(a)*r;if(isPaved(x,z)&&!footprint(x,z,1.4)&&!taken.some(t=>Math.hypot(t[0]-x,t[1]-z)<3.1)){spot=[x,z];break search;}}
      if(!spot){stats.carsWithoutForecourt++;continue;}taken.push(spot);
      cars.push({home,spot,angle:Math.atan2(at[0]-spot[0],at[1]-spot[1])+(rand()-.5)*.5,intervals:carSchedule(rand(),rand(),rand()),colour:CAR_COLOURS[Math.floor(rand()*CAR_COLOURS.length)],away:false,trip:null,hold:-Infinity});}
    // Bahnpendler: ein Teil der Haushalte in Gehdistanz zum Bahnhof
    if(stationTree&&footNode>=0&&stationTree.dist[footNode]<1300)for(let d=0;d<dwellings;d++)if(rand()<.3)walkers.push({home,intervals:walkerSchedule(rand(),rand(),rand()),colour:COAT_COLOURS[Math.floor(rand()*COAT_COLOURS.length)],state:'home',trip:null,hold:-Infinity,pace:1.25+rand()*.3,slot:.12+rand()*.76,phase:rand()*6.28,bike:stationTree.dist[footNode]>220&&rand()<.38});}
  const bikers=walkers.filter(w=>w.bike);stats.cars=cars.length;stats.walkers=walkers.length;stats.bikeCommuters=bikers.length;

  // ---- Darstellung: je Art ein einziger Aufruf
  const THROUGH=64,CYCLISTS=10,dummy=new T.Object3D(),hidden=new T.Matrix4().compose(new T.Vector3(0,-400,0),new T.Quaternion(),new T.Vector3(1e-4,1e-4,1e-4)) /* ausgeblendet: winzig und tief unter dem Gelände – Grösse null ergäbe im GLB-Export ungültige Drehwerte */,tint=new T.Color();
  const carGeometry=boxes([[1.74,.62,4.25,0,.62,0,'#ffffff'],[1.56,.5,2.25,0,1.16,-.2,'#ffffff',.9],[1.5,.36,2.05,0,1.17,-.2,'#1d2a30'],[1.62,.12,.5,0,.45,2.0,'#2a2d2e'],[1.62,.12,.5,0,.45,-2.0,'#2a2d2e'],
    ...[[-.82,1.32],[.82,1.32],[-.82,-1.32],[.82,-1.32]].map(([x,z])=>[.22,.62,.62,x,.31,z,'#1b1d1e'])]);
  const instanced=(geometry,count,name,material)=>{const m=new T.InstancedMesh(geometry,material||new T.MeshStandardMaterial({color:'#ffffff',vertexColors:true,roughness:.55,metalness:.15}),count);m.name=name;m.castShadow=true;m.receiveShadow=true;m.frustumCulled=false;for(let i=0;i<count;i++){m.setMatrixAt(i,hidden);m.setColorAt(i,tint.set('#ffffff'));}group.add(m);return m;};
  const carMesh=instanced(carGeometry,cars.length+THROUGH,'Autos');cars.forEach((c,i)=>{c.slot=i;carMesh.setColorAt(i,tint.set(c.colour));});
  // Scheinwerfer und Rücklichter leuchten selbst; ein heller Fleck vor dem Auto deutet den Lichtkegel an.
  const lightGeometry=(()=>{const g=boxes([[.3,.14,.06,-.6,.72,2.14,'#fff4d6',3],[.3,.14,.06,.6,.72,2.14,'#fff4d6',3],[.3,.12,.06,-.62,.78,-2.14,'#ff2a1a',2.2],[.3,.12,.06,.62,.78,-2.14,'#ff2a1a',2.2]]);
    const p=[...g.getAttribute('position').array],c=[...g.getAttribute('color').array],fan=[[-.8,.06,2.3,.5],[.8,.06,2.3,.5],[2.6,.06,11,0],[-.8,.06,2.3,.5],[2.6,.06,11,0],[-2.6,.06,11,0]];for(const [x,y,z,s] of fan){p.push(x,y,z);c.push(s,s*.93,s*.75);}
    const out=new T.BufferGeometry();out.setAttribute('position',new T.Float32BufferAttribute(p,3));out.setAttribute('color',new T.Float32BufferAttribute(c,3));return out;})();
  const LIGHTS=80,lightMesh=instanced(lightGeometry,LIGHTS,'Auto_Scheinwerfer',new T.MeshBasicMaterial({vertexColors:true,transparent:true,blending:T.AdditiveBlending,depthWrite:false,toneMapped:false,side:T.DoubleSide}));lightMesh.castShadow=false;lightMesh.receiveShadow=false;lightMesh.visible=false;
  const bodyGeometry=new T.CapsuleGeometry(.2,.95,3,8);bodyGeometry.translate(0,.9,0);const headGeometry=new T.SphereGeometry(.15,10,8);headGeometry.translate(0,1.66,0);
  const plain=()=>new T.MeshStandardMaterial({color:'#ffffff',roughness:1}),WALKERS=Math.min(64,Math.max(8,walkers.length)),bodyMesh=instanced(bodyGeometry,WALKERS+CYCLISTS,'Pendler_Koerper',plain()),headMesh=instanced(headGeometry,WALKERS+CYCLISTS,'Pendler_Koepfe',new T.MeshStandardMaterial({color:'#c79e7c',roughness:1}));
  // Velo: Rahmen aus Quadern, Räder als schmale Scheiben
  const bikeGeometry=(()=>{const frame=boxes([[.05,.07,1.05,0,.62,0,'#ffffff'],[.05,.5,.07,0,.85,-.25,'#ffffff'],[.42,.05,.06,0,1.02,.42,'#22262a'],[.05,.42,.06,0,.84,.44,'#ffffff']]),position=[...frame.getAttribute('position').array],normal=[...frame.getAttribute('normal').array],colour=[...frame.getAttribute('color').array];
    for(const z of [.52,-.52]){const wheel=new T.CylinderGeometry(.33,.33,.05,14).toNonIndexed();wheel.rotateZ(Math.PI/2);wheel.translate(0,.34,z);position.push(...wheel.getAttribute('position').array);normal.push(...wheel.getAttribute('normal').array);for(let i=0;i<wheel.getAttribute('position').count;i++)colour.push(.02,.025,.03);wheel.dispose();}
    const out=new T.BufferGeometry();out.setAttribute('position',new T.Float32BufferAttribute(position,3));out.setAttribute('normal',new T.Float32BufferAttribute(normal,3));out.setAttribute('color',new T.Float32BufferAttribute(colour,3));return out;})();
  const bikeMesh=instanced(bikeGeometry,CYCLISTS+bikers.length,'Velos');
  // Lastwagen (Kabine und Kastenaufbau) und Motorräder mit Fahrer für den Durchgangsverkehr; Formen und Farben frei gestaltet
  const TRUCKS=10,MOTOS=10,truckMesh=instanced(boxes([[2.4,2.5,2.1,0,1.75,3.55,'#ffffff',.92],[2.2,.9,.1,0,2.2,4.62,'#1d2a30'],[2.5,2.8,6.6,0,2.15,-.95,'#ffffff'],[2.3,.5,8.8,0,.75,-.1,'#2a2d2e'],
    ...[[-1.08,3.3],[1.08,3.3],[-1.08,-2.2],[1.08,-2.2],[-1.08,-3.4],[1.08,-3.4]].map(([x,z])=>[.36,1,1,x,.5,z,'#1b1d1e'])]),TRUCKS,'Lastwagen');
  const motoMesh=instanced((()=>{const frame=boxes([[.22,.3,1.1,0,.62,0,'#ffffff'],[.3,.22,.5,0,.86,.18,'#ffffff'],[.5,.06,.08,0,1.05,.52,'#22262a'],[.36,.55,.3,0,1.25,-.12,'#2a2d31'],[.3,.26,.3,0,1.68,-.06,'#d8d8d2'],[.16,.5,.2,-.13,.78,-.05,'#2a2d31'],[.16,.5,.2,.13,.78,-.05,'#2a2d31']]),position=[...frame.getAttribute('position').array],normal=[...frame.getAttribute('normal').array],colour=[...frame.getAttribute('color').array];
    for(const z of [.72,-.72]){const wheel=new T.CylinderGeometry(.32,.32,.13,14).toNonIndexed();wheel.rotateZ(Math.PI/2);wheel.translate(0,.32,z);position.push(...wheel.getAttribute('position').array);normal.push(...wheel.getAttribute('normal').array);for(let i=0;i<wheel.getAttribute('position').count;i++)colour.push(.02,.025,.03);wheel.dispose();}
    const out=new T.BufferGeometry();out.setAttribute('position',new T.Float32BufferAttribute(position,3));out.setAttribute('normal',new T.Float32BufferAttribute(normal,3));out.setAttribute('color',new T.Float32BufferAttribute(colour,3));return out;})(),MOTOS,'Motorraeder');
  const TRUCK_COLOURS=['#e9e7e0','#d8d2c2','#35506b','#3f5a45','#8f2f32','#c9a02c','#7d858a'],MOTO_COLOURS=['#8f2f32','#1f2326','#35506b','#c9a02c','#e9e7e0','#3f5a45'];
  // Velopendler: jedes Velo hat seinen festen Platz im vermessenen Velounterstand am Perron (zwei Reihen quer zum Dach); fehlt die Angabe, beim Vorplatz
  {const len=Math.hypot(pB[0]-pA[0],pB[1]-pA[1]),u=[(pB[0]-pA[0])/len,(pB[1]-pA[1])/len],n=[-u[1],u[0]],shed=community?.station?.bikes,yard=model.world.station.forecourt;
    const base=shed?[shed.x,shed.z]:Array.isArray(yard)&&yard.length>=3?[yard.reduce((s,p)=>s+p[0],0)/yard.length,yard.reduce((s,p)=>s+p[1],0)/yard.length]:onPlatform(.04),along=shed?shed.ring.map(p=>p[0]*u[0]+p[1]*u[1]):null,across=shed?shed.ring.map(p=>p[0]*n[0]+p[1]*n[1]):null;
    const length=shed?Math.max(...along)-Math.min(...along)-.6:bikers.length*.65,depth=shed?Math.max(...across)-Math.min(...across):0,perRow=Math.max(1,Math.ceil(bikers.length/2)),gap=Math.min(.65,length/Math.max(1,perRow-1||1));
    bikers.forEach((w,i)=>{const row=shed?(i%2?1:-1):0,k=shed?Math.floor(i/2):i,count=shed?perRow:bikers.length,a=(k-(count-1)/2)*gap;w.bikeSlot=CYCLISTS+i;w.rack=[base[0]+u[0]*a+n[0]*row*depth*.22,base[1]+u[1]*a+n[1]*row*depth*.22,Math.atan2(n[0],n[1])+(row>0?Math.PI:0)];w.pace=4.2+rand()*1.2;bikeMesh.setColorAt(w.bikeSlot,tint.set(COAT_COLOURS[i%COAT_COLOURS.length]));});}
  // ---- Ablauf
  let minutes=420,total=420,season=180,wet=false,lamps=false,carTimer=0,throughTimer=3,cycleTimer=8,trainWasOpen=false,service=true;
  const active={cars:new Set(),through:[],walkers:new Set(),cyclists:[]},freeThrough=[...Array(THROUGH).keys()].map(i=>cars.length+i),freeTrucks=[...Array(TRUCKS).keys()],freeMotos=[...Array(MOTOS).keys()],freeBodies=[...Array(WALKERS+CYCLISTS).keys()],freeBikes=[...Array(CYCLISTS).keys()];
  const lane=(kind,width)=>kind==='track'?.15:Math.min(1.55,width*.24),kerb=(kind,width)=>kind==='path'||kind==='footway'?0:width*.5+.7,bikeLane=(kind,width)=>kind==='path'||kind==='footway'?.2:Math.max(.5,width*.36);
  // Fahrverhalten je Fahrzeugart: Anteil am erlaubten Tempo, Beschleunigung und Verzögerung in m/s², Länge für den Abstand
  const DRIVE={car:{pace:1,accel:1.9,brake:2.4,length:4.3},truck:{pace:.86,accel:.85,brake:1.8,length:9.5},moto:{pace:1.04,accel:2.8,brake:2.8,length:2.2}};
  const place=(mesh,slot,x,z,angle,lift=0,pitch=0)=>{dummy.position.set(x,height(x,z)+lift,z);dummy.rotation.set(pitch,angle,0,'YXZ');dummy.scale.setScalar(1);dummy.updateMatrix();mesh.setMatrixAt(slot,dummy.matrix);};
  const park=c=>{if(c.away)carMesh.setMatrixAt(c.slot,hidden);else place(carMesh,c.slot,c.spot[0],c.spot[1],c.angle,.02);};
  function carRoute(c,outbound){const exit=pickExit(),r=route(c.home.carNode,exit.tree,[c.spot],[],6);if(!r)return null;return outbound?r:reversed(r);}
  const begin=(r,kind,endSpeed,standing)=>{const d=DRIVE[kind],caps=speedCaps(r,d.pace,d.brake,endSpeed);return {r,s:0,v:standing?0:caps[0],seg:0,caps,kind,...d};};
  function startCar(c,outbound){const r=carRoute(c,outbound);if(!r){c.away=outbound;park(c);return false;}c.trip={...begin(r,'car',outbound?99:.7,outbound),outbound};active.cars.add(c);return true;}
  function startThrough(){if(through.length<2||!freeThrough.length)return;const a=through[Math.floor(rand()*through.length)];let b=a;for(let k=0;k<6&&b===a;k++)b=through[Math.floor(rand()*through.length)];if(b===a)return;const r=route(a.node,b.mainTree,[],[],9);if(!r||r.total<80)return;
    // Fahrzeugart: meist Autos, tagsüber einige Lastwagen, in der warmen Jahreszeit Motorräder
    const pick=rand(),moto=motorcycleShare(season,minutes,wet),lorry=truckShare(minutes),kind=pick<moto&&freeMotos.length?'moto':pick<moto+lorry&&freeTrucks.length?'truck':'car';
    // nicht in ein Fahrzeug hinein starten, das eben erst in dieselbe Richtung losgefahren ist
    const way=a.node+'>'+b.node;if(active.through.some(t=>t.lane===way&&t.trip.s<DRIVE[kind].length+14))return;
    const mesh=kind==='moto'?motoMesh:kind==='truck'?truckMesh:carMesh,pool=kind==='moto'?freeMotos:kind==='truck'?freeTrucks:freeThrough,palette=kind==='moto'?MOTO_COLOURS:kind==='truck'?TRUCK_COLOURS:CAR_COLOURS,slot=pool.pop();
    mesh.setColorAt(slot,tint.set(palette[Math.floor(rand()*palette.length)]));mesh.instanceColor.needsUpdate=true;active.through.push({slot,kind,mesh,pool,lane:way,trip:begin(r,kind,99,false)});}
  // Ein Schritt Fahrt: beschleunigen bis zum erlaubten Tempo, vor Kurven, tieferen Limiten, dem Ziel und einem Vordermann rechtzeitig bremsen
  function moveCar(trip,slot,dt,mesh=carMesh){const r=trip.r;along(r,trip.s,trip,lane);const i=trip.seg,rest=Math.max(0,r.cum[i+1]-trip.s-trip.v*dt),next=trip.caps[i+1];let allowed=Math.min(r.seglim[i]*trip.pace,Math.sqrt(next*next+2*trip.brake*rest));
    if(trip.gap!==undefined)allowed=Math.min(allowed,Math.max(0,(trip.gap-4)/1.3));else if(allowed<.6&&r.total-trip.s>.5)allowed=.6; // nie vor dem Ziel stehen bleiben, ausser hinter einem Vordermann
    trip.v=Math.max(0,trip.v+Math.max(-trip.brake*1.3*dt,Math.min(trip.accel*dt,allowed-trip.v)));trip.s+=trip.v*dt;
    const p=along(r,Math.min(trip.s,r.total),trip,lane),angle=Math.atan2(p.dx,p.dz);{const turn=Math.atan2(Math.sin(angle-(trip.angle??angle)),Math.cos(angle-(trip.angle??angle))),most=1.5*dt;trip.angle=(trip.angle??angle)+Math.max(-most,Math.min(most,turn));} // das Fahrzeug dreht höchstens 86° pro Sekunde, auch in engen Einfahrten
    trip.x=p.x;trip.z=p.z;trip.limit=p.limit;trip.main=r.main[trip.seg];trip.shown=inside([p.x,p.z]);
    if(trip.shown)place(mesh,slot,p.x,p.z,trip.angle,.02);else mesh.setMatrixAt(slot,hidden);return trip.s>=r.total-.25;}
  // Bahnpendler
  function walkRoute(w,toStation){const spot=onPlatform(w.slot),r=route(w.home.footNode,stationTree,[w.home.at],[spot],1.6);return r?(toStation?r:reversed(r)):null;}
  function startWalker(w,toStation){if(!freeBodies.length)return false;const r=w.bike?(()=>{const q=route(w.home.footNode,stationTree,[w.home.at],[[w.rack[0],w.rack[1]]],3.5);return q?(toStation?q:reversed(q)):null;})():walkRoute(w,toStation);if(!r){w.state=toStation?'away':'home';return false;}w.body=freeBodies.pop();bodyMesh.setColorAt(w.body,tint.set(w.colour));bodyMesh.instanceColor.needsUpdate=true;w.trip={r,s:0,seg:0};w.state=toStation?'toStation':'toHome';active.walkers.add(w);parkBike(w);return true;}
  const showWalker=(slot,x,z,angle,bob)=>{place(bodyMesh,slot,x,z,angle,.03+bob);place(headMesh,slot,x,z,angle,.03+bob);};
  const showRider=(w,x,z,angle)=>{place(bikeMesh,w.bikeSlot,x,z,angle,.03);place(bodyMesh,w.body,x,z,angle,.2,.28);place(headMesh,w.body,x,z,angle,.2,.28);};
  const parkBike=w=>{if(!w.bike)return;if(w.state==='home'||w.state==='toHome'||w.state==='toStation')bikeMesh.setMatrixAt(w.bikeSlot,hidden);else place(bikeMesh,w.bikeSlot,w.rack[0],w.rack[1],w.rack[2],.03);};
  const release=w=>{if(w.body!==undefined){bodyMesh.setMatrixAt(w.body,hidden);headMesh.setMatrixAt(w.body,hidden);freeBodies.push(w.body);w.body=undefined;}active.walkers.delete(w);w.trip=null;};
  function startCyclist(){if(!freeBikes.length||!freeBodies.length||homes.length<2)return;const from=homes[Math.floor(rand()*homes.length)],exit=pickExit(),r0=route(from.carNode,exit.tree,[],[],3.5);if(!r0||r0.total<120)return;const r=rand()<.5?r0:reversed(r0),bike=freeBikes.pop(),body=freeBodies.pop();
    bikeMesh.setColorAt(bike,tint.set(COAT_COLOURS[Math.floor(rand()*COAT_COLOURS.length)]));bikeMesh.instanceColor.needsUpdate=true;bodyMesh.setColorAt(body,tint.set(COAT_COLOURS[Math.floor(rand()*COAT_COLOURS.length)]));bodyMesh.instanceColor.needsUpdate=true;active.cyclists.push({bike,body,trip:{r,s:0,seg:0},speed:4.4+rand()*1.6});}

  // Alles auf den Stand der Uhr stellen (nach einem Sprung am Zeitregler): niemand ist unterwegs.
  function settle(){for(const c of active.cars)c.trip=null;active.cars.clear();for(const t of active.through){t.mesh.setMatrixAt(t.slot,hidden);t.pool.push(t.slot);}active.through.length=0;
    for(const c of cars){c.away=isAway(c.intervals,minutes);c.hold=-Infinity;park(c);}
    for(const w of [...active.walkers])release(w);for(const w of walkers){if(w.body!==undefined)release(w);w.state=isAway(w.intervals,minutes)?'away':'home';w.hold=-Infinity;parkBike(w);}
    for(const c of active.cyclists){bikeMesh.setMatrixAt(c.bike,hidden);bodyMesh.setMatrixAt(c.body,hidden);headMesh.setMatrixAt(c.body,hidden);freeBikes.push(c.bike);freeBodies.push(c.body);}active.cyclists.length=0;
    for(let i=0;i<LIGHTS;i++)lightMesh.setMatrixAt(i,hidden);flush();}
  const flush=()=>{for(const m of [carMesh,truckMesh,motoMesh,lightMesh,bodyMesh,headMesh,bikeMesh])m.instanceMatrix.needsUpdate=true;};
  // Uhrzeit der Darstellung in Minuten seit Mitternacht. Kleine Schritte laufen weiter, ein Sprung stellt alles neu.
  function setClock(minuteOfDay,{lights=lamps,day=season,rain=wet}={}){lamps=!!lights;season=day;wet=!!rain;lightMesh.visible=lamps;const jump=Math.abs(((minuteOfDay-minutes+2160)%1440)-720);if(jump>2.5){minutes=((minuteOfDay%1440)+1440)%1440;total=minutes;settle();}service=!(minutes>45&&minutes<285);model.life.setService?.(service);}
  // Wie dicht der Durchgangsverkehr ist: mittlerer Abstand in Sekunden
  const throughGap=m=>m<300?60:m<390?12:m<540?4:m<960?6.5:m<1170?4:m<1320?10:m<1410?25:60;

  function update(dt){
    if(!(dt>0))return;const before=minutes;minutes=(minutes+dt/60)%1440;total+=dt/60;if(minutes<before)total=minutes; // neuer Tag
    // Autos: fällige Fahrten sofort, sonst zieht eine der nächsten vor, damit immer etwas fährt
    carTimer-=dt;if(carTimer<=0){carTimer=2.6+rand()*2.4;if(active.cars.size<6){const idle=cars.filter(c=>!c.trip&&total>=c.hold),due=idle.filter(c=>isAway(c.intervals,minutes)!==c.away);let pick=due.length?due[Math.floor(rand()*due.length)]:null;
        if(!pick){const soon=idle.map(c=>[c,nextChange(c.intervals,minutes)]).filter(([,t])=>t-minutes<50).sort((a,b)=>a[1]-b[1]);if(soon.length&&active.cars.size<Math.min(3,Math.ceil(soon.length/8))){pick=soon[Math.floor(rand()*Math.min(4,soon.length))][0];pick.hold=total+(nextChange(pick.intervals,minutes)-minutes)+.5;}}
        if(pick)startCar(pick,!pick.away);}}
    throughTimer-=dt;if(throughTimer<=0){throughTimer=throughGap(minutes)*(.5+rand());startThrough();}
    cycleTimer-=dt;if(cycleTimer<=0){cycleTimer=minutes>360&&minutes<1260?28+rand()*45:120;if(minutes>360&&minutes<1260)startCyclist();}
    for(const c of [...active.cars])if(moveCar(c.trip,c.slot,dt)){c.away=c.trip.outbound;c.trip=null;active.cars.delete(c);park(c);}
    {const lanes=new Map();for(const t of active.through){if(!lanes.has(t.lane))lanes.set(t.lane,[]);lanes.get(t.lane).push(t);}for(const list of lanes.values()){list.sort((a,b)=>b.trip.s-a.trip.s);list.forEach((t,k)=>{t.trip.gap=k?list[k-1].trip.s-list[k-1].trip.length/2-t.trip.s-t.trip.length/2:undefined;});}}
    for(let i=active.through.length-1;i>=0;i--){const t=active.through[i];if(moveCar(t.trip,t.slot,dt,t.mesh)){t.mesh.setMatrixAt(t.slot,hidden);t.pool.push(t.slot);active.through.splice(i,1);}}
    // Scheinwerfer der fahrenden Autos
    if(lamps){let k=0;for(const t of [...[...active.cars].map(c=>c.trip),...active.through.map(t=>t.trip)]){if(k>=LIGHTS)break;if(t.shown)place(lightMesh,k++,t.x,t.z,t.angle,.02);}for(;k<LIGHTS;k++)lightMesh.setMatrixAt(k,hidden);}
    // Bahnpendler: zum Bahnhof gehen, warten, einsteigen; aus dem Zug aussteigen und heimgehen
    const state=model.life.diagnostics().trainState,open=state==='Halt am Bahnhof';
    if(service&&active.walkers.size<WALKERS-10&&rand()<dt/2.2){const idle=walkers.filter(w=>w.state==='home'&&total>=w.hold),due=idle.filter(w=>isAway(w.intervals,minutes));let pick=due.length?due[Math.floor(rand()*due.length)]:null;
      if(!pick){const soon=idle.map(w=>[w,nextChange(w.intervals,minutes)]).filter(([w,t])=>t-minutes<35&&!isAway(w.intervals,minutes)).sort((a,b)=>a[1]-b[1]);if(soon.length){pick=soon[0][0];pick.hold=total+(soon[0][1]-minutes)+.5;}}
      if(pick)startWalker(pick,true);}
    if(open&&!trainWasOpen){ // Zug hält: Wartende steigen ein, Heimkehrende steigen aus
      for(const w of walkers)if(w.state==='waiting'){w.state='boarding';w.timer=1.2+rand()*2.5;}
      const back=walkers.filter(w=>w.state==='away'&&total>=w.hold).map(w=>[w,isAway(w.intervals,minutes)?nextChange(w.intervals,minutes)-minutes:0]).filter(([,t])=>t<55).sort((a,b)=>a[1]-b[1]).slice(0,9);
      for(const [w,t] of back){if(t>0)w.hold=total+t+.5;startWalker(w,false);}}
    trainWasOpen=open;
    for(const w of [...active.walkers]){if(w.state==='waiting'){const p=onPlatform(w.slot);showWalker(w.body,p[0],p[1],w.phase,0);continue;}
      if(w.state==='boarding'){w.timer-=dt;if(w.timer<=0||!open){w.state='away';release(w);}continue;}
      {const ramp=w.bike?9:1.6,left=w.trip.r.total-w.trip.s;w.trip.s+=w.pace*Math.max(.25,Math.min(1,(w.trip.s+.4)/ramp,(left+.4)/ramp))*dt;}const p=along(w.trip.r,Math.min(w.trip.s,w.trip.r.total),w.trip,w.bike?bikeLane:kerb);if(w.bike)showRider(w,p.x,p.z,Math.atan2(p.dx,p.dz));else showWalker(w.body,p.x,p.z,Math.atan2(p.dx,p.dz),Math.abs(Math.sin(w.trip.s*2.4+w.phase))*.05);
      if(w.trip.s>=w.trip.r.total){if(w.state==='toStation'){w.state='waiting';w.trip=null;parkBike(w);}else{w.state='home';release(w);parkBike(w);}}}
    for(let i=active.cyclists.length-1;i>=0;i--){const c=active.cyclists[i];c.trip.s+=c.speed*dt;const p=along(c.trip.r,Math.min(c.trip.s,c.trip.r.total),c.trip,bikeLane),angle=Math.atan2(p.dx,p.dz),seen=inside([p.x,p.z]);
      if(c.trip.s>=c.trip.r.total||!seen&&c.trip.s>40){bikeMesh.setMatrixAt(c.bike,hidden);bodyMesh.setMatrixAt(c.body,hidden);headMesh.setMatrixAt(c.body,hidden);freeBikes.push(c.bike);freeBodies.push(c.body);active.cyclists.splice(i,1);continue;}
      if(seen){place(bikeMesh,c.bike,p.x,p.z,angle,.03);place(bodyMesh,c.body,p.x,p.z,angle,.2,.28);place(headMesh,c.body,p.x,p.z,angle,.2,.28);}}
    flush();
  }
  settle();
  const count=(list,test)=>list.reduce((n,x)=>n+(test(x)?1:0),0);
  const diagnostics=()=>({minutes:+minutes.toFixed(2),service,lamps,...stats,carsAtHome:count(cars,c=>!c.away&&!c.trip),carsAway:count(cars,c=>c.away&&!c.trip),carsDriving:active.cars.size,carsOutbound:count([...active.cars],c=>c.trip.outbound),throughCars:active.through.length,throughTrucks:count(active.through,t=>t.kind==='truck'),throughMotorcycles:count(active.through,t=>t.kind==='moto'),season,wet,
    walkersHome:count(walkers,w=>w.state==='home'),walkersAway:count(walkers,w=>w.state==='away'),walkersToStation:count(walkers,w=>w.state==='toStation'),walkersWaiting:count(walkers,w=>w.state==='waiting'||w.state==='boarding'),walkersToHome:count(walkers,w=>w.state==='toHome'),cyclists:active.cyclists.length,bikeCommutersRiding:count(bikers,w=>w.state==='toStation'||w.state==='toHome'),bikesAtStation:count(bikers,w=>['waiting','boarding','away'].includes(w.state))});
  // Für Prüfungen: Orte der fahrenden Autos und der Gehenden
  const moving=()=>[...[...active.cars].map(c=>({id:'a'+c.slot,through:false,kind:'car',t:c.trip})),...active.through.map(t=>({id:t.kind[0]+t.slot,through:true,kind:t.kind,t:t.trip}))].filter(m=>m.t.x!==undefined).map(m=>({id:m.id,through:m.through,kind:m.kind,x:m.t.x,z:m.t.z,v:m.t.v,angle:m.t.angle,limit:m.t.limit,main:m.t.main,gap:m.t.gap??null,shown:m.t.shown}));
  const positions=()=>({cars:[...active.cars].map(c=>[c.trip.x,c.trip.z]).filter(p=>p[0]!==undefined),through:active.through.map(t=>[t.trip.x,t.trip.z]).filter(p=>p[0]!==undefined),parked:cars.filter(c=>!c.away&&!c.trip).map(c=>c.spot),
    walkers:[...active.walkers].filter(w=>w.trip).map(w=>{const p=along(w.trip.r,Math.min(w.trip.s,w.trip.r.total),{seg:w.trip.seg},()=>0);return [p.x,p.z];})});
  model.stats.daily=stats;// Wegnetz und Wohnhäuser auch für andere Teile (community.js: Kehrichtwagen, Schulbus, Schulkinder)
  const network={nodes,nearest,tree,route,reversed,along,CAR_COST,FOOT_COST,exits,through,stationNode,stationTree,railSide,platformSide,onPlatform};
  model.daily={group,update,setClock,diagnostics,positions,moving,stats,mainRoad,network,homes,schedule:{cars:cars.map(c=>c.intervals),walkers:walkers.map(w=>w.intervals)}};
  return model.daily;
}
