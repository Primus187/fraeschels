// Stimmung «Goldene Stunde» mit Wetter: Licht, Himmel, Dunst, Farben, Tiefenunschärfe, Umland und Gartengrün.
// Alles wird zur Laufzeit über das fertige Modell gelegt und lässt sich vollständig zurücknehmen
// (setEnabled(false)), damit die sachliche Darstellung und der GLB-Export unverändert bleiben.
// Illustrativ und nicht erhoben: Gartenbüsche, zusätzliche Garten- und Obstbäume, Bodenbedeckung und Bäume im Umland.
import * as T from 'three';
import {EffectComposer} from 'three/addons/postprocessing/EffectComposer.js';
import {ShaderPass} from 'three/addons/postprocessing/ShaderPass.js';
import {OutputPass} from 'three/addons/postprocessing/OutputPass.js';
import {UnrealBloomPass} from 'three/addons/postprocessing/UnrealBloomPass.js';
import {GTAOPass} from 'three/addons/postprocessing/GTAOPass.js';
import {Pass,FullScreenQuad} from 'three/addons/postprocessing/Pass.js';
import {FXAAShader} from 'three/addons/shaders/FXAAShader.js';

import {WINDOW_VERTEX_DECLARATIONS,WINDOW_VERTEX_CHUNK,WINDOW_FRAGMENT_DECLARATIONS,WINDOW_FRAGMENT_CHUNK} from './house-lights.js';
import {sunPosition,moonPosition,sunVector,zurichTime,zurichParts,dayOfYear,seasonPalette} from './sun-season.js';

const GREEN={grass:['#557d2c','#73993c','#98b052'],
  fields:{crop:['#4f8a2c','#5f9a35','#3f7a2a','#6fa63d'],grain:['#dcb95a','#cfa94c','#e5c972','#c8a24c'],soil:['#8a7252','#7b6648','#97805c'],meadow:['#6f9e3a','#84ad46','#5f9032'],wood:['#3c5a25']},
  foliage:['#3d6a20','#4d7d27','#5b8c2d','#6e9a34','#2f5a21','#7ca53b'],bush:['#3d6a20','#4d7d27','#5b8c2d','#6e9a34'],rows:'#55782d',tuft:'#73993c',road:'#6d6a66',water:'#3d9fb0',
  av:{paved:['#b4ad9e','#a39c8d'],asphalt:['#908d87','#827f7a'],gravel:['#c9bb9c','#b8a988'],slab:['#c7c3b9','#b6b2a8'],garden:['#6f9a3c','#88ad49'],green:['#5f8a33','#739a3d'],walk:['#cbc4b3','#bdb6a5'],rail:['#9d968a','#8c857a'],road:'#8d8a84',path:'#b3a585',wood:'#42632a',wall:'#c2b9a6',roof:'#8d8a82'}};
const WHITE={grass:['#eef2f8','#e0e8f3','#f7f9fc'],
  fields:{crop:['#edf1f7','#e4ebf4'],grain:['#f1f3f7','#e6ecf4'],soil:['#e9edf3','#dfe6ef'],meadow:['#f0f3f8','#e5ebf4'],wood:['#cfd8de']},
  foliage:['#8f897e','#a29b8f','#7c766d','#9a9388','#3f5a3d','#b0a99c','#6f6a62'],bush:['#5d6b55','#7a8272','#8c8a7c','#4a6046'],rows:'#cfd8e2',tuft:'#dfe6ee',road:'#8b9099',water:'#7fb2c8',
  av:{paved:['#e2e6ec','#d6dbe3'],asphalt:['#dfe3ea','#d2d8e0'],gravel:['#e6e8ec','#dadde3'],slab:['#e4e8ee','#d8dde5'],garden:['#f0f3f8','#e6ecf4'],green:['#eef2f7','#e4eaf2'],walk:['#e6e9ee','#dadfe6'],rail:['#d5d9df','#c9ced6'],road:'#9aa0aa',path:'#dcd9d0',wood:'#cfd8de',wall:'#d9d6d0',roof:'#eef1f6'}};
const GOLDEN={sunDir:[-.80,.23,-.50],glowDir:null,sun:'#ffc98c',sunI:5.6,hemiSky:'#e6ddcd',hemiGround:'#a89468',hemiI:1.15,envI:.45,exposure:1.1,
  zenith:'#5d8fd6',horizon:'#fbe6c4',glow:'#ffc67a',cloudLight:'#fff0dc',fog:'#f4e3c6',fogDensity:.00021,clouds:.35,roof:'#b85a3c',roofAmt:.36,wall:'#fff3e0',frame:'#a7b5ac',
  ao:1,bloom:.14,bloomThreshold:.95,sat:1.1,contrast:1.03,tint:[1.03,1,.96],vignette:.3,lit:0,lamps:0};
const DUSK={sunDir:[-.62,.52,-.38],glowDir:[-.80,-.02,-.60],sun:'#8fa4e8',sunI:1.25,hemiSky:'#5677d2',hemiGround:'#2b3048',hemiI:.75,envI:.4,exposure:1.25,
  zenith:'#111f48',horizon:'#f08a4a',glow:'#ff8f4d',cloudLight:'#7f7fa8',fog:'#5d6490',fogDensity:.00034,clouds:.3,roof:'#b85a3c',roofAmt:.3,wall:'#fff3e0',frame:'#34405a',
  ao:.8,bloom:.6,bloomThreshold:.78,sat:1.15,contrast:1.06,tint:[1,1,1.02],vignette:.4,lit:1,lamps:1};

// Weitere Grundstimmungen für den Tageslauf: hoher Sonnenstand, Sonnenuntergang und tiefe Nacht.
const DAY={...GOLDEN,sun:'#fff3df',sunI:2.9,hemiSky:'#dde6f2',hemiGround:'#a39a78',hemiI:1.1,envI:.48,exposure:1,zenith:'#3f86de',horizon:'#d6e8f8',glow:'#fff2d6',cloudLight:'#ffffff',fog:'#dfe9f2',fogDensity:.00018,
  roofAmt:.3,wall:'#fffaf0',bloom:.1,bloomThreshold:.97,sat:1.08,tint:[1,1,1],vignette:.26};
const SUNSET={...GOLDEN,sun:'#ff9d62',sunI:3,hemiSky:'#c9bfd0',hemiGround:'#8a7460',hemiI:1,envI:.42,exposure:1.15,zenith:'#3f62b0',horizon:'#ffb37a',glow:'#ff9a52',cloudLight:'#ffd0b0',fog:'#e8c0a0',fogDensity:.00026,clouds:.33,
  roofAmt:.34,frame:'#7f8a90',ao:.95,bloom:.3,bloomThreshold:.88,sat:1.12,contrast:1.04,tint:[1.03,.99,.96],vignette:.34,lit:.55,lamps:.6};
const NIGHT={...DUSK,sun:'#8b9de0',sunI:1.05,zenith:'#0c1736',horizon:'#22305c',glow:'#1a2548',cloudLight:'#5a5f88',fog:'#3a4270',exposure:1.2,bloom:.65};
// Sonnenhöhe in Grad → Grundstimmung; dazwischen wird stufenlos überblendet. GOLDEN bei 12° ist die bisherige Abendstimmung.
const STAGES=[[-18,NIGHT],[-6,DUSK],[0,SUNSET],[12,GOLDEN],[38,DAY]];
const blendValue=(a,b,t)=>typeof a==='number'?a+(b-a)*t:Array.isArray(a)?a.map((v,i)=>v+(b[i]-v)*t):typeof a==='string'?'#'+new T.Color(a).lerp(new T.Color(b),t).getHexString():a;
function baseFor(elevation){
  if(elevation<=STAGES[0][0])return STAGES[0][1];if(elevation>=STAGES.at(-1)[0])return STAGES.at(-1)[1];
  const i=STAGES.findIndex(s=>s[0]>elevation),[e0,A]=STAGES[i-1],[e1,B]=STAGES[i],t=(elevation-e0)/(e1-e0),out={};for(const key of Object.keys(A))if(key!=='sunDir'&&key!=='glowDir')out[key]=blendValue(A[key],B[key],t);return out;
}
// Zeitpunkt der Darstellung: ?zeit=2026-10-25T14:00 (Schweizer Ortszeit) hat Vorrang, dann die feste Zeit eines Vorschau-Zustands,
// sonst die Uhr des Geräts. Weicht diese stark von der Zeit des Wetterdienstes ab, gilt der Wetterdienst.
// Der Zeitregler setzt den Zeitpunkt über setTime(); «Jetzt» (setTime(null)) stellt auf die Uhr des Geräts um.
let chosenTime=zurichTime(new URLSearchParams(globalThis.location?.search||'').get('zeit')),clockOnly=false;
function moment(w){
  if(Number.isFinite(chosenTime))return {when:chosenTime,live:false};const reported=zurichTime(w?.time);
  if(!clockOnly&&Number.isFinite(reported)&&(!w.live||Math.abs(Date.now()-reported)>30*60000))return {when:reported,live:false};return {when:Date.now(),live:true};
}

// Farben zwischen Sommer- und Schneepalette, für eine Schneedecke, die erst dünn liegt.
const mixPalette=(g,w,t)=>typeof g==='string'?'#'+new T.Color(g).lerp(new T.Color(w),t).getHexString():Array.isArray(g)?g.map((c,i)=>mixPalette(c,w[i%w.length],t)):Object.fromEntries(Object.keys(g).map(k=>[k,k in w?mixPalette(g[k],w[k],t):g[k]]));
// Leitet aus Zeitpunkt (Sonnenstand, Jahreszeit) und Wetter die konkreten Einstellungen ab.
function derive(w){
  const {when,live}=moment(w),position=sunPosition(when),season=seasonPalette(dayOfYear(when)),B=baseFor(position.elevation),dark=Math.max(0,Math.min(1,-position.elevation/6));
  // Schneedecke: ja/nein aus der Wettermeldung, oder ein Anteil 0…1 (Film: der Schnee bleibt allmählich liegen).
  const cover=w?.snowCover===true?1:Math.max(0,Math.min(1,Number(w?.snowCover)||0));
  const c=w?.clouds||0,rain=w?.rain||0,fog=w?.fog||0,fall=w?.snowfall||0,dull=Math.pow(c,1.5),mix=(a,b,t)=>new T.Color(a).lerp(new T.Color(b),t),by=(day,night)=>mix(day,night,dark);
  // Lichtrichtung: echte Sonnenrichtung, aber mindestens 9° hoch (sonst endlose Schatten); in der Dämmerung Übergang zum Mondlicht.
  // Nachtlicht: steht der Mond mindestens 6° hoch, kommt das Licht aus seiner Richtung (mindestens 15° hoch gerechnet) und ist bei Vollmond heller;
  // sonst bleibt ein schwaches Licht aus fester Richtung, damit das Modell erkennbar bleibt.
  const lunar=moonPosition(when),moonUp=Math.max(0,Math.min(1,(lunar.elevation-2)/6)),moonLight=moonUp*lunar.illuminated;
  const moon=moonUp>0?new T.Vector3(...sunVector(lunar.azimuth,Math.max(lunar.elevation,15))):new T.Vector3(...DUSK.sunDir).normalize(),sunDir=new T.Vector3(...sunVector(position.azimuth,Math.max(position.elevation,9))).lerp(moon,dark).normalize().toArray();
  return {...B,sunDir,glowDir:sunVector(position.azimuth,Math.max(position.elevation,-8)),lamps:B.lamps>.5,when,liveTime:live,elevation:position.elevation,azimuth:position.azimuth,dark,hour:(p=>p.hour+p.minute/60)(zurichParts(when)),moon:lunar,moonDir:sunVector(lunar.azimuth,lunar.elevation),sunTrue:sunVector(position.azimuth,position.elevation),season:season.label,bare:season.bare,
    palette:cover>=.97?WHITE:cover>0?mixPalette({...GREEN,foliage:season.foliage,bush:season.bush},WHITE,cover):{...GREEN,foliage:season.foliage,bush:season.bush},snow:cover,rain,snowfall:fall,over:c,
    sun:mix(B.sun,by('#efe9df','#6f7fa8'),dull*.75),sunI:B.sunI*(1-.7*dull)*(1-.35*fog)*(1-dark*(.28-.5*moonLight)),shadowRadius:2.2+5*dull,
    hemiSky:mix(B.hemiSky,by('#d5d9de','#46557c'),c*.8),hemiGround:new T.Color(B.hemiGround),hemiI:B.hemiI*(1+.32*c),
    zenith:mix(B.zenith,by('#8d98a6','#1b2338'),c*.9),horizon:mix(B.horizon,by('#d6d8da','#3c4560'),Math.max(c*.85,fog)),glow:mix(B.glow,'#000000',Math.max(dull*.9,fog)),
    cloudLight:mix(B.cloudLight,by('#b9bec4','#4a5068'),c*.8),fog:mix(B.fog,by('#cdd2d6','#424a66'),Math.max(c*.8,fog)),
    fogDensity:B.fogDensity*(1+1.4*rain+14*fog+1.6*fall),clouds:Math.max(B.clouds,c),sat:B.sat-.15*c,contrast:B.contrast-.02*c,
    tint:B.tint.map(v=>v+(1-v)*c),lit:Math.max(B.lit,cover*.5,c>.85&&(rain>.3||fog)?.35:0),wet:rain,
    wall:mix(B.wall,'#ffffff',c*.6),roofAmt:B.roofAmt*(1-.25*c)};
}

