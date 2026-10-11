// Sonnenstand und Jahreszeit für Fräschels, gerechnet aus Datum und Uhrzeit (keine Abfrage, keine Abhängigkeiten).
// Der Sonnenstand ist astronomisch gerechnet (Genauigkeit rund 0,1°). Die Laubfarben je Jahreszeit sind Gestaltung:
// feste Stichtage, kein Bezug zur tatsächlichen Witterung des Jahres.
export const SITE={lat:46.9984,lon:7.2072};
const RAD=Math.PI/180,clamp=(v,lo=0,hi=1)=>Math.max(lo,Math.min(hi,v));

// Sonnenhöhe und Azimut (Grad; Azimut ab Nord im Uhrzeigersinn) für einen Zeitpunkt in Millisekunden UTC.
export function sunPosition(ms,lat=SITE.lat,lon=SITE.lon){
  const d=ms/86400000+2440587.5-2451545,g=(357.529+.98560028*d)*RAD,q=280.459+.98564736*d,L=(q+1.915*Math.sin(g)+.02*Math.sin(2*g))*RAD,e=(23.439-.00000036*d)*RAD;
  const ra=Math.atan2(Math.cos(e)*Math.sin(L),Math.cos(L)),dec=Math.asin(Math.sin(e)*Math.sin(L)),H=((18.697374558+24.06570982441908*d)*15+lon)*RAD-ra,p=lat*RAD;
  const elevation=Math.asin(Math.sin(p)*Math.sin(dec)+Math.cos(p)*Math.cos(dec)*Math.cos(H)),azimuth=Math.atan2(-Math.sin(H),Math.tan(dec)*Math.cos(p)-Math.sin(p)*Math.cos(H));
  return {elevation:elevation/RAD,azimuth:(azimuth/RAD+360)%360};
}
// Mond: Höhe und Azimut wie bei der Sonne, dazu der beleuchtete Anteil der Scheibe (0 Neumond … 1 Vollmond) und der Winkelabstand
// zur Sonne. Vereinfachte Bahn (drei Hauptglieder), ohne Parallaxe: auf rund 2° genau – genug, um ihn an der richtigen Stelle zu zeigen.
export function moonPosition(ms,lat=SITE.lat,lon=SITE.lon){
  const d=ms/86400000+2440587.5-2451545,L=(218.316+13.176396*d)*RAD,M=(134.963+13.064993*d)*RAD,F=(93.272+13.229350*d)*RAD,l=L+6.289*RAD*Math.sin(M),b=5.128*RAD*Math.sin(F),e=(23.439-.00000036*d)*RAD;
  const x=Math.cos(b)*Math.cos(l),y=Math.cos(e)*Math.cos(b)*Math.sin(l)-Math.sin(e)*Math.sin(b),z=Math.sin(e)*Math.cos(b)*Math.sin(l)+Math.cos(e)*Math.sin(b),ra=Math.atan2(y,x),dec=Math.asin(z),H=((18.697374558+24.06570982441908*d)*15+lon)*RAD-ra,p=lat*RAD;
  const elevation=Math.asin(Math.sin(p)*Math.sin(dec)+Math.cos(p)*Math.cos(dec)*Math.cos(H)),azimuth=Math.atan2(-Math.sin(H),Math.tan(dec)*Math.cos(p)-Math.sin(p)*Math.cos(H));
  // Abstand zur Sonne in ekliptikaler Länge → Phase
  const g=(357.529+.98560028*d)*RAD,sunLon=(280.459+.98564736*d)*RAD+1.915*RAD*Math.sin(g)+.02*RAD*Math.sin(2*g),elongation=Math.acos(Math.max(-1,Math.min(1,Math.cos(b)*Math.cos(l-sunLon))));
  return {elevation:elevation/RAD,azimuth:(azimuth/RAD+360)%360,illuminated:(1-Math.cos(elongation))/2,elongation:elongation/RAD,waxing:Math.sin(l-sunLon)>0};
}
// Richtung zur Sonne im Modell: x nach Osten, y nach oben, z nach Süden.
export function sunVector(azimuth,elevation){const a=azimuth*RAD,h=elevation*RAD;return [Math.sin(a)*Math.cos(h),Math.sin(h),-Math.cos(a)*Math.cos(h)];}

