// Real-time conversation layer: streams the answer as it is written, speaks it sentence by sentence,
// and offers hands-free Talk mode (listen -> answer -> speak -> listen again).
(() => {
  const $ = (s) => document.querySelector(s);
  const history = [];
  let talk = false, rec = null, speaking = 0;
  const SR = window.SpeechRecognition || window.webkitSpeechRecognition;

  const voice = () => {
    const v = speechSynthesis.getVoices();
    return v.find((x) => /en/i.test(x.lang) && /male|daniel|alex|david|google uk english male/i.test(x.name)) || v.find((x) => /^en/i.test(x.lang)) || null;
  };
  function say(text) {
    if (!('speechSynthesis' in window) || !text.trim()) return;
    const u = new SpeechSynthesisUtterance(text);
    u.rate = 0.95; u.pitch = 0.92;
    const v = voice(); if (v) u.voice = v;
    speaking++;
    u.onend = u.onerror = () => { speaking--; if (!speaking && talk) listen(); };
    speechSynthesis.speak(u);
  }

  window.speak = (text) => { speechSynthesis.cancel(); speaking = 0; say(text); };

  window.ask = async function (q) {
    q = String(q || '').trim();
    if (!q) return;
    if (!(await ensureSession())) return;
    speechSynthesis.cancel(); speaking = 0;
    addBubble(q, 'user');
    const bubble = addBubble('…');
    let full = '', buf = '';
    try {
      const r = await fetch('/api/chat/stream', {
        method: 'POST', credentials: 'same-origin', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: q, history }),
      });
      if (!r.ok) { const j = await r.json().catch(() => ({})); throw new Error(j.error || 'Request failed'); }
      const reader = r.body.getReader(), dec = new TextDecoder();
      let pending = '';
      for (;;) {
        const { value, done } = await reader.read();
        if (done) break;
        pending += dec.decode(value, { stream: true });
        const frames = pending.split('\n\n'); pending = frames.pop();
        for (const f of frames) {
          if (!f.startsWith('data: ')) continue;
          const m = JSON.parse(f.slice(6));
          if (m.error) throw new Error(m.error);
          if (m.t) {
            full += m.t; buf += m.t; bubble.textContent = full;
            $('#messages').scrollTop = $('#messages').scrollHeight;
            const cut = buf.search(/[.!?]\s/);
            if (cut > 20) { say(buf.slice(0, cut + 1)); buf = buf.slice(cut + 2); }
          }
        }
      }
      if (buf.trim()) say(buf);
      history.push({ role: 'user', content: q }, { role: 'assistant', content: full });
    } catch (e) {
      bubble.textContent = e.message;
      if (talk) stopTalk();
    }
  };

  function listen() {
    if (!SR || !talk) return;
    rec = new SR(); rec.lang = 'en-US'; rec.interimResults = false;
    $('#voiceStatus').textContent = 'Listening…';
    rec.onresult = (e) => window.ask(e.results[0][0].transcript);
    rec.onerror = (e) => { if (e.error === 'not-allowed' || e.error === 'service-not-allowed') stopTalk(); };
    rec.onend = () => { if (talk && !speaking && $('#voiceStatus').textContent === 'Listening…') setTimeout(listen, 400); };
    try { rec.start(); } catch {}
  }
  function stopTalk() {
    talk = false; try { rec && rec.abort(); } catch {}
    speechSynthesis.cancel(); speaking = 0;
    $('#talkBtn').textContent = 'Talk live'; $('#talkBtn').classList.remove('on');
    $('#voiceStatus').textContent = 'Type or use your microphone';
  }

  const btn = document.createElement('button');
  btn.type = 'button'; btn.id = 'talkBtn'; btn.className = 'talk'; btn.textContent = 'Talk live';
  btn.onclick = () => {
    if (!SR) { $('#voiceStatus').textContent = 'Live talk needs Chrome, Edge or Safari.'; return; }
    if (talk) return stopTalk();
    talk = true; btn.textContent = 'End live talk'; btn.classList.add('on'); listen();
  };
  $('.chat-controls').insertBefore(btn, $('#voiceStatus'));
})();
