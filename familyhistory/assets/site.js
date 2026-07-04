/* ═══════════════════════════════════════════════════════════
   TIDD FAMILY HISTORY — shared behaviour
   Loaded on every page. Progressive-enhancement only; the
   content is fully readable with JS disabled.
   ═══════════════════════════════════════════════════════════ */
(function(){
  'use strict';
  var reduce = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;

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
    else { var m2 = p.match(/\/(migration|famous|maps|genetics|archive|sources)\/?$/); if(m2) norm = m2[1]; }
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

  function ready(fn){ if(document.readyState!=='loading')fn(); else document.addEventListener('DOMContentLoaded',fn); }
  ready(function(){ initNav(); initReveal(); initField(); });
})();