const NOISE=`
float ldHash(vec2 p){p=fract(p*vec2(123.34,456.21));p+=dot(p,p+45.32);return fract(p.x*p.y);}
float ldNoise(vec2 p){vec2 i=floor(p),f=fract(p);f=f*f*(3.0-2.0*f);return mix(mix(ldHash(i),ldHash(i+vec2(1,0)),f.x),mix(ldHash(i+vec2(0,1)),ldHash(i+vec2(1,1)),f.x),f.y);}
float ldFbm(vec2 p){float a=.5,s=0.0;for(int i=0;i<4;i++){s+=a*ldNoise(p);p=p*2.03+17.0;a*=.5;}return s;}
`;
const GROUND_CHUNK={
  lawn:`{float n1=ldFbm(vLdW.xz*.011),n2=ldNoise(vLdW.xz*.09+31.0),n3=ldNoise(vLdW.xz*2.3);
    vec3 g=mix(uA,uB,smoothstep(.3,.7,n1));g=mix(g,uC,smoothstep(.5,.95,n2)*.4);g*=(.9+.2*n3)*(.92+.16*ldNoise(vLdW.xz*.33+7.0));diffuseColor.rgb=g;}`,
  field:`{float n1=ldFbm(vLdW.xz*.02+uSeed),n3=ldNoise(vLdW.xz*1.7+uSeed);vec3 g=mix(uA,uB,smoothstep(.25,.75,n1));g*=.92+.16*n3;diffuseColor.rgb=g;}`,
  // Belag mit begrünten Teilen: weicher, leicht unregelmässiger Übergang zwischen Belag (uA/uB) und Rasen (uC)
  paved:`{float n1=ldFbm(vLdW.xz*.02+uSeed),n3=ldNoise(vLdW.xz*1.7+uSeed),n4=ldNoise(vLdW.xz*.9+3.0);vec3 hard=mix(uA,uB,smoothstep(.25,.75,n1))*(.92+.16*n3);
    vec3 soft=mix(uC*.9,uC*1.14,smoothstep(.3,.7,ldFbm(vLdW.xz*.011)))*(.9+.2*n3);diffuseColor.rgb=mix(hard,soft,smoothstep(.38,.62,vLdGreen+(n4-.5)*.3));}`,
  surround:`{vec2 p=mat2(.913,-.408,.408,.913)*vLdW.xz;vec2 cellSize=vec2(230.0,125.0);vec2 gq=p/cellSize;float row=floor(gq.y);gq.x+=ldHash(vec2(row,3.0))*.73;
    vec2 id=floor(gq),f=fract(gq);float r=ldHash(id+11.0);
    vec3 col=r<.26?uF[0]:r<.46?uF[1]:r<.66?uF[2]:r<.84?uF[3]:uF[4];col*=.9+.2*ldHash(id+7.0);
    float e=min(min(f.x,1.0-f.x)*cellSize.x,min(f.y,1.0-f.y)*cellSize.y);col=mix(uF[3]*.8,col,smoothstep(1.2,4.5,e));col*=.93+.14*ldFbm(vLdW.xz*.013);
    float wood=texture2D(uWoodMask,vLdW.xz/uWoodExtent+.5).r;col=mix(col,(uF[0]+uF[1]+uF[2])/3.0,.38);col=mix(col,uWoodColor,smoothstep(.61,.67,wood)*(1.0-smoothstep(2700.0,3300.0,length(vLdW.xz))));float ldG=dot(col,vec3(.299,.587,.114));col=mix(col,vec3(ldG)*vec3(1.0,.98,.9),.5*uFocus);diffuseColor.rgb=col;}`,
};
const BUILDING_CHUNK=`{vec3 ldBase=diffuseColor.rgb,ldN=normalize(vDioramaNormal);float ldL=dot(diffuseColor.rgb,vec3(.299,.587,.114));
  if(ldN.y>.3){diffuseColor.rgb=mix(diffuseColor.rgb,uRoofTint*ldL,uRoofAmt)*1.15+.008;diffuseColor.rgb*=.86+.28*dNoise(vDioramaPosition*vec3(.8,2.2,.8));
   diffuseColor.rgb=mix(diffuseColor.rgb,vec3(.93,.95,1.0),uSnow*smoothstep(.32,.55,ldN.y)*(.8+.2*dNoise(vDioramaPosition*.7)));}
  else{diffuseColor.rgb*=uWallTint;
   float ldNear=1.0-smoothstep(.02,.12,fwidth(vDioramaPosition.x)+fwidth(vDioramaPosition.y)+fwidth(vDioramaPosition.z));
   if(ldBase.r>ldBase.b*1.35&&ldL<.42){ // dunkles, warmes Braun: Holzschalung mit senkrechten Brettern
    float ldU=dot(vDioramaPosition.xz,vec2(ldN.z,-ldN.x))/.19,ldS=fract(ldU),ldBoard=smoothstep(0.0,.05,ldS)*smoothstep(1.0,.95,ldS);
    diffuseColor.rgb*=mix(1.0,(.84+.32*dHash(vec3(floor(ldU),3.0,7.0)))*mix(.55,1.0,ldBoard)*(.93+.14*dNoise(vec3(ldU*9.0,vDioramaPosition.y*1.3,0.0))),ldNear);dRelief+=ldBoard*.012*ldNear;
   }else{ // Putz: wolkige Flecken aus der Distanz, Körnung aus der Nähe
    diffuseColor.rgb*=.91+.18*(dNoise(vDioramaPosition*.7)*.6+dNoise(vDioramaPosition*2.3)*.4);
    float ldGrain=dNoise(vDioramaPosition*34.0);diffuseColor.rgb*=mix(1.0,.93+.14*ldGrain,ldNear);dRelief+=ldGrain*.007*ldNear;}}
  diffuseColor.rgb=mix(ldBase,diffuseColor.rgb,uLd);}`;
// Kronen: der Vertex-Shader beult die Kugeln zu unregelmässigen Laubballen aus (je Krone anders).
const FOLIAGE_VERTEX={declarations:`uniform float uLd,uWind,uWindAmt;uniform vec2 uWindDir;
float ldVH(vec3 p){return fract(sin(dot(p,vec3(12.9898,78.233,37.719)))*43758.5453);}
float ldVN(vec3 p){vec3 i=floor(p),f=fract(p);f=f*f*(3.0-2.0*f);return mix(mix(mix(ldVH(i),ldVH(i+vec3(1,0,0)),f.x),mix(ldVH(i+vec3(0,1,0)),ldVH(i+vec3(1,1,0)),f.x),f.y),mix(mix(ldVH(i+vec3(0,0,1)),ldVH(i+vec3(1,0,1)),f.x),mix(ldVH(i+vec3(0,1,1)),ldVH(i+vec3(1,1,1)),f.x),f.y),f.z);}
`,chunk:`#ifdef USE_INSTANCING
  vec3 ldSeed=instanceMatrix[3].xyz*.37;
#else
  vec3 ldSeed=vec3(0.0);
#endif
  transformed+=normal*((ldVN(position*2.6+ldSeed)-.5)*.46+(ldVN(position*6.0+ldSeed)-.5)*.18)*uLd;
  // Wind: die Krone neigt sich in Böen (oben stärker), das Laub zittert leicht. uWindAmt ist 0, solange die Bewegung pausiert.
  float ldSway=sin(uWind*1.25+ldSeed.x*3.1+ldSeed.z*2.3)+.45*sin(uWind*2.9+ldSeed.z*5.7+position.y*3.0);
  transformed.xz+=uWindDir*ldSway*uWindAmt*clamp(.5+.5*position.y,0.0,1.0);transformed+=normal*sin(uWind*5.3+position.x*9.0+position.z*7.0+ldSeed.x*4.0)*uWindAmt*.22;`};
// Im Bild: Blattflecken hell/dunkel, plastisches Laub und ein ausgefranster Kronenrand (nur aus der Nähe, sonst flimmert es).
const FOLIAGE_CHUNK=`{vec3 ldBase=diffuseColor.rgb,ldN=normalize(vDioramaNormal);float ldUp=ldN.y*.5+.5;float l1=dNoise(vDioramaPosition*1.3),l2=dNoise(vDioramaPosition*4.5);
  vec3 ldV0=normalize(cameraPosition-vDioramaPosition);float ldNear=(1.0-smoothstep(.05,.22,fwidth(vDioramaPosition.x)+fwidth(vDioramaPosition.y)+fwidth(vDioramaPosition.z)))*uLd;
  // Kahle Kronen (Winter, teils Spätherbst und Austrieb): Laubbäume werden zu lichtem Astwerk ausgedünnt; Immergrüne (grüner Farbton) bleiben dicht.
  float ldBare=uBare*uLd*step(ldBase.g,ldBase.r*1.08);if(ldBare>.01&&dNoise(vDioramaPosition*vec3(4.2,1.6,4.2))*.6+dNoise(vDioramaPosition*1.3)*.4<ldBare*.56)discard;
  if(ldNear>.01){float ldLeaf=dNoise(vDioramaPosition*2.4)*.55+dNoise(vDioramaPosition*7.0)*.45;
   if(ldLeaf<smoothstep(.45,1.0,1.0-abs(dot(ldN,ldV0)))*.6*ldNear)discard;
   diffuseColor.rgb*=mix(1.0,mix(.72,1.24,smoothstep(.38,.62,dNoise(vDioramaPosition*9.0))),ldNear);dRelief+=ldLeaf*.11*ldNear;}
  diffuseColor.rgb*=mix(.58,1.2,ldUp)*(.78+.44*(l1*.6+l2*.4));
  diffuseColor.rgb=mix(diffuseColor.rgb,diffuseColor.rgb*uFolSun,max(dot(ldN,uSunDir),0.0)*.7);
  diffuseColor.rgb=mix(diffuseColor.rgb,vec3(.93,.95,1.0),uSnow*smoothstep(.05,.75,ldN.y)*.8);
  diffuseColor.rgb=mix(ldBase,diffuseColor.rgb,uLd);
  vec3 ldV=normalize(cameraPosition-vDioramaPosition);
  totalEmissiveRadiance+=uLd*diffuseColor.rgb*uBack*pow(max(dot(-ldV,uSunDir),0.0),3.0)*(1.0-abs(dot(ldN,ldV)));}`;

