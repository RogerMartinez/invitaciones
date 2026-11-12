/* Kit de invitaciones: módulos independientes. Cada módulo se activa si existe su elemento
   (data-modulo="...") en el HTML del evento. Los datos vienen de window.EVENTO (evento.json). */
(function () {
  const E = window.EVENTO || {};
  const $ = (s, c = document) => c.querySelector(s);
  const $$ = (s, c = document) => [...c.querySelectorAll(s)];
  const params = new URLSearchParams(location.search);

  /* Aparición suave al hacer scroll */
  const io = new IntersectionObserver((es) => es.forEach((e) => {
    if (e.isIntersecting) { e.target.classList.add('visible'); io.unobserve(e.target); }
  }), { threshold: 0.15 });
  $$('.aparece').forEach((el) => io.observe(el));

  /* Cuenta regresiva */
  const cr = $('[data-modulo="cuenta-regresiva"]');
  if (cr && E.fecha) {
    const meta = new Date(E.fecha.inicio).getTime();
    const pinta = () => {
      let s = Math.max(0, Math.floor((meta - Date.now()) / 1000));
      if (!s) { cr.innerHTML = '<p class="cr-hoy">¡Es hoy!</p>'; return; }
      const v = { dias: Math.floor(s / 86400), horas: Math.floor(s % 86400 / 3600), min: Math.floor(s % 3600 / 60), seg: s % 60 };
      Object.entries(v).forEach(([k, n]) => { const el = $(`[data-cr="${k}"]`, cr); if (el) el.textContent = String(n).padStart(2, '0'); });
    };
    pinta(); setInterval(pinta, 1000);
  }

  /* Agregar al calendario: Google Calendar y archivo .ics (iPhone/Outlook) */
  const fmt = (d) => new Date(d).toISOString().replace(/[-:]/g, '').replace(/\.\d{3}/, '');
  $$('[data-modulo="calendario"]').forEach((box) => {
    const titulo = E.titulo, lugar = (E.lugares || [])[0] || {};
    const det = (E.lugares || []).map((l) => `${l.titulo}: ${l.nombre}, ${l.hora}`).join('\n') + `\n${E.url || location.href}`;
    const g = $('[data-cal="google"]', box);
    if (g) g.href = 'https://calendar.google.com/calendar/render?action=TEMPLATE' +
      `&text=${encodeURIComponent(titulo)}&dates=${fmt(E.fecha.inicio)}/${fmt(E.fecha.fin)}` +
      `&details=${encodeURIComponent(det)}&location=${encodeURIComponent(lugar.maps || '')}`;
    const i = $('[data-cal="ics"]', box);
    if (i) {
      const ics = ['BEGIN:VCALENDAR', 'VERSION:2.0', 'PRODID:-//Invitaciones//ES', 'BEGIN:VEVENT',
        `UID:${E.slug}@invitaciones`, `DTSTAMP:${fmt(Date.now())}`, `DTSTART:${fmt(E.fecha.inicio)}`, `DTEND:${fmt(E.fecha.fin)}`,
        `SUMMARY:${titulo}`, `LOCATION:${lugar.maps || ''}`, `DESCRIPTION:${det.replace(/\n/g, '\\n')}`,
        'BEGIN:VALARM', 'TRIGGER:-P1D', 'ACTION:DISPLAY', `DESCRIPTION:${titulo}`, 'END:VALARM',
        'END:VEVENT', 'END:VCALENDAR'].join('\r\n');
      i.href = URL.createObjectURL(new Blob([ics], { type: 'text/calendar' }));
      i.download = `${E.slug || 'evento'}.ics`;
    }
  });

  /* Mapas: iframe sin API key + "Cómo llegar" (abre la app de Maps en el celular) + Waze */
  $$('[data-modulo="mapa"]').forEach((box) => {
    const q = box.dataset.maps;
    const f = $('iframe', box);
    if (f) f.src = `https://www.google.com/maps?q=${encodeURIComponent(q)}&output=embed`;
    const ir = $('[data-mapa="ir"]', box);
    if (ir) ir.href = `https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(q)}`;
    const wz = $('[data-mapa="waze"]', box);
    if (wz) wz.href = `https://waze.com/ul?q=${encodeURIComponent(q)}&navigate=yes`;
  });

  /* WhatsApp con mensaje prellenado; si hay invitado identificado, lo incluye */
  const waLink = (tel, nombre, familia) => {
    const msg = `Hola ${nombre}, ` + (familia ? `somos ${familia}. Te escribo` : 'te escribo') + ` por la invitación de ${E.novios ? E.novios.corto : ''}.`;
    return `https://wa.me/${tel}?text=${encodeURIComponent(msg)}`;
  };
  const pintaWhatsApp = (familia) => $$('[data-modulo="whatsapp"]').forEach((a) => {
    a.href = waLink(a.dataset.tel, a.dataset.nombre || '', familia); a.target = '_blank'; a.rel = 'noopener';
  });
  pintaWhatsApp();

  /* Música: solo con un toque del invitado (los navegadores bloquean la reproducción automática) */
  const mus = $('[data-modulo="musica"]');
  if (mus && E.musica && E.musica.archivo) {
    const audio = new Audio(E.musica.archivo); audio.loop = true; audio.preload = 'none';
    mus.hidden = false;
    mus.addEventListener('click', () => {
      if (audio.paused) { audio.play(); mus.classList.add('sonando'); } else { audio.pause(); mus.classList.remove('sonando'); }
    });
  }

  /* Galería: carrusel con deslizamiento + vista ampliada */
  const gal = $('[data-modulo="galeria"]');
  if (gal && (E.galeria || []).length) {
    const pista = $('.gal-pista', gal);
    E.galeria.forEach((src, n) => {
      const b = document.createElement('button'); b.className = 'gal-item'; b.setAttribute('aria-label', `Ver foto ${n + 1}`);
      b.innerHTML = `<img src="${src}" alt="" loading="lazy">`; b.onclick = () => abre(n); pista.appendChild(b);
    });
    const lb = document.createElement('div'); lb.className = 'lightbox'; lb.hidden = true;
    lb.innerHTML = '<button class="lb-cerrar" aria-label="Cerrar">×</button><img alt="">';
    document.body.appendChild(lb);
    let actual = 0;
    const abre = (n) => { actual = n; $('img', lb).src = E.galeria[n]; lb.hidden = false; };
    lb.onclick = (e) => { if (e.target.tagName !== 'IMG') lb.hidden = true; else abre((actual + 1) % E.galeria.length); };
  }

  /* Confirmación personalizada: ?i=CÓDIGO busca a la familia en el Sheet (Apps Script) */
  const rs = $('[data-modulo="rsvp"]');
  if (rs) {
    const codigo = (params.get('i') || '').trim().toUpperCase();
    const ep = E.rsvp && E.rsvp.endpoint;
    const vista = (n) => $$('[data-rsvp-vista]', rs).forEach((v) => { v.hidden = v.dataset.rsvpVista !== n; });
    const cerrado = E.rsvp && E.rsvp.fecha_limite && Date.now() > new Date(E.rsvp.fecha_limite).getTime();
    if (!codigo || !ep) vista('sin-codigo');
    else if (cerrado) vista('cerrado');
    else {
      vista('cargando');
      fetch(`${ep}?i=${encodeURIComponent(codigo)}`).then((r) => r.json()).then((d) => {
        if (!d.ok) return vista('sin-codigo');
        $$('[data-rsvp="familia"]').forEach((el) => { el.textContent = d.familia; });
        $$('[data-rsvp="pases"]').forEach((el) => { el.textContent = d.pases; });
        $$('[data-rsvp-saludo]').forEach((el) => { el.hidden = false; });
        pintaWhatsApp(d.familia);
        const sel = $('select[name="asistentes"]', rs);
        sel.innerHTML = Array.from({ length: d.pases }, (_, k) => `<option>${k + 1}</option>`).join('');
        if (d.respuesta) { $('[data-rsvp="previa"]', rs).textContent = d.respuesta; vista('ya'); } else vista('form');
      }).catch(() => vista('sin-codigo'));
      $('[data-rsvp-cambiar]', rs).onclick = () => vista('form');
      const form = $('form', rs);
      form.querySelectorAll('input[name="asiste"]').forEach((r) => r.onchange = () => {
        $('.rsvp-cuantos', rs).hidden = form.asiste.value !== 'si';
      });
      form.onsubmit = (ev) => {
        ev.preventDefault();
        const btn = $('button[type="submit"]', form); btn.disabled = true; btn.textContent = 'Enviando…';
        const datos = { i: codigo, asiste: form.asiste.value, asistentes: form.asiste.value === 'si' ? +form.asistentes.value : 0,
          nombres: form.nombres.value.trim(), mensaje: form.mensaje.value.trim() };
        // text/plain evita el preflight CORS que Apps Script no responde
        fetch(ep, { method: 'POST', headers: { 'Content-Type': 'text/plain;charset=utf-8' }, body: JSON.stringify(datos) })
          .then((r) => r.json()).then((d) => {
            if (!d.ok) throw new Error(d.error);
            $('[data-rsvp="gracias"]', rs).textContent = datos.asiste === 'si'
              ? `¡Gracias! Registramos ${datos.asistentes} ${datos.asistentes === 1 ? 'asistente' : 'asistentes'}.`
              : 'Gracias por avisarnos. Los vamos a extrañar.';
            vista('gracias');
          }).catch(() => { btn.disabled = false; btn.textContent = 'Reintentar'; alert('No se pudo enviar. Revisa tu conexión e intenta de nuevo.'); });
      };
    }
  }
})();
