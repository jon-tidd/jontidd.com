/* ═══════════════════════════════════════════════════════════
   TIDD FAMILY HISTORY — Living Maps engine (D3 v7 + TopoJSON)

   World map  = a 100,000-year migration journey. Time jumps
   non-linearly across the big eras (Out of Africa → Europe →
   R1b Britain → Anglo-Saxon → 1273 first record → 1637 crossing
   → diaspora → today's surname map). Each era lights up where the
   line lived, draws a DIRECTIONAL animated flow to the next home,
   and can pop a callout for a major moment.

   US map = the American chapter, 1637 → today, with the surname
   concentration by state and the same directional flows.

   Directional motion uses CSS dash-flow + SMIL <animateMotion>
   comets + an arrowhead, none of which depend on requestAnimation-
   Frame, so the maps animate even on throttled/background tabs.
   ═══════════════════════════════════════════════════════════ */
(function(){
  'use strict';
  if(!window.d3 || !window.topojson){
    ['worldLoading','usLoading'].forEach(function(id){
      var el=document.getElementById(id); if(el) el.textContent='Map libraries could not load — check your connection.';
    });
    return;
  }
  var reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
  var LAND='#28344f';            // base landmass tone — visible in every era
  var ramp = d3.interpolateRgbBasis(['#3a2f18','#6b4f1c','#a9812f','#d4a846','#f6dd9b']);
  function colorScale(maxV){ var s=d3.scaleLog().domain([1,Math.max(2,maxV)]).range([0,1]).clamp(true);
    return function(v){ return (!v||v<=0)?LAND:ramp(s(v)); }; }

  /* ───────────────────────── WORLD ERAS ───────────────────────── */
  // c = [lon,lat]. r: marker size hint. Flows are {from,to}.
  var WORLD_TODAY = {'United States of America':2897,'United Kingdom':640,'Canada':400,'Australia':250,
    'New Zealand':60,'South Africa':40,'Ireland':25,'Germany':12,'France':9,'Netherlands':7};
  var WORLD = [
    {t:'~100,000 BCE', name:'Out of Africa', data:{}, choro:false,
     markers:[{c:[38,7],r:2.4,label:'East Africa'}], flows:[],
     popup:{c:[38,7],title:'The journey begins', body:'Every person alive descends from a small band of modern humans in East Africa — no name, no farming yet, just the first steps of a hundred-thousand-year walk.'}},
    {t:'~45,000 BCE', name:'Into Ice-Age Europe', data:{}, choro:false,
     markers:[{c:[38,7]},{c:[42,34]},{c:[12,48],r:2,label:'Europe'}], flows:[{from:[38,10],to:[13,47]}],
     popup:{c:[12,48],title:'Hunters at the edge of the ice', body:'The line reaches Europe during the last Ice Age, sharing the tundra with mammoths and, briefly, with Neanderthals — whose DNA still survives (~2%) in the family genome.'}},
    {t:'~6,000 BCE', name:'The first farmers', data:{}, choro:false,
     markers:[{c:[33,39],label:'Anatolia'},{c:[10,48],r:2}], flows:[{from:[33,39],to:[10,49]}],
     popup:{c:[33,39],title:'Farming sweeps west', body:'Neolithic farmers spread out of Anatolia into Europe, folding the old hunter-gatherer world into a new agricultural one. The family genome is a braid of the two.'}},
    {t:'~2,500 BCE', name:'R1b reaches Britain', data:{}, choro:false,
     markers:[{c:[46,49],label:'Steppe'},{c:[-2,54],r:2.4,label:'Britain'}], flows:[{from:[44,50],to:[-2,54]}],
     popup:{c:[-2,54],title:'The signature of Britain', body:'Horse-riding Beaker people bring haplogroup R1b-P312 to Britain — carried today by 70%+ of English men, and the near-certain deep paternal marker of the Tidd line.'}},
    {t:'410–700 CE', name:'The Anglo-Saxons', data:{}, choro:false,
     markers:[{c:[9,55],label:'Saxony · Jutland'},{c:[-1,52.4],r:2.4,label:'England'}], flows:[{from:[8,55],to:[0,52.5]}],
     popup:{c:[-1,52.4],title:'The name is born', body:'Angles, Saxons and Jutes cross the North Sea. From their tongue comes tid-man — the trusted head of a tithing of ten households — the root of the surname.'}},
    {t:'1273 CE', name:'First written record', data:{}, choro:false,
     markers:[{c:[0.1,52.4],r:2.4,label:'Cambridgeshire'}], flows:[],
     popup:{c:[0.1,52.4],title:'“Thomas de Tid,” 1273', body:'The surname first appears in writing in the Hundred Rolls of Cambridgeshire, in the reign of King Edward I. From here the paper trail runs unbroken to today.'}},
    {t:'1637 CE', name:'The Atlantic crossing', data:{}, choro:false,
     markers:[{c:[-1.3,50.7],label:'Isle of Wight'},{c:[-71,42.5],r:2.4,label:'Woburn'}], flows:[{from:[-1.3,50.7],to:[-71,42.5]}],
     popup:{c:[-71,42.5],title:'John Tidd sails west', body:'A tailor from Hertfordshire crosses to the Massachusetts Bay Colony and helps found Woburn in 1640 — the reason there are American Tidds at all.'}},
    {t:'1700s–1800s', name:'The diaspora', data:{}, choro:false,
     markers:[{c:[-83,40.4],label:'Ohio'},{c:[-79.4,44],label:'Canada'},{c:[151,-33.9],label:'Australia'}],
     flows:[{from:[-71,42.5],to:[-83,40.4]},{from:[-0.1,51.5],to:[-79.4,44]},{from:[-0.1,51.5],to:[151,-33.9]}],
     popup:{c:[-83,40.4],title:'Over the mountains & the seas', body:'Branches push west to the Niles–Vienna country of Ohio, and colonial ships carry the name to Canada and Australia.'}},
    {t:'Today', name:'The family now', data:WORLD_TODAY, choro:true,
     markers:[], flows:[],
     popup:{c:[-96,38],title:'One name in 1.6 million', body:'About 2,897 Tidds live in the U.S. today — the largest population on Earth. Three-quarters of all Tidds are now in the Americas; the rest cluster in England, Canada and Australia.'}}
  ];

  /* ───────────────────────── US ERAS ───────────────────────── */
  var US = [
    {t:'1637–1700', name:'Woburn', data:{'Massachusetts':20}, choro:true,
     markers:[{c:[-71.1,42.4],r:2.4,label:'Woburn'}], flows:[],
     popup:{c:[-71.1,42.4],title:'Ground zero: Woburn', body:'Sgt. John Tidd helps found Woburn in 1640. For a century the family barely leaves Massachusetts.'}},
    {t:'c. 1750', name:'New England', data:{'Massachusetts':60,'New Hampshire':15,'Connecticut':12,'Maine':10}, choro:true,
     markers:[{c:[-71.1,42.4]}], flows:[], popup:null},
    {t:'c. 1850', name:'Westward', data:{'Massachusetts':120,'Ohio':90,'New York':70,'Pennsylvania':40,'New Hampshire':25,'Maine':20,'Connecticut':18,'Illinois':15}, choro:true,
     markers:[{c:[-82.9,40.4],r:2.2,label:'Ohio'},{c:[-98.2,41.2],r:2.2,label:'Palmer, Neb.'}], flows:[{from:[-71.1,42.4],to:[-82.9,40.4]},{from:[-71.1,42.4],to:[-98.2,41.2]}],
     popup:{c:[-98.2,41.2],title:'The line leaps to Nebraska', body:'Cousin branches settle Ohio and New York, while the direct line jumps from Lexington to Palmer, Nebraska: Charles Lowell Tidd, Civil War veteran, opens one of the town\u2019s first stores.'}},
    {t:'c. 1950', name:'Coast to coast', data:{'Ohio':260,'Massachusetts':220,'California':180,'New York':150,'Illinois':70,'Michigan':90,'Texas':80,'Florida':60,'Pennsylvania':60,'Indiana':50}, choro:true,
     markers:[{c:[-119,37],label:'California'}], flows:[{from:[-71.1,42.4],to:[-119,37]},{from:[-71.1,42.4],to:[-99,31.5]},{from:[-71.1,42.4],to:[-81.7,28]}],
     popup:null},
    {t:'Today', name:'Everywhere', data:{'California':320,'Ohio':300,'Texas':240,'Florida':220,'Massachusetts':190,'New York':150,'Michigan':130,'Pennsylvania':120,'Illinois':110,'Washington':90,'Arizona':85,'North Carolina':80,'Georgia':75,'Virginia':70,'Indiana':65,'Colorado':60,'New Jersey':60,'Maine':45,'New Hampshire':40,'Connecticut':40,'Oregon':45,'Tennessee':40,'Missouri':40,'Wisconsin':38,'Minnesota':36,'Maryland':35}, choro:true,
     markers:[], flows:[],
     popup:{c:[-119,37],title:'California tops the list', body:'The 20th century scatters the family nationwide; California now holds the most Tidds of any state, with Ohio close behind.'}}
  ];

  var COUNTRY_NOTE={'United States of America':'Largest Tidd population on Earth.','United Kingdom':'The homeland where the name was born.','Canada':'~10% of the world’s Tidds.','Australia':'Carried south in the 1800s.'};
  var STATE_NOTE={'Massachusetts':'Woburn, founded 1640 by Sgt. John Tidd.','Ohio':'A cousin branch, the Niles–Vienna Tidds.','Nebraska':'Palmer: the direct line\u2019s prairie home from the 1880s.','California':'Today the top Tidd state, and Ceres, where Grandpa Joy was born.'};

  var uid=0;
  function makeMap(cfg){
    var svgEl=document.getElementById(cfg.svg), svg=d3.select(svgEl);
    var defs=svg.append('defs');
    var baseG=svg.append('g'), flowG=svg.append('g'), markG=svg.append('g');
    var stage=svgEl.closest('.map-stage');
    var tip=document.getElementById(cfg.tip), eraBadge=document.getElementById(cfg.era);
    var moment=document.getElementById(cfg.moment);
    var loading=document.getElementById(cfg.loading), controls=document.getElementById(cfg.controls);
    var scrub=document.getElementById(cfg.scrub), playBtn=document.getElementById(cfg.play);
    var eraLabel=document.getElementById(cfg.eraLabel);
    var eras=cfg.eras, maxV=d3.max(eras,function(e){var vs=Object.values(e.data); return vs.length?d3.max(vs):0;})||1;
    var col=colorScale(maxV);
    var proj,path,features;
    var state={era:eras.length-1, playing:false, loop:true, timer:null};

    // arrowhead marker
    defs.append('marker').attr('id','arrow-'+cfg.svg).attr('viewBox','0 0 10 10')
      .attr('refX',8).attr('refY',5).attr('markerWidth',6).attr('markerHeight',6).attr('orient','auto-start-reverse')
      .append('path').attr('d','M0,0 L10,5 L0,10 z').attr('fill','#f0cf85');

    function nameOf(f){ return f.properties.name; }
    function arcD(a){
      var s=proj(a.from), t=proj(a.to); if(!s||!t) return '';
      var dx=t[0]-s[0], dy=t[1]-s[1], dr=Math.sqrt(dx*dx+dy*dy)||1;
      var mx=(s[0]+t[0])/2, my=(s[1]+t[1])/2, nx=-dy/dr, ny=dx/dr, lift=Math.min(dr*0.3,90);
      return 'M'+s[0]+','+s[1]+'Q'+(mx+nx*lift)+','+(my+ny*lift)+' '+t[0]+','+t[1];
    }

    function draw(){
      path=d3.geoPath(proj);
      baseG.selectAll('path').data(features).join('path')
        .attr('class',function(f){ return 'geo'+(anyData(nameOf(f))?' hot':''); })
        .attr('d',path)
        .on('mousemove',function(ev,f){ showTip(ev,f); })
        .on('mouseleave',function(){ tip.style.opacity=0; });
      render();
    }
    function anyData(nm){ return eras.some(function(e){return e.data[nm];}); }
    function showTip(ev,f){
      var nm=nameOf(f), v=eras[state.era].data[nm], note=cfg.note[nm];
      var host=svgEl.getBoundingClientRect();
      tip.style.left=(ev.clientX-host.left)+'px'; tip.style.top=(ev.clientY-host.top)+'px';
      tip.innerHTML='<b>'+nm+'</b><div class="n">'+(v?('~'+v.toLocaleString()+' Tidds'):'No recorded Tidds')+
        ' · '+eras[state.era].t+'</div>'+(note?('<div class="note">'+note+'</div>'):'');
      tip.style.opacity=1;
    }

    function render(){
      var e=eras[state.era];
      // fills
      baseG.selectAll('path').attr('fill',function(f){ return e.choro? col(e.data[nameOf(f)]) : LAND; });
      // era badge + labels
      eraBadge.innerHTML='<span class="eb-date">'+e.t+'</span><span class="eb-name">'+e.name+'</span>';
      if(eraLabel) eraLabel.textContent=e.t+' · '+e.name;
      if(scrub){ scrub.max=eras.length-1; scrub.value=state.era;
        var p=state.era/(eras.length-1)*100;
        scrub.style.background='linear-gradient(90deg,var(--gold) '+p+'%,rgba(255,255,255,.1) '+p+'%)'; }
      drawMarkers(e); drawFlows(e); drawMoment(e);
    }

    function drawMarkers(e){
      var sel=markG.selectAll('g.mk').data(e.markers||[],function(d,i){return i+'-'+d.c.join();});
      sel.exit().remove();
      var en=sel.enter().append('g').attr('class','mk');
      en.append('circle').attr('class','mk-halo');
      en.append('circle').attr('class','mk-core');
      en.append('text').attr('class','mk-label');
      var all=en.merge(sel).attr('transform',function(d){var p=proj(d.c);return p?'translate('+p[0]+','+p[1]+')':'translate(-99,-99)';});
      all.select('.mk-halo').attr('r',function(d){return (d.r||1.6)*7;});
      all.select('.mk-core').attr('r',function(d){return (d.r||1.6)*2.6;});
      all.select('.mk-label').attr('x',function(d){return (d.r||1.6)*7+4;}).attr('y',4)
        .text(function(d){return d.label||'';});
    }

    function drawFlows(e){
      var flows=e.flows||[];
      var sel=flowG.selectAll('g.flow').data(flows,function(d){return d.from.join()+'>'+d.to.join();});
      sel.exit().remove();
      var en=sel.enter().append('g').attr('class','flow');
      en.each(function(a){
        var g=d3.select(this), id='fp-'+cfg.svg+'-'+(uid++);
        var d=arcD(a);
        g.append('path').attr('id',id).attr('class','flow-base').attr('d',d).attr('marker-end','url(#arrow-'+cfg.svg+')');
        g.append('path').attr('class','flow-dash').attr('d',d);
        if(!reduce){
          var comet=g.append('circle').attr('class','flow-comet').attr('r',3.4);
          var am=comet.append('animateMotion').attr('dur','2.6s').attr('repeatCount','indefinite')
            .attr('rotate','auto').attr('keyPoints','0;1').attr('keyTimes','0;1').attr('calcMode','linear');
          am.append('mpath').attr('href','#'+id).attr('xlink:href','#'+id);
        }
      });
    }

    // project a lon/lat to a pixel position within the stage (accounts for
    // preserveAspectRatio="xMidYMid meet" letterboxing) — for HTML popups
    function vbToPixel(lonlat){
      var p=proj(lonlat); if(!p) return null;
      var rect=svgEl.getBoundingClientRect(); if(!rect.width) return null;
      var vb=svgEl.viewBox.baseVal;
      var scale=Math.min(rect.width/vb.width, rect.height/vb.height);
      var ox=(rect.width - vb.width*scale)/2, oy=(rect.height - vb.height*scale)/2;
      return [ox + p[0]*scale, oy + p[1]*scale];
    }
    function drawMoment(e){
      if(!moment) return;
      if(!e.popup){ moment.classList.remove('show'); return; }
      moment.innerHTML='<b>'+e.popup.title+'</b><span>'+e.popup.body+'</span>';
      moment.classList.add('show');
      // position after it has size
      requestAnimationFrame(function(){ positionMoment(e); });
      setTimeout(function(){ positionMoment(e); }, 60);
    }
    function positionMoment(e){
      if(!e.popup) return;
      var px=vbToPixel(e.popup.c); if(!px){ moment.style.left='50%'; moment.style.top='12px'; moment.style.transform='translateX(-50%)'; return; }
      var sw=stage.clientWidth, sh=stage.clientHeight, mw=moment.offsetWidth, mh=moment.offsetHeight;
      var left=px[0]+16, top=px[1]-mh-14;
      if(top<8) top=px[1]+18;
      left=Math.max(10, Math.min(left, sw-mw-10));
      top=Math.max(8, Math.min(top, sh-mh-8));
      moment.style.left=left+'px'; moment.style.top=top+'px'; moment.style.transform='none';
    }

    function setEra(i){ state.era=Math.max(0,Math.min(eras.length-1,i)); render(); updateStepUI(); }
    // step through the story with arrows — no autoplay, no loop, no video
    var prevBtn=document.getElementById(cfg.prev), nextBtn=document.getElementById(cfg.next),
        stepLbl=document.getElementById(cfg.step);
    function updateStepUI(){
      if(prevBtn) prevBtn.disabled=state.era===0;
      if(nextBtn) nextBtn.disabled=state.era===eras.length-1;
      if(stepLbl) stepLbl.innerHTML='step <b>'+(state.era+1)+'</b> / '+eras.length;
    }
    if(prevBtn) prevBtn.onclick=function(){ setEra(state.era-1); };
    if(nextBtn) nextBtn.onclick=function(){ setEra(state.era+1); };
    d3.selectAll('#'+cfg.modes+' button').on('click',function(){
      var mode=this.dataset.mode;
      d3.selectAll('#'+cfg.modes+' button').classed('on',false); d3.select(this).classed('on',true);
      if(mode==='today'){ controls.hidden=true; setEra(eras.length-1); }
      else { controls.hidden=false; setEra(0); }
    });
    addEventListener('resize',function(){ positionMoment(eras[state.era]); },{passive:true});

    cfg.load(function(err,topo){
      if(err){ loading.textContent='Could not load the map data.'; return; }
      features=cfg.extract(topo);
      proj=cfg.project(features,cfg.w,cfg.h);
      loading.style.display='none';
      draw();
    });
  }

  /* WORLD */
  makeMap({
    svg:'worldMap',tip:'worldTip',era:'worldEra',moment:'worldMoment',loading:'worldLoading',
    controls:'worldControls',prev:'worldPrev',next:'worldNext',step:'worldStep',modes:'worldModes',
    eraLabel:'worldEraLabel',
    eras:WORLD,note:COUNTRY_NOTE,w:960,h:520,
    load:function(cb){ d3.json('https://cdn.jsdelivr.net/npm/world-atlas@2/countries-110m.json').then(function(t){cb(null,t);}).catch(cb); },
    extract:function(t){ return topojson.feature(t,t.objects.countries).features.filter(function(f){return f.properties.name!=='Antarctica';}); },
    project:function(fc,w,h){ return d3.geoNaturalEarth1().fitExtent([[8,8],[w-8,h-8]],{type:'FeatureCollection',features:fc}); }
  });
  /* US */
  makeMap({
    svg:'usMap',tip:'usTip',era:'usEra',moment:'usMoment',loading:'usLoading',
    controls:'usControls',prev:'usPrev',next:'usNext',step:'usStep',modes:'usModes',
    eraLabel:'usEraLabel',
    eras:US,note:STATE_NOTE,w:960,h:560,
    load:function(cb){ d3.json('https://cdn.jsdelivr.net/npm/us-atlas@3/states-10m.json').then(function(t){cb(null,t);}).catch(cb); },
    extract:function(t){ return topojson.feature(t,t.objects.states).features; },
    project:function(fc,w,h){ return d3.geoAlbersUsa().fitExtent([[12,12],[w-12,h-12]],{type:'FeatureCollection',features:fc}); }
  });
})();
