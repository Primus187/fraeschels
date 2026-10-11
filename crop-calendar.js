// Kulturen der Felder im Jahreslauf (keine Abhängigkeiten, läuft auch in Node).
// Welche Kultur auf welchem Feld steht, stammt aus den gemeldeten Nutzungsflächen (data/crops.json).
// Der Kalender – wann gesät, wann grün, wann reif, wann geerntet – ist Gestaltung nach üblichen Terminen im Seeland:
// feste Stichtage, kein Bezug zur Witterung oder zur tatsächlichen Arbeit auf dem einzelnen Feld.
const SOIL='#8a7252',STRAW='#cdb97a';
// Gruppe → Bezeichnung, Reihenabstand der Darstellung in m (0 = flächig), Fahrgassen, Stichtage [Tag im Jahr, Farbe, Bedeckung 0…1]
export const CROPS={
  wintergetreide:{label:'Wintergetreide',rows:0,tram:1,keys:[[1,'#5f8f36',.45],[75,'#5f9438',.6],[110,'#4f8f2e',1],[160,'#6f9a38',1],[180,'#c9b04e',1],[195,'#dcb95a',1],[203,'#dcb95a',1],[206,STRAW,.85],[235,'#c2ad74',.8],[245,SOIL,0],[288,SOIL,0],[300,'#6f9a40',.2],[330,'#63933a',.4]]},
  sommergetreide:{label:'Sommergetreide',rows:0,tram:1,keys:[[1,SOIL,0],[75,SOIL,0],[100,'#6fa040',.3],[135,'#4f8f2e',1],[185,'#8fa040',1],[205,'#dcb95a',1],[218,'#dcb95a',1],[221,STRAW,.85],[250,SOIL,0]]},
  mais:{label:'Mais',rows:1.5,tram:0,keys:[[1,'#9a8560',.4],[100,SOIL,0],[128,SOIL,0],[140,'#6fa63d',.15],[165,'#4f8a2c',.5],[190,'#3f7a2a',1],[250,'#4a7d2c',1],[268,'#a89a52',1],[283,'#b3a05c',1],[287,'#a8946a',.5],[340,'#9a8560',.4]]},
  rueben:{label:'Zuckerrüben',rows:1.2,tram:0,keys:[[1,SOIL,0],[95,SOIL,0],[125,'#6fa63d',.2],[165,'#3f8a2e',.75],[185,'#3a8230',1],[290,'#4a8a34',1],[305,SOIL,0]]},
  kartoffeln:{label:'Kartoffeln',rows:1.5,tram:0,keys:[[1,SOIL,0],[105,SOIL,0],[140,'#5f9a35',.25],[170,'#3f7a2a',.85],[185,'#3f7a2a',1],[225,'#5a8030',1],[238,'#8f7f4a',.8],[258,'#8f7f4a',.6],[262,SOIL,0]]},
  raps:{label:'Raps',rows:0,tram:1,keys:[[1,'#4f8a35',.7],[95,'#4a8a30',1],[108,'#e6d23a',1],[132,'#e2cf3c',1],[142,'#6f9a3a',1],[175,'#8f9a48',1],[190,'#b8a560',1],[197,'#c2ad74',.8],[225,SOIL,0],[245,SOIL,0],[262,'#6fa040',.3],[300,'#4f8a35',.7]]},
  sonnenblumen:{label:'Sonnenblumen',rows:1.5,tram:0,keys:[[1,SOIL,0],[110,SOIL,0],[140,'#6fa63d',.2],[175,'#3f7a2a',.9],[190,'#e0b92e',1],[218,'#d9b030',1],[232,'#8a7a40',1],[262,'#7a6a3c',1],[266,SOIL,0]]},
  huelsen:{label:'Hülsenfrüchte und Ölsaaten',rows:0,tram:1,keys:[[1,SOIL,0],[115,SOIL,0],[150,'#5f9a35',.4],[185,'#4f8a2c',1],[235,'#8f9a48',1],[255,'#b09a58',1],[268,SOIL,0]]},
  gemuese:{label:'Gemüse',rows:1.6,tram:0,spread:28,keys:[[1,SOIL,0],[70,SOIL,0],[100,'#6fa63d',.3],[135,'#4f9a35',.65],[280,'#4f9a35',.6],[315,'#6f8a40',.3],[335,SOIL,0]]},
  spargel:{label:'Spargel',rows:2,tram:0,keys:[[1,SOIL,0],[160,SOIL,0],[175,'#5f9a40',.4],[200,'#4f9440',1],[285,'#b8a04a',1],[320,SOIL,.2],[340,SOIL,0]]},
  wiese:{label:'Wiese oder Weide',rows:0,tram:0,keys:[[1,'#7c9448',1],[80,'#7c9a44',1],[120,'#6fa63a',1],[160,'#84ad46',1],[250,'#6f9e3a',1],[320,'#7c9648',1]]},
  extensiv:{label:'Extensiv genutzte Wiese',rows:0,tram:0,keys:[[1,'#84924e',1],[120,'#7aa040',1],[165,'#a8ad55',1],[185,'#8fa850',1],[260,'#7c9c44',1],[330,'#84924e',1]]},
  brache:{label:'Brache oder Blühstreifen',rows:0,tram:0,keys:[[1,'#8a8452',1],[120,'#7c9c48',1],[170,'#9aa850',1],[260,'#8f9450',1],[330,'#8a8452',1]]},
};
export const SOIL_COLOUR=SOIL;
// Gemeldete Kultur → Gruppe der Darstellung und Verschiebung des Kalenders in Tagen. null: keine landwirtschaftliche Kultur, wird nicht gezeichnet.
const RULES=[[/Wintergerste/i,'wintergetreide',-14],[/Winterweizen|Futterweizen|Triticale|Dinkel|Roggen|Emmer|Einkorn/i,'wintergetreide',0],[/Sommerweizen|Sommergerste|Hafer/i,'sommergetreide',0],[/Silo- und Grünmais/i,'mais',-16],[/mais/i,'mais',0],
  [/rüben/i,'rueben',0],[/Kartoffeln/i,'kartoffeln',0],[/raps/i,'raps',0],[/Sonnenblumen/i,'sonnenblumen',0],[/Soja|Erbsen|Bohnen|Lupinen|Mohn|Lein|Hanf/i,'huelsen',0],[/Spargel/i,'spargel',0],
  [/gemüse|Rhabarber|Beeren|Spezialkulturen|Kräuter|Gewürz/i,'gemuese',0],[/Extensiv genutzte Wiesen|Wenig intensiv|Streue/i,'extensiv',0],[/Buntbrache|Rotationsbrache|Nützlingsstreifen|Saum/i,'brache',0],
  [/Wiesen|Weiden|Grünfläche|Obstanlagen|Reben|nachwachsende/i,'wiese',0]];
