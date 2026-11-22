import { HMAC_JS } from '@core/connect/hmac'

/**
 * The viewer page: what a phone, tablet, TV or other-PC browser opens (the QR code points here).
 * One self-contained file, no libraries, no network requests except the WebSocket back to the host.
 *
 * It follows the host's shared song clock: synced lyrics, cover art, the host's vibe, and (when internet is
 * available) the same background video played locally in sync, never streamed from the PC. Controllers also get
 * play / pause / next / seek / volume / vibe.
 *
 * Written in plain ES2017 inside a template string: do not use backticks or dollar-brace in the script.
 */
const CSS = `
*{box-sizing:border-box;margin:0}
html,body{height:100%;background:#0b0b10;color:#f4f2ee;font-family:system-ui,-apple-system,"Segoe UI",Roboto,sans-serif;overflow:hidden}
:root{--accent:#ffd36b}
:root[data-vibe=neon]{--accent:#ff4fd8}:root[data-vibe=sunset]{--accent:#ff8a4c}:root[data-vibe=noir]{--accent:#e8e8e8}
:root[data-vibe=arcade]{--accent:#7dff6b}:root[data-vibe=dream]{--accent:#b9a2ff}:root[data-vibe=chrome]{--accent:#9fd0ff}
:root[data-vibe=crt]{--accent:#58ff9a}:root[data-vibe=paper]{--accent:#c9743a}:root[data-vibe=journal]{--accent:#e0556d}:root[data-vibe=doodle]{--accent:#ff5f7e}:root[data-vibe=stadium]{--accent:#ffe14d}
#bg{position:fixed;inset:0;background:#0b0b10 center/cover no-repeat;filter:blur(36px) saturate(1.3) brightness(.55);transform:scale(1.2);transition:background-image .6s}
#vid{position:fixed;inset:0;width:100%;height:100%;border:0;opacity:0;transition:opacity .8s;pointer-events:none}
#vid.on{opacity:.55}
#shade{position:fixed;inset:0;background:linear-gradient(#0008,#000a)}
main{position:relative;height:100%;display:flex;flex-direction:column;padding:max(16px,env(safe-area-inset-top)) 20px max(16px,env(safe-area-inset-bottom))}
header{display:flex;gap:14px;align-items:center;min-height:64px}
#art{width:56px;height:56px;border-radius:10px;background:#222 center/cover;flex:none}
#meta{min-width:0;flex:1}
#title{font-weight:700;font-size:1.05rem;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
#artist{opacity:.7;font-size:.9rem;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
#chip{font-size:.72rem;padding:4px 9px;border-radius:99px;background:#fff2;white-space:nowrap}
#chip.ok{background:color-mix(in srgb,var(--accent) 30%,transparent)}
#lyrics{flex:1;min-height:0;overflow:hidden;position:relative;display:flex;align-items:center;mask-image:linear-gradient(transparent,#000 22%,#000 78%,transparent)}
#lines{position:absolute;left:0;right:0;top:0;transition:transform .45s cubic-bezier(.2,.8,.2,1);will-change:transform}
.l{font-size:clamp(1.3rem,4.2vw,2.6rem);font-weight:700;line-height:1.25;padding:.35em 0;opacity:.32;transition:opacity .3s,transform .3s;transform-origin:left center;text-align:left}
.l.on{opacity:1;color:var(--accent);transform:scale(1.04)}
.l.past{opacity:.2}
#empty{position:absolute;inset:0;display:grid;place-items:center;text-align:center;opacity:.7;padding:30px;line-height:1.5}
#ctl{display:none;gap:14px;align-items:center;justify-content:center;padding-top:10px;flex-wrap:wrap}
#ctl.on{display:flex}
#ctl button,#ctl select{background:#ffffff1c;color:inherit;border:0;border-radius:99px;min-width:48px;height:48px;font-size:1.1rem;padding:0 16px}
#ctl button:active{background:#ffffff40}
#seek{flex:1 1 100%;accent-color:var(--accent)}
#vol{width:120px;accent-color:var(--accent)}
#pair{position:fixed;inset:0;display:none;place-items:center;background:#0b0b10;z-index:5;padding:24px;text-align:center}
#pair.on{display:grid}
#pair input{font-size:2rem;letter-spacing:.2em;text-align:center;width:11ch;padding:10px;border-radius:12px;border:2px solid #fff4;background:#fff1;color:inherit;text-transform:uppercase}
#pair button{margin-top:16px;font-size:1.1rem;padding:12px 28px;border-radius:99px;border:0;background:var(--accent);color:#111;font-weight:700}
#pair p{opacity:.7;margin:10px 0;max-width:34ch}
#fs{position:fixed;right:14px;bottom:14px;z-index:4;width:44px;height:44px;border-radius:50%;border:1px solid #fff3;background:#0f0f12a6;color:inherit;font-size:20px;line-height:1;cursor:pointer;transition:opacity .4s}
body.calm #fs,body.calm #chip{opacity:0;pointer-events:none}
body.calm{cursor:none}
body.tv #fs{display:none}
body.tv header{min-height:96px;gap:22px}body.tv #art{width:96px;height:96px;border-radius:16px}
body.tv #title{font-size:clamp(1.6rem,2.6vw,3rem)}body.tv #artist{font-size:clamp(1.1rem,1.8vw,2rem)}
body.tv .l{font-size:clamp(2rem,5vw,5.5rem)}body.tv #chip{font-size:1rem}body.tv #ctl button,body.tv #ctl select{height:64px;min-width:64px;font-size:1.4rem}
`

