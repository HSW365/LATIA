/* Truth Be Told — live call screen: hold-to-talk mic, spoken answers, animated face. */
(function () {
  const $ = s => document.querySelector(s);
  const overlay = $('#callOverlay'), canvas = $('#callCanvas'), ctx = canvas.getContext('2d');
  const statusEl = $('#callStatus'), capEl = $('#callCaption'), talkBtn = $('#talkBtn'), timerEl = $('#callTimer');
  const img = new Image(); img.src = '/avatar.jpg';
  // Mouth/jaw geometry on the 1024px portrait (normalised)
  const MX = 0.535, MY = 0.758, CHIN = 0.885, MW = 0.12;
  let open = 0, target = 0, state = 'idle', history = [], rec = null, heard = '', audio = null, actx = null, analyser = null, data = null, t0 = 0, timer = null, fake = 0;

  function setState(s, text) { state = s; overlay.dataset.state = s; statusEl.textContent = text; }
  function size() { const r = canvas.getBoundingClientRect(), d = Math.min(devicePixelRatio || 1, 2); canvas.width = r.width * d; canvas.height = r.height * d; }

  function draw(ts) {
    requestAnimationFrame(draw);
    if (!overlay.classList.contains('on') || !img.complete) return;
    const W = canvas.width, H = canvas.height, S = Math.max(W, H);
    // audio-driven mouth opening
    if (analyser && state === 'speaking') {
      analyser.getByteTimeDomainData(data); let sum = 0;
      for (let i = 0; i < data.length; i++) { const v = (data[i] - 128) / 128; sum += v * v; }
      target = Math.min(1, Math.sqrt(sum / data.length) * 5.2);
    } else if (state === 'speaking') { // browser-voice fallback: syllable-like envelope
      fake += 0.2; target = Math.max(0, Math.sin(fake * 2.1) * .5 + Math.sin(fake * 3.7) * .35 + .1);
    } else target = 0;
    open += (target - open) * (target > open ? 0.55 : 0.3);
    const sway = Math.sin(ts / 1800) * 0.004 + (state === 'listening' ? Math.sin(ts / 600) * 0.004 : 0);
    const breathe = 1 + Math.sin(ts / 2300) * 0.003;
    ctx.save(); ctx.clearRect(0, 0, W, H);
    ctx.translate(W / 2, H / 2); ctx.rotate(sway); ctx.scale(breathe * 1.02, breathe * 1.02); ctx.translate(-W / 2, -H / 2);
    const iw = img.naturalWidth, ih = img.naturalHeight, k = W / iw; // fit width
    const oy = (H - ih * k) / 2;
    const my = MY * ih, chin = CHIN * ih, drop = open * ih * 0.03, band = 3;
    ctx.drawImage(img, 0, oy, W, ih * k); // backdrop so slice seams never show gaps
    // draw upper face untouched
    ctx.drawImage(img, 0, 0, iw, my, 0, oy, W, my * k);
    // jaw: slices below the mouth line slide down with a smooth falloff (stretching the lower face)
    for (let y = my; y < ih; y += band) {
      const f = y < chin ? (y - my) / (chin - my) : 1 - Math.min(1, (y - chin) / (ih * 0.14));
      const e = f * f * (3 - 2 * f), d0 = drop * e, d1 = drop * (y + band < chin ? ((y + band - my) / (chin - my)) ** 2 * (3 - 2 * ((y + band - my) / (chin - my))) : Math.max(0, 1 - Math.min(1, (y + band - chin) / (ih * 0.14))));
      const dy = oy + y * k + d0 * k, dh = (band * k) + (d1 - d0) * k;
      ctx.drawImage(img, 0, y, iw, band, 0, dy, W, Math.max(1, dh) + 1.5);
    }
    // mouth interior revealed by the stretch
    if (open > 0.04) {
      const cx = MX * iw * k, cy = oy + (my + drop * 0.35) * k, rx = MW * iw * k * (0.55 + open * 0.15), ry = Math.max(1, drop * k * 0.85);
      const g = ctx.createRadialGradient(cx, cy, 1, cx, cy, rx);
      g.addColorStop(0, 'rgba(26,6,6,.96)'); g.addColorStop(.7, 'rgba(40,10,10,.9)'); g.addColorStop(1, 'rgba(40,10,10,0)');
      ctx.fillStyle = g; ctx.beginPath(); ctx.ellipse(cx, cy, rx, ry, 0, 0, 7); ctx.fill();
      ctx.fillStyle = 'rgba(235,225,210,.55)'; ctx.beginPath(); ctx.ellipse(cx, cy - ry * 0.55, rx * 0.62, Math.max(0.5, ry * 0.22), 0, 0, 7); ctx.fill();
    }
    ctx.restore();
  }

  function ensureAudioGraph() {
    if (actx) return;
    actx = new (window.AudioContext || window.webkitAudioContext)();
    analyser = actx.createAnalyser(); analyser.fftSize = 512; data = new Uint8Array(analyser.fftSize);
    analyser.connect(actx.destination);
  }

  async function speak(text) {
    stopSpeaking();
    setState('speaking', 'Speaking…'); capEl.textContent = text;
    try {
      const ctl = new AbortController(); const to = setTimeout(() => ctl.abort(), 20000);
      const r = await fetch('/api/speak', { method: 'POST', headers: { 'Content-Type': 'application/json', ...window.TBT.ownerHeaders() }, credentials: 'same-origin', body: JSON.stringify({ text }), signal: ctl.signal });
      clearTimeout(to);
      if (!r.ok) throw new Error('voice');
      const blob = await r.blob(); const url = URL.createObjectURL(blob);
      ensureAudioGraph(); if (actx.state === 'suspended') await actx.resume();
      audio = new Audio(url); audio.crossOrigin = 'anonymous';
      actx.createMediaElementSource(audio).connect(analyser);
      audio.onended = () => { URL.revokeObjectURL(url); if (state === 'speaking') setState('idle', 'Hold the mic and talk'); };
      await audio.play();
    } catch (e) { browserVoice(text); }
  }
  function browserVoice(text) {
    if (!('speechSynthesis' in window)) { setState('idle', 'Hold the mic and talk'); return; }
    speechSynthesis.cancel();
    const u = new SpeechSynthesisUtterance(text); u.rate = .92; u.pitch = .8;
    const v = speechSynthesis.getVoices().find(v => /en/i.test(v.lang) && /male|daniel|david|guy|alex|fred|google uk english male/i.test(v.name)); if (v) u.voice = v;
    analyser = null; u.onend = () => { if (state === 'speaking') setState('idle', 'Hold the mic and talk'); };
    speechSynthesis.speak(u);
  }
  function stopSpeaking() { if (audio) { audio.pause(); audio = null; } if ('speechSynthesis' in window) speechSynthesis.cancel(); }

  async function ask(q) {
    setState('thinking', 'Thinking…'); capEl.textContent = '“' + q + '”';
    try {
      const r = await fetch('/api/chat', { method: 'POST', headers: { 'Content-Type': 'application/json', ...window.TBT.ownerHeaders() }, credentials: 'same-origin', body: JSON.stringify({ message: q, mode: 'call', history }) });
      const d = await r.json(); if (!r.ok) throw new Error(d.error || 'Request failed');
      history.push({ role: 'user', content: q }, { role: 'assistant', content: d.answer }); history = history.slice(-10);
      speak(d.answer);
    } catch (e) { setState('idle', 'Hold the mic and talk'); capEl.textContent = e.message; }
  }

  function startTalk() {
    const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SR) { capEl.textContent = 'This browser can’t hear the mic. Use Chrome, Edge or Safari, or type in the chat below.'; return; }
    ensureAudioGraph(); if (actx.state === 'suspended') actx.resume();
    stopSpeaking(); heard = '';
    rec = new SR(); rec.lang = 'en-US'; rec.interimResults = true; rec.continuous = true;
    rec.onresult = e => { let t = ''; for (const r of e.results) t += r[0].transcript; heard = t.trim(); capEl.textContent = heard ? '“' + heard + '”' : 'Listening…'; };
    rec.onerror = e => { if (e.error === 'not-allowed' || e.error === 'service-not-allowed') { capEl.textContent = 'Microphone is blocked. Allow it in your browser settings.'; setState('idle', 'Mic blocked'); rec = null; } };
    rec.onend = () => { const q = heard; rec = null; if (state === 'listening') { if (q) ask(q); else { setState('idle', 'Hold the mic and talk'); capEl.textContent = 'I didn’t catch that. Hold the mic and try again.'; } } };
    setState('listening', 'Listening…'); capEl.textContent = 'Listening…';
    try { rec.start(); } catch (e) { }
  }
  function endTalk() { if (rec && state === 'listening') { try { rec.stop(); } catch (e) { } } }

  async function openCall() {
    if (!(await window.TBT.ensureSession())) return; // opens sign-in first
    overlay.classList.add('on'); document.body.style.overflow = 'hidden'; size();
    history = []; t0 = Date.now(); timerEl.textContent = '0:00';
    timer = setInterval(() => { const s = Math.floor((Date.now() - t0) / 1000); timerEl.textContent = Math.floor(s / 60) + ':' + String(s % 60).padStart(2, '0'); }, 1000);
    setState('thinking', 'Connecting…'); capEl.textContent = '';
    setTimeout(() => speak('Peace be with you. I’m glad you called. What’s on your heart today?'), 600);
  }
  function endCall() { endTalk(); stopSpeaking(); clearInterval(timer); overlay.classList.remove('on'); document.body.style.overflow = ''; setState('idle', ''); }

  talkBtn.addEventListener('pointerdown', e => { e.preventDefault(); talkBtn.setPointerCapture(e.pointerId); talkBtn.classList.add('held'); startTalk(); });
  ['pointerup', 'pointercancel'].forEach(ev => talkBtn.addEventListener(ev, () => { talkBtn.classList.remove('held'); endTalk(); }));
  talkBtn.addEventListener('contextmenu', e => e.preventDefault());
  window.addEventListener('keydown', e => { if (overlay.classList.contains('on') && e.code === 'Space' && !e.repeat) { e.preventDefault(); talkBtn.classList.add('held'); startTalk(); } if (e.key === 'Escape' && overlay.classList.contains('on')) endCall(); });
  window.addEventListener('keyup', e => { if (overlay.classList.contains('on') && e.code === 'Space') { talkBtn.classList.remove('held'); endTalk(); } });
  $('#endCall').onclick = endCall;
  document.querySelectorAll('[data-call]').forEach(b => b.addEventListener('click', openCall));
  window.addEventListener('resize', size);
  requestAnimationFrame(draw);
})();
