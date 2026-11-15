/* Stargazing Planner frontend
 * - User-entered date/time are interpreted in the browser's local timezone.
 * - The request sent to API Gateway contains UTC ISO timestamps.
 * - API-returned UTC timestamps are rendered in the browser's local timezone.
 * - The alternatives array is displayed in the exact order returned by the API.
 */
const $ = (id) => document.getElementById(id);
const SAMPLE_REQUEST = {
  latitude: 42.04114,
  longitude: -87.69006,
  timezone: 'America/Chicago',
  start_utc: '2026-11-16T02:00:00Z',
  end_utc: '2026-11-16T06:00:00Z'
};
const SAMPLE_RESPONSE = {
  alternatives: [
    { id:'6f4232d2-9a3a-4d5a-9399-ad4ced89a166', display_name:'Solarscope Llc', latitude:42.17705154418945, longitude:-87.81835174560547, matched_categories:['observatory'], distance_km:18.45, assessment:{ status:'scored', sky_background:{sqm:18.81,bortle_class:8}, best_window:{start_utc:'2026-11-16T02:00:00Z',end_utc:'2026-11-16T03:00:00Z',score:74.68958901286265,mean_cloud_cover_pct:14,sun_altitude_midpoint_deg:-44.315183323946684,moon_altitude_midpoint_deg:10.048371444581619,lunar_illumination_midpoint_pct:36.93951428845929}, warnings:[] } },
    { id:'3f7fe96f-db09-4bcc-9097-9cfeba31f627', display_name:'Dearborn Observatory', latitude:42.05668640136719, longitude:-87.67505645751953, matched_categories:['observatory'], distance_km:2.13, assessment:{ status:'scored', sky_background:{sqm:18.54,bortle_class:8}, best_window:{start_utc:'2026-11-16T02:00:00Z',end_utc:'2026-11-16T03:00:00Z',score:51.14014098595001,mean_cloud_cover_pct:51,sun_altitude_midpoint_deg:-44.45090475008706,moon_altitude_midpoint_deg:10.042500389959088,lunar_illumination_midpoint_pct:36.93951428845929}, warnings:[] } },
    { id:'c7e731bd-e605-43b5-81a6-db62d75ba438', display_name:'John Hancock Observatory', latitude:41.8990364074707, longitude:-87.623046875, matched_categories:['observatory'], distance_km:16.74, assessment:{ status:'scored', sky_background:{sqm:17.23,bortle_class:9}, best_window:{start_utc:'2026-11-16T03:45:00Z',end_utc:'2026-11-16T04:45:00Z',score:16.150000000000002,mean_cloud_cover_pct:100,sun_altitude_midpoint_deg:-61.23506734659884,moon_altitude_midpoint_deg:-6.009658887052382,lunar_illumination_midpoint_pct:37.61018928845929}, warnings:[] } }
  ], candidate_count:8, shortlisted_count:5, evaluated_count:5, warnings:['CANDIDATE_DATA_INCOMPLETE']
};
const LOCAL_TIME_ZONE = Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC';
const localToday = (() => { const d=new Date(); return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`; })();
const state = {
  request:{...SAMPLE_REQUEST}, response:{alternatives:[],candidate_count:null,shortlisted_count:null,evaluated_count:null,warnings:[]}, plan:null, nearbyError:null,
  location:{name:'Evanston, Illinois',latitude:SAMPLE_REQUEST.latitude,longitude:SAMPLE_REQUEST.longitude,timezone:LOCAL_TIME_ZONE,country:'United States',stateCode:'IL',locationType:'city'},
  date:localToday, start:'20:00', end:'23:00', duration:60,
  selectedSiteId:'__main_location__',
  exploreMap:null,detailMap:null,reverseAddressCache:new Map(), liveData:false
};
const sites = () => Array.isArray(state.response?.alternatives) ? state.response.alternatives : [];
const mainSite = () => ({id:'__main_location__',isMain:true,name:state.location.name,latitude:state.request.latitude,longitude:state.request.longitude,distance_km:0,matched_categories:['search center'],assessment:state.plan?.assessment||state.plan?.requested_location?.assessment||null});
const selectedSite = () => state.selectedSiteId==='__main_location__' ? mainSite() : (sites().find(s=>s.id===state.selectedSiteId) || sites()[0] || mainSite());
const fmtNum = (v,d=1) => v!==null && v!==undefined && Number.isFinite(Number(v)) ? Number(v).toFixed(d) : '—';
const fmtLocal = (value) => value
  ? new Intl.DateTimeFormat('en-US', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      hour12: true,
      timeZone: LOCAL_TIME_ZONE
    }).format(new Date(value))
  : '—';
const fmtDate = v => v ? new Date(`${v}T12:00:00`).toLocaleDateString(undefined,{month:'long',day:'numeric',year:'numeric'}) : '—';
function setText(id,value){const el=$(id);if(el)el.textContent=value;}
function escapeHTML(s){return String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));}
function showPage(name){
  document.querySelectorAll('.page').forEach(p=>{p.hidden=true;p.classList.remove('active')});
  const page=$(`page-${name}`); if(!page)return; page.hidden=false; page.classList.add('active');
  history.replaceState(null,'',name==='home'?'#home':`#${name}`);
  if(name==='explore'){renderSummary();scheduleMapInit('explore');}
  if(name==='detail'){renderDetail();scheduleMapInit('detail');}
  window.scrollTo({top:0,behavior:'smooth'});
}
function renderSummary(){
  setText('map-subtitle',`Places within 50 km of ${state.location.name}`);
  setText('site-count',String(sites().length).padStart(2,'0'));
  setText('main-location-name',state.location.name);
  setText('main-location-coords',`${state.request.latitude.toFixed(5)}, ${state.request.longitude.toFixed(5)}`);
  const mainScore = mainSite().assessment?.best_window?.score;
  setText('main-location-score', Number.isFinite(mainScore)
    ? `Score: ${fmtNum(mainScore, 1)} / 100`
    : 'Score: Not available');
  $('site-chips').innerHTML=sites().length ? sites().map((s,i)=>{
    const a=s.assessment||{},w=a.best_window||{},score=Number.isFinite(w.score)?`${fmtNum(w.score,1)} / 100`:(a.status||'No assessment');
    return `<button class="site-chip" data-site="${escapeHTML(s.id)}"><span class="chip-order">${String(i+1).padStart(2,'0')}</span><strong>${escapeHTML(s.display_name)}</strong><small>${fmtNum(s.distance_km,2)} km · ${escapeHTML(score)}</small></button>`;
  }).join('') : `<div class="site-empty">${escapeHTML(state.nearbyError ? 'Nearby results unavailable: '+state.nearbyError : 'No higher-scoring nearby candidates were returned. You can still open your main location above.')}</div>`;
  $('site-chips').querySelectorAll('[data-site]').forEach(b=>b.addEventListener('click',()=>selectSite(b.dataset.site)));
  $('explore-location-input').value=state.location.name;
  $('explore-date-input').value=state.date;$('explore-start-input').value=state.start;$('explore-end-input').value=state.end;$('explore-duration-input').value=String(state.duration);
}

// Local browser wall-clock date/time -> absolute UTC instant.
function localInputToDate(dateValue,timeValue,dayOffset=0){
  const [y,m,d]=dateValue.split('-').map(Number),[hh,mm]=timeValue.split(':').map(Number);
  const result=new Date(y,m-1,d+dayOffset,hh,mm,0,0);
  // Detect nonexistent local times during the spring DST transition.
  if(result.getFullYear()!==y || result.getMonth()!==m-1 || result.getDate()!==d+dayOffset || result.getHours()!==hh || result.getMinutes()!==mm){
    throw new Error('That local time does not exist because of a daylight-saving clock change. Please choose another time.');
  }
  return result;
}
function buildUTCInterval(dateValue,startValue,endValue){
  const start=localInputToDate(dateValue,startValue,0);
  let end=localInputToDate(dateValue,endValue,0);
  if(end<=start)end=localInputToDate(dateValue,endValue,1);
  if((end-start)<=0)throw new Error('End time must be after start time.');
  return {start_utc:start.toISOString(),end_utc:end.toISOString()};
}
// The deployed API Gateway already unwraps Lambda proxy responses. Never send
// the Lambda Test-tab envelope {body,isBase64Encoded} from a browser.
function unwrapHttpPayload(payload){
  if(payload && typeof payload==='object' && Object.prototype.hasOwnProperty.call(payload,'body')){
    const body=typeof payload.body==='string'?JSON.parse(payload.body):payload.body;
    if(payload.statusCode>=400)throw new Error(body?.message||body?.error||`Lambda status ${payload.statusCode}`);
    return body;
  }
  return payload;
}
async function postApi(path,payload){
  const base=window.STARGAZING_CONFIG?.API_BASE_URL?.replace(/\/+$/,'');
  if(!base)throw new Error('API base URL is missing in config.js');
  const controller=new AbortController();
  const timeout=setTimeout(()=>controller.abort(),window.STARGAZING_CONFIG?.REQUEST_TIMEOUT_MS||45000);
  try{
    const res=await fetch(`${base}${path}`,{method:'POST',headers:{'Content-Type':'application/json',Accept:'application/json'},body:JSON.stringify(payload),signal:controller.signal});
    const text=await res.text();let raw;
    try{raw=text?JSON.parse(text):{}}catch{throw new Error(`Server returned invalid JSON (HTTP ${res.status})`)}
    const data=unwrapHttpPayload(raw);
    if(!res.ok)throw new Error(data?.message||data?.error||`HTTP ${res.status}`);
    return data;
  }catch(e){
    if(e.name==='AbortError')throw new Error('Request timed out. Try again.');
    if(e instanceof TypeError)throw new Error('Network/CORS error. Verify the API allows this frontend origin and POST/OPTIONS.');
    throw e;
  }finally{clearTimeout(timeout)}
}
const STATE_CODES = Object.fromEntries(Object.entries({
  AL:'Alabama',AK:'Alaska',AZ:'Arizona',AR:'Arkansas',CA:'California',CO:'Colorado',CT:'Connecticut',DE:'Delaware',DC:'District of Columbia',FL:'Florida',GA:'Georgia',HI:'Hawaii',ID:'Idaho',IL:'Illinois',IN:'Indiana',IA:'Iowa',KS:'Kansas',KY:'Kentucky',LA:'Louisiana',ME:'Maine',MD:'Maryland',MA:'Massachusetts',MI:'Michigan',MN:'Minnesota',MS:'Mississippi',MO:'Missouri',MT:'Montana',NE:'Nebraska',NV:'Nevada',NH:'New Hampshire',NJ:'New Jersey',NM:'New Mexico',NY:'New York',NC:'North Carolina',ND:'North Dakota',OH:'Ohio',OK:'Oklahoma',OR:'Oregon',PA:'Pennsylvania',RI:'Rhode Island',SC:'South Carolina',SD:'South Dakota',TN:'Tennessee',TX:'Texas',UT:'Utah',VT:'Vermont',VA:'Virginia',WA:'Washington',WV:'West Virginia',WI:'Wisconsin',WY:'Wyoming'
}).flatMap(([code,name])=>[[code,code],[name.toLowerCase(),code]]));
function extractLocation(place){
  const label=String(place.name||'').trim();
  const segments=label.split(',').map(x=>x.trim()).filter(Boolean);
  const tail=segments[segments.length-1]||'';
  const normalizedState=tail.replace(/\s+\d{5}(?:-\d{4})?$/,'').trim();
  const stateCode=place.stateCode||STATE_CODES[normalizedState]||STATE_CODES[normalizedState.toLowerCase()];
  if(!stateCode)throw new Error('Choose a U.S. city with a state (e.g. Evanston, Illinois) or enter a street address ending in a state abbreviation.');
  const isAddress=place.locationType==='address'||/^\d+\s/.test(segments[0]||'');
  return {location_type:isAddress?'address':'city',location:isAddress?label:segments[0],state:stateCode};
}
function zonedParts(date,timeZone){
  const parts=new Intl.DateTimeFormat('en-US',{timeZone,year:'numeric',month:'2-digit',day:'2-digit',hour:'2-digit',minute:'2-digit',hourCycle:'h23'}).formatToParts(date);
  const p=Object.fromEntries(parts.map(v=>[v.type,v.value]));
  return {date:`${p.year}-${p.month}-${p.day}`,time:`${p.hour}:${p.minute}`};
}
async function runSearch(place,date,start,end,duration,errorId,button){
  const errorEl=$(errorId);errorEl.textContent='';
  if(!place){errorEl.textContent='Select a city or street address from the suggestions.';return;}
  if(!date||!start||!end){errorEl.textContent='Please complete the date and time fields.';return;}
  let interval,locationFields;
  try{interval=buildUTCInterval(date,start,end);locationFields=extractLocation(place)}catch(e){errorEl.textContent=e.message;return;}
  if((new Date(interval.end_utc)-new Date(interval.start_utc))/3600000>12){errorEl.textContent='Choose an interval of no more than 12 hours.';return;}
  const original=button?.innerHTML;
  if(button){button.disabled=true;button.innerHTML='<span>Evaluating selected location…</span><span class="button-arrow">…</span>';}
  try{
    // The UI uses the browser computer's local time. Plan expects wall-clock
    // date/time in the *selected place's* timezone, so convert both instants.
    const placeZone=place.timezone||LOCAL_TIME_ZONE;
    const zonedStart=zonedParts(new Date(interval.start_utc),placeZone);
    const zonedEnd=zonedParts(new Date(interval.end_utc),placeZone);
    const planRequest={...locationFields,date:zonedStart.date,start_time:zonedStart.time,end_time:zonedEnd.time};
    const plan=await postApi('/stargazing/plan',planRequest);
    const loc=plan?.requested_location,range=plan?.interval;
    if(!loc||!range?.start_utc||!range?.end_utc)throw new Error('Plan response missing requested_location or interval.');
    const latitude=Number(loc.latitude??loc.coordinates?.latitude),longitude=Number(loc.longitude??loc.coordinates?.longitude);
    if(!Number.isFinite(latitude)||!Number.isFinite(longitude))throw new Error('Plan response has no usable coordinates.');
    const zone=loc.timezone||placeZone;
    state.location={...place,name:loc.display_name||place.name,latitude,longitude,timezone:zone};
    state.plan=plan;
    state.request={latitude,longitude,timezone:zone,start_utc:range.start_utc,end_utc:range.end_utc};
    state.response={alternatives:[],candidate_count:null,shortlisted_count:null,evaluated_count:null,warnings:[]};
    state.nearbyError=null;state.liveData=true;
    state.date=date;state.start=start;state.end=end;state.duration=duration;
    state.selectedSiteId='__main_location__';selectedHomePlace=place;selectedExplorePlace=place;
    showPage('explore');
    const nearbyRequest={...state.request};
    const score=plan.assessment?.best_window?.score??loc.assessment?.best_window?.score;
    if(typeof score==='number'&&Number.isFinite(score))nearbyRequest.baseline_score=score;
    try{
      const nearby=await postApi('/stargazing/nearby',nearbyRequest);
      if(!Array.isArray(nearby?.alternatives))throw new Error('Nearby response missing alternatives array.');
      state.response=nearby; // Preserve backend order; no client-side sorting.
    }catch(e){state.nearbyError=e.message;state.response={alternatives:[],warnings:[]};}
    renderSummary();if($('page-explore').classList.contains('active'))scheduleMapInit('explore');
  }catch(e){errorEl.textContent=e.message;}
  finally{if(button){button.disabled=false;button.innerHTML=original;}}
}

// Address lookup: Photon reverse geocoding (OpenStreetMap-based). Census Geocoder is
// not a POI address service and often has no address match for observatories/parks.
async function reverseGeocode(lat,lon){
  const key=`${Number(lat).toFixed(6)},${Number(lon).toFixed(6)}`;
  if(state.reverseAddressCache.has(key))return state.reverseAddressCache.get(key);
  const url=`https://photon.komoot.io/reverse?lon=${encodeURIComponent(lon)}&lat=${encodeURIComponent(lat)}`;
  try{
    const res=await fetch(url,{headers:{Accept:'application/json'}});if(!res.ok)throw new Error(`Reverse geocoding HTTP ${res.status}`);
    const data=await res.json(),p=data?.features?.[0]?.properties;
    if(!p)throw new Error('No address feature found for these coordinates.');
    const street=[p.housenumber,p.street].filter(Boolean).join(' ');
    const locality=[p.suburb,p.district,p.city,p.town,p.village].filter(Boolean).filter((v,i,a)=>a.indexOf(v)===i).join(', ');
    const region=[p.state,p.postcode,p.country].filter(Boolean).join(' ');
    const address=[street,locality,region].filter(Boolean).join(', ');
    const result={address:address||p.name||`${lat}, ${lon}`,poiName:p.name||null};
    state.reverseAddressCache.set(key,result);return result;
  }catch(e){console.warn('Reverse geocoding failed:',e);state.reverseAddressCache.set(key,null);return null;}
}
function renderDetail(){
  const s=selectedSite(),a=s.assessment||{},sky=a.sky_background||{},w=a.best_window||{};
  const lat=Number(s.isMain?state.request.latitude:s.latitude),lon=Number(s.isMain?state.request.longitude:s.longitude);
  const name=s.name||s.display_name;
  setText('detail-title', name);
  setText('detail-address', s.isMain ? state.location.name : `${name} · Looking up approximate address…`);
  setText('detail-coordinates',`${Math.abs(lat).toFixed(5)}° ${lat>=0?'N':'S'} · ${Math.abs(lon).toFixed(5)}° ${lon>=0?'E':'W'}`);
  setText('detail-score',Number.isFinite(w.score)?fmtNum(w.score,1):'—');setText('detail-score-suffix',Number.isFinite(w.score)?'/ 100':'');
  setText('detail-status',a.status==='scored'?'Scored assessment':a.status==='no_eligible_window'?'No eligible dark window':a.status==='insufficient_data'?'Insufficient forecast data':'Assessment unavailable');
  setText('detail-sqm',sky.sqm!=null?fmtNum(sky.sqm,2):'—');setText('detail-bortle',sky.bortle_class??'—');
  setText('detail-bortle-description',sky.bortle_class!=null?`Bortle class ${sky.bortle_class} · light pollution scale`:'No sky-background value returned');
  // The API returns UTC timestamps; show them once in the browser's local time.
  setText('detail-start', w.start_utc ? fmtLocal(w.start_utc) : '—');
  setText('detail-end', w.end_utc ? fmtLocal(w.end_utc) : '—');
  setText('detail-cloud',w.mean_cloud_cover_pct!=null?`${fmtNum(w.mean_cloud_cover_pct,0)}%`:'—');
  setText('detail-sun',w.sun_altitude_midpoint_deg!=null?`${fmtNum(w.sun_altitude_midpoint_deg,1)}°`:'—');
  setText('detail-moon',w.moon_altitude_midpoint_deg!=null?`${fmtNum(w.moon_altitude_midpoint_deg,1)}°`:'—');
  setText('detail-illumination',w.lunar_illumination_midpoint_pct!=null?`${fmtNum(w.lunar_illumination_midpoint_pct,1)}%`:'—');
  setText('detail-category',(s.matched_categories||[]).join(', ')||'—');setText('detail-distance',s.isMain?'Search center':`${fmtNum(s.distance_km,2)} km`);
  setText('map-selected-name',name);
  setText('detail-data-disclaimer',s.isMain?'No observation window means no suitable window was found.':'Times are shown in UTC and local time.');
  reverseGeocode(lat,lon).then(result=>{
    const current=selectedSite(),clat=Number(current.isMain?state.request.latitude:current.latitude),clon=Number(current.isMain?state.request.longitude:current.longitude);
    if(Math.abs(clat-lat)>1e-7||Math.abs(clon-lon)>1e-7)return;
    setText('detail-address',result?.address?`${name} · ${result.address}`:`${name} · Street address unavailable`);
  });
}
function selectSite(id){state.selectedSiteId=id;showPage('detail');}

// Leaflet maps: create only after the page is visible, clear old instances, invalidate size,
// use public OpenStreetMap tiles with a dark CSS treatment and show a fallback if tiles fail.
function markerIcon(center=false){return L.divIcon({className:'',html:`<div class="custom-marker ${center?'center':''}">${center?'✦':'✧'}</div>`,iconSize:center?[27,27]:[22,22],iconAnchor:center?[13,13]:[11,11]});}
function removeMap(which,elementId){const map=state[which];if(map){try{map.off();map.remove()}catch(e){console.warn('Map cleanup:',e)}state[which]=null;}const el=$(elementId);if(el){el.innerHTML='';el.removeAttribute('data-map-error');}}
function addDarkTiles(map){
  const layer=L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png',{maxZoom:19,attribution:'&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap contributors</a>'});
  let tileErrors=0;layer.on('tileerror',()=>{tileErrors++;if(tileErrors>=4){const el=map.getContainer();if(el&&!el.querySelector('.map-network-warning')){const n=document.createElement('div');n.className='map-network-warning';n.textContent='Map tiles could not load. Check your internet connection or tile-provider access.';el.appendChild(n);}}});layer.addTo(map);
}
function bindPopupNavigation(){document.querySelectorAll('.popup-open').forEach(a=>{if(a.dataset.bound)return;a.dataset.bound='1';a.addEventListener('click',e=>{e.preventDefault();selectSite(a.dataset.site);});});}
let mapInitToken=0;
function scheduleMapInit(which){
  const token=++mapInitToken;
  requestAnimationFrame(()=>requestAnimationFrame(()=>{
    if (token!==mapInitToken) return;
    if(which==='explore') initExploreMap();
    else initDetailMap();
  }));
}
function reportMapFailure(el,error,which){
  const msg = error instanceof Error ? error.message : String(error);
  console.error(`${which} map initialization failed:`, error);
  // Include the actual failure; no more generic 'reload the page' dead end.
  if(el){el.innerHTML='';const div=document.createElement('div');div.className='map-fallback';
    div.textContent=`Map initialization failed: ${msg}. Open DevTools Console for details.`;el.appendChild(div);}
}
function initExploreMap(){
  const el=$('explore-map');if(!el || $('page-explore').hidden)return;removeMap('exploreMap','explore-map');
  if(!window.L){el.innerHTML='<div class="map-fallback">The map library did not load. Check your internet connection and reload.</div>';return;}
  try{
    const center=[Number(state.request.latitude),Number(state.request.longitude)];
    if(!center.every(Number.isFinite))throw new Error('Missing or invalid coordinates returned by Plan API');
    const map=L.map(el,{scrollWheelZoom:false,preferCanvas:true,zoomControl:true,worldCopyJump:true}).setView(center,10);state.exploreMap=map;addDarkTiles(map);
    // Shade the area outside the 50 km boundary without obscuring markers.
    const radiusKm=50;
    const latitudeRadians=center[0]*Math.PI/180;
    const circleRing=Array.from({length:129},(_,index)=>{
      const bearing=2*Math.PI*index/128;
      const angularDistance=radiusKm/6371.0088;
      const lat=Math.asin(Math.sin(latitudeRadians)*Math.cos(angularDistance)+Math.cos(latitudeRadians)*Math.sin(angularDistance)*Math.cos(bearing));
      const lon=center[1]*Math.PI/180+Math.atan2(Math.sin(bearing)*Math.sin(angularDistance)*Math.cos(latitudeRadians),Math.cos(angularDistance)-Math.sin(latitudeRadians)*Math.sin(lat));
      return [lat*180/Math.PI,lon*180/Math.PI];
    });
    L.polygon([
      [[-85,-179],[-85,179],[85,179],[85,-179]],
      circleRing.slice().reverse()
    ],{stroke:false,fillColor:'#050a19',fillOpacity:.62,interactive:false}).addTo(map);
    const searchRadiusCircle=L.circle(center,{radius:50000,color:'#d7c8ff',weight:2,dashArray:'7 7',fillColor:'#c2b1ed',fillOpacity:.07,interactive:false}).addTo(map);
    const main=L.marker(center,{icon:markerIcon(true),zIndexOffset:1000}).addTo(map);
    main.bindTooltip(`<strong>${escapeHTML(state.location.name)}</strong><br><span>Main search location · click for details</span>`,{direction:'top',offset:[0,-12]});
    main.bindPopup(`<div class="popup-title">${escapeHTML(state.location.name)}</div><div class="popup-meta">Main search location<br>${center[0].toFixed(5)}, ${center[1].toFixed(5)}<br><a href="#detail" class="popup-open" data-site="__main_location__">View main location details →</a></div>`);
    main.on('popupopen',bindPopupNavigation);
    sites().forEach((s,index)=>{
      const lat=Number(s.latitude),lon=Number(s.longitude);if(!Number.isFinite(lat)||!Number.isFinite(lon))return;
      const a=s.assessment||{},w=a.best_window||{},score=Number.isFinite(w.score)?fmtNum(w.score,1):'Not scored';
      const marker=L.marker([lat,lon],{icon:markerIcon()}).addTo(map);
      marker.bindTooltip(`<strong>${escapeHTML(s.display_name)}</strong><br><span>#${index+1} · ${fmtNum(s.distance_km,2)} km · Score ${escapeHTML(score)}</span>`,{direction:'top',offset:[0,-10]});
      marker.bindPopup(`<div class="popup-title">${escapeHTML(s.display_name)}</div><div class="popup-meta">${fmtNum(s.distance_km,2)} km from search center<br>Category: ${escapeHTML((s.matched_categories||[]).join(', ')||'—')}<br>Sky quality: ${a.sky_background?.sqm!=null?`${fmtNum(a.sky_background.sqm,2)} SQM`:'Unavailable'}<br>Cloud cover: ${w.mean_cloud_cover_pct!=null?`${fmtNum(w.mean_cloud_cover_pct,0)}%`:'Unavailable'}<br><span class="popup-score">Score ${escapeHTML(score)}</span><br><a href="#detail" class="popup-open" data-site="${escapeHTML(s.id)}">View location details →</a></div>`);
      marker.on('popupopen',bindPopupNavigation);
    });
    const bounds=searchRadiusCircle.getBounds();map.fitBounds(bounds,{padding:[64,64]});
    setTimeout(()=>{if(state.exploreMap===map)map.invalidateSize(true)},250);
  }catch(e){removeMap('exploreMap','explore-map');reportMapFailure(el,e,'Explore');}
}
function initDetailMap(){
  const el=$('detail-map');if(!el || $('page-detail').hidden)return;removeMap('detailMap','detail-map');
  if(!window.L){el.innerHTML='<div class="map-fallback">The map library did not load. Check your internet connection and reload.</div>';return;}
  try{
    syncDetailMapHeight();
    const s=selectedSite(),lat=Number(s.isMain?state.request.latitude:s.latitude),lon=Number(s.isMain?state.request.longitude:s.longitude);
    if(!Number.isFinite(lat)||!Number.isFinite(lon))throw new Error('Selected location has invalid latitude/longitude');
    const map=L.map(el,{scrollWheelZoom:false,preferCanvas:true,zoomControl:true}).setView([lat,lon],16);state.detailMap=map;addDarkTiles(map);
    L.circle([lat,lon],{radius:250,color:'#c7b9ee',weight:1.5,fillColor:'#7266a7',fillOpacity:.12}).addTo(map);
    L.marker([lat,lon],{icon:markerIcon(true)}).addTo(map).bindTooltip(`<strong>${escapeHTML(s.name||s.display_name)}</strong><br><span>Selected location</span>`,{permanent:true,direction:'top',offset:[0,-14]});
    setTimeout(()=>{if(state.detailMap===map)map.invalidateSize(true)},250);
  }catch(e){removeMap('detailMap','detail-map');reportMapFailure(el,e,'Detail');}
}

// Align the right map's bottom edge with the left observation-window card.
// Using measured positions keeps this true when fonts or viewport sizes change.
function syncDetailMapHeight(){
  const frame=document.querySelector('.detail-map-frame');
  const windowCard=document.querySelector('.page-detail .window-card');
  if(!frame||!windowCard)return;
  if(window.matchMedia('(max-width: 760px)').matches){
    frame.style.removeProperty('--detail-map-height');
    return;
  }
  const top=frame.getBoundingClientRect().top;
  const bottom=windowCard.getBoundingClientRect().bottom;
  frame.style.setProperty('--detail-map-height',`${Math.max(280,Math.round(bottom-top))}px`);
}

window.addEventListener('resize',()=>{
  if($('page-detail').hidden)return;
  requestAnimationFrame(()=>{
    syncDetailMapHeight();
    state.detailMap?.invalidateSize(false);
  });
});

// Open-Meteo handles cities; Photon (OpenStreetMap) offers address suggestions.
// Both paths require selecting a real geocoded result before submitting.
async function searchAddressSuggestions(query){
  const url=`https://photon.komoot.io/api/?q=${encodeURIComponent(query)}&limit=8&lang=en`;
  const response=await fetch(url);
  if(!response.ok)throw new Error('Address suggestions unavailable');
  const data=await response.json();
  return (data.features||[]).map(feature=>{
    const p=feature.properties||{};
    if(String(p.countrycode||'').toUpperCase()!=='US')return null;
    const stateCode=STATE_CODES[p.state]||STATE_CODES[String(p.state||'').toLowerCase()];
    const street=[p.housenumber,p.street].filter(Boolean).join(' ');
    const city=p.city||p.town||p.locality||p.district;
    if(!street||!city||!p.state||!stateCode)return null;
    const name=[street,city,p.postcode?`${p.state} ${p.postcode}`:p.state].filter(Boolean).join(', ');
    const [longitude,latitude]=feature.geometry?.coordinates||[];
    if(!Number.isFinite(latitude)||!Number.isFinite(longitude))return null;
    return {name,latitude,longitude,locationType:'address',stateCode,timezone:LOCAL_TIME_ZONE};
  }).filter(Boolean);
}
function attachAutocomplete(inputId,suggestionsId,hintId,onSelect){
  const input=$(inputId),box=$(suggestionsId);let timer=null,requestId=0;
  const close=()=>{box.classList.remove('open');input.setAttribute('aria-expanded','false')};
  const status=t=>{box.innerHTML=`<div class="suggestion-status">${escapeHTML(t)}</div>`;box.classList.add('open');input.setAttribute('aria-expanded','true')};
  input.addEventListener('input',()=>{
    clearTimeout(timer);
    const q=input.value.trim();
    if(q.length<2){close();return;}
    const isStreet=/^\d+\s+/.test(q);
    status(isStreet?'Searching street addresses…':'Searching cities…');const id=++requestId;
    timer=setTimeout(async()=>{try{
      let results;
      if(isStreet){
        results=await searchAddressSuggestions(q);
      }else{
        const url=`https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(q)}&count=7&language=en&format=json&countryCode=US`;
        const response=await fetch(url);
        if(!response.ok)throw new Error('City suggestions unavailable');
        const data=await response.json();
        results=(data.results||[]).filter(r=>r.country_code==='US').map(r=>({
          name:[r.name,r.admin1].filter(Boolean).join(', '),
          latitude:r.latitude,longitude:r.longitude,timezone:r.timezone||LOCAL_TIME_ZONE,
          country:r.country,stateCode:STATE_CODES[String(r.admin1||'').toLowerCase()]
        }));
      }
      if(id!==requestId)return;
      if(!results.length){status(isStreet?'No matching U.S. street addresses found. Add city and state.':'No U.S. cities found. Try adding a state name.');return;}
      box.innerHTML=results.map((r,i)=>`<button type="button" class="suggestion-item" role="option" data-index="${i}"><strong>${escapeHTML(r.name)}</strong><small>${escapeHTML(r.locationType==='address'?'Street address':'City')}</small></button>`).join('');
      box.classList.add('open');input.setAttribute('aria-expanded','true');
      box.querySelectorAll('[data-index]').forEach(btn=>btn.addEventListener('click',()=>{
        const place=results[Number(btn.dataset.index)];
        input.value=place.name;onSelect(place);close();
        if(hintId)setText(hintId,`Selected · ${place.latitude.toFixed(5)}, ${place.longitude.toFixed(5)}`);
      }));
    }catch(e){if(id===requestId)status('Could not load suggestions. Please try again.');}},300);
  });
  document.addEventListener('click',e=>{if(!e.target.closest(`#${inputId}`)&&!e.target.closest(`#${suggestionsId}`))close()});
  input.addEventListener('keydown',e=>{if(e.key==='Escape')close();if(e.key==='Enter'&&box.classList.contains('open')){const first=box.querySelector('button');if(first){e.preventDefault();first.click();}}});
}
let selectedHomePlace=null,selectedExplorePlace=null;
attachAutocomplete('location-input','location-suggestions','location-hint',p=>{selectedHomePlace=p});
attachAutocomplete('explore-location-input','explore-location-suggestions','explore-location-hint',p=>{selectedExplorePlace=p});
$('location-input').addEventListener('input',()=>{if($('location-input').value.trim()!==state.location.name)selectedHomePlace=null});
$('explore-location-input').addEventListener('input',()=>{if($('explore-location-input').value.trim()!==state.location.name)selectedExplorePlace=null});
$('search-form').addEventListener('submit',e=>{
  e.preventDefault();const address=$('location-input').value.trim();
  const place=selectedHomePlace||(address.toLowerCase()==='evanston, illinois'?state.location:null);
  runSearch(place,$('date-input').value,$('start-input').value,$('end-input').value,Number($('duration-input').value),'form-error',$('search-form').querySelector('button[type="submit"]'));
});
$('update-search-button').addEventListener('click',()=>{
  const text=$('explore-location-input').value.trim();const place=selectedExplorePlace||(text===state.location.name?state.location:null);
  runSearch(place,$('explore-date-input').value,$('explore-start-input').value,$('explore-end-input').value,Number($('explore-duration-input').value),'explore-form-error',$('update-search-button'));
});

// A hash change alone does not change .page.active; route it through showPage.
// Brand link is an in-app navigation action, not just a URL-fragment update.
document.querySelector('.brand')?.addEventListener('click', e => {
  e.preventDefault();
  showPage('home');
});
window.addEventListener('hashchange', () => {
  const target = location.hash.replace(/^#/, '');
  if (['home', 'explore', 'detail'].includes(target)) {
    const active = document.querySelector('.page.active')?.id;
    if (active !== `page-${target}`) showPage(target);
  }
});

$('main-location-link').addEventListener('click',e=>{e.preventDefault();selectSite('__main_location__')});
$('back-to-map').addEventListener('click',()=>showPage('explore'));
// A click inside a Leaflet popup can be added after popup creation; delegation handles it.
document.addEventListener('click',e=>{const link=e.target.closest('.popup-open');if(link){e.preventDefault();selectSite(link.dataset.site)}});
// Initialize form values using the browser's local wall clock.
$('date-input').value=state.date;$('start-input').value=state.start;$('end-input').value=state.end;$('duration-input').value=String(state.duration);
if(location.hash==='#explore')showPage('explore');else if(location.hash==='#detail')showPage('detail');else showPage('home');