// Zeichnet die Szene ein einziges Mal und stellt deren Tiefe bereit. Verschattung und Tiefenunschärfe
// lesen diese Tiefe, statt die ganze Geometrie ein zweites Mal zu zeichnen.
class ScenePass extends Pass{
  constructor(scene,camera){
    super();this.scene=scene;this.camera=camera;this.needsSwap=true;
    this.depthTexture=new T.DepthTexture(4,4);this.depthTexture.type=T.UnsignedIntType;
    this.target=new T.WebGLRenderTarget(4,4,{type:T.HalfFloatType,depthTexture:this.depthTexture});
    this.copy=new FullScreenQuad(new T.ShaderMaterial({uniforms:{tDiffuse:{value:null}},depthTest:false,depthWrite:false,
      vertexShader:'varying vec2 vUv;void main(){vUv=uv;gl_Position=vec4(position.xy,0.0,1.0);}',fragmentShader:'varying vec2 vUv;uniform sampler2D tDiffuse;void main(){gl_FragColor=texture2D(tDiffuse,vUv);}'}));
  }
  setSize(w,h){this.target.setSize(w,h);}
  render(renderer,writeBuffer){
    renderer.setRenderTarget(this.target);renderer.render(this.scene,this.camera);
    this.copy.material.uniforms.tDiffuse.value=this.target.texture;renderer.setRenderTarget(this.renderToScreen?null:writeBuffer);this.copy.render(renderer);
  }
}
// Wolkenschatten: dunkelt das fertige Bild dort ab, wo am Boden ein Wolkenschatten liegt. Der Ort im Gelände wird aus der Tiefe
// zurückgerechnet, deshalb trifft der Schatten alles gleich (Felder, Dächer, Strassen, Bäume) und kostet nur einen Bilddurchgang.
class CloudShadowPass extends Pass{
  constructor(camera,depthTexture){
    super();this.camera=camera;this.amount=0;this.offset=new T.Vector2();
    this.material=new T.ShaderMaterial({uniforms:{tDiffuse:{value:null},tDepth:{value:depthTexture},uProjInv:{value:new T.Matrix4()},uCamWorld:{value:new T.Matrix4()},uOffset:{value:this.offset},uAmount:{value:0}},depthTest:false,depthWrite:false,
      vertexShader:'varying vec2 vUv;void main(){vUv=uv;gl_Position=vec4(position.xy,0.0,1.0);}',
      fragmentShader:`varying vec2 vUv;uniform sampler2D tDiffuse,tDepth;uniform mat4 uProjInv,uCamWorld;uniform vec2 uOffset;uniform float uAmount;${NOISE}
        void main(){vec4 c=texture2D(tDiffuse,vUv);float d=texture2D(tDepth,vUv).x;
          if(uAmount>0.0&&d<.999995){vec4 v=uProjInv*vec4(vUv*2.0-1.0,d*2.0-1.0,1.0);vec2 p=((uCamWorld*vec4(v.xyz/v.w,1.0)).xz-uOffset)/620.0;
            float n=ldFbm(p+11.0)*.7+ldFbm(p*2.7+3.0)*.3;c.rgb*=1.0-uAmount*smoothstep(.5,.68,n);}
          gl_FragColor=c;}`});
    this.quad=new FullScreenQuad(this.material);
  }
  render(renderer,writeBuffer,readBuffer){
    const u=this.material.uniforms;u.tDiffuse.value=readBuffer.texture;u.uAmount.value=this.amount;u.uProjInv.value.copy(this.camera.projectionMatrixInverse);u.uCamWorld.value.copy(this.camera.matrixWorld);
    renderer.setRenderTarget(this.renderToScreen?null:writeBuffer);this.quad.render(renderer);
  }
}
// Tiefenunschärfe mit der Tiefe aus dem Szenendurchgang.
class DofPass extends Pass{
  constructor(camera){
    super();this.camera=camera;this.strength=1;this.focus=300;this.depthTexture=null;
    this.material=new T.ShaderMaterial({uniforms:{tColor:{value:null},tDepth:{value:null},uNear:{value:1},uFar:{value:1000},uFocus:{value:300},uRange:{value:100},uSharp:{value:20},uMaxBlur:{value:.01},uAspect:{value:1}},
      vertexShader:'varying vec2 vUv;void main(){vUv=uv;gl_Position=vec4(position.xy,0.0,1.0);}',
      fragmentShader:`#include <packing>
        varying vec2 vUv;uniform sampler2D tColor,tDepth;uniform float uNear,uFar,uFocus,uRange,uSharp,uMaxBlur,uAspect;
        float viewZ(vec2 uv){return -perspectiveDepthToViewZ(texture2D(tDepth,uv).x,uNear,uFar);}
        float coc(float z){return clamp((abs(z-uFocus)-uSharp)/uRange,0.0,1.0);}
        void main(){float z=viewZ(vUv),c=coc(z);vec3 acc=texture2D(tColor,vUv).rgb;float total=1.0;
          for(int i=1;i<SAMPLES;i++){float fi=float(i),r=sqrt(fi/float(SAMPLES)),a=fi*2.3999632;vec2 uv=vUv+vec2(cos(a)/uAspect,sin(a))*r*uMaxBlur;
            float sz=viewZ(uv),sc=coc(sz),reach=sz<z?max(c,sc):min(c,sc+.25);float w=1.0-smoothstep(reach-.1,reach+.02,r);
            acc+=texture2D(tColor,uv).rgb*w;total+=w;}
          gl_FragColor=vec4(acc/total,1.0);}`,defines:{SAMPLES:40}});
    this.quad=new FullScreenQuad(this.material);
  }
  setSize(w,h){this.material.uniforms.uAspect.value=w/h;}
  render(renderer,writeBuffer,readBuffer){
    const u=this.material.uniforms;u.tColor.value=readBuffer.texture;u.tDepth.value=this.depthTexture;u.uNear.value=this.camera.near;u.uFar.value=this.camera.far;
    // Scharfe Zone: 14,5 % der Entfernung vor und hinter dem Schärfepunkt, aus der Nähe aber mindestens 14 m – sonst wird schon ein einzelnes Haus vorn und hinten unscharf.
    u.uFocus.value=this.focus;u.uRange.value=this.focus*.66;u.uSharp.value=Math.max(this.focus*.145,14);u.uMaxBlur.value=.0095*this.strength;
    renderer.setRenderTarget(this.renderToScreen?null:writeBuffer);this.quad.render(renderer);
  }
}
// Farbabstimmung, Randabdunklung, Regen und Schneefall.
const GradeShader={uniforms:{tDiffuse:{value:null},uSat:{value:1},uContrast:{value:1},uTint:{value:new T.Vector3(1,1,1)},uVignette:{value:.3},uRain:{value:0},uSnowfall:{value:0},uTime:{value:0},uAspect:{value:1}},
  vertexShader:'varying vec2 vUv;void main(){vUv=uv;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.0);}',
  fragmentShader:`varying vec2 vUv;uniform sampler2D tDiffuse;uniform float uSat,uContrast,uVignette,uRain,uSnowfall,uTime,uAspect;uniform vec3 uTint;
    float h1(float n){return fract(sin(n*91.345)*47453.5453);}float h2(vec2 p){return fract(sin(dot(p,vec2(127.1,311.7)))*43758.5453);}
    void main(){vec3 c=texture2D(tDiffuse,vUv).rgb;float l=dot(c,vec3(.2126,.7152,.0722));c=mix(vec3(l),c,uSat);c=(c-.5)*uContrast+.5;c*=uTint;
      vec2 p=vUv*vec2(uAspect,1.0);
      if(uRain>0.0){float streak=0.0;for(int i=0;i<3;i++){float s=1.0+float(i)*.45;vec2 q=vec2((p.x+p.y*.07)*85.0*s,p.y*2.6*s+uTime*(2.4+float(i)*.7));float column=floor(q.x),n=h1(column+float(i)*17.0);
        float y=fract(q.y+n*9.0),x=abs(fract(q.x)-.5);streak+=smoothstep(.12,.02,x)*smoothstep(0.0,.05,y)*smoothstep(.30,.10,y)*step(1.0-uRain*.75,n);}
        c=mix(c,vec3(.86,.9,.95),clamp(streak,0.0,1.0)*.17);}
      // Schneefall in sieben Tiefenlagen: vorn wenige grosse, unscharfe Flocken, hinten viele feine.
      if(uSnowfall>0.0){float flake=0.0;for(int i=0;i<7;i++){float k=float(i),s=6.0+k*k;vec2 q=p*s+vec2(sin(uTime*.35+k*1.7)*.35,uTime*s*(.05+.12/(1.0+k)));vec2 id=floor(q),f=fract(q)-.5;
        vec2 o=(vec2(h2(id+3.0),h2(id+7.0))-.5)*.7;float r=h2(id+k*5.0),size=mix(.02,.06,r*r)*(i<2?2.4:1.0);
        flake+=smoothstep(size,size*.25,length(f-o))*step(1.0-uSnowfall*.5,h2(id+k*13.0))*(i<2?.4:mix(.9,.55,k/6.0));}
        c=mix(c,vec3(.96,.97,1.0),clamp(flake,0.0,1.0)*.8);}
      vec2 q=(vUv-.5)*vec2(1.0,.82);c*=1.0-uVignette*pow(length(q)*1.35,2.6);gl_FragColor=vec4(clamp(c,0.0,1.0),1.0);}`};

const hashInt=n=>{n=Math.imul(n^0x9e3779b9,0x85ebca6b);n^=n>>>13;n=Math.imul(n,0xc2b2ae35);return ((n^(n>>>16))>>>0)/4294967296;};
const nameSeed=name=>{let h=7;for(const ch of name)h=(h*31+ch.charCodeAt(0))|0;return h;};
const distanceToSegment=(p,a,b)=>{const dx=b[0]-a[0],dz=b[1]-a[1],t=Math.max(0,Math.min(1,((p[0]-a[0])*dx+(p[1]-a[1])*dz)/(dx*dx+dz*dz||1)));return Math.hypot(p[0]-a[0]-t*dx,p[1]-a[1]-t*dz);};
const pointIn=(p,poly)=>{let yes=false;for(let i=0,j=poly.length-1;i<poly.length;j=i++){const a=poly[i],b=poly[j];if((a[1]>p[1])!==(b[1]>p[1])&&p[0]<(b[0]-a[0])*(p[1]-a[1])/(b[1]-a[1])+a[0])yes=!yes;}return yes;};
const ROOF_DETAIL=/Dachziegel|Firstabdeckung|Dachabschluss/;