// «2026-10-09T17:30» als Schweizer Ortszeit lesen (Sommer- und Winterzeit über die Zeitzonendaten des Browsers).
export function zurichTime(text){
  const m=/^(\d{4})-(\d\d)-(\d\d)(?:T(\d\d):(\d\d))?/.exec(text||'');if(!m)return NaN;const guess=Date.UTC(+m[1],m[2]-1,+m[3],+(m[4]??12),+(m[5]??0));
  const parts=Object.fromEntries(new Intl.DateTimeFormat('en-GB',{timeZone:'Europe/Zurich',hourCycle:'h23',year:'numeric',month:'numeric',day:'numeric',hour:'numeric',minute:'numeric'}).formatToParts(guess).map(p=>[p.type,+p.value]));
  return guess-(Date.UTC(parts.year,parts.month-1,parts.day,parts.hour,parts.minute)-guess);
}
// Schweizer Ortszeit eines Zeitpunkts in Einzelteilen, mit Tag im Jahr.
export function zurichParts(ms){
  const p=Object.fromEntries(new Intl.DateTimeFormat('en-GB',{timeZone:'Europe/Zurich',hourCycle:'h23',year:'numeric',month:'numeric',day:'numeric',hour:'numeric',minute:'numeric'}).formatToParts(ms).map(x=>[x.type,+x.value]));
  return {year:p.year,month:p.month,day:p.day,hour:p.hour,minute:p.minute,dayOfYear:Math.floor((Date.UTC(p.year,p.month-1,p.day)-Date.UTC(p.year,0,1))/86400000)+1};
}
// Sonnenauf- und -untergang des Tages in Minuten nach Mitternacht (Ortszeit), auf die Minute gesucht; −0,833° berücksichtigt Refraktion und Sonnenradius.
// Der flache Horizont gilt; Hügel und Berge sind nicht berücksichtigt.
export function sunTimes(ms){
  const p=zurichParts(ms),two=n=>String(n).padStart(2,'0'),start=zurichTime(p.year+'-'+two(p.month)+'-'+two(p.day)+'T00:00');let rise=null,set=null,before=sunPosition(start).elevation;
  for(let m=1;m<=1440;m++){const e=sunPosition(start+m*60000).elevation;if(before<-.833&&e>=-.833&&rise===null)rise=m;if(before>=-.833&&e<-.833)set=m;before=e;}return {rise,set};
}
export const dayOfYear=ms=>{const d=new Date(ms);return Math.floor((ms-Date.UTC(d.getUTCFullYear(),0,1))/86400000)+1;};

const hex=c=>[1,3,5].map(i=>parseInt(c.slice(i,i+2),16)),mixHex=(a,b,t)=>{const A=hex(a),B=hex(b);return '#'+A.map((v,i)=>Math.round(v+(B[i]-v)*t).toString(16).padStart(2,'0')).join('');};
// Laubfarben an Stichtagen (Tag im Jahr). Gleiche Position = gleicher Baum: Jeder Baum behält seinen Platz in der Liste
// und verfärbt sich über die Wochen. Position 4 beim Laub und 0 bei den Sträuchern sind immergrün (Nadelbäume, Hecken).
// Dritter Wert: Anteil kahler Kronen (0 = voll belaubt, 1 = kahl); die Darstellung lichtet die Kronen entsprechend aus.
const SUMMER={foliage:['#3d6a20','#4d7d27','#5b8c2d','#6e9a34','#2f5a21','#7ca53b'],bush:['#3d6a20','#4d7d27','#5b8c2d','#6e9a34']};
const BARE={foliage:['#5a4f44','#63574b','#52483e','#6b5f52','#2f5a21','#72665a'],bush:['#3a5a26','#5c5247','#665b4f','#544a40']};
const STAGES=[
  [75,'Winter',BARE,1],
  [95,'Austrieb',{foliage:['#7d8a4a','#8e9a52','#9aa65a','#a9b264','#2f5a21','#b6bd6e'],bush:['#3d6a20','#76864a','#87955a','#96a05e']},.55],
  [121,'Frühling',{foliage:['#5c8f2c','#6fa336','#7fb03d','#93bd48','#2f5a21','#a4c653'],bush:['#3d6a20','#5f9230','#74a53a','#88b344']}],
  [160,'Sommer',SUMMER],[250,'Sommer',SUMMER],
  [283,'Frühherbst',{foliage:['#44691f','#567b25','#6d8a2b','#8f9a32','#2f5a21','#b3a437'],bush:['#3d6a20','#52792a','#718a2d','#939a33']}],
  [305,'Herbst',{foliage:['#9a7f2a','#d08a2c','#e0b33a','#b5562a','#2f5a21','#c9a233'],bush:['#3d6a20','#b0792c','#cfa436','#a9552c']}],
  [325,'Spätherbst',{foliage:['#8a6a3a','#9c7436','#a8843e','#8a5a34','#2f5a21','#93793f'],bush:['#3a5f24','#876a3a','#967a40','#7d5a36']},.5],
  [342,'Winter',BARE,1]];
export function seasonPalette(day){
  const n=STAGES.length;let i=STAGES.findIndex(s=>s[0]>day);if(i<0)i=n;const a=STAGES[(i-1+n)%n],b=STAGES[i%n],span=(b[0]-a[0]+365)%365||365,t=clamp(((day-a[0]+365)%365)/span);
  return {label:t<.5?a[1]:b[1],bare:(a[3]||0)+((b[3]||0)-(a[3]||0))*t,foliage:a[2].foliage.map((c,k)=>mixHex(c,b[2].foliage[k],t)),bush:a[2].bush.map((c,k)=>mixHex(c,b[2].bush[k],t))};
}
