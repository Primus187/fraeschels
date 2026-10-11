// Procedural surface detail: no photographs or bitmap assets are sampled.
const style={value:1};
export function setSurfaceStyle(enabled){style.value=enabled?1:0;}
export function dressMaterial(material,kind){
 material.userData.dioramaSurface=kind;
 material.onBeforeCompile=shader=>{
  shader.uniforms.dStyleEnabled=style;
  shader.vertexShader='varying vec3 vDioramaPosition;\nvarying vec3 vDioramaNormal;\n'+shader.vertexShader;
  shader.vertexShader=shader.vertexShader.replace('#include <begin_vertex>',`#include <begin_vertex>
   vec4 dPosition=vec4(position,1.0);
   vec3 dNormal=normal;
   #ifdef USE_INSTANCING
    dPosition=instanceMatrix*dPosition;dNormal=mat3(instanceMatrix)*dNormal;
   #endif
   vDioramaPosition=(modelMatrix*dPosition).xyz;
   vDioramaNormal=normalize(mat3(modelMatrix)*dNormal);`);
  shader.fragmentShader=`uniform float dStyleEnabled;varying vec3 vDioramaPosition;
   varying vec3 vDioramaNormal;
   float dHash(vec3 p){return fract(sin(dot(p,vec3(127.1,311.7,74.7)))*43758.5453);}
   float dNoise(vec3 p){vec3 i=floor(p),f=fract(p);f=f*f*(3.0-2.0*f);return mix(mix(mix(dHash(i),dHash(i+vec3(1,0,0)),f.x),mix(dHash(i+vec3(0,1,0)),dHash(i+vec3(1,1,0)),f.x),f.y),mix(mix(dHash(i+vec3(0,0,1)),dHash(i+vec3(1,0,1)),f.x),mix(dHash(i+vec3(0,1,1)),dHash(i+vec3(1,1,1)),f.x),f.y),f.z);}
  `+shader.fragmentShader;
  const effect=kind==='greenhouse'?`
   vec3 dN=normalize(vDioramaNormal);vec2 down=length(dN.xz)>.01?normalize(dN.xz):vec2(0,1),across=vec2(down.y,-down.x);vec2 pane=vec2(dot(vDioramaPosition.xz,across)/1.7,dot(vDioramaPosition.xz,down)/max(abs(dN.y),.25)/2.4);vec2 cell=fract(pane);float edge=min(min(cell.x,1.0-cell.x),min(cell.y,1.0-cell.y));float detail=1.0-smoothstep(.3,1.2,max(fwidth(pane.x),fwidth(pane.y)));float frame=(1.0-smoothstep(.012,.03,edge))*detail;diffuseColor.rgb=mix(diffuseColor.rgb*vec3(.82,.94,.94),vec3(.64,.70,.65),frame);
  `:kind==='building'?`
   vec3 dN=normalize(vDioramaNormal);
   if(dN.y>.3){
    vec2 down=length(dN.xz)>.01?normalize(dN.xz):vec2(0,1),across=vec2(down.y,-down.x);
    vec2 tile=vec2(dot(vDioramaPosition.xz,across)/.29,dot(vDioramaPosition.xz,down)/max(dN.y,.25)/.36);
    tile.x+=mod(floor(tile.y),2.0)*.5;
    float detail=1.0-smoothstep(.3,1.2,max(fwidth(tile.x),fwidth(tile.y)));
    vec2 cell=fract(tile);float mortar=(1.0-smoothstep(.008,.035,min(min(cell.x,1.0-cell.x),min(cell.y,1.0-cell.y))));
    float tileColor=mix(.92,1.08,dHash(vec3(floor(tile),0.0)));
    diffuseColor.rgb*=mix(1.0,tileColor*(1.0-mortar*.12),detail);
    dRelief=detail*(.003*sin(cell.x*3.14159)-mortar*.004);
   }else{diffuseColor.rgb*=.97+dNoise(vDioramaPosition*4.0)*.06;}
  `:kind==='ground'?`
   float dPatch=dNoise(vDioramaPosition*.075),grain=dNoise(vDioramaPosition*1.4);
   diffuseColor.rgb*=.90+dPatch*.16+grain*.025;
  `:kind==='field'?`
   float furrow=(vDioramaPosition.x*.38+vDioramaPosition.z*.92)/.65;
   float fDetail=1.0-smoothstep(.3,1.2,fwidth(furrow));
   float ridge=cos(furrow*6.28318);
   diffuseColor.rgb*=.94+dNoise(vDioramaPosition*.4)*.12+ridge*.065*fDetail;
   dRelief=ridge*.022*fDetail;
  `:kind==='foliage'?`
   float leaf=dNoise(vDioramaPosition*3.0);
   diffuseColor.rgb*=.90+leaf*.20;dRelief=leaf*.045;
  `:kind==='soil'?`
   float layer=sin(vDioramaPosition.y*1.45+dNoise(vDioramaPosition*.13)*2.0);
   diffuseColor.rgb*=.92+layer*.035+dNoise(vDioramaPosition*.6)*.13;
  `:`diffuseColor.rgb*=.975+dNoise(vDioramaPosition*7.0)*.05;`;
  shader.fragmentShader=shader.fragmentShader.replace('#include <color_fragment>','#include <color_fragment>\nvec3 dOriginal=diffuseColor.rgb;float dRelief=0.0;\n'+effect+'\ndiffuseColor.rgb=mix(dOriginal,diffuseColor.rgb,dStyleEnabled);');
  shader.fragmentShader=shader.fragmentShader.replace('#include <normal_fragment_maps>',`#include <normal_fragment_maps>
   vec3 dX=dFdx(-vViewPosition),dY=dFdy(-vViewPosition);
   vec3 dR1=cross(dY,normal),dR2=cross(normal,dX);
   float dDet=dot(dX,dR1);
   vec3 dGrad=sign(dDet)*(dFdx(dRelief)*dR1+dFdy(dRelief)*dR2)*dStyleEnabled;
   if(abs(dDet)>0.000001)normal=normalize(abs(dDet)*normal-dGrad);`);
 };
 material.customProgramCacheKey=()=> 'fraeschels-diorama-relief-'+kind;
 return material;
}
