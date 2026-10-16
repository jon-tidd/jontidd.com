// One sticky Sound on/off switch. Remembered across visits. Off = mute + stop everything. Never autoplays.
const Sound=(()=>{const KEY='jon-sound-v2',HINT='jon-sound-hint-seen';let on=localStorage.getItem(KEY)!=='off';const subs=[];
const icon=o=>`<svg viewBox="0 0 24 24" width="22" height="22" aria-hidden="true"><path d="M4 9h4l5-4v14l-5-4H4z" fill="currentColor"/>${o?'<path d="M16 8.5a5 5 0 0 1 0 7M18.5 6a8.5 8.5 0 0 1 0 12" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>':'<path d="M16 9l5 6M21 9l-5 6" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>'}</svg>`;
const b=document.getElementById('snd');
function paint(){b.setAttribute('aria-pressed',on);b.classList.toggle('off',!on);b.innerHTML=icon(on)+`<span>Sound ${on?'on':'off'}</span>`;b.setAttribute('aria-label',on?'Sound is on. Tap to turn off.':'Sound is off. Tap to turn on.')}
b.onclick=()=>{on=!on;localStorage.setItem(KEY,on?'on':'off');paint();hideHint();subs.forEach(f=>f(on))};paint();
const h=document.createElement('div');h.className='snd-hint';h.setAttribute('role','status');h.innerHTML=(b.dataset.hint||'Tap any cover to hear it')+' <button aria-label="Dismiss">✕</button>';
function hideHint(){h.classList.remove('show');localStorage.setItem(HINT,'1')}
if(!localStorage.getItem(HINT)){document.body.appendChild(h);requestAnimationFrame(()=>h.classList.add('show'));h.querySelector('button').onclick=hideHint;setTimeout(hideHint,9000);document.addEventListener('click',e=>{if(e.target.closest('[data-k],.shows button,#snd'))hideHint()},{once:false})}
function nudge(){b.classList.remove('nudge');void b.offsetWidth;b.classList.add('nudge')}
// Clips that fail to load are remembered for the session so their play controls can be hidden.
const bad=new Set(JSON.parse(sessionStorage.getItem('jon-bad-clips')||'[]'));
function clipFailed(url){bad.add(url);sessionStorage.setItem('jon-bad-clips',JSON.stringify([...bad]));document.querySelectorAll('[data-clip]').forEach(e=>{if(bad.has(e.dataset.clip)){e.hidden=true;e.disabled=true}})}
return{on:()=>on,onChange:f=>subs.push(f),nudge,clipFailed,isBad:u=>bad.has(u)}})();

