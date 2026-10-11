// Aktuelles Wetter für Fräschels. Einzige externe Abfrage der Anwendung: Open-Meteo (kein Schlüssel nötig).
// Schlägt die Abfrage fehl, bleibt die Szene bei klarem Himmel; Sonnenstand und Jahreszeit hängen nicht vom Wetterdienst ab.
const URL_CURRENT='https://api.open-meteo.com/v1/forecast?latitude=46.9984&longitude=7.2072&current=temperature_2m,is_day,precipitation,rain,showers,snowfall,snow_depth,weather_code,cloud_cover,wind_speed_10m,wind_direction_10m&timezone=Europe%2FZurich';
const LABELS=[[[0],'klar'],[[1],'meist klar'],[[2],'teils bewölkt'],[[3],'bedeckt'],[[45,48],'Nebel'],[[51,53,55,56,57],'Nieselregen'],[[61,80],'leichter Regen'],[[63,81],'Regen'],[[65,82],'starker Regen'],[[66,67],'gefrierender Regen'],[[71,85],'leichter Schneefall'],[[73],'Schneefall'],[[75,86],'starker Schneefall'],[[77],'Schneegriesel'],[[95,96,99],'Gewitter']];
const clamp=(v,lo=0,hi=1)=>Math.max(lo,Math.min(hi,v));

// Übersetzt die Messwerte in die wenigen Grössen, welche die Darstellung steuert.
export function describeWeather(c){
  const code=Number(c.weather_code)||0,label=LABELS.find(([codes])=>codes.includes(code))?.[1]||'wechselhaft';
  const snowing=[71,73,75,77,85,86].includes(code),raining=[51,53,55,56,57,61,63,65,66,67,80,81,82,95,96,99].includes(code);
  const amount=Number(c.precipitation)||0;
  return {live:true,code,label,temperature:Number(c.temperature_2m),time:c.time,
    clouds:clamp((Number(c.cloud_cover)||0)/100),
    rain:raining?clamp(.35+amount/2.5+([65,82,95,96,99].includes(code)?.35:[63,81].includes(code)?.2:0)):0,
    snowfall:snowing?clamp(.4+(Number(c.snowfall)||0)/1.5+(code===75||code===86?.3:0)):0,
    snowCover:(Number(c.snow_depth)||0)>=.02||(snowing&&Number(c.temperature_2m)<=1),
    fog:[45,48].includes(code)?1:0,night:Number(c.is_day)===0,wind:Number(c.wind_speed_10m)||0,windDirection:Number.isFinite(Number(c.wind_direction_10m))&&c.wind_direction_10m!==null?Number(c.wind_direction_10m):NaN};
}
export async function fetchWeather(){
  const response=await fetch(URL_CURRENT,{cache:'no-store'});if(!response.ok)throw new Error('Wetterdienst antwortet nicht ('+response.status+')');
  const data=await response.json();if(!data.current)throw new Error('Wetterdaten unvollständig');return describeWeather(data.current);
}
// Feste Zustände für Vorschau und Tests: ?weather=clear|cloudy|overcast|rain|snow|fog|night
// Sie tragen eine feste Zeit (Sommerabend bzw. Sommernacht), damit sie immer gleich aussehen; ?zeit=… überschreibt sie.
const preset=(label,values)=>({live:false,time:'2026-06-21T20:00',code:0,label,temperature:NaN,clouds:0,rain:0,snowfall:0,snowCover:false,fog:0,night:false,wind:0,...values});
export const PRESETS={
  clear:preset('klar',{}),cloudy:preset('teils bewölkt',{clouds:.5}),overcast:preset('bedeckt',{clouds:1}),
  rain:preset('Regen',{clouds:1,rain:.7}),snow:preset('Schneefall',{clouds:.9,snowfall:.7,snowCover:true}),
  fog:preset('Nebel',{clouds:.8,fog:1}),night:preset('klare Nacht',{night:true,time:'2026-06-21T23:30'}),
};