const JS = `
(function(){
var $=function(i){return document.getElementById(i)};
var KEY='lyra.connect.device';
var ws=null,attempt=0,retryTimer=0,pingTimer=0,pingsSent=0,role='viewer',sessionKey='',cmdN=0,pendingPair=null;
var samples=[];var play=null,now=null,choices={},lyrics=null,view=null,vibes=[];
var curLine=-1,lastSeek=0,ytReady=false,videoId=null,videoState='';

function save(o){try{localStorage.setItem(KEY,JSON.stringify(o))}catch(e){}}
function load(){try{return JSON.parse(localStorage.getItem(KEY)||'null')}catch(e){return null}}
function forget(){try{localStorage.removeItem(KEY)}catch(e){}}
function rnd(n){var a=new Uint8Array(n);(window.crypto||window.msCrypto).getRandomValues(a);var s='';for(var i=0;i<n;i++)s+=(a[i]<16?'0':'')+a[i].toString(16);return s}
function deviceName(){var u=navigator.userAgent;var k=/iPad|Tablet/i.test(u)?'Tablet':/iPhone|Android.*Mobile|Mobile/i.test(u)?'Phone':/TV|Tizen|WebOS|SMART-TV/i.test(u)?'TV':'Browser';return k+' '+rnd(2)}
function chip(text,ok){var c=$('chip');c.textContent=text;c.className=ok?'ok':''}

// ---- clock offset (NTP-style, best of the last 8 round trips) ----
function addSample(c0,s1,s2,c3){var rtt=c3-c0-(s2-s1);if(!(rtt>=0&&rtt<10000))return;samples.push({o:(s1-c0+(s2-c3))/2,r:rtt,t:c3});if(samples.length>8)samples.shift()}
function offset(){if(!samples.length)return 0;var b=samples[0];for(var i=1;i<samples.length;i++)if(samples[i].r<b.r)b=samples[i];return b.o}
function pos(){if(!play)return 0;var hostNow=Date.now()+offset();var p=play.positionMs+(play.playing?Math.max(0,hostNow-play.at):0);var d=now?now.durationMs:0;return Math.max(0,d>0?Math.min(p,d):p)}
function pingDelay(n){return n<6?150:n<12?1000:10000}

// ---- connection ----
function send(o){if(ws&&ws.readyState===1){o.v=1;ws.send(JSON.stringify(o))}}
function signedCmd(body){if(!sessionKey)return;cmdN++;var b=JSON.stringify(body);send({t:'cmd',n:cmdN,b:b,mac:lyraHmac(sessionKey,cmdN+'|'+b)})}
function schedulePing(){clearTimeout(pingTimer);pingTimer=setTimeout(function(){if(ws&&ws.readyState===1){send({t:'ping',id:pingsSent,c0:Date.now()});pingsSent++;schedulePing()}},pingDelay(pingsSent))}
function backoff(){var b=Math.min(15000,500*Math.pow(2,attempt));return Math.round(b*(0.75+Math.random()*0.5))}

function connect(){
  clearTimeout(retryTimer);
  var saved=load();
  if(!saved&&!pendingPair){showPair('');return}
  chip('Connecting…',false);
  var cn=rnd(16),cred=saved,code=pendingPair;
  try{ws=new WebSocket('ws://'+location.host+'/ws')}catch(e){return retry()}
  var mine=ws;
  mine.onopen=function(){
    attempt=0;pingsSent=0;samples=[];
    if(code)send({t:'pair',code:code,name:deviceName(),cn:cn});
    else send({t:'hello',deviceId:cred.id,name:cred.name||deviceName(),cn:cn});
    schedulePing();
  };
  mine.onmessage=function(ev){var m;try{m=JSON.parse(ev.data)}catch(e){return}
    if(m.t==='challenge'){send({t:'auth',proof:lyraHmac(cred.token,'lyra1|auth|'+cn+'|'+m.sn)});sessionKey=lyraHmac(cred.token,'lyra1|sess|'+cn+'|'+m.sn);cmdN=0}
    else if(m.t==='paired'){pendingPair=null;cred={id:m.deviceId,token:m.token,name:deviceName()};save(cred);sessionKey=lyraHmac(m.token,'lyra1|sess|'+cn+'|'+m.sn);cmdN=0;role=m.role}
    else if(m.t==='ready'){role=m.role;vibes=m.vibes||[];chip(m.party?'Party · '+m.name:m.name,true);buildControls();hidePair()}
    else if(m.t==='pong'){addSample(m.c0,m.s1,m.s2,Date.now())}
    else if(m.t==='now'){now=m.now;choices=m.choices||{};lyrics=null;curLine=-1;renderNow();renderLyrics()}
    else if(m.t==='play'){play=m.play;syncVideo(true);tick()}
    else if(m.t==='view'){view=m.view;renderView()}
    else if(m.t==='lyrics'){if(now&&m.id===now.id){lyrics=m;curLine=-1;renderLyrics()}}
    else if(m.t==='art'){if(now&&m.id===now.id)$('art').style.backgroundImage=$('bg').style.backgroundImage=m.src?'url('+m.src+')':''}
    else if(m.t==='err'){if(m.code==='bad-proof'||m.code==='unknown-device'){forget();cred=null}if(m.code==='bad-code'||m.code==='expired'||m.code==='rate'||m.code==='full'){showPair(m.msg)}else if(m.code==='bad-proof'){showPair('This device was removed. Scan the code again.')}}
    else if(m.t==='bye'){if(m.why&&/removed/.test(m.why)){forget();showPair(m.why)}else chip(m.why||'Disconnected',false)}
  };
  mine.onclose=function(){if(mine!==ws)return;sessionKey='';retry()};
  mine.onerror=function(){};
}
function retry(){clearTimeout(pingTimer);if(!load()&&!pendingPair)return;chip('Reconnecting…',false);retryTimer=setTimeout(function(){attempt++;connect()},backoff())}

// ---- pairing screen ----
function showPair(msg){$('pair').className='on';$('pmsg').textContent=msg||''}
function hidePair(){$('pair').className=''}
$('pgo').onclick=function(){var v=$('pcode').value.trim();if(!v)return;pendingPair=v;if(ws)try{ws.close()}catch(e){}connect()};

// ---- rendering ----
function renderNow(){
  $('title').textContent=now?now.title:'Nothing playing';
  $('artist').textContent=now?now.artists.join(', '):'Play a song in Lyra';
  document.title=now?now.title+' · Lyra':'Lyra';
  if(!now){$('art').style.backgroundImage=$('bg').style.backgroundImage=''}
  if(choices.video&&choices.video.videoId&&(!view||!view.video.id)){/* the host's own pick wins until its view message names the video */}
}
function offsetMs(){return view&&typeof view.offsetMs==='number'?view.offsetMs:typeof choices.offsetMs==='number'?choices.offsetMs:0}
function renderLyrics(){
  var box=$('lines');box.textContent='';box.style.transform='';
  var e=$('empty');
  if(!lyrics||!lyrics.lines.length){e.style.display='grid';e.textContent=now?(lyrics&&lyrics.status==='loading'?'Finding lyrics…':'No lyrics for this song'):'';return}
  e.style.display='none';
  for(var i=0;i<lyrics.lines.length;i++){var d=document.createElement('div');d.className='l';d.textContent=lyrics.lines[i].x;box.appendChild(d)}
  if(!lyrics.synced){box.style.transform='translateY(0)';}
  tick();
}
function renderView(){
  if(!view)return;
  document.documentElement.setAttribute('data-vibe',view.vibe||'none');
  var id=view.video&&view.video.id||null;
  if(id!==videoId){videoId=id;ytReady=false;var f=$('vid');f.className='';f.removeAttribute('src');if(id)startVideo(id)}
  var sel=$('vibe');if(sel&&view.vibe)sel.value=view.vibe;
}
function startVideo(id){
  var f=$('vid');var start=Math.floor(pos()/1000);
  f.onload=function(){f.contentWindow.postMessage(JSON.stringify({event:'listening',id:1,channel:'widget'}),'*');setTimeout(function(){f.className='on'},600)};
  f.src='https://www.youtube-nocookie.com/embed/'+encodeURIComponent(id)+'?autoplay=1&mute=1&controls=0&playsinline=1&rel=0&disablekb=1&modestbranding=1&enablejsapi=1&start='+start;
}
function yt(func,args){try{$('vid').contentWindow.postMessage(JSON.stringify({event:'command',func:func,args:args||[]}),'*')}catch(e){}}
window.addEventListener('message',function(ev){
  if(ev.source!==$('vid').contentWindow)return;var d;try{d=JSON.parse(ev.data)}catch(e){return}
  if(d.event==='infoDelivery'&&d.info&&typeof d.info.currentTime==='number'){
    ytReady=true;var want=pos()/1000,have=d.info.currentTime,t=Date.now();
    // seek only when clearly off, and not more than once every 3 s: never stutter over normal jitter
    if(play&&play.playing&&Math.abs(have-want)>0.6&&t-lastSeek>3000){lastSeek=t;yt('seekTo',[want,true])}
  }
});
function syncVideo(){if(!videoId)return;var s=play&&play.playing?'p':'s';if(s!==videoState){videoState=s;yt(s==='p'?'playVideo':'pauseVideo')}}

var raf=0;
function tick(){
  cancelAnimationFrame(raf);
  if(lyrics&&lyrics.synced&&lyrics.lines.length){
    var p=pos()-offsetMs(),L=lyrics.lines,i=-1;
    for(var k=0;k<L.length;k++){if(L[k].t<=p)i=k;else break}
    if(i!==curLine){
      var nodes=$('lines').children;
      if(curLine>=0&&nodes[curLine])nodes[curLine].className='l past';
      for(var j=0;j<i;j++)if(nodes[j]&&nodes[j].className!=='l past')nodes[j].className='l past';
      if(i>=0&&nodes[i]){nodes[i].className='l on';
        var h=$('lyrics').clientHeight,n=nodes[i];$('lines').style.transform='translateY('+Math.round(h/2-(n.offsetTop+n.offsetHeight/2))+'px)'}
      curLine=i;
    }
  }
  var sk=$('seek');if(sk&&now&&role==='controller'&&!sk.dataset.drag){sk.max=now.durationMs;sk.value=pos()}
  // only animate while something moves and the page is visible: no idle CPU, no battery drain
  if(play&&play.playing&&!document.hidden)raf=requestAnimationFrame(function(){setTimeout(tick,120)});
}
document.addEventListener('visibilitychange',function(){if(!document.hidden){tick();syncVideo()}});

function buildControls(){
  var c=$('ctl');if(role!=='controller'){c.className='';return}
  if(c.dataset.built){c.className='on';return}
  c.dataset.built='1';c.className='on';
  c.innerHTML='<input id="seek" type="range" min="0" max="1000" value="0" aria-label="Seek"><button id="prev" aria-label="Previous">⏮</button><button id="pp" aria-label="Play or pause">⏯</button><button id="next" aria-label="Next">⏭</button><input id="vol" type="range" min="0" max="100" value="50" aria-label="Volume"><select id="vibe" aria-label="Vibe"></select>';
  $('prev').onclick=function(){signedCmd({c:'prev'})};$('next').onclick=function(){signedCmd({c:'next'})};$('pp').onclick=function(){signedCmd({c:'toggle'})};
  var sk=$('seek');sk.oninput=function(){sk.dataset.drag='1'};sk.onchange=function(){delete sk.dataset.drag;signedCmd({c:'seek',ms:Number(sk.value)})};
  $('vol').onchange=function(){signedCmd({c:'volume',pct:Number($('vol').value)})};
  var sel=$('vibe');for(var i=0;i<vibes.length;i++){var o=document.createElement('option');o.value=vibes[i];o.textContent=vibes[i];sel.appendChild(o)}
  sel.onchange=function(){signedCmd({c:'vibe',id:sel.value})};
}

// keep the screen on (TV / tablet on a stand); the browser drops the lock when the page is hidden, so ask again on return
function keepAwake(){try{if(navigator.wakeLock)navigator.wakeLock.request('screen').catch(function(){})}catch(e){}}
keepAwake();document.addEventListener('visibilitychange',function(){if(!document.hidden)keepAwake()});
// TV browsers sit metres away: bigger type and cover, no small button (?tv=1 forces it, ?tv=0 turns it off)
var qs=location.search;
var isTv=/[?&]tv=/.test(qs)?!/[?&]tv=0/.test(qs):/SMART-TV|SmartTV|Tizen|Web0S|WebOS|NetCast|HbbTV|CrKey|AFT[A-Z]|BRAVIA|Roku|VIDAA|Hisense|AppleTV|GoogleTV/i.test(navigator.userAgent);
document.body.classList.toggle('tv',isTv);
// full screen: the button, the F key, or a double tap / click anywhere
function toggleFs(){var d=document,el=d.documentElement;
  if(d.fullscreenElement||d.webkitFullscreenElement){(d.exitFullscreen||d.webkitExitFullscreen).call(d)}
  else{var f=el.requestFullscreen||el.webkitRequestFullscreen;if(f)try{var r=f.call(el);if(r&&r.catch)r.catch(function(){})}catch(e){}}}
$('fs').onclick=toggleFs;
addEventListener('dblclick',function(e){if(!/INPUT|SELECT|BUTTON/.test(e.target.tagName)&&$('pair').className!=='on')toggleFs()});
addEventListener('keydown',function(e){if((e.key==='f'||e.key==='F')&&!/INPUT|SELECT|TEXTAREA/.test(e.target.tagName)&&!e.ctrlKey&&!e.metaKey&&!e.altKey)toggleFs()});
// idle hide: after 4 s without a pointer move, key or touch the cursor and the small chrome fade out (never while pairing)
var calmTimer=0;
function wake(){document.body.classList.remove('calm');clearTimeout(calmTimer);calmTimer=setTimeout(function(){if($('pair').className!=='on')document.body.classList.add('calm')},4000)}
['mousemove','mousedown','keydown','touchstart'].forEach(function(n){addEventListener(n,wake,{passive:true})});
wake();

// pairing code from the QR link lives in the URL fragment: read it once, then wipe it from the address bar
var m=/[#&]p=([A-Za-z0-9-]+)/.exec(location.hash);
if(m){pendingPair=m[1];try{history.replaceState(null,'',location.pathname)}catch(e){}}
connect();
})();
`

