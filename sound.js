// Geräuschkulisse zur Stimmung: Wind, Regen, Vogelstimmen am Tag, Grillen an Sommerabenden.
// Alles wird im Browser erzeugt (Web Audio), es gibt keine Tondateien und keine Abrufe. Die Klänge sind synthetisch
// und frei gestaltet – keine Aufnahmen aus Fräschels. Standardmässig aus; der Ton startet erst auf Knopfdruck.
const clamp=(v,lo=0,hi=1)=>Math.max(lo,Math.min(hi,v));

// Lautstärken (0…1) aus Wetter, Sonnenstand und Jahreszeit. Eigene Funktion, damit sie ohne Ton prüfbar ist.
export function soundLevels({wind=0,rain=0,snowfall=0,snow=false,elevation=30,day=180,temperature=NaN}={}){
  const light=clamp((elevation+6)/10),season=clamp(1-Math.abs(day-150)/150),dawn=elevation>-6&&elevation<14?1:0,warm=Number.isFinite(temperature)?clamp((temperature-10)/8):1;
  return {wind:clamp(.12+wind/45)*(snow?.8:1),rain:clamp(rain),
    birds:clamp(light*(.2+.8*season)*(.6+.4*dawn)*(1-rain)*(1-snowfall)*(snow?.3:1)),
    crickets:clamp((1-light)*clamp(1-Math.abs(day-210)/60)*warm*(1-clamp(rain*2))*(snow?0:1))};
}

export function createSoundscape(){
  let context=null,master=null,parts=null,enabled=false,levels=soundLevels(),birdTimer=null;
  function build(){
    context=new (window.AudioContext||window.webkitAudioContext)();master=context.createGain();master.gain.value=0;master.connect(context.destination);
    const length=context.sampleRate*3,buffer=context.createBuffer(1,length,context.sampleRate),data=buffer.getChannelData(0);let last=0;
    for(let i=0;i<length;i++){const white=Math.random()*2-1;last=(last+.02*white)/1.02;data[i]=white*.5+last*3;} // Rauschen mit etwas Tiefenanteil
    const noise=()=>{const source=context.createBufferSource();source.buffer=buffer;source.loop=true;source.start(0,Math.random()*3);return source;};
    // Wind: tiefes Rauschen, dessen Klangfarbe und Stärke langsam schwanken (Böen)
    const windFilter=context.createBiquadFilter();windFilter.type='lowpass';windFilter.frequency.value=380;windFilter.Q.value=.6;const windGain=context.createGain();windGain.gain.value=0;
    const gust=context.createOscillator(),gustDepth=context.createGain();gust.frequency.value=.07;gustDepth.gain.value=170;gust.connect(gustDepth).connect(windFilter.frequency);gust.start();noise().connect(windFilter).connect(windGain).connect(master);
    // Regen: helles Rauschen
    const rainHigh=context.createBiquadFilter();rainHigh.type='highpass';rainHigh.frequency.value=1700;const rainLow=context.createBiquadFilter();rainLow.type='lowpass';rainLow.frequency.value=8500;const rainGain=context.createGain();rainGain.gain.value=0;
    noise().connect(rainHigh).connect(rainLow).connect(rainGain).connect(master);
    // Grillen: hoher Ton, schnell an- und abschwellend, in Schüben
    const cricket=context.createOscillator();cricket.frequency.value=4300;const pulse=context.createGain();pulse.gain.value=0;const trill=context.createOscillator(),trillDepth=context.createGain();trill.type='square';trill.frequency.value=31;trillDepth.gain.value=.5;
    const phrase=context.createOscillator(),phraseDepth=context.createGain();phrase.frequency.value=.9;phraseDepth.gain.value=.5;const cricketGain=context.createGain();cricketGain.gain.value=0;
    trill.connect(trillDepth).connect(pulse.gain);phrase.connect(phraseDepth).connect(pulse.gain);cricket.connect(pulse).connect(cricketGain).connect(master);cricket.start();trill.start();phrase.start();
    const birdGain=context.createGain();birdGain.gain.value=0;birdGain.connect(master);
    parts={windGain,rainGain,cricketGain,birdGain};
  }
  // Ein Vogelruf: zwei bis fünf kurze, gleitende Töne
  function chirp(){
    if(!enabled||!context)return;const now=context.currentTime,base=2200+Math.random()*2600,notes=2+Math.floor(Math.random()*4),pan=context.createStereoPanner?context.createStereoPanner():null;if(pan)pan.pan.value=Math.random()*1.6-.8;
    for(let k=0;k<notes;k++){const start=now+k*(.09+Math.random()*.06),osc=context.createOscillator(),gain=context.createGain(),from=base*(.85+Math.random()*.4),to=from*(Math.random()<.5?1.35:.72);
      osc.frequency.setValueAtTime(from,start);osc.frequency.exponentialRampToValueAtTime(to,start+.07);gain.gain.setValueAtTime(0,start);gain.gain.linearRampToValueAtTime(.5,start+.012);gain.gain.exponentialRampToValueAtTime(.001,start+.085);
      osc.connect(gain);if(pan)gain.connect(pan).connect(parts.birdGain);else gain.connect(parts.birdGain);osc.start(start);osc.stop(start+.1);}
  }
  function scheduleBirds(){clearTimeout(birdTimer);if(!enabled)return;birdTimer=setTimeout(()=>{if(levels.birds>.03&&Math.random()<.35+.6*levels.birds)chirp();scheduleBirds();},500+Math.random()*(2600-1800*levels.birds));}
  function apply(){if(!parts)return;const t=context.currentTime,set=(node,value)=>node.gain.setTargetAtTime(value,t,1.2);set(parts.windGain,levels.wind*.5);set(parts.rainGain,levels.rain*.42);set(parts.cricketGain,levels.crickets*.05);set(parts.birdGain,levels.birds*.22);}
  async function setEnabled(value){
    enabled=!!value;if(enabled&&!context)build();if(!context)return enabled;
    if(enabled){await context.resume();master.gain.setTargetAtTime(.8,context.currentTime,.4);apply();scheduleBirds();}else{clearTimeout(birdTimer);master.gain.setTargetAtTime(0,context.currentTime,.15);setTimeout(()=>{if(!enabled)context.suspend();},700);}
    return enabled;
  }
  function update(conditions){levels=soundLevels(conditions);apply();}
  // Im Hintergrund schweigt die Seite.
  document.addEventListener('visibilitychange',()=>{if(!context||!enabled)return;if(document.hidden)context.suspend();else context.resume();});
  return {setEnabled,update,get enabled(){return enabled;},get levels(){return {...levels};},get running(){return context?.state==='running';}};
}
