(function(){
  var ov=document.getElementById('gmOv'); if(!ov) return;
  var box=ov.querySelector('.gmBox'), lastFocus=null, opened=false;
  var ac=null, on=true, hum=null, lastKey=0;
  var snd=document.getElementById('gmSnd');
  var reduce=window.matchMedia&&window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  // ── Audio ───────────────────────────────────────────────────────────────────
  function A(){
    if(!ac){ try{ ac=new(window.AudioContext||window.webkitAudioContext)(); }catch(e){ return null; } }
    if(ac.state==='suspended') ac.resume();
    return ac;
  }
  function tone(f,d,v,t){
    var a=A(); if(!a||!on) return; var n=a.currentTime;
    var o=a.createOscillator(), g=a.createGain();
    o.type=t||'sine'; o.frequency.value=f;
    g.gain.setValueAtTime(0.0001,n); g.gain.exponentialRampToValueAtTime(v,n+0.008);
    g.gain.exponentialRampToValueAtTime(0.0001,n+d);
    o.connect(g); g.connect(a.destination); o.start(n); o.stop(n+d+0.05);
  }
  function key(){
    var t=Date.now(); if(t-lastKey<45) return; lastKey=t;
    tone(1400+Math.random()*500,0.045,0.02,'triangle');
  }
  function blip(){ tone(880,0.14,0.05); tone(1320,0.11,0.028); }
  function chord(){
    var a=A(); if(!a||!on) return; var n=a.currentTime;
    [523.25,783.99,1046.5].forEach(function(f,k){
      var o=a.createOscillator(), g=a.createGain();
      o.type='sine'; o.frequency.value=f;
      g.gain.setValueAtTime(0.0001,n+k*0.07);
      g.gain.exponentialRampToValueAtTime(0.06/(k+1),n+k*0.07+0.02);
      g.gain.exponentialRampToValueAtTime(0.0001,n+0.8+k*0.08);
      o.connect(g); g.connect(a.destination); o.start(n+k*0.07); o.stop(n+1.2);
    });
  }
  function startHum(){
    var a=A(); if(!a||!on||hum) return;
    var g=a.createGain(); g.gain.value=0.0001; g.connect(a.destination);
    var o=a.createOscillator(); o.type='triangle'; o.frequency.value=92;
    var b=a.createBuffer(1,a.sampleRate,a.sampleRate), d=b.getChannelData(0);
    for(var i=0;i<d.length;i++) d[i]=(Math.random()*2-1)*0.5;
    var nz=a.createBufferSource(); nz.buffer=b; nz.loop=true;
    var bp=a.createBiquadFilter(); bp.type='bandpass'; bp.frequency.value=1600; bp.Q.value=0.7;
    var ng=a.createGain(); ng.gain.value=0.05;
    nz.connect(bp); bp.connect(ng); ng.connect(g); o.connect(g);
    o.start(); nz.start(); g.gain.exponentialRampToValueAtTime(0.05,a.currentTime+0.3);
    hum={g:g,n:[o,nz]};
  }
  function stopHum(){
    if(!hum||!ac) return; var h=hum; hum=null;
    try{ h.g.gain.exponentialRampToValueAtTime(0.0001,ac.currentTime+0.3);
      h.n.forEach(function(x){ x.stop(ac.currentTime+0.4); }); }catch(e){}
  }

  if(snd) snd.addEventListener('click',function(){
    on=!on;
    snd.setAttribute('aria-pressed',on?'false':'true');
    snd.textContent=on?'SOUND ON':'SOUND OFF';
    snd.style.color=on?'#C7DDF3':'#6C86A3';
    if(!on) stopHum();
  });

  // ── Steps ───────────────────────────────────────────────────────────────────
  var P=['gm0','gm1','gm2','gm3','gm4','gm5'].map(function(i){ return document.getElementById(i); });
  var stpEl=document.getElementById('gmStp');
  function go(n){
    P.forEach(function(p,i){ if(p) p.style.display=(i===n)?'block':'none'; });
    if(stpEl) stpEl.textContent=(n>0&&n<5)?n+' OF 4':'';
  }

  // ── Input tones ─────────────────────────────────────────────────────────────
  ['gmAsk','gmNm','gmEm','gmPh'].forEach(function(id){
    var el=document.getElementById(id); if(!el) return;
    el.addEventListener('input',function(){ key(); el.style.borderColor='#2A6DB0'; });
  });

  // ── Open / close ─────────────────────────────────────────────────────────────
  function open(){
    if(opened) return; opened=true;
    lastFocus=document.activeElement;
    ov.hidden=false;
    requestAnimationFrame(function(){ ov.classList.add('open'); });
    document.body.style.overflow='hidden';
    setTimeout(function(){ var b=document.getElementById('gmBegin'); if(b) b.focus(); },80);
    try{ sessionStorage.setItem('gmSeen','1'); }catch(e){}
  }
  function close(){
    opened=false; stopHum(); ov.classList.remove('open');
    document.body.style.overflow='';
    setTimeout(function(){ ov.hidden=true; },350);
    if(lastFocus) try{ lastFocus.focus(); }catch(e){}
  }

  var gmX=document.getElementById('gmX'); if(gmX) gmX.addEventListener('click',close);
  ov.addEventListener('mousedown',function(e){ if(e.target===ov) close(); });
  document.addEventListener('keydown',function(e){
    if(e.key==='Escape'&&opened) close();
    if(e.key==='Tab'&&opened){
      var f=box.querySelectorAll('button,[href],input,select,textarea');
      f=[].slice.call(f).filter(function(x){ return x.offsetParent!==null; });
      if(!f.length) return;
      var first=f[0], last=f[f.length-1];
      if(e.shiftKey&&document.activeElement===first){ e.preventDefault(); last.focus(); }
      else if(!e.shiftKey&&document.activeElement===last){ e.preventDefault(); first.focus(); }
    }
  });
  var gmDone=document.getElementById('gmDone'); if(gmDone) gmDone.addEventListener('click',close);

  // ── Step navigation ──────────────────────────────────────────────────────────
  var gmBegin=document.getElementById('gmBegin');
  if(gmBegin) gmBegin.addEventListener('click',function(){ A(); tone(660,0.18,0.05); go(1); });

  var gmG1=document.getElementById('gmG1');
  if(gmG1) gmG1.addEventListener('click',function(){
    var v=document.getElementById('gmAsk');
    if(!v||!v.value.trim()){ if(v) v.style.borderColor='#EF9F27'; if(v) v.focus(); return; }
    tone(660,0.16,0.045); go(2);
  });

  var gmG2=document.getElementById('gmG2');
  if(gmG2) gmG2.addEventListener('click',function(){
    var st=document.getElementById('gmSt');
    if(!st||!st.value){ if(st) st.style.borderColor='#EF9F27'; return; }
    go(3); search();
  });

  var gmG3=document.getElementById('gmG3');
  if(gmG3) gmG3.addEventListener('click',function(){ tone(660,0.16,0.045); go(4); });

  var gmG4=document.getElementById('gmG4');
  if(gmG4) gmG4.addEventListener('click',function(){
    var em=document.getElementById('gmEm'),
        ph=document.getElementById('gmPh'),
        cc=document.getElementById('gmCc'),
        c1=document.getElementById('gmC1'),
        c2=document.getElementById('gmC2');
    var okEm=em&&/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(em.value.trim());
    var okPh=ph&&ph.value.trim().replace(/\D/g,'').length>=7;
    if(!okEm){ if(em){ em.style.borderColor='#EF9F27'; em.focus(); } return; }
    if(!okPh){ if(ph){ ph.style.borderColor='#EF9F27'; ph.focus(); } return; }
    if(!c1||!c1.checked){ if(c1) c1.parentNode.style.color='#EF9F27'; return; }
    submit(em.value.trim(), ph.value.trim(), cc?cc.value:'+1', c1.checked, c2&&c2.checked);
  });

  // ── Live record search ───────────────────────────────────────────────────────
  function search(){
    var stEl=document.getElementById('gmSt'), erEl=document.getElementById('gmEr'),
        nmEl=document.getElementById('gmNm');
    var st=stEl?stEl.value:'', er=erEl?erEl.value:'',
        nm=(nmEl&&nmEl.value.trim())||'her';
    var planEl=document.getElementById('gmPlan'), barEl=document.getElementById('gmBar'),
        statEl=document.getElementById('gmStat'), headEl=document.getElementById('gmHd'),
        g3El=document.getElementById('gmG3');
    if(planEl) planEl.innerHTML='';
    if(barEl)  barEl.style.width='0';
    if(g3El)   g3El.style.display='none';
    if(headEl) headEl.textContent='Looking for '+nm+'…';
    if(!reduce) startHum();

    var url='/api/record-availability?state='+encodeURIComponent(st)+'&era='+encodeURIComponent(er);
    fetch(url).then(function(r){ return r.json(); }).then(function(data){
      var items=data.items||[];
      var i=0,n=items.length;
      if(statEl) statEl.textContent='OPENING COLLECTIONS';
      (function step(){
        if(i>=n){
          stopHum();
          if(barEl)  barEl.style.width='100%';
          if(statEl) statEl.textContent=n+' PLACES TO LOOK';
          if(headEl) headEl.textContent='These exist. Anyone can open them.';
          if(g3El)   g3El.style.display='inline-block';
          chord(); return;
        }
        var it=items[i];
        var gradeColor={'documented':'#3DDC84','absent':'#6FA9E0','inferred':'#C7DDF3'}[it.grade]||'#C7DDF3';
        var d=document.createElement('div');
        d.className='gmRow'; d.style.borderLeftColor=gradeColor;
        d.innerHTML='<h5>'+esc(it.label)+'</h5><p>'+esc(it.note)+'</p>';
        if(planEl) planEl.appendChild(d);
        if(!reduce) requestAnimationFrame(function(){ d.classList.add('in'); });
        else d.classList.add('in');
        blip(); i++;
        if(barEl)  barEl.style.width=Math.round(i/n*100)+'%';
        if(statEl) statEl.textContent='FOUND '+i+' OF '+n;
        setTimeout(step,620);
      })();
    }).catch(function(){
      stopHum();
      if(headEl) headEl.textContent='Could not load records. Please try again.';
    });
  }

  function esc(s){ var d=document.createElement('div'); d.textContent=s||''; return d.innerHTML; }

  // ── Submit ───────────────────────────────────────────────────────────────────
  function submit(email, phone, cc, consentDelivery, consentCommunity){
    var askEl=document.getElementById('gmAsk'), nmEl=document.getElementById('gmNm'),
        stEl=document.getElementById('gmSt'),   erEl=document.getElementById('gmEr'),
        g4El=document.getElementById('gmG4');
    if(g4El){ g4El.disabled=true; g4El.textContent='Sending…'; }

    var body={
      question:          askEl?askEl.value.trim():'',
      ancestor_name:     nmEl?nmEl.value.trim():'',
      state:             stEl?stEl.value:'',
      era:               erEl?erEl.value:'',
      email:             email,
      phone_cc:          cc,
      phone:             phone,
      consent_delivery:  consentDelivery,
      consent_community: consentCommunity,
      website:           ''  // honeypot always empty
    };

    fetch('/api/mango',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(body)})
      .then(function(r){ return r.json(); })
      .then(function(data){
        if(data.ok){ chord(); go(5); }
        else{
          if(g4El){ g4El.disabled=false; g4El.textContent='Send it to me'; }
          alert(data.error||'Something went wrong. Please try again.');
        }
      })
      .catch(function(){
        if(g4El){ g4El.disabled=false; g4El.textContent='Send it to me'; }
        alert('Something went wrong. Please try again.');
      });
  }

  // ── Triggers ─────────────────────────────────────────────────────────────────
  window.openMangoModal=open;

  // Wire "Ask me for a name" and "Start free" links
  [].slice.call(document.querySelectorAll('a,button')).forEach(function(el){
    var t=(el.textContent||'').trim().toLowerCase();
    if(t==='ask me for a name'){
      el.addEventListener('click',function(e){ e.preventDefault(); open(); });
    }
  });

  // Scroll + timer triggers (once per session)
  var seen=false; try{ seen=sessionStorage.getItem('gmSeen')==='1'; }catch(e){}
  if(!seen){
    var fired=false;
    function maybe(){
      if(fired) return;
      if(window.scrollY>window.innerHeight*0.6){ fired=true; open(); }
    }
    window.addEventListener('scroll',maybe,{passive:true});
    setTimeout(function(){ if(!fired){ fired=true; open(); } },32000);
  }

  go(0);
})();