export const VIEWER_HTML = `<!doctype html>
<html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover">
<meta name="referrer" content="no-referrer"><meta name="theme-color" content="#0b0b10">
<link rel="manifest" href="/manifest.webmanifest"><link rel="apple-touch-icon" href="/icon.png">
<meta name="mobile-web-app-capable" content="yes"><meta name="apple-mobile-web-app-capable" content="yes"><meta name="apple-mobile-web-app-status-bar-style" content="black-translucent">
<title>Lyra</title><style>${CSS}</style></head>
<body>
<div id="bg"></div><iframe id="vid" title="Background video" allow="autoplay; encrypted-media" referrerpolicy="strict-origin-when-cross-origin"></iframe><div id="shade"></div>
<main>
<header><div id="art"></div><div id="meta"><div id="title">Lyra</div><div id="artist"></div></div><div id="chip">Connecting…</div></header>
<div id="lyrics"><div id="lines"></div><div id="empty"></div></div>
<div id="ctl"></div>
</main>
<button id="fs" type="button" title="Full screen (F)" aria-label="Full screen">&#9974;</button>
<div id="pair"><div><h2>Connect to Lyra</h2><p>Scan the QR code in Lyra on your PC, or type the code shown in Settings, Devices.</p><input id="pcode" maxlength="9" autocomplete="off" autocapitalize="characters" placeholder="ABCD-EFGH"><br><button id="pgo">Connect</button><p id="pmsg"></p></div></div>
<script>${HMAC_JS}\n${JS}</script>
</body></html>`
