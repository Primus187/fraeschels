// Licht in den Fenstern nach dem Lauf des Alltags. Jedes Haus hat seinen eigenen Rhythmus (Bettzeit, Aufstehen, niemand zu Hause),
// jedes Fenster ist ein Zimmer mit eigenen Zeiten. Dieselbe Regel steht hier zweimal: als Shader für das Bild und als Funktion zum
// Nachrechnen und Prüfen. Alles ist Gestaltung – es bildet keine wirklichen Haushalte ab.
//   Haus (b1, b2 aus dem Standort des Hauses): 7 % sind am Abend leer; Bettzeit zwischen 21:35 und 23:55; Aufstehen zwischen 05:20 und 06:50.
//   Zimmer (r, r2, r3 je Fenster): 62 % werden am Abend benutzt, bezogen zwischen 17:00 und etwa 20:00, dunkel spätestens zur Bettzeit,
//   einzelne früher; 18 % sind Schlafzimmer, die kurz vor dem Lichterlöschen aufleuchten; 2,5 % brennen bis 02:30; am Morgen 40 % für ein bis zwei Stunden.
//   An dunklen Tagen (Regen, Nebel, Schnee) brennt tagsüber in einem Teil der Zimmer Licht.
const fract=v=>v-Math.floor(v),step=(edge,v)=>v>=edge?1:0;

export function roomLit(hour,r,b1,b2,gloom=0){
  const r2=fract(r*7.31),r3=fract(r*3.17),late=hour<12?hour+24:hour,home=step(.07,b2),bed=21.6+2.3*b1,used=step(r2,.62)*(r2<=.62?1:0);
  const evening=(r2<=.62?1:0)*step(17+3.2*r3*(1-.5*b1),late)*step(late,bed-1.6*r*r),bedroom=(r2>.62&&r2<=.8?1:0)*step(bed-.15,late)*step(late,bed+.25+.5*r3),owl=step(.975,r)*step(late,26.5)*step(17,late);
  const wake=5.3+1.5*b1,morning=(r2<=.4?1:0)*step(wake+.6*r3,hour)*step(hour,wake+1.6+.8*r3)*step(hour,9.5),day=step(8,hour)*step(hour,17)*(r2<=.3*gloom?1:0);
  return home*Math.max(evening,bedroom,owl,morning,day)>0;
}
// Anteil beleuchteter Fenster zu einer Uhrzeit (über viele Häuser und Zimmer gemittelt)
export function litShare(hour,gloom=0){let lit=0,total=0;for(let h=0;h<60;h++){const b1=fract(Math.sin(h*12.9898)*43758.5453),b2=fract(b1*5.13);for(let k=0;k<40;k++){const r=fract(Math.sin((h*40+k)*78.233)*43758.5453);total++;if(roomLit(hour,r,b1,b2,gloom))lit++;}}return lit/total;}

// Shader: vLdR = Zufallszahl des Fensters, vLdB = Zufallszahl des Hauses, uHour = Uhrzeit, uLit = Dunkelheit (0 Tag … 1 Nacht), uSeconds = laufende Sekunden
export const WINDOW_VERTEX_DECLARATIONS='varying float vLdR;varying float vLdB;\n';
export const WINDOW_VERTEX_CHUNK=`#ifdef USE_INSTANCING
vLdR=fract(sin(dot(instanceMatrix[3].xyz,vec3(12.9898,78.233,37.719)))*43758.5453);
vLdB=fract(sin(dot(floor(instanceMatrix[3].xz/13.0),vec2(127.1,311.7)))*43758.5453); // alle Fenster im selben 13-m-Feld gehören zum selben Haus
#else
vLdR=.5;vLdB=.5;
#endif`;
export const WINDOW_FRAGMENT_DECLARATIONS='varying float vLdR;varying float vLdB;uniform float uLit,uHour,uSeconds;\n';
export const WINDOW_FRAGMENT_CHUNK=`{float r=vLdR,r2=fract(r*7.31),r3=fract(r*3.17),b1=vLdB,b2=fract(vLdB*5.13),late=uHour<12.0?uHour+24.0:uHour,home=step(.07,b2),bed=21.6+2.3*b1;
  float evening=step(r2,.62)*step(17.0+3.2*r3*(1.0-.5*b1),late)*step(late,bed-1.6*r*r),bedroom=step(.62,r2)*step(r2,.8)*step(bed-.15,late)*step(late,bed+.25+.5*r3),owl=step(.975,r)*step(late,26.5)*step(17.0,late);
  float wake=5.3+1.5*b1,morning=step(r2,.4)*step(wake+.6*r3,uHour)*step(uHour,wake+1.6+.8*r3)*step(uHour,9.5),day=step(8.0,uHour)*step(uHour,17.0)*step(r2,.3*uLit);
  // in jedem Zimmer geht gelegentlich für eine Weile das Licht aus (alle 35 bis 85 Sekunden neu ausgelost)
  float slot=floor(uSeconds/(35.0+50.0*r2)+r*10.0),room=step(.1,fract(sin(slot*12.99+r*78.2)*43758.5));
  totalEmissiveRadiance+=vec3(1.0,.60,.26)*smoothstep(.05,.45,uLit)*home*max(max(evening,bedroom),max(max(owl,morning),day))*room*(1.6+r*3.2);}`;