const EXCLUDED=/Wald|Hecken|Ufergehölz|unproduktiv|Wassergr|Hochstamm|Einzelbäume|Nussbäume|Kastanien/i;
export function classifyCrop(name){if(!name||EXCLUDED.test(name))return null;return RULES.find(([pattern])=>pattern.test(name))?.[1]||null;}
const shiftOf=name=>RULES.find(([pattern])=>pattern.test(name||''))?.[2]||0;

const hex=c=>[1,3,5].map(i=>parseInt(c.slice(i,i+2),16)/255);
// Zustand eines Feldes an einem Tag: Farbe des Bestands [r,g,b] 0…1, Bedeckung 0…1 (0 = offener Boden), Reihen und Fahrgassen.
// variation 0…1 ist eine feste Zufallszahl des Feldes: Felder derselben Kultur sind um einige Tage versetzt und leicht verschieden hell.
export function cropState(group,day,variation=.5,name=''){
  const crop=CROPS[group];if(!crop)return null;const keys=crop.keys,n=keys.length,d=((day-shiftOf(name)-(variation-.5)*2*(crop.spread??6)-1)%365+365)%365+1;
  let i=keys.findIndex(k=>k[0]>d);if(i<0)i=n;const a=keys[(i-1+n)%n],b=keys[i%n],span=(b[0]-a[0]+365)%365||365,t=Math.max(0,Math.min(1,((d-a[0]+365)%365)/span)),A=hex(a[1]),B=hex(b[1]),shade=.93+.14*((variation*7.3)%1);
  return {colour:A.map((v,k)=>(v+(B[k]-v)*t)*shade),cover:a[2]+(b[2]-a[2])*t,rows:crop.rows,tram:crop.tram,label:crop.label};
}
