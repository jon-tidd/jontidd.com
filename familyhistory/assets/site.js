/* ═══════════════════════════════════════════════════════════
   TIDD FAMILY HISTORY — shared behaviour
   Loaded on every page. Progressive-enhancement only; the
   content is fully readable with JS disabled.
   ═══════════════════════════════════════════════════════════ */
(function(){
  'use strict';
  var reduce = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  /* ---------- overlay history: browser Back closes the open overlay ---------- */
  /* Any overlay (reader, image lightbox) calls tiddPushOverlay(closeFn) when it
     opens and tiddPopOverlay() when the user closes it. Pressing the browser
     Back button then dismisses the overlay instead of leaving the page. */
  (function(){
    var closers = [];      // stack of close callbacks, one per open overlay
    var selfBack = false;  // true while we trigger our own history.back()
    window.tiddPushOverlay = function(closeFn){
      closers.push(closeFn);
      try{ history.pushState({tiddOverlay:true}, ''); }catch(e){}
    };
    window.tiddPopOverlay = function(){   // overlay closed by button / Escape / backdrop
      if(!closers.length) return;
      closers.pop();
      selfBack = true;
      try{ history.back(); }catch(e){ selfBack = false; }
    };
    window.addEventListener('popstate', function(){
      if(selfBack){ selfBack = false; return; }  // our own history.back(), overlay already closed
      var fn = closers.pop();
      if(fn) fn();                                // Back pressed: close the top overlay
    });
  })();

  /* ---------- text-size control (grandparent friendly) ---------- */
  var SCALES = {sm:0.9, md:1, lg:1.18};
  function applyScale(k){
    document.documentElement.style.setProperty('--scale', SCALES[k]||1);
    try{ localStorage.setItem('tidd-textsize', k); }catch(e){}
    document.querySelectorAll('.textsize button').forEach(function(b){
      b.classList.toggle('on', b.dataset.size===k);
    });
  }
  window.__tiddApplyScale = applyScale;

  /* ---------- nav: active link + mobile toggle + text-size ---------- */
  function initNav(){
    var nav = document.querySelector('.nav');
    if(!nav) return;
    // Extension-agnostic active-link detection: works whether the host serves
    // "sources.html" or clean "/sources" URLs. The hub (/familyhistory/) = index.
    var p = location.pathname, norm = 'index', m = p.match(/([a-z]+)\.html$/);
    if(m){ norm = m[1]; }
    else { var m2 = p.match(/\/(line|migration|famous|maps|genetics|archive|sources)\/?$/); if(m2) norm = m2[1]; }
    nav.querySelectorAll('.nav-links a[data-page]').forEach(function(a){
      var dp = (a.dataset.page||'').replace(/\.html$/,'') || 'index';
      if(dp===norm) a.classList.add('active');
    });
    var hamb = nav.querySelector('.hamb');
    if(hamb) hamb.addEventListener('click', function(){ nav.classList.toggle('open'); });
    nav.querySelectorAll('.nav-links a').forEach(function(a){
      a.addEventListener('click', function(){ nav.classList.remove('open'); });
    });
    nav.querySelectorAll('.textsize button').forEach(function(b){
      b.addEventListener('click', function(){ applyScale(b.dataset.size); });
    });
    var saved='md'; try{ saved = localStorage.getItem('tidd-textsize')||'md'; }catch(e){}
    applyScale(saved);
  }

  /* ---------- scroll reveal + progress bar (GSAP if present) ---------- */
  function initReveal(){
    var bar = document.querySelector('.progress');
    function onScroll(){
      if(!bar) return;
      var h = document.documentElement.scrollHeight - innerHeight;
      bar.style.width = (h>0 ? (scrollY/h*100) : 0) + '%';
    }
    addEventListener('scroll', onScroll, {passive:true}); onScroll();

    // Only enable the hidden-initial reveal state when we can guarantee we can
    // turn it back on: real IntersectionObserver + a non-zero viewport + motion OK.
    // Otherwise leave everything visible (content-first for a 70+ audience).
    var sane = ('IntersectionObserver' in window) && !reduce && (window.innerHeight>50) && (window.innerWidth>50);
    if(!sane) return; // content stays visible by default
    document.documentElement.classList.add('reveal-on');

    var items = [].slice.call(document.querySelectorAll('[data-reveal]'));
    function reveal(el){
      if(el.classList.contains('in')) return;
      var d = parseFloat(el.dataset.delay||0)*90;
      if(d){ setTimeout(function(){ el.classList.add('in'); }, d); } else { el.classList.add('in'); }
    }
    var io = new IntersectionObserver(function(es){
      es.forEach(function(e){ if(e.isIntersecting){ reveal(e.target); io.unobserve(e.target); } });
    },{rootMargin:'0px 0px -6% 0px',threshold:.04});
    items.forEach(function(el){
      // reveal immediately if already in view; otherwise watch for scroll-in
      if(el.getBoundingClientRect().top < innerHeight*0.98) reveal(el); else io.observe(el);
    });
    // Failsafe: catch late-injected nodes and anything IO missed — never leave hidden.
    setTimeout(function(){
      document.querySelectorAll('[data-reveal]:not(.in)').forEach(function(el){
        if(el.getBoundingClientRect().top < innerHeight*1.05) reveal(el); else io.observe(el);
      });
    }, 1200);
    setTimeout(function(){ document.querySelectorAll('[data-reveal]:not(.in)').forEach(reveal); }, 5000);
  }

  /* ---------- three.js: drifting ancestral particle field ---------- */
  function initField(){
    var canvas = document.getElementById('bg-canvas');
    if(!canvas || !window.THREE || reduce) return;
    var renderer, scene, camera, points, lines, raf, W, H;
    try{
      renderer = new THREE.WebGLRenderer({canvas:canvas, alpha:true, antialias:true});
    }catch(e){ return; }
    renderer.setPixelRatio(Math.min(devicePixelRatio,1.75));
    scene = new THREE.Scene();
    camera = new THREE.PerspectiveCamera(60, innerWidth/innerHeight, 1, 2600);
    camera.position.z = 620;

    var N = innerWidth < 720 ? 130 : 240;
    var geo = new THREE.BufferGeometry();
    var pos = new Float32Array(N*3), vel = new Float32Array(N*3);
    var SPREAD = 1500;
    for(var i=0;i<N;i++){
      pos[i*3]   = (Math.random()-.5)*SPREAD;
      pos[i*3+1] = (Math.random()-.5)*SPREAD*.62;
      pos[i*3+2] = (Math.random()-.5)*900;
      vel[i*3]   = (Math.random()-.5)*.16;
      vel[i*3+1] = (Math.random()-.5)*.16;
      vel[i*3+2] = (Math.random()-.5)*.10;
    }
    geo.setAttribute('position', new THREE.BufferAttribute(pos,3));
    // soft golden sprite
    var c=document.createElement('canvas');c.width=c.height=64;var g=c.getContext('2d');
    var rg=g.createRadialGradient(32,32,0,32,32,32);
    rg.addColorStop(0,'rgba(240,207,133,1)');rg.addColorStop(.35,'rgba(212,168,70,.7)');
    rg.addColorStop(1,'rgba(212,168,70,0)');
    g.fillStyle=rg;g.fillRect(0,0,64,64);
    var tex=new THREE.CanvasTexture(c);
    points = new THREE.Points(geo, new THREE.PointsMaterial({
      size:16, map:tex, transparent:true, depthWrite:false, blending:THREE.AdditiveBlending,
      opacity:.9
    }));
    scene.add(points);

    // faint connecting threads (lineage web)
    var lgeo = new THREE.BufferGeometry();
    var lpos = new Float32Array(N*6);
    lgeo.setAttribute('position', new THREE.BufferAttribute(lpos,3));
    lines = new THREE.LineSegments(lgeo, new THREE.LineBasicMaterial({
      color:0x8b5cf6, transparent:true, opacity:.10, blending:THREE.AdditiveBlending, depthWrite:false
    }));
    scene.add(lines);

    var mx=0,my=0,tx=0,ty=0;
    addEventListener('mousemove',function(e){ tx=(e.clientX/innerWidth-.5); ty=(e.clientY/innerHeight-.5); },{passive:true});

    function resize(){ W=innerWidth;H=innerHeight;renderer.setSize(W,H,false);
      camera.aspect=W/H;camera.updateProjectionMatrix(); }
    resize(); addEventListener('resize',resize,{passive:true});

    function tick(){
      raf=requestAnimationFrame(tick);
      var p=geo.attributes.position.array;
      for(var i=0;i<N;i++){
        p[i*3]+=vel[i*3]; p[i*3+1]+=vel[i*3+1]; p[i*3+2]+=vel[i*3+2];
        if(p[i*3]> SPREAD/2)p[i*3]=-SPREAD/2; if(p[i*3]<-SPREAD/2)p[i*3]=SPREAD/2;
        if(p[i*3+1]> SPREAD*.31)p[i*3+1]=-SPREAD*.31; if(p[i*3+1]<-SPREAD*.31)p[i*3+1]=SPREAD*.31;
      }
      geo.attributes.position.needsUpdate=true;
      // rebuild nearest-neighbour threads occasionally
      var lp=lgeo.attributes.position.array,li=0;
      for(var a=0;a<N && li<lpos.length-6;a++){
        for(var b=a+1;b<N;b++){
          var dx=p[a*3]-p[b*3],dy=p[a*3+1]-p[b*3+1],dz=p[a*3+2]-p[b*3+2];
          if(dx*dx+dy*dy+dz*dz < 34000){
            lp[li++]=p[a*3];lp[li++]=p[a*3+1];lp[li++]=p[a*3+2];
            lp[li++]=p[b*3];lp[li++]=p[b*3+1];lp[li++]=p[b*3+2];
            if(li>=lpos.length-6)break;
          }
        }
      }
      for(;li<lpos.length;li++)lp[li]=0;
      lgeo.attributes.position.needsUpdate=true;
      lgeo.setDrawRange(0, li/3);
      mx+=(tx-mx)*.04; my+=(ty-my)*.04;
      scene.rotation.y = mx*.35; scene.rotation.x = my*.22;
      renderer.render(scene,camera);
    }
    tick();
    document.addEventListener('visibilitychange',function(){
      if(document.hidden){cancelAnimationFrame(raf);} else {tick();}
    });
  }

  /* ---------- accessible transcript reader (shared) ---------- */
  var readerEl;
  function buildReader(){
    if(readerEl) return readerEl;
    readerEl = document.createElement('div');
    readerEl.className='reader'; readerEl.setAttribute('aria-hidden','true');
    readerEl.innerHTML =
      '<div class="reader-bar">'+
        '<span class="reader-title"></span>'+
        '<label class="reader-size"><span class="a-sm">A</span>'+
          '<input type="range" min="0.85" max="2.6" step="0.05" value="1.2" aria-label="Text size">'+
          '<span class="a-lg">A</span></label>'+
        '<button class="reader-close" aria-label="Close reader">✕</button>'+
      '</div>'+
      '<div class="reader-scroll"><div class="reader-body"></div></div>';
    document.body.appendChild(readerEl);
    var body=readerEl.querySelector('.reader-body');
    var range=readerEl.querySelector('.reader-size input');
    function applySize(v){ body.style.setProperty('--rd', v); try{localStorage.setItem('tidd-readsize',v);}catch(e){} }
    var saved='1.2'; try{ saved=localStorage.getItem('tidd-readsize')||'1.2'; }catch(e){}
    range.value=saved; applySize(saved);
    range.addEventListener('input',function(){ applySize(range.value); });
    readerEl.querySelector('.reader-close').addEventListener('click', closeReader);
    readerEl.addEventListener('click',function(e){ if(e.target===readerEl) closeReader(); });
    document.addEventListener('keydown',function(e){ if(e.key==='Escape' && readerEl.classList.contains('open')) closeReader(); });
    return readerEl;
  }
  function openReader(title, html){
    var r=buildReader();
    r.querySelector('.reader-title').textContent=title||'Transcript';
    r.querySelector('.reader-body').innerHTML=html||'';
    r.querySelector('.reader-scroll').scrollTop=0;
    r.classList.add('open'); r.setAttribute('aria-hidden','false');
    document.documentElement.style.overflow='hidden';
    window.tiddPushOverlay(function(){ closeReader(true); });
  }
  function closeReader(fromPop){
    if(!readerEl) return;
    if(!readerEl.classList.contains('open')) return;
    readerEl.classList.remove('open'); readerEl.setAttribute('aria-hidden','true');
    document.documentElement.style.overflow='';
    if(!fromPop) window.tiddPopOverlay();
  }
  window.__openReader = openReader;

  /* ---------- flip-book (books & multi-page letters) ---------- */
  function initFlipbooks(){
    document.querySelectorAll('.flipbook').forEach(function(fb){
      var pages=[].slice.call(fb.querySelectorAll('.fb-page'));
      if(!pages.length) return;
      var title=fb.dataset.title||'Document';
      var data=pages.map(function(p){
        var img=p.querySelector('img');
        var t=p.querySelector('.fb-text');
        return {src:img?img.getAttribute('src'):'', alt:img?img.alt:'',
                cap:p.dataset.cap||'', text:t?t.textContent:''};
      });
      var i=0, view='img';
      var stage=document.createElement('div'); stage.className='fb-stage';
      var paper=document.createElement('div'); paper.className='fb-paper';
      var im=document.createElement('img'); paper.appendChild(im);
      var tv=document.createElement('div'); tv.className='fb-textview'; paper.appendChild(tv);
      stage.appendChild(paper);
      // overlay controls (sit ON the page, so you never scroll below to advance)
      var prev=mk('button','fb-nav prev','‹'), next=mk('button','fb-nav next','›');
      prev.setAttribute('aria-label','Previous page'); next.setAttribute('aria-label','Next page');
      var counter=mk('div','fb-counter',''), toggle=mk('button','fb-toggle','');
      toggle.setAttribute('aria-label','Switch between the scan and the typed transcription');
      stage.appendChild(prev); stage.appendChild(next); stage.appendChild(counter); stage.appendChild(toggle);
      var cap=mk('div','fb-cap','');
      fb.appendChild(stage); fb.appendChild(cap);
      function render(){
        im.src=data[i].src; im.alt=data[i].alt;
        counter.innerHTML='<b>'+(i+1)+'</b> / '+data.length;
        cap.textContent=data[i].cap;
        prev.disabled=i===0; next.disabled=i===data.length-1;
        var hasText=!!data[i].text;
        toggle.style.display=hasText?'':'none';
        if(view==='text' && hasText){
          paper.classList.add('is-text');
          tv.innerHTML=data[i].text+'<button class="fb-enlarge" type="button">⤢ Larger text</button>';
          tv.querySelector('.fb-enlarge').onclick=function(){ openReader(title+' · page '+(i+1), data[i].text); };
          toggle.innerHTML='🖼 Scan';
        } else {
          paper.classList.remove('is-text'); toggle.innerHTML='📖 Text';
        }
      }
      function go(n,dir){
        n=Math.max(0,Math.min(data.length-1,n)); if(n===i) return;
        if(!reduce && dir && view==='img'){ paper.classList.add(dir>0?'turn-next':'turn-prev');
          setTimeout(function(){ i=n; render(); paper.classList.remove('turn-next','turn-prev'); },150); }
        else { i=n; render(); }
      }
      prev.addEventListener('click',function(){ go(i-1,-1); });
      next.addEventListener('click',function(){ go(i+1,1); });
      toggle.addEventListener('click',function(){ view=view==='text'?'img':'text'; render(); });
      fb.setAttribute('tabindex','0');
      fb.addEventListener('keydown',function(e){ if(e.key==='ArrowLeft')go(i-1,-1); if(e.key==='ArrowRight')go(i+1,1); });
      render();
    });
  }
  function mk(tag,cls,html){ var e=document.createElement(tag); e.className=cls; e.innerHTML=html; return e; }

  /* ---------- transcript buttons on any image (data-transcript) ---------- */
  function initTranscriptButtons(){
    document.querySelectorAll('[data-reader-title]').forEach(function(el){
      el.addEventListener('click',function(e){
        e.preventDefault();
        var html=''; var tpl=el.parentNode.querySelector('.rd-text')||document.getElementById(el.dataset.readerFor||'');
        if(tpl) html=tpl.innerHTML || tpl.textContent;
        openReader(el.dataset.readerTitle, html);
      });
    });
  }

  /* ---------- direct-line filter (show only the lineal bloodline) ---------- */
  function initLineFilter(){
    var nav=document.querySelector('.nav'); if(!nav) return;
    var on=false; try{ on = localStorage.getItem('tidd-line-only')==='1'; }catch(e){}
    document.documentElement.classList.toggle('line-only', on);
    var btn=document.createElement('button');
    btn.type='button';
    btn.className='line-toggle'+(on?' on':'');
    btn.setAttribute('aria-pressed', on?'true':'false');
    btn.title='Toggle between the direct bloodline only and the whole family, indirect lines included';
    btn.innerHTML='<span class="lt-dot"></span><span class="lt-label"></span>';
    var lbl=btn.querySelector('.lt-label');
    function apply(v){
      on=v;
      document.documentElement.classList.toggle('line-only', on);
      btn.classList.toggle('on', on);
      btn.setAttribute('aria-pressed', on?'true':'false');
      lbl.textContent = on ? 'Direct line only' : 'Direct + Indirect';
      try{ localStorage.setItem('tidd-line-only', on?'1':'0'); }catch(e){}
    }
    apply(on);
    btn.addEventListener('click', function(){ apply(!on); });
    nav.appendChild(btn);
  }

  function ready(fn){ if(document.readyState!=='loading')fn(); else document.addEventListener('DOMContentLoaded',fn); }
  ready(function(){ initNav(); initLineFilter(); initReveal(); initField(); initFlipbooks(); initTranscriptButtons(); });
})();
