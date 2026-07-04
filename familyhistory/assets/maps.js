/* ═══════════════════════════════════════════════════════════
   TIDD FAMILY HISTORY — Living Maps engine (D3 v7 + TopoJSON)
   Two independent maps (world + US), each with:
     · "today" static mode and "play the history" animated mode
     · scrubber, play/pause, loop / once
     · flow arcs that draw when their era arrives
     · hover tooltips with family notes
   Degrades to a friendly message if D3 or the atlas data fail.
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

  /* ---------- shared colour ramp ---------- */
  var ramp = d3.interpolateRgbBasis(['#141c2e','#3a2f18','#7a5a1e','#d4a846','#f6dd9b']);
  function colorScale(maxV){ var s=d3.scaleLog().domain([1,maxV]).range([0,1]).clamp(true);
    return function(v){ return (!v||v<=0)?'#101725':ramp(s(v)); }; }

  /* ============================ WORLD ============================ */
  var WORLD_ERAS = ['c. 1650','c. 1700','c. 1800','c. 1900','c. 1960','Present day'];
  var WORLD = [
    {'United Kingdom':500,'United States of America':20},
    {'United Kingdom':700,'United States of America':120,'Canada':5},
    {'United Kingdom':900,'United States of America':700,'Canada':70,'Australia':30},
    {'United States of America':1800,'United Kingdom':850,'Canada':230,'Australia':150,'New Zealand':30,'South Africa':20},
    {'United States of America':2400,'United Kingdom':720,'Canada':350,'Australia':220,'New Zealand':55,'South Africa':35,'Ireland':20},
    {'United States of America':2897,'United Kingdom':640,'Canada':400,'Australia':250,'New Zealand':60,'South Africa':40,'Ireland':25,'Germany':12,'France':9,'Netherlands':7}
  ];
  var WORLD_NOTE = {
    'United Kingdom':'The homeland. The name is born in Anglo-Saxon England; John Tidd sails from the Isle of Wight in 1637.',
    'United States of America':'Woburn, MA founded 1640 by Sgt. John Tidd. Now the largest Tidd population on Earth.',
    'Canada':'A colonial branch — today ~10% of the world’s Tidds.',
    'Australia':'Carried south in the 1800s; a small but enduring community.',
    'New Zealand':'A handful of families at the far edge of the diaspora.',
    'South Africa':'The name reaches the southern tip of Africa.',
    'Ireland':'Close neighbours to the English homeland.',
    'Germany':'A scattering across continental Europe.',
    'France':'A scattering across continental Europe.',
    'Netherlands':'A scattering across continental Europe.'
  };
  // migration arcs, keyed to the era index at which they first appear
  var WORLD_ARCS = [
    {from:[-1.5,50.7],  to:[-71.1,42.4], era:0, faint:false}, // Isle of Wight -> Massachusetts (1637)
    {from:[-0.13,51.5], to:[-79.4,43.6], era:2, faint:true},  // London -> Canada
    {from:[-0.13,51.5], to:[151.2,-33.9],era:2, faint:true},  // London -> Australia
    {from:[-71.1,42.4], to:[-82.9,40.4], era:2, faint:false}  // Massachusetts -> Ohio
  ];
  var WORLD_CITIES = [
    {name:'London',c:[-0.13,51.5]},{name:'Woburn',c:[-71.1,42.4]},
    {name:'Ohio',c:[-82.9,40.4]},{name:'Sydney',c:[151.2,-33.9]}
  ];

  /* ============================ US ============================ */
  var US_ERAS = ['1637–1700','c. 1750','c. 1850','c. 1950','Present day'];
  var US = [
    {'Massachusetts':20},
    {'Massachusetts':60,'New Hampshire':15,'Connecticut':12,'Maine':10},
    {'Massachusetts':120,'Ohio':90,'New York':70,'Pennsylvania':40,'New Hampshire':25,'Maine':20,'Connecticut':18,'Illinois':15},
    {'Ohio':260,'Massachusetts':220,'California':180,'New York':150,'Illinois':70,'Michigan':90,'Texas':80,'Florida':60,'Pennsylvania':60,'Indiana':50},
    {'California':320,'Ohio':300,'Texas':240,'Florida':220,'Massachusetts':190,'New York':150,'Michigan':130,'Pennsylvania':120,'Illinois':110,'Washington':90,'Arizona':85,'North Carolina':80,'Georgia':75,'Virginia':70,'Indiana':65,'Colorado':60,'New Jersey':60,'Maine':45,'New Hampshire':40,'Connecticut':40,'Oregon':45,'Tennessee':40,'Missouri':40,'Wisconsin':38,'Minnesota':36,'Maryland':35}
  ];
  var US_NOTE = {
    'Massachusetts':'Ground zero — Woburn, founded 1640 by Sgt. John Tidd.',
    'Ohio':'The westward branch: William & James Tidd settle the Niles–Vienna country.',
    'New York':'A stop on the road west along the Erie corridor.',
    'California':'The 20th-century magnet — now the top Tidd state.',
    'Texas':'Sun-belt growth in the modern era.',
    'Florida':'Sun-belt growth in the modern era.',
    'Michigan':'Great-Lakes industry drew families north.'
  };
  var US_ARCS = [
    {from:[-71.1,42.4],to:[-82.9,40.4],era:2,faint:false}, // MA -> Ohio
    {from:[-71.1,42.4],to:[-119,37],   era:3,faint:true},  // MA -> California
    {from:[-71.1,42.4],to:[-99,31.5],  era:3,faint:true},  // MA -> Texas
    {from:[-71.1,42.4],to:[-81.7,28],  era:3,faint:true}   // MA -> Florida
  ];
  var US_CITIES=[{name:'Woburn',c:[-71.1,42.4]},{name:'Ohio',c:[-82.9,40.4]}];

  /* ---------- a reusable map controller ---------- */
  function makeMap(cfg){
    var svg=d3.select('#'+cfg.svg), g=svg.append('g'), arcG=svg.append('g'), cityG=svg.append('g');
    var tip=document.getElementById(cfg.tip), eraBadge=document.getElementById(cfg.era);
    var loading=document.getElementById(cfg.loading), controls=document.getElementById(cfg.controls);
    var scrub=document.getElementById(cfg.scrub), playBtn=document.getElementById(cfg.play);
    var eraLabel=document.getElementById(cfg.eraLabel);
    var maxV=d3.max(cfg.data,function(o){return d3.max(Object.values(o));});
    var col=colorScale(maxV);
    var proj,path,features,nameOf,arcs=[],cities=[];
    var state={era:cfg.data.length-1, playing:false, loop:true, timer:null};

    function keyName(f){ return cfg.nameKey(f); }
    function draw(){
      path=d3.geoPath(proj);
      g.selectAll('path').data(features).join('path')
        .attr('class',function(f){ return 'geo'+(cfg.data.some(function(o){return o[keyName(f)];})?' hot':''); })
        .attr('d',path)
        .on('mousemove',function(ev,f){ showTip(ev,f); })
        .on('mouseleave',function(){ tip.style.opacity=0; });
      // cities
      cityG.selectAll('g').data(cfg.cities).join(function(en){
        var gg=en.append('g'); gg.append('circle').attr('class','city').attr('r',3.4);
        gg.append('text').attr('class','city-label').attr('dx',7).attr('dy',3); return gg;
      }).attr('transform',function(d){var p=proj(d.c);return p?'translate('+p[0]+','+p[1]+')':'translate(-99,-99)';})
        .select('text').text(function(d){return d.name;});
      render();
    }
    function showTip(ev,f){
      var nm=keyName(f), v=cfg.data[state.era][nm];
      var host=svg.node().getBoundingClientRect();
      tip.style.left=(ev.clientX-host.left)+'px';
      tip.style.top=(ev.clientY-host.top)+'px';
      tip.innerHTML='<b>'+nm+'</b><div class="n">'+(v?('~'+v.toLocaleString()+' Tidds'):'No recorded Tidds')+
        ' · '+cfg.eras[state.era]+'</div>'+(cfg.note[nm]?('<div class="note">'+cfg.note[nm]+'</div>'):'');
      tip.style.opacity=1;
    }
    function render(){
      var d=cfg.data[state.era];
      // Set fills instantly; the CSS `.geo{transition:fill}` rule animates them
      // smoothly. This avoids any dependency on requestAnimationFrame, so the
      // map stays correct even on throttled/background tabs.
      g.selectAll('path').attr('fill',function(f){ return col(d[keyName(f)]); });
      eraBadge.textContent=cfg.eras[state.era];
      if(eraLabel) eraLabel.textContent=cfg.eras[state.era];
      if(scrub) scrub.value=state.era;
      // scrub fill
      if(scrub){var p=state.era/(cfg.data.length-1)*100;
        scrub.style.background='linear-gradient(90deg,var(--gold) '+p+'%,rgba(255,255,255,.1) '+p+'%)';}
      drawArcs();
    }
    function drawArcs(){
      var active=cfg.arcs.filter(function(a){return a.era<=state.era;});
      var sel=arcG.selectAll('path').data(active,function(a){return a.from.join()+a.to.join();});
      sel.exit().remove();
      sel.enter().append('path')
        .attr('class',function(a){return 'arc'+(a.faint?' faint':'');})
        .attr('d',arcPath)
        .each(function(a){
          var self=this, len=this.getTotalLength()||600;
          // CSS-transition the dash draw (no requestAnimationFrame dependency)
          self.style.transition='none';
          self.setAttribute('stroke-dasharray',len);
          self.setAttribute('stroke-dashoffset', reduce?0:len);
          if(!reduce){
            void self.getBoundingClientRect();            // force reflow
            setTimeout(function(){
              self.style.transition='stroke-dashoffset 1.3s cubic-bezier(.2,.7,.2,1)';
              self.setAttribute('stroke-dashoffset',0);
            },30);
          }
        });
    }
    function arcPath(a){
      var s=proj(a.from), t=proj(a.to); if(!s||!t) return '';
      var dx=t[0]-s[0], dy=t[1]-s[1], dr=Math.sqrt(dx*dx+dy*dy);
      var mx=(s[0]+t[0])/2, my=(s[1]+t[1])/2;
      // lift control point perpendicular for a nice curved flight path
      var nx=-dy/dr, ny=dx/dr, lift=Math.min(dr*0.28,80);
      return 'M'+s[0]+','+s[1]+'Q'+(mx+nx*lift)+','+(my+ny*lift)+' '+t[0]+','+t[1];
    }
    function setEra(i){ state.era=Math.max(0,Math.min(cfg.data.length-1,i)); render(); }
    function play(){
      state.playing=true; playBtn.textContent='❚❚';
      if(state.era>=cfg.data.length-1) state.era=0;
      step();
    }
    function step(){
      render();
      clearTimeout(state.timer);
      state.timer=setTimeout(function(){
        if(state.era>=cfg.data.length-1){
          if(state.loop){ state.era=0; step(); }
          else { pause(); }
          return;
        }
        state.era++; step();
      }, reduce?400:2100);
    }
    function pause(){ state.playing=false; playBtn.textContent='▶'; clearTimeout(state.timer); }
    function toggle(){ state.playing?pause():play(); }

    // wire controls
    if(playBtn) playBtn.onclick=toggle;
    if(scrub) scrub.oninput=function(){ pause(); setEra(+scrub.value); };
    // mode buttons
    d3.selectAll('#'+cfg.modes+' button').on('click',function(){
      var mode=this.dataset.mode;
      d3.selectAll('#'+cfg.modes+' button').classed('on',false); d3.select(this).classed('on',true);
      if(mode==='today'){ pause(); controls.hidden=true; setEra(cfg.data.length-1); }
      else { controls.hidden=false; setEra(0); play(); }
    });
    // loop toggle
    var loopBtn=document.getElementById(cfg.loopBtn), onceBtn=document.getElementById(cfg.onceBtn);
    if(loopBtn) loopBtn.onclick=function(){state.loop=true;loopBtn.classList.add('on');onceBtn.classList.remove('on');};
    if(onceBtn) onceBtn.onclick=function(){state.loop=false;onceBtn.classList.add('on');loopBtn.classList.remove('on');};

    // load data
    cfg.load(function(err,topo){
      if(err){ loading.textContent='Could not load the map data.'; return; }
      var fc=cfg.extract(topo);
      features=fc; proj=cfg.project(fc,cfg.w,cfg.h);
      loading.style.display='none';
      draw();
    });
    return {render:render,setEra:setEra};
  }

  /* ---------- instantiate WORLD ---------- */
  makeMap({
    svg:'worldMap',tip:'worldTip',era:'worldEra',loading:'worldLoading',
    controls:'worldControls',scrub:'worldScrub',play:'worldPlay',
    modes:'worldModes',loopBtn:'worldLoop',onceBtn:'worldOnce',eraLabel:'worldEraLabel',
    data:WORLD,eras:WORLD_ERAS,note:WORLD_NOTE,arcs:WORLD_ARCS,cities:WORLD_CITIES,w:960,h:500,
    load:function(cb){ d3.json('https://cdn.jsdelivr.net/npm/world-atlas@2/countries-110m.json')
      .then(function(t){cb(null,t);}).catch(function(e){cb(e);}); },
    extract:function(t){ return topojson.feature(t,t.objects.countries).features
      .filter(function(f){return f.properties.name!=='Antarctica';}); },
    nameKey:function(f){return f.properties.name;},
    project:function(fc,w,h){ return d3.geoNaturalEarth1().fitExtent([[6,10],[w-6,h-6]],{type:'FeatureCollection',features:fc}); }
  });

  /* ---------- instantiate US ---------- */
  makeMap({
    svg:'usMap',tip:'usTip',era:'usEra',loading:'usLoading',
    controls:'usControls',scrub:'usScrub',play:'usPlay',
    modes:'usModes',loopBtn:'usLoop',onceBtn:'usOnce',eraLabel:'usEraLabel',
    data:US,eras:US_ERAS,note:US_NOTE,arcs:US_ARCS,cities:US_CITIES,w:960,h:560,
    load:function(cb){ d3.json('https://cdn.jsdelivr.net/npm/us-atlas@3/states-10m.json')
      .then(function(t){cb(null,t);}).catch(function(e){cb(e);}); },
    extract:function(t){ return topojson.feature(t,t.objects.states).features; },
    nameKey:function(f){return f.properties.name;},
    project:function(fc,w,h){ return d3.geoAlbersUsa().fitExtent([[10,10],[w-10,h-10]],{type:'FeatureCollection',features:fc}); }
  });
})();