export async function createAtmosphere({renderer,scene,camera,controls,model,sun,hemi,viewport}){
  const mobile=matchMedia('(max-width:720px)').matches,added=new T.Group();added.name='Stimmung_Zusatz_illustrativ';added.visible=false;scene.add(added);
  const G={uLd:{value:0},uWind:{value:0},uWindAmt:{value:0},uWindDir:{value:new T.Vector2(1,0)},uBare:{value:0},uSnow:{value:0},uLit:{value:0},uHour:{value:20},uSeconds:{value:0},uSunDir:{value:new T.Vector3(0,1,0)},uFolSun:{value:new T.Color('#fff')},uBack:{value:new T.Color('#000')},uRoofTint:{value:new T.Color()},uRoofAmt:{value:0},uWallTint:{value:new T.Color('#fff')}};
  let enabled=false,weather=null,look=derive(null),session=null;const sunDirection=new T.Vector3(...GOLDEN.sunDir).normalize();

  // ------------------------------------------------------------ Materialien
  let groundSeed=0; // feste Folge: gleiche Flächenmuster bei jedem Laden
  function groundMaterial(kind,extra={}){
    const u={uA:{value:new T.Color()},uB:{value:new T.Color()},uC:{value:new T.Color()},uSeed:{value:hashInt(++groundSeed)*100},...extra};
    const m=new T.MeshStandardMaterial({roughness:1,metalness:0,polygonOffset:kind==='field'||kind==='paved',polygonOffsetFactor:-1,polygonOffsetUnits:-1});
    m.onBeforeCompile=sh=>{Object.assign(sh.uniforms,u);
      sh.vertexShader='varying vec3 vLdW;\n'+(kind==='paved'?'attribute float aGreen;varying float vLdGreen;\n':'')+sh.vertexShader.replace('#include <begin_vertex>','#include <begin_vertex>\nvLdW=(modelMatrix*vec4(position,1.0)).xyz;'+(kind==='paved'?'vLdGreen=aGreen;':''));
      sh.fragmentShader='varying vec3 vLdW;uniform vec3 uA,uB,uC;uniform float uSeed;'+(kind==='paved'?'varying float vLdGreen;':'')+(kind==='surround'?'uniform vec3 uF[5];uniform vec3 uWoodColor;uniform sampler2D uWoodMask;uniform float uWoodExtent,uFocus;':'')+NOISE+sh.fragmentShader.replace('#include <color_fragment>','#include <color_fragment>\n'+GROUND_CHUNK[kind]);};
    m.customProgramCacheKey=()=>'ld-ground-'+kind;m.userData.u=u;m.userData.stimmung=true;return m;
  }
  function extend(material,key,uniforms,declarations,chunk,anchor='#include <roughnessmap_fragment>',vertex=null){
    const previous=material.onBeforeCompile;
    material.onBeforeCompile=(sh,r)=>{previous?.(sh,r);Object.assign(sh.uniforms,uniforms);sh.fragmentShader=declarations+sh.fragmentShader.replace(anchor,chunk+'\n'+anchor);
      if(vertex)sh.vertexShader=vertex.declarations+sh.vertexShader.replace('#include <begin_vertex>','#include <begin_vertex>\n'+vertex.chunk);};
    material.customProgramCacheKey=()=>key;material.needsUpdate=true;
  }
  const terrain=model.groups.terrain.children.find(o=>o.name==='Gelaende_129x129_Verkehrskorridore'),lawn=groundMaterial('lawn');
  const pedestal=model.groups.terrain.children.filter(o=>['Geländekanten','Modellsockel','Präsentationsboden'].includes(o.name));
  const hex=m=>m?.color?.getHexString?.(),typeByHex={'789445':'crop','729549':'crop','b9ac65':'grain','92744e':'soil','8a6b46':'soil','91a765':'meadow','8aab66':'meadow','81a86d':'meadow','687d46':'wood'};
  const fields=[],water=[],rows=[];let plot=0;
  for(const o of model.groups.surfaces.children){if(!o.isMesh||o.isInstancedMesh)continue;const h=hex(o.material);
    if(h==='58a6af'){if(!water.includes(o.material))water.push(o.material);continue;}if(o.name==='Feldreihen_3D'){rows.push(o);continue;}
    const type=typeByHex[h];if(type)fields.push({mesh:o,material:groundMaterial('field'),type,pick:hashInt(plot*17+3),alt:hashInt(plot++*29+5)});}
  for(const o of model.groups.pools.children)if(hex(o.material)==='58a6af'&&!water.includes(o.material))water.push(o.material);
  // Flächen und Körper der amtlichen Vermessung: Beläge und Grün mit lebendiger Oberfläche, Farben je Stimmung.
  const avMeshes=(model.groups.cadastre?.children||[]).filter(o=>o.userData.kind==='cadastre').map(mesh=>{const role=mesh.userData.role,material=['paved','asphalt','gravel','slab','garden','green','walk','rail'].includes(role)?groundMaterial(mesh.geometry.getAttribute('aGreen')?'paved':'field'):null;if(material)material.polygonOffsetFactor=material.polygonOffsetUnits=-2;return {mesh,role,material};});
  // Gebäude: wärmere Dächer und Fassaden, Schnee. Die Ziegelstruktur des Modells bleibt erhalten.
  const buildingUniforms={uLd:G.uLd,uRoofTint:G.uRoofTint,uRoofAmt:G.uRoofAmt,uWallTint:G.uWallTint,uSnow:G.uSnow},greenhouses=[];
  for(const o of model.buildingMeshes){if(o.userData.buildingType==='greenhouse'){greenhouses.push(o);continue;}
    const original=model.quality.changes.find(c=>c.obj===o)?.previous||o.material;if(!Array.isArray(original))extend(original,'ld-building',buildingUniforms,'uniform vec3 uRoofTint,uWallTint;uniform float uRoofAmt,uSnow,uLd;\n',BUILDING_CHUNK);}
  for(const change of model.quality.changes){if(!change.obj.userData.qualityBuilding||!Array.isArray(change.next))continue;const [roof,wall]=change.next;
    extend(roof,'ld-quality-roof',buildingUniforms,'uniform vec3 uRoofTint;uniform float uRoofAmt,uSnow,uLd;\n','{vec3 ldBase=diffuseColor.rgb;float ldL=dot(ldBase,vec3(.299,.587,.114));diffuseColor.rgb=mix(ldBase,uRoofTint*ldL,uRoofAmt)*1.15+.008;diffuseColor.rgb=mix(diffuseColor.rgb,vec3(.93,.95,1.0),uSnow*.9);diffuseColor.rgb=mix(ldBase,diffuseColor.rgb,uLd);}');
    extend(wall,'ld-quality-wall',buildingUniforms,'uniform vec3 uWallTint;uniform float uLd;\n','{diffuseColor.rgb=mix(diffuseColor.rgb,diffuseColor.rgb*uWallTint,uLd);}');}
  // Laub: Volumen, Gegenlicht, Schnee.
  const foliageUniforms={uLd:G.uLd,uWind:G.uWind,uWindAmt:G.uWindAmt,uWindDir:G.uWindDir,uBare:G.uBare,uSunDir:G.uSunDir,uFolSun:G.uFolSun,uBack:G.uBack,uSnow:G.uSnow},seen=new Set();let foliage=null;
  model.root.traverse(o=>{const m=o.material;if(m&&!Array.isArray(m)&&m.userData?.dioramaSurface==='foliage'&&!seen.has(m)){seen.add(m);extend(m,'ld-foliage',foliageUniforms,'uniform vec3 uSunDir,uFolSun,uBack;uniform float uSnow,uLd,uBare;\n',FOLIAGE_CHUNK,undefined,FOLIAGE_VERTEX);if(!foliage&&/Baumkronen_Ferne/.test(o.name))foliage=m;}});
  // Fenster: spiegelnd am Tag, leuchtend bei Dunkelheit.
  const windows=model.groups.details.children.find(o=>o.name==='Fenster_stilisiert'),windowMaterial=new T.MeshStandardMaterial({color:'#30484b',roughness:.1,metalness:.6,envMapIntensity:1.7});
  // Licht in den Fenstern je Haus und Zimmer nach Tageslauf (Regel in house-lights.js)
  windowMaterial.onBeforeCompile=sh=>{sh.uniforms.uLit=G.uLit;sh.uniforms.uHour=G.uHour;sh.uniforms.uSeconds=G.uSeconds;sh.vertexShader=WINDOW_VERTEX_DECLARATIONS+sh.vertexShader.replace('#include <begin_vertex>','#include <begin_vertex>\n'+WINDOW_VERTEX_CHUNK);
    sh.fragmentShader=WINDOW_FRAGMENT_DECLARATIONS+sh.fragmentShader.replace('#include <emissivemap_fragment>','#include <emissivemap_fragment>\n'+WINDOW_FRAGMENT_CHUNK);};
  windowMaterial.customProgramCacheKey=()=>'ld-window-v3';windowMaterial.userData.stimmung=true;
  const lodGroups=[],foliageMeshes=[];
  model.root.traverse(o=>{if(o.userData.detailLOD)lodGroups.push(o);if(o.userData.forestFar)foliageMeshes.push(o);});
  const hedges=model.groups.vegetation.children.filter(o=>o.name==='Hecken_angenähert'),tufts=[];model.root.traverse(o=>{if(o.isInstancedMesh&&(o.name==='Grasbüschel'||o.name==='Pflanzenreihen_im_Acker'))tufts.push(o);});
  const frames=[];model.groups.world.traverse(o=>{if(o.name==='Gewaechshaus_Tragwerk')frames.push(o);});

  // ------------------------------------------------------------ Kaminrauch (illustrativ)
  // Bei Kälte steigt über einem Teil der kleineren Gebäude Rauch auf und treibt mit dem Wind. Kamine sind nicht erhoben:
  // der Rauch entspringt dem höchsten Punkt des Daches, und welche Häuser heizen, ist ausgelost.
  const smokeSources=[];{model.root.updateMatrixWorld(true);const box=new T.Box3();model.buildingMeshes.forEach((o,i)=>{if(!o.visible||o.userData.buildingType==='greenhouse')return;box.setFromObject(o);const w=box.max.x-box.min.x,d=box.max.z-box.min.z;if(w*d<50||w*d>700||hashInt(i*53+7)>.5)return;
      const x=(box.min.x+box.max.x)/2+(hashInt(i*11)-.5)*w*.25,z=(box.min.z+box.max.z)/2+(hashInt(i*17)-.5)*d*.25;if(model.boundary.contains([x,z]))smokeSources.push({x,y:box.max.y-.2,z,seed:hashInt(i*29+1)});});}
  const PUFFS=5,smoke=new T.InstancedMesh(new T.IcosahedronGeometry(1,1),new T.MeshBasicMaterial({color:'#d9dde2',transparent:true,opacity:.3,depthWrite:false,fog:true}),smokeSources.length*PUFFS);smoke.name='Kaminrauch_illustrativ';smoke.frustumCulled=false;smoke.visible=false;smoke.renderOrder=3;added.add(smoke);
  const smokeDummy=new T.Object3D();
  function updateSmoke(){if(!smoke.visible)return;const t=wind.seconds,push=1.2+2.2*wind.strength;smokeSources.forEach((s,i)=>{for(let k=0;k<PUFFS;k++){const p=(t*.11+k/PUFFS+s.seed)%1,size=(.5+p*2.3)*Math.min(1,p*8)*Math.min(1,(1-p)*3.2);
        smokeDummy.position.set(s.x+wind.direction.x*p*p*push*3+Math.sin(t*.7+s.seed*40+k)*.25*p,s.y+p*6.5,s.z+wind.direction.y*p*p*push*3+Math.cos(t*.6+s.seed*31+k)*.25*p);smokeDummy.scale.set(size,size*.85,size);smokeDummy.updateMatrix();smoke.setMatrixAt(i*PUFFS+k,smokeDummy.matrix);}});smoke.instanceMatrix.needsUpdate=true;}

  // ------------------------------------------------------------ Himmel
  const skyUniforms={uZenith:{value:new T.Color()},uHorizon:{value:new T.Color()},uGlow:{value:new T.Color()},uGlowDir:{value:new T.Vector3(0,1,0)},uClouds:{value:.4},uOver:{value:0},uCloudLight:{value:new T.Color()},uDrift:{value:new T.Vector2()},uNight:{value:0},uMoonDir:{value:new T.Vector3(0,-1,0)},uSunTrue:{value:new T.Vector3(0,1,0)}};
  const skyMaterial=disc=>new T.ShaderMaterial({side:T.BackSide,depthWrite:false,fog:false,uniforms:{...skyUniforms,uDisc:{value:disc}},
    vertexShader:'varying vec3 vDir;void main(){vDir=position;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.0);}',
    fragmentShader:`varying vec3 vDir;uniform vec3 uZenith,uHorizon,uGlow,uGlowDir,uCloudLight,uMoonDir,uSunTrue;uniform vec2 uDrift;uniform float uClouds,uOver,uDisc,uNight;${NOISE}
      float ldStar(vec3 p){return fract(sin(dot(p,vec3(127.1,311.7,74.7)))*43758.5453);}
      void main(){vec3 d=normalize(vDir);float h=max(d.y,0.0);vec3 c=mix(uHorizon,uZenith,smoothstep(0.0,.4,pow(h,.5)));
        float s=max(dot(d,normalize(uGlowDir)),0.0);c+=uGlow*(pow(s,6.0)*.30+pow(s,48.0)*.55);
        vec2 p=d.xz/(d.y+.16)*1.25-uDrift;float cl=ldFbm(p*1.7+3.0)*.65+ldFbm(p*4.3)*.35;
        float cover=smoothstep(.50-.5*uOver,.74-.34*uOver,cl)*mix(uClouds,1.0,uOver)*smoothstep(.015,.2,d.y);
        vec3 cloud=mix(uHorizon*1.05,uCloudLight,smoothstep(.5-.3*uOver,.9,cl))+uGlow*pow(s,5.0)*.5;c=mix(c,cloud,cover);
        c+=uGlow*uDisc*smoothstep(.99965,.99992,s)*14.0*(1.0-cover);
        // Sterne: zufällig verteilte Punkte, nur bei Dunkelheit und wo keine Wolke steht. Es sind keine echten Sternbilder.
        if(uNight>.02&&d.y>0.0){vec3 q=d*190.0,cell=floor(q);float h=ldStar(cell),spot=1.0-smoothstep(.0,.22,length(fract(q)-.5-(vec3(ldStar(cell+1.7),ldStar(cell+5.3),ldStar(cell+9.1))-.5)*.5));
          c+=vec3(.9,.95,1.0)*step(.988,h)*spot*(.3+.8*fract(h*97.0))*uNight*(1.0-cover)*smoothstep(.02,.25,d.y)*uDisc;}
        // Mond: an seiner gerechneten Stelle, mit Phase; zur Sichtbarkeit rund sechsmal grösser als in Wirklichkeit
        {float m=dot(d,uMoonDir),radius=.028,edge=1.0-smoothstep(radius*.94,radius,acos(clamp(m,-1.0,1.0)));
         if(edge>0.0&&uMoonDir.y>-.02){vec3 off=(d-uMoonDir*m)/radius;vec3 toSun=normalize(uSunTrue-uMoonDir*dot(uSunTrue,uMoonDir)+1e-5);float x=dot(off,toSun),y2=clamp(dot(off,off)-x*x,0.0,1.0);
           float lit=smoothstep(-.06,.06,x-dot(uSunTrue,uMoonDir)*sqrt(1.0-y2));c=mix(c,mix(c+vec3(.05,.06,.08),vec3(1.0,.97,.88)*(.85+.45*uNight),lit),edge*(1.0-cover)*(.3+.7*uNight)*uDisc);}}
        c=mix(c,uHorizon*.72,smoothstep(0.0,-.25,d.y));gl_FragColor=vec4(c,1.0);}`});
  const sky=new T.Mesh(new T.SphereGeometry(1,48,24),skyMaterial(1));sky.name='Himmel';sky.frustumCulled=false;sky.renderOrder=-10;added.add(sky);
  const envScene=new T.Scene();envScene.add(new T.Mesh(new T.SphereGeometry(40,32,16),skyMaterial(0)));
  const pmrem=new T.PMREMGenerator(renderer);let envTarget=null;
  const fog=new T.FogExp2('#ffffff',.0002);

  // ------------------------------------------------------------ Umland
  // Gelände im Kartenrechteck: echtes swisstopo-Terrain des Modells. Felder und Bäume darauf sind illustrativ.
  const W=model.halfWidth,D=model.halfDepth,rings=model.boundary.rings;
  const boundaryDistance=p=>{let best=Infinity;for(const ring of rings)for(let i=0;i<ring.length-1;i++)best=Math.min(best,distanceToSegment(p,ring[i],ring[i+1]));return best;};
  const surroundHeight=(x,z)=>{const out=Math.max(Math.abs(x)-W,Math.abs(z)-D,0),t=Math.min(1,out/900),s=t*t*(3-2*t);return model.height(x,z)*(1-s)-15*s;};
  const axis=half=>{const v=[];for(let i=0;i<=256;i++)v.push(-half+i*half/128);let step=24,x=half;while(x<11000){step*=1.32;x+=step;v.push(x);v.unshift(-x);}return v;};
  const xs=axis(W),zs=axis(D),positions=[],index=[];
  for(const z of zs)for(const x of xs){let y=surroundHeight(x,z);if(Math.abs(x)<=W&&Math.abs(z)<=D&&model.boundary.contains([x,z]))y-=boundaryDistance([x,z])>22?4:.5;else y-=.2;positions.push(x,y,z);}
  for(let j=0;j<zs.length-1;j++)for(let i=0;i<xs.length-1;i++){const a=j*xs.length+i,b=a+1,c=a+xs.length,d=c+1;index.push(a,c,b,b,c,d);}
  const surroundGeometry=new T.BufferGeometry();surroundGeometry.setAttribute('position',new T.Float32BufferAttribute(positions,3));surroundGeometry.setIndex(index);surroundGeometry.computeVertexNormals();
  const N=256,extent=9600,maskData=new Uint8Array(N*N),grid=new Float32Array(33*33).map((_,i)=>hashInt(i*7+13));
  const smooth=(u,v)=>{const x=u*32,y=v*32,i=Math.min(31,Math.floor(x)),j=Math.min(31,Math.floor(y)),fx=x-i,fy=y-j,sx=fx*fx*(3-2*fx),sy=fy*fy*(3-2*fy);return (grid[j*33+i]*(1-sx)+grid[j*33+i+1]*sx)*(1-sy)+(grid[(j+1)*33+i]*(1-sx)+grid[(j+1)*33+i+1]*sx)*sy;};
  for(let j=0;j<N;j++)for(let i=0;i<N;i++)maskData[j*N+i]=Math.round(smooth(i/(N-1),j/(N-1))*255);
  const mask=new T.DataTexture(maskData,N,N,T.RedFormat);mask.magFilter=mask.minFilter=T.LinearFilter;mask.needsUpdate=true;
  const woodAt=(x,z)=>{const u=x/extent+.5,v=z/extent+.5;return u<0||u>1||v<0||v>1?0:smooth(u,v);};
  const surroundMaterial=groundMaterial('surround',{uF:{value:[0,1,2,3,4].map(()=>new T.Color())},uWoodColor:{value:new T.Color()},uWoodMask:{value:mask},uWoodExtent:{value:extent},uFocus:{value:0}});
  const surround=new T.Mesh(surroundGeometry,surroundMaterial);surround.name='Umland_Gelaende';surround.receiveShadow=true;added.add(surround);
  const instanced=(geometry,material,list,name)=>{const mesh=new T.InstancedMesh(geometry,material,list.length),dummy=new T.Object3D();list.forEach((t,i)=>{dummy.position.set(t.x,t.y,t.z);dummy.scale.set(t.sx,t.sy,t.sz);dummy.rotation.y=(t.n??i)*1.7;dummy.updateMatrix();mesh.setMatrixAt(i,dummy.matrix);mesh.setColorAt(i,new T.Color('#fff'));});mesh.name=name;mesh.castShadow=true;mesh.receiveShadow=true;mesh.userData.items=list;mesh.userData.illustrative=true;added.add(mesh);return mesh;};
  // Grosse Mengen gleicher Objekte in Kacheln aufteilen: gezeichnet wird nur, was im Bild (bzw. im Schattenbereich) liegt.
  // Das Bild bleibt gleich; Farbe und Form hängen nur vom einzelnen Objekt ab, nicht von der Kachel.
  const tiled=(geometry,material,list,name,size)=>{const cells=new Map();list.forEach((item,n)=>{item.n=n;});for(const item of list){const key=Math.floor(item.x/size)+'|'+Math.floor(item.z/size);if(!cells.has(key))cells.set(key,[]);cells.get(key).push(item);}
    return [...cells.values()].map(items=>{const mesh=instanced(geometry,material,items,name);mesh.computeBoundingSphere();mesh.userData.centre=mesh.boundingSphere.center.clone();return mesh;});};
  let seed=91;const rnd=()=>hashInt(seed++),far=[];
  for(let k=0;k<90000&&far.length<(mobile?2500:6500);k++){const radius=200+Math.pow(rnd(),.7)*3000,angle=rnd()*Math.PI*2,x=Math.cos(angle)*radius,z=Math.sin(angle)*radius;
    if(model.boundary.contains([x,z])||boundaryDistance([x,z])<12)continue;const w=woodAt(x,z);if(w<.65&&rnd()>.012)continue;
    const big=w>=.65,r=big?7.5+rnd()*5:3+rnd()*2.5,h=big?15+rnd()*9:7+rnd()*5;far.push({x,z,y:surroundHeight(x,z)+h*.62,sx:r,sy:h*.5,sz:r,tree:far.length});}
  const surroundTrees=tiled(new T.IcosahedronGeometry(1,1),foliage,far,'Umland_Baeume',400);
  // Gemeindegrenze als feine Linie, sichtbar aus der Distanz.
  const borderPositions=[];for(const ring of rings)for(let i=0;i<ring.length-1;i++){const a=ring[i],b=ring[i+1],len=Math.hypot(b[0]-a[0],b[1]-a[1]),n=Math.max(1,Math.ceil(len/12)),nx=-(b[1]-a[1])/len*3,nz=(b[0]-a[0])/len*3;
    for(let k=0;k<n;k++){const p=[a[0]+(b[0]-a[0])*k/n,a[1]+(b[1]-a[1])*k/n],q=[a[0]+(b[0]-a[0])*(k+1)/n,a[1]+(b[1]-a[1])*(k+1)/n],hp=model.height(...p)+1.2,hq=model.height(...q)+1.2;
      borderPositions.push(p[0]-nx,hp,p[1]-nz,p[0]+nx,hp,p[1]+nz,q[0]-nx,hq,q[1]-nz,p[0]+nx,hp,p[1]+nz,q[0]+nx,hq,q[1]+nz,q[0]-nx,hq,q[1]-nz);}}
  const borderGeometry=new T.BufferGeometry();borderGeometry.setAttribute('position',new T.Float32BufferAttribute(borderPositions,3));
  const border=new T.Mesh(borderGeometry,new T.MeshBasicMaterial({color:'#fff6df',transparent:true,opacity:0,depthWrite:false,fog:false,side:T.DoubleSide}));border.name='Gemeindegrenze_2026_Linie';added.add(border);

  // ------------------------------------------------------------ Gartengrün (illustrativ)
  const [world,street,landscape]=await Promise.all(['world-details','mainstreet-detail','landscape'].map(n=>fetch('data/'+n+'.json').then(r=>r.json())));
  model.root.updateMatrixWorld(true);
  const allBoxes=model.buildingMeshes.map(o=>new T.Box3().setFromObject(o)),houseBoxes=model.buildingMeshes.map((o,i)=>o.visible&&o.userData.buildingType!=='greenhouse'?allBoxes[i]:null).filter(Boolean);
  const blocked=[world.sport?.points,world.playground?.points,...(world.patios||[]).map(p=>p.points),...(world.gardens||[]).map(p=>p.points),...(world.parking||[]).map(p=>p.points),world.station?.platform,world.workyard?.points,world.storageYard?.points,
    ...(street.surfaces||[]).map(a=>a.pixels.map(([x,y])=>[x/street.referenceSize[0]*500-250,y/street.referenceSize[1]*440-220]))].filter(p=>p&&p.length>2);
  const acres=[...landscape.fields.filter(f=>f.type!=='meadow').map(f=>f.pixels.map(([x,y])=>[x/landscape.referenceImageSize[0]*2*W-W,y/landscape.referenceImageSize[1]*2*D-D])),...model.fields.filter(f=>f.type!=='grass').map(f=>f.poly)];
  const roads=model.roadSegments,bushes=[],trunks=[],crowns=[],taken=[];seed=4711;
  const free=(x,z,margin)=>model.boundary.contains([x,z])&&!allBoxes.some(b=>x>b.min.x-margin&&x<b.max.x+margin&&z>b.min.z-margin&&z<b.max.z+margin)&&!blocked.some(poly=>pointIn([x,z],poly))&&!roads.some(s=>Math.abs((s.a[0]+s.b[0])/2-x)<80&&Math.abs((s.a[1]+s.b[1])/2-z)<80&&distanceToSegment([x,z],s.a,s.b)<s.width/2+2.2);
  const plant=(x,z,h,r,parts)=>{const y=model.height(x,z),girth=Math.max(1,h/7);taken.push([x,z]);trunks.push({x,y:y+h*.3,z,sx:girth,sy:h*.6,sz:girth});for(let c=0;c<parts;c++){const a=c*2.4+rnd(),ring=c?r*.42:0,rr=r*(c?.6:.85);crowns.push({x:x+Math.cos(a)*ring,y:y+h*(.66+rnd()*.14),z:z+Math.sin(a)*ring,sx:rr,sy:rr*(.85+rnd()*.3),sz:rr,tree:trunks.length});}};
  for(const mesh of foliageMeshes){if(!/Baumkronen_Ferne/.test(mesh.name))continue;const m=new T.Matrix4();for(let i=0;i<mesh.count;i+=3){mesh.getMatrixAt(i,m);taken.push([m.elements[12],m.elements[14]]);}}
  // Mit amtlicher Vermessung: Sträucher und Bäume nur in Gartenanlagen und Grünflächen, nie auf Vorplätzen,
  // Zufahrten, Strassen oder Gebäudegrundrissen. Die einzelnen Pflanzen bleiben illustrativ.
  const cad=model.cadastre;
  if(cad){
    const edgeDistance=(p,ring)=>{let best=Infinity;for(let i=0;i<ring.length;i++)best=Math.min(best,distanceToSegment(p,ring[i],ring[(i+1)%ring.length]));return best;};
    const nearFootprint=(x,z,d)=>cad.footprints.some(f=>x>f.box.minX-d&&x<f.box.maxX+d&&z>f.box.minZ-d&&z<f.box.maxZ+d&&(pointIn([x,z],f.rings[0])||edgeDistance([x,z],f.rings[0])<d));
    const clear=(x,z,d)=>model.boundary.contains([x,z])&&!model.quarter?.occupied(x,z)&&!nearFootprint(x,z,d)&&!cad.onHard(x,z)&&!blocked.some(poly=>pointIn([x,z],poly))&&!roads.some(s=>Math.abs((s.a[0]+s.b[0])/2-x)<80&&Math.abs((s.a[1]+s.b[1])/2-z)<80&&distanceToSegment([x,z],s.a,s.b)<s.width/2+.8);
    const roomy=(x,z,d)=>clear(x,z,d)&&[[1.6,0],[-1.6,0],[0,1.6],[0,-1.6]].every(([dx,dz])=>!cad.onHard(x+dx,z+dz))&&!taken.some(t=>Math.hypot(t[0]-x,t[1]-z)<5.5);
    const bush=(x,z,r)=>{const y=model.height(x,z);bushes.push({x,y:y+r*.55,z,sx:r*(.85+rnd()*.4),sy:r*(.7+rnd()*.35),sz:r*(.85+rnd()*.4),tree:bushes.length});};
    const ringArea=ring=>{let a=0;for(let i=0,j=ring.length-1;i<ring.length;j=i++)a+=(ring[j][0]+ring[i][0])*(ring[j][1]-ring[i][1]);return Math.abs(a/2);};
    const within=(p,g)=>p[0]>=g.box.minX&&p[0]<=g.box.maxX&&p[1]>=g.box.minZ&&p[1]<=g.box.maxZ&&pointIn(p,g.rings[0])&&!g.rings.slice(1).some(h=>pointIn(p,h));
    // Gehölze aus den Laserdaten (Standort, Höhe, Kronenradius gemessen); Art und Form bleiben illustrativ.
    if(cad.vegetation?.length){
      for(const p of cad.vegetation)if(p.tree&&clear(p.x,p.z,1.2)&&!taken.some(t=>Math.hypot(t[0]-p.x,t[1]-p.z)<4.2))plant(p.x,p.z,p.h||p.r*2.1+rnd()*1.2,p.r,p.h>14?7:5);
      for(const p of cad.vegetation){if(p.tree||rnd()>=.72)continue;const x=p.x+(rnd()-.5)*.4,z=p.z+(rnd()-.5)*.4;if(clear(x,z,.5)&&!taken.some(t=>Math.hypot(t[0]-x,t[1]-z)<2.2))bush(x,z,p.h?Math.max(.45,Math.min(1.5,p.h*.5)):.55+rnd()*.35);}
    }else for(const g of cad.polygons.garden||[]){const ring=g.rings[0],size=ringArea(ring);if(size<12)continue;
      // Sträucher und Hecken entlang eines Teils der Gartengrenzen
      for(let i=0;i<ring.length;i++){const a=ring[i],b=ring[(i+1)%ring.length],len=Math.hypot(b[0]-a[0],b[1]-a[1]);if(len<4||rnd()>.36)continue;let nx=-(b[1]-a[1])/len,nz=(b[0]-a[0])/len;const mid=[(a[0]+b[0])/2+nx*.9,(a[1]+b[1])/2+nz*.9];if(!within(mid,g)){nx=-nx;nz=-nz;}
        const hedge=rnd()<.45,radius=hedge?.62:.6+rnd()*.6;for(let d=.8;d<len-.6;d+=hedge?1.05:1.5+rnd()*1.2){const x=a[0]+(b[0]-a[0])*d/len+nx*.9,z=a[1]+(b[1]-a[1])*d/len+nz*.9;if(within([x,z],g)&&clear(x,z,.8))bush(x,z,hedge?radius:radius*(.8+rnd()*.5));}}
      // Bäume und Sträucher im Innern
      for(let k=0,n=Math.round(size/60);k<n;k++){const x=g.box.minX+rnd()*(g.box.maxX-g.box.minX),z=g.box.minZ+rnd()*(g.box.maxZ-g.box.minZ);if(!within([x,z],g))continue;
        if(rnd()<.36&&roomy(x,z,2.6))plant(x,z,5+rnd()*4,2.3+rnd()*1.7,5);else if(clear(x,z,1.1)){const r=.6+rnd()*.85;bush(x,z,r);if(rnd()<.4){const x2=x+(rnd()-.5)*r*1.6,z2=z+(rnd()-.5)*r*1.6;if(clear(x2,z2,1.1))bush(x2,z2,r*.8);}}}}
    // Einzelne Obstbäume auf den übrigen Grünflächen
    for(const g of cad.polygons.green||[])for(let k=0,n=Math.round(ringArea(g.rings[0])/230);k<n;k++){const x=g.box.minX+rnd()*(g.box.maxX-g.box.minX),z=g.box.minZ+rnd()*(g.box.maxZ-g.box.minZ);if(within([x,z],g)&&roomy(x,z,3)&&!acres.some(poly=>pointIn([x,z],poly)))plant(x,z,5.5+rnd()*4.5,2.6+rnd()*1.9,6);}
    // Gehölzflächen der AV dicht bestocken
    for(const g of cad.polygons.wood||[])for(let k=0,n=Math.round(ringArea(g.rings[0])/38);k<n;k++){const x=g.box.minX+rnd()*(g.box.maxX-g.box.minX),z=g.box.minZ+rnd()*(g.box.maxZ-g.box.minZ);if(!within([x,z],g)||!clear(x,z,1.5))continue;if(rnd()<.45&&!taken.some(t=>Math.hypot(t[0]-x,t[1]-z)<4.5))plant(x,z,6+rnd()*5,2.4+rnd()*1.6,5);else bush(x,z,1+rnd()*.9);}
  }else{
  for(const b of houseBoxes){const sx=b.max.x-b.min.x,sz=b.max.z-b.min.z;if(sx*sz<25)continue;const perimeter=2*(sx+sz),count=Math.round(perimeter/5.5);
    for(let k=0;k<count;k++){if(rnd()<.42)continue;const d=rnd()*perimeter,off=2.2+rnd()*rnd()*9;let x,z;
      if(d<sx){x=b.min.x+d;z=b.min.z-off;}else if(d<sx+sz){x=b.max.x+off;z=b.min.z+d-sx;}else if(d<2*sx+sz){x=b.max.x-(d-sx-sz);z=b.max.z+off;}else{x=b.min.x-off;z=b.max.z-(d-2*sx-sz);}
      if(!free(x,z,1.4))continue;
      if(rnd()<.24&&off>4.5&&free(x,z,3.4)&&!taken.some(t=>Math.hypot(t[0]-x,t[1]-z)<6))plant(x,z,5.5+rnd()*4,2.5+rnd()*1.8,5);
      else{const y=model.height(x,z),r=.65+rnd()*.9,n=1+Math.floor(rnd()*2.4);for(let c=0;c<n;c++)bushes.push({x:x+(rnd()-.5)*r*1.5,y:y+r*.55,z:z+(rnd()-.5)*r*1.5,sx:r*(.85+rnd()*.4),sy:r*(.7+rnd()*.35),sz:r*(.85+rnd()*.4),tree:bushes.length+c*13});}}}
  for(const b of houseBoxes){const sx=b.max.x-b.min.x,sz=b.max.z-b.min.z;if(sx*sz<60)continue;const cx=(b.min.x+b.max.x)/2,cz=(b.min.z+b.max.z)/2,reach=Math.hypot(sx,sz)/2;
    for(let k=0;k<4;k++){const a=rnd()*Math.PI*2,d=reach+5+rnd()*20,x=cx+Math.cos(a)*d,z=cz+Math.sin(a)*d;
      if(free(x,z,4)&&!acres.some(poly=>pointIn([x,z],poly))&&!taken.some(t=>Math.hypot(t[0]-x,t[1]-z)<8.5))plant(x,z,5.5+rnd()*4.5,2.6+rnd()*1.9,6);}}
  }
  const crownGeometry=new T.IcosahedronGeometry(1,1),gardens=new T.Group();gardens.name='Gartengruen_illustrativ';added.add(gardens);
  const crownFine=new T.IcosahedronGeometry(1,mobile?1:2),bushMeshes=tiled(crownGeometry,foliage,bushes,'Gartenbuesche',120),crownMeshes=tiled(crownFine,foliage,crowns,'Gartenbaeume_Kronen',120),trunkMeshes=tiled(new T.CylinderGeometry(.12,.2,1,7),new T.MeshStandardMaterial({color:'#6d5a45',roughness:1}),trunks,'Gartenbaeume_Staemme',120);
  gardens.add(...bushMeshes,...crownMeshes,...trunkMeshes);

  // ------------------------------------------------------------ Laternenlicht bei Dunkelheit
  const lamps=new T.Group();lamps.name='Laternenlicht';lamps.visible=false;added.add(lamps);const heads=new Map();
  model.groups.world.traverse(o=>{if(!/Bahnhof_Lampenglas/.test(o.name))return;const push=p=>{const key=Math.round(p.x/2)+'|'+Math.round(p.z/2);if(!heads.has(key))heads.set(key,p);};
    if(o.isInstancedMesh){const m=new T.Matrix4();for(let i=0;i<o.count;i++){o.getMatrixAt(i,m);push(new T.Vector3().setFromMatrixPosition(m).applyMatrix4(o.matrixWorld));}}else if(o.isMesh)push(new T.Box3().setFromObject(o).getCenter(new T.Vector3()));});
  const bulbMaterial=new T.MeshBasicMaterial({color:new T.Color('#ffd9a0').multiplyScalar(6),toneMapped:false});
  for(const p of heads.values()){const bulb=new T.Mesh(new T.SphereGeometry(.22,10,8),bulbMaterial);bulb.position.copy(p);lamps.add(bulb);if(!mobile){const light=new T.PointLight('#ffc27a',260,46,1.9);light.position.copy(p).y-=.4;lamps.add(light);}}

  // ------------------------------------------------------------ Nachbearbeitung
  const composer=new EffectComposer(renderer),scenePass=new ScenePass(scene,camera);composer.addPass(scenePass);
  const cloudShade=new CloudShadowPass(camera,scenePass.depthTexture);composer.addPass(cloudShade);
  const gtao=new GTAOPass(scene,camera,viewport.clientWidth,viewport.clientHeight);gtao.updateGtaoMaterial({radius:4,distanceExponent:1.2,thickness:1.6,scale:1.45,samples:mobile?8:12,screenSpaceRadius:false});gtao.updatePdMaterial({lumaPhi:10,depthPhi:2,normalPhi:3,radius:4,radiusExponent:1,rings:2,samples:mobile?8:16});
  // Kein eigener Normalen-Durchgang: Normalen werden aus der Szenentiefe abgeleitet.
  gtao._renderGBuffer=false;gtao.depthTexture=scenePass.depthTexture;gtao.normalTexture=undefined;
  for(const m of [gtao.gtaoMaterial,gtao.pdMaterial]){m.defines.NORMAL_VECTOR_TYPE=0;m.uniforms.tNormal.value=null;m.uniforms.tDepth.value=scenePass.depthTexture;m.needsUpdate=true;}
  composer.addPass(gtao);
  const dof=new DofPass(camera);dof.depthTexture=scenePass.depthTexture;composer.addPass(dof);
  const bloom=new UnrealBloomPass(new T.Vector2(viewport.clientWidth,viewport.clientHeight),.14,.7,.95);composer.addPass(bloom);
  composer.addPass(new OutputPass());const fxaa=new ShaderPass(FXAAShader);composer.addPass(fxaa);const grade=new ShaderPass(GradeShader);composer.addPass(grade);
  function setSize(w,h){const ratio=renderer.getPixelRatio();composer.setSize(w,h);gtao.setSize(Math.round(w*ratio*.6),Math.round(h*ratio*.6));dof.setSize(w,h);fxaa.material.uniforms.resolution.value.set(1/(w*ratio),1/(h*ratio));grade.uniforms.uAspect.value=w/h;}
  setSize(viewport.clientWidth,viewport.clientHeight);

  // ------------------------------------------------------------ Ein- und Ausschalten
  // Jeder Eingriff in bestehende Objekte wird vermerkt und beim Ausschalten zurückgenommen.
  function snap(object,...keys){if(!session)return;let known=session.seen.get(object);if(!known)session.seen.set(object,known=new Set());for(const key of keys){if(known.has(key))continue;known.add(key);const value=object[key];
    if(value?.isColor){const copy=value.clone();session.restores.push(()=>value.copy(copy));}else session.restores.push(()=>{object[key]=value;if(object.isMaterial&&key==='vertexColors')object.needsUpdate=true;});}}
  function swap(mesh,material){if(mesh.material===material)return;const previous=mesh.material;mesh.material=material;session.restores.push(()=>{if(mesh.material===material)mesh.material=previous;});}
  function recolor(mesh,palette){
    if(!mesh.isInstancedMesh||!mesh.instanceColor)return;if(!mesh.userData.ldOriginal){const original=mesh.userData.ldOriginal=new Float32Array(mesh.instanceColor.array);session.restores.push(()=>{mesh.instanceColor.array.set(original);mesh.instanceColor.needsUpdate=true;delete mesh.userData.ldOriginal;});}
    const per=/Nahdetails|^Baumkronen$/.test(mesh.name)?18:3,key=nameSeed(mesh.name+(mesh.parent?.name||'')),items=mesh.userData.items,color=new T.Color();
    for(let i=0;i<mesh.count;i++){const tree=items?items[i].tree:Math.floor(i/per);color.set(palette[Math.floor(hashInt(tree*131+key)*palette.length)%palette.length]).multiplyScalar(.86+.28*hashInt((items?items[i].n??i:i)*977+key));mesh.setColorAt(i,color);}
    mesh.instanceColor.needsUpdate=true;
  }
  function tintRoofDetails(root){root.traverse(o=>{if(!o.isMesh||!ROOF_DETAIL.test(o.name))return;const m=o.material;if(!m.userData.ldBase)m.userData.ldBase=m.color.clone();snap(m,'color');const b=m.userData.ldBase,l=b.r*.299+b.g*.587+b.b*.114;
    m.color.copy(G.uRoofTint.value).multiplyScalar(l).lerp(b,1-G.uRoofAmt.value).multiplyScalar(1.15).addScalar(.008);if(G.uSnow.value)m.color.lerp(new T.Color('#eef1f8'),.85*G.uSnow.value);});}
  function nearFoliage(){const list=[];for(const g of lodGroups)if(g.userData.forestDetail)for(const child of g.children)list.push(child);return list;}
  const applied={sky:'',leaves:''},wind={clock:0,seconds:0,last:0,strength:.6,direction:new T.Vector2(1,0),moving:false};
  function apply(){
    if(!enabled)return;const L=look,P=L.palette;
    sunDirection.set(...L.sunDir).normalize();G.uSunDir.value.copy(sunDirection);sun.color.copy(L.sun);sun.intensity=L.sunI;sun.shadow.radius=L.shadowRadius;
    hemi.color.copy(L.hemiSky);hemi.groundColor.copy(L.hemiGround);hemi.intensity=L.hemiI;scene.environmentIntensity=L.envI;renderer.toneMappingExposure=L.exposure;
    skyUniforms.uZenith.value.copy(L.zenith);skyUniforms.uHorizon.value.copy(L.horizon);skyUniforms.uGlow.value.copy(L.glow);skyUniforms.uGlowDir.value.copy(L.glowDir?new T.Vector3(...L.glowDir).normalize():sunDirection);skyUniforms.uClouds.value=L.clouds;skyUniforms.uOver.value=L.over;skyUniforms.uCloudLight.value.copy(L.cloudLight);skyUniforms.uNight.value=L.dark*(1-.85*L.over);skyUniforms.uMoonDir.value.set(...L.moonDir);skyUniforms.uSunTrue.value.set(...L.sunTrue);
    fog.color.copy(L.fog);
    // Umgebungslicht und Laubfarben nur neu rechnen, wenn sie sich wirklich geändert haben (wichtig für den Zeitraffer).
    const skyKey=[L.zenith,L.horizon,L.glow,L.cloudLight].map(c=>c.getHexString()).join()+[L.clouds,L.over].map(v=>v.toFixed(2)).join()+skyUniforms.uGlowDir.value.toArray().map(v=>v.toFixed(2)).join();
    if(skyKey!==applied.sky){applied.sky=skyKey;envTarget?.dispose();envTarget=pmrem.fromScene(envScene,.02,.1,100);scene.environment=envTarget.texture;}
    model.crops?.setSeason(dayOfYear(L.when),L.snow);
    // Wind aus der Wettermeldung (ohne Angabe: 8 km/h aus Westsüdwest). Wolkenschatten nur bei lockerer Bewölkung am Tag.
    const from=Number.isFinite(weather?.windDirection)?weather.windDirection:250,to=(from+180)*Math.PI/180;wind.strength=Math.max(.35,Math.min(1.8,(Number.isFinite(weather?.wind)&&weather.wind>0?weather.wind:8)/14));wind.direction.set(Math.sin(to),-Math.cos(to));G.uWindDir.value.copy(wind.direction);
    cloudShade.amount=.34*T.MathUtils.smoothstep(L.clouds,.15,.5)*(1-T.MathUtils.smoothstep(L.over,.7,1))*Math.max(0,Math.min(1,(L.elevation+2)/8));cloudShade.enabled=cloudShade.amount>.005;
    {const day=dayOfYear(L.when),cold=Number.isFinite(weather?.temperature)&&weather.live&&L.liveTime?weather.temperature<9:day<80||day>300||!!L.snow;smoke.visible=cold;smoke.material.color.set(L.dark>.5?'#8f97a6':'#d9dde2');smoke.material.opacity=L.dark>.5?.16:.22;updateSmoke();}
    G.uSnow.value=L.snow;G.uBare.value=L.bare;G.uLit.value=L.lit;G.uHour.value=L.hour;G.uFolSun.value.copy(L.sun).lerp(new T.Color('#ffffff'),.35).multiplyScalar(1.25);G.uBack.value.copy(L.sun).multiplyScalar(L.lamps?0:.5*(1-L.over));
    const roof=new T.Color(L.roof),lum=roof.r*.299+roof.g*.587+roof.b*.114;G.uRoofTint.value.copy(roof).multiplyScalar(1/lum);G.uRoofAmt.value=L.roofAmt;G.uWallTint.value.copy(L.wall);
    const lu=lawn.userData.u;lu.uA.value.set(P.grass[0]);lu.uB.value.set(P.grass[1]);lu.uC.value.set(P.grass[2]);lawn.color.set(P.grass[1]);
    for(const f of fields){const list=P.fields[f.type],color=new T.Color(list[Math.floor(f.pick*list.length)%list.length]),u=f.material.userData.u;u.uA.value.copy(color);u.uB.value.copy(color).multiplyScalar(.82+.3*f.alt);f.material.color.copy(color);}
    const F=P.fields,su=surroundMaterial.userData.u;[F.crop[0],F.grain[0],F.meadow[0],F.crop[F.crop.length-1],F.soil[0]].forEach((h,i)=>su.uF.value[i].set(h));su.uWoodColor.value.set(P.foliage[0]).multiplyScalar(.6);
    for(const m of water){snap(m,'color','roughness','metalness','envMapIntensity');m.color.set(P.water);m.roughness=.06;m.metalness=.2;m.envMapIntensity=1.6;}
    for(const o of rows){snap(o.material,'color');o.material.color.set(P.rows);}
    for(const o of tufts){snap(o.material,'color');o.material.color.set(P.tuft);}
    for(const o of hedges){snap(o.material,'color');o.material.color.set(P.bush[0]).multiplyScalar(1.6);}
    for(const o of frames){snap(o.material,'color');o.material.color.set(L.frame);}
    for(const o of model.groups.roads.children)if(o.name==='Asphaltflächen'){const m=o.material;snap(m,'color','roughness');m.color.set(P.road).multiplyScalar((m.map?1.3:1)*(1-.3*L.wet));m.roughness=.92-.6*L.wet;}
    for(const o of greenhouses){const m=o.material;snap(m,'vertexColors','color','roughness','metalness','envMapIntensity');if(m.vertexColors){m.vertexColors=false;m.needsUpdate=true;}m.color.set(L.snow>.5?'#c9d6da':'#a9c9c6');m.roughness=.16;m.metalness=.45;m.envMapIntensity=1.3;}
    for(const a of avMeshes){if(a.material){const [c1,c2]=P.av[a.role],u=a.material.userData.u;u.uA.value.set(c1);u.uB.value.set(c2);u.uC.value.set(P.av.garden[0]);a.material.color.set(c1);continue;}const m=a.mesh.material;snap(m,'color','roughness','metalness','envMapIntensity');
      if(a.role==='road'){m.color.set(P.av.road).multiplyScalar(1-.3*L.wet);m.roughness=.92-.6*L.wet;}else if(a.role==='water'){m.color.set(P.water);m.roughness=.06;m.metalness=.2;m.envMapIntensity=1.6;}else m.color.set(P.av[a.role]||a.mesh.userData.baseColor);}
    tintRoofDetails(model.groups.details);
    const leafKey=P.foliage.join()+P.bush.join();if(leafKey!==applied.leaves){applied.leaves=leafKey;for(const mesh of [...foliageMeshes,...nearFoliage(),...surroundTrees,...crownMeshes])recolor(mesh,P.foliage);for(const mesh of bushMeshes)recolor(mesh,P.bush);}
    lamps.visible=!!L.lamps;model.streetLights?.setOn(!!L.lamps);gtao.blendIntensity=L.ao;bloom.strength=L.bloom;bloom.threshold=L.bloomThreshold;bloom.radius=.7;
    const g=grade.uniforms;g.uSat.value=L.sat;g.uContrast.value=L.contrast;g.uTint.value.set(...L.tint);g.uVignette.value=L.vignette;g.uRain.value=L.rain;g.uSnowfall.value=L.snowfall;
    renderer.shadowMap.needsUpdate=true;
  }
  function setEnabled(value){
    value=!!value;if(value===enabled)return;enabled=value;added.visible=value;G.uLd.value=value?1:0;
    if(value){session={restores:[],seen:new Map()};
      const before={background:scene.background,fog:scene.fog,environment:scene.environment,environmentIntensity:scene.environmentIntensity};session.restores.push(()=>Object.assign(scene,before));snap(renderer,'toneMappingExposure');snap(sun,'intensity');snap(sun.shadow,'radius');snap(hemi,'intensity');
      const colors=[sun.color.clone(),hemi.color.clone(),hemi.groundColor.clone()];session.restores.push(()=>{sun.color.copy(colors[0]);hemi.color.copy(colors[1]);hemi.groundColor.copy(colors[2]);});
      scene.background=null;scene.fog=fog;swap(terrain,lawn);for(const f of fields)swap(f.mesh,f.material);for(const a of avMeshes)if(a.material)swap(a.mesh,a.material);if(windows)swap(windows,windowMaterial);
      for(const o of pedestal){snap(o,'visible');o.visible=false;}
      for(const g of lodGroups){g.userData.ldDone=0;if(g.userData.forestDetail){snap(g.userData,'lodDistance');g.userData.lodDistance=g.name.startsWith('Wald')?110:150;}}apply();
    }else{for(const restore of session.restores.reverse())restore();session=null;model.crops?.setSeason();model.streetLights?.setOn(false);applied.sky=applied.leaves='';G.uSnow.value=0;G.uLit.value=0;renderer.shadowMap.needsUpdate=true;}
  }
  function setWeather(state){weather=state||null;look=derive(weather);apply();}
  // Sonnenstand nachführen, solange die Uhr des Geräts gilt. Liefert true, wenn neu gezeichnet werden muss.
  function setTime(ms){if(Number.isFinite(ms)){chosenTime=ms;clockOnly=false;}else{chosenTime=NaN;clockOnly=true;}look=derive(weather);apply();}
  function refreshTime(){if(!look.liveTime||Math.abs(Date.now()-look.when)<4*60000)return false;look=derive(weather);apply();return enabled;}

  // Pro Bild: nachgeladene Nahdetails einfärben, Sichtbarkeiten und Dunst nachführen.
  function update(){
    if(!enabled)return;
    for(const g of lodGroups){if(g.children.length===g.userData.ldDone)continue;g.userData.ldDone=g.children.length;if(g.userData.forestDetail)for(const child of g.children)recolor(child,look.palette.foliage);else tintRoofDetails(g);}
    const distance=camera.position.distanceTo(controls.target);
    gardens.visible=model.groups.vegetation.visible;for(const mesh of surroundTrees)mesh.visible=gardens.visible;
    fog.density=look.fogDensity*Math.max(.18,Math.min(1,700/distance));
    border.material.opacity=.75*T.MathUtils.smoothstep(distance,900,2400);surroundMaterial.userData.u.uFocus.value=T.MathUtils.smoothstep(distance,1200,3200);border.visible=border.material.opacity>.01;
    sky.position.copy(camera.position);sky.scale.setScalar(camera.far*.9);
    sun.shadow.normalBias=Math.max(.06,sun.shadow.camera.right/sun.shadow.mapSize.x*4.8);
  }
  // Wind und Wolkenzug laufen nur, wenn das Dorfleben läuft (motion). Beim Pausieren bleibt alles stehen, wo es gerade ist;
  // ist die Bewegung nie gelaufen (reduzierte Bewegung), ruhen die Kronen in ihrer Grundform.
  function advanceWind(time,motion){const dt=Math.min(.1,Math.max(0,(time-wind.last)/1000));wind.last=time;wind.moving=!!motion;if(motion){wind.clock+=dt*wind.strength;wind.seconds+=dt;}G.uSeconds.value=wind.seconds;updateSmoke();
    G.uWind.value=wind.clock;G.uWindAmt.value=wind.clock>0?.045*wind.strength:0;cloudShade.offset.copy(wind.direction).multiplyScalar(wind.clock*9);skyUniforms.uDrift.value.copy(wind.direction).multiplyScalar(wind.clock*.004);model.crops?.setWind(wind.clock,wind.direction,motion?wind.strength:0);}
  function render(time,{close=false,motion=false,focus,blur=1}={}){
    advanceWind(time,motion);
    if(camera.far<16000){camera.far=16000;camera.updateProjectionMatrix();}
    update();const distance=camera.position.distanceTo(controls.target);
    gtao.enabled=!mobile&&!close;// Schärfepunkt ist die Stelle, auf die die Kamera blickt (focus vom Viewer); aus der Nähe fällt die Unschärfe schwächer aus.
    dof.enabled=!close;dof.focus=focus??distance;dof.strength=Math.max(.4,Math.min(1,1.25-distance/1100))*(.45+.55*T.MathUtils.smoothstep(dof.focus,25,140))*blur;
    grade.uniforms.uTime.value=time/1000;composer.render();
  }
  renderer.shadowMap.type=T.PCFSoftShadowMap;sun.shadow.mapSize.set(mobile?2048:4096,mobile?2048:4096);sun.shadow.bias=-.0003;
  return {setEnabled,setWeather,setTime,refreshTime,setSize,render,update,sunDirection,
    get night(){return {streetLights:!!model.streetLights?.on,hour:+look.hour.toFixed(2),dark:+look.dark.toFixed(2),stars:+skyUniforms.uNight.value.toFixed(2),moon:{elevation:+look.moon.elevation.toFixed(1),azimuth:+look.moon.azimuth.toFixed(1),illuminated:+look.moon.illuminated.toFixed(2),waxing:look.moon.waxing},smoke:smoke.visible,smokeSources:smokeSources.length,sunIntensity:+sun.intensity.toFixed(2)};},
    get motion(){return {clock:+wind.clock.toFixed(3),moving:wind.moving,strength:+wind.strength.toFixed(2),direction:wind.direction.toArray().map(v=>+v.toFixed(3)),cloudShadow:+cloudShade.amount.toFixed(3),sway:G.uWindAmt.value};},
    get conditions(){return {wind:Number.isFinite(weather?.wind)&&weather.wind>0?weather.wind:8,rain:look.rain,snowfall:look.snowfall,snow:!!look.snow,elevation:look.elevation,day:dayOfYear(look.when),temperature:weather?.temperature??NaN};},
    get time(){return {when:new Date(look.when).toISOString(),live:look.liveTime,sunElevation:+look.elevation.toFixed(1),sunAzimuth:+look.azimuth.toFixed(1),season:look.season,lamps:look.lamps};},
    get enabled(){return enabled;},get weather(){return weather;},get snow(){return enabled&&!!look.snow;},get animated(){return enabled&&(look.rain>0||look.snowfall>0);},get ambientOcclusion(){return enabled&&gtao.enabled;},
    stats:{gardenBushes:bushes.length,gardenTrees:trunks.length,surroundTrees:far.length,lamps:heads.size,fields:fields.length},
    accuracy:'Der Sonnenstand ist aus Datum und Uhrzeit gerechnet; Licht, Himmel, Dunst und Farben sind Gestaltung, ebenso die Laubfarben je Jahreszeit. Gartenbüsche, zusätzliche Gartenbäume sowie Felder und Bäume im Umland sind illustrativ und nicht erhoben.'};
}
