/* Güppi — interações do layout mobile (seções gp-*) */
(function () {
  'use strict';

  var reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  // Arrastar com mouse nos carrosséis (no celular o arrasto é nativo)
  function initDrag(root) {
    root.querySelectorAll('[data-gp-drag]').forEach(function (el) {
      if (el.dataset.gpDragReady) return;
      el.dataset.gpDragReady = '1';
      var down = false, moved = false, startX = 0, startLeft = 0;
      el.addEventListener('pointerdown', function (e) {
        if (e.pointerType !== 'mouse') return;
        down = true; moved = false; startX = e.clientX; startLeft = el.scrollLeft; el.classList.add('dragging');
      });
      window.addEventListener('pointermove', function (e) {
        if (!down) return;
        if (Math.abs(e.clientX - startX) > 5) moved = true;
        el.scrollLeft = startLeft - (e.clientX - startX);
      });
      window.addEventListener('pointerup', function () { if (down) { down = false; el.classList.remove('dragging'); } });
      el.addEventListener('click', function (e) { if (moved) { e.preventDefault(); e.stopPropagation(); moved = false; } }, true);
      el.addEventListener('dragstart', function (e) { e.preventDefault(); });
    });
  }

  // Setas que movem um trilho (creators, ativos, vídeos)
  document.addEventListener('click', function (e) {
    var b = e.target.closest('[data-gp-scroll]');
    if (!b) return;
    var track = document.getElementById(b.getAttribute('data-gp-scroll'));
    if (!track || !track.firstElementChild) return;
    var gap = parseFloat(getComputedStyle(track).columnGap) || 14;
    var step = track.firstElementChild.getBoundingClientRect().width + gap;
    track.scrollBy({ left: step * Number(b.dataset.dir), behavior: 'smooth' });
  });

  // Antes e depois
  function initBeforeAfter(root) {
    root.querySelectorAll('[data-gp-ba]').forEach(function (ba) {
      if (ba.dataset.gpReady) return;
      ba.dataset.gpReady = '1';
      var baDown = false;
      function set(p) {
        p = Math.max(4, Math.min(96, p));
        ba.style.setProperty('--pos', p + '%');
        ba.setAttribute('aria-valuenow', Math.round(p));
      }
      function setX(x) { var r = ba.getBoundingClientRect(); set((x - r.left) / r.width * 100); }
      ba.addEventListener('pointerdown', function (e) { baDown = true; ba.setPointerCapture(e.pointerId); setX(e.clientX); });
      ba.addEventListener('pointermove', function (e) { if (baDown) setX(e.clientX); });
      ['pointerup', 'pointercancel'].forEach(function (ev) { ba.addEventListener(ev, function () { baDown = false; }); });
      ba.addEventListener('keydown', function (e) {
        var cur = Number(ba.getAttribute('aria-valuenow')) || 50;
        if (e.key === 'ArrowLeft') set(cur - 5); else if (e.key === 'ArrowRight') set(cur + 5); else return;
        e.preventDefault();
      });
    });
  }

  // Ficha do produto (pontos na foto)
  var sheet = null, lastFocus = null;
  function getSheet() {
    if (sheet) return sheet;
    sheet = document.createElement('div');
    sheet.className = 'gp gp-sheet-wrap';
    sheet.setAttribute('aria-hidden', 'true');
    sheet.innerHTML =
      '<div class="gp-backdrop" data-gp-close></div>' +
      '<div class="gp-sheet" role="dialog" aria-modal="true" aria-labelledby="gpSheetTitle">' +
      '<button class="gp-close" type="button" data-gp-close aria-label="Fechar">×</button>' +
      '<div class="gp-s-photo"><span data-gp-s-ph>Foto do produto</span></div>' +
      '<div class="gp-s-meta"><span class="gp-s-num"></span><span class="gp-s-size"></span></div>' +
      '<h3 id="gpSheetTitle"></h3><p></p><a class="gp-cta off" role="button"></a></div>';
    document.body.appendChild(sheet);
    sheet.querySelectorAll('[data-gp-close]').forEach(function (c) { c.addEventListener('click', closeSheet); });
    sheet.querySelector('.gp-cta').addEventListener('click', function (e) {
      if (this.classList.contains('off')) { e.preventDefault(); return; }
      closeSheet();
    });
    return sheet;
  }
  function openSheet(dot) {
    var s = getSheet(), d = dot.dataset, cta = s.querySelector('.gp-cta'), photo = s.querySelector('.gp-s-photo');
    s.querySelector('.gp-s-num').textContent = d.num;
    s.querySelector('.gp-s-size').textContent = d.size || '';
    s.querySelector('h3').textContent = d.title || '';
    s.querySelector('p').textContent = d.text || '';
    var old = photo.querySelector('img'); if (old) old.remove();
    s.querySelector('[data-gp-s-ph]').hidden = !!d.img;
    if (d.img) { var img = document.createElement('img'); img.src = d.img; img.alt = ''; photo.appendChild(img); }
    if (d.url) {
      cta.textContent = d.cta || 'Ver produto'; cta.href = d.url;
      cta.classList.remove('off'); cta.removeAttribute('aria-disabled');
    } else {
      cta.textContent = d.soon || 'Em breve'; cta.removeAttribute('href');
      cta.classList.add('off'); cta.setAttribute('aria-disabled', 'true');
    }
    lastFocus = document.activeElement;
    s.classList.add('open'); s.setAttribute('aria-hidden', 'false');
    s.querySelector('.gp-close').focus();
  }
  function closeSheet() {
    if (!sheet) return;
    sheet.classList.remove('open'); sheet.setAttribute('aria-hidden', 'true');
    if (lastFocus) lastFocus.focus();
  }
  document.addEventListener('click', function (e) {
    var dot = e.target.closest('.gp-dot');
    if (dot) openSheet(dot);
  });

  // Menu lateral
  function setMenu(open) {
    var wrap = document.getElementById('GpMenu'), btn = document.getElementById('GpMenuBtn');
    if (!wrap || !btn) return;
    wrap.classList.toggle('open', open);
    wrap.setAttribute('aria-hidden', String(!open));
    btn.setAttribute('aria-expanded', String(open));
    btn.classList.toggle('is-open', open);
  }
  document.addEventListener('click', function (e) {
    if (e.target.closest('#GpMenuBtn')) {
      var wrap = document.getElementById('GpMenu');
      setMenu(!(wrap && wrap.classList.contains('open')));
      return;
    }
    if (e.target.closest('[data-gp-menu-close]')) setMenu(false);
    var top = e.target.closest('[data-gp-top]');
    if (top) { e.preventDefault(); window.scrollTo({ top: 0, behavior: 'smooth' }); }
  });
  document.addEventListener('keydown', function (e) {
    if (e.key !== 'Escape') return;
    setMenu(false);
    if (sheet && sheet.classList.contains('open')) closeSheet();
  });

  // Galeria do produto
  function initGallery(root) {
    root.querySelectorAll('[data-gp-gallery]').forEach(function (g) {
      if (g.dataset.gpReady) return;
      g.dataset.gpReady = '1';
      var stage = g.querySelector('.gp-pdp-stage');
      var photos = g.querySelectorAll('.gp-pdp-photo');
      var thumbs = g.querySelectorAll('.gp-pdp-thumb');
      var counter = g.querySelector('.gp-pdp-counter');
      var total = photos.length, i = 0;
      if (total < 2) return;
      function show(n) {
        i = (n + total) % total;
        stage.className = 'gp-pdp-stage gp-ph' + ((i % 4) + 1);
        if (counter) counter.textContent = (i + 1) + ' / ' + total;
        thumbs.forEach(function (b, j) { b.setAttribute('aria-pressed', String(j === i)); });
        photos.forEach(function (p, j) {
          p.classList.toggle('is-on', j === i);
          if (p.tagName === 'VIDEO') { if (j === i) { var a = p.play(); if (a && a.catch) a.catch(function () {}); } else p.pause(); }
        });
        if (thumbs[i] && thumbs[i].scrollIntoView && thumbs.length > 4) {
          var strip = thumbs[i].parentElement;
          strip.scrollTo({ left: thumbs[i].offsetLeft - strip.clientWidth / 2 + thumbs[i].clientWidth / 2, behavior: 'smooth' });
        }
      }
      g._gpShow = function (index) { if (photos[index]) show(index); };
      g.querySelector('.gp-pdp-prev').addEventListener('click', function () { show(i - 1); });
      g.querySelector('.gp-pdp-next').addEventListener('click', function () { show(i + 1); });
      thumbs.forEach(function (b) { b.addEventListener('click', function () { show(Number(b.dataset.i)); }); });
      var sx = 0;
      stage.addEventListener('touchstart', function (e) { sx = e.changedTouches[0].screenX; }, { passive: true });
      stage.addEventListener('touchend', function (e) {
        var dx = e.changedTouches[0].screenX - sx;
        if (Math.abs(dx) > 45) show(i + (dx < 0 ? 1 : -1));
      }, { passive: true });
    });
  }

  // Troca de variante: atualiza preço, botão e foto
  document.addEventListener('change', function (e) {
    var sel = e.target.closest('[data-gp-variant]');
    if (!sel) return;
    var opt = sel.options[sel.selectedIndex], d = opt.dataset, sec = sel.closest('[data-gp-product]');
    if (!sec) return;
    sec.querySelectorAll('[data-gp-price]').forEach(function (el) { el.textContent = d.price; });
    sec.querySelectorAll('[data-gp-pix]').forEach(function (el) { el.textContent = d.pix; });
    sec.querySelectorAll('[data-gp-compare]').forEach(function (el) { el.textContent = d.compare || ''; el.hidden = !d.compare; });
    var available = d.available === 'true';
    sec.querySelectorAll('[data-gp-submit]').forEach(function (b) {
      b.disabled = !available;
      b.textContent = available ? b.dataset.labelAdd : b.dataset.labelSoldout;
    });
    var g = sec.querySelector('[data-gp-gallery]');
    if (d.media && g && g._gpShow) g._gpShow(Number(d.media));
    if (window.history && window.history.replaceState) {
      var url = new URL(window.location.href);
      url.searchParams.set('variant', sel.value);
      window.history.replaceState({}, '', url.toString());
    }
  });

  // Fórmula: creme revelado conforme a rolagem
  var creamScenes = [];
  function initCream(root) {
    root.querySelectorAll('[data-gp-cream]').forEach(function (chapter) {
      if (chapter.dataset.gpReady) return;
      chapter.dataset.gpReady = '1';
      creamScenes.push({ chapter: chapter, scene: chapter.querySelector('.gp-pdp-cream'), bullets: chapter.querySelectorAll('.gp-pdp-bullets li') });
    });
    animateCream();
  }
  function animateCream() {
    creamScenes.forEach(function (c) {
      if (!c.chapter.isConnected) return;
      if (reduceMotion) {
        c.bullets.forEach(function (li) { li.style.opacity = 1; li.style.transform = 'none'; });
        return;
      }
      var r = c.chapter.getBoundingClientRect();
      var distance = Math.max(1, c.chapter.offsetHeight - c.scene.offsetHeight);
      var progress = Math.max(0, Math.min(1, (innerHeight * .65 - r.top) / (distance + innerHeight * .65)));
      c.scene.style.setProperty('--cream-reveal', (16 + progress * 84) + '%');
      c.scene.style.setProperty('--cream-y', (progress * 8) + 'px');
      c.scene.style.setProperty('--apply-opacity', progress > .02 && progress < .99 ? 1 : 0);
      var n = c.bullets.length || 1, stepSize = .84 / n;
      c.bullets.forEach(function (li, i) {
        var amount = Math.max(0, Math.min(1, (progress + .07 - i * stepSize) / .085));
        li.style.opacity = amount;
        li.style.transform = 'translateY(' + ((1 - amount) * 22) + 'px) translateX(' + ((1 - amount) * 8) + 'px)';
      });
    });
  }
  var ticking = false;
  window.addEventListener('scroll', function () {
    if (!creamScenes.length || ticking) return;
    ticking = true;
    requestAnimationFrame(function () { animateCream(); ticking = false; });
  }, { passive: true });
  window.addEventListener('resize', animateCream);

  // Vídeos: tocam sem som quando aparecem na tela
  function initVideos(root) {
    var videos = [].slice.call(root.querySelectorAll('.gp video[autoplay]'));
    if (!videos.length) return;
    videos.forEach(function (v) { v.muted = true; v.playsInline = true; v.setAttribute('muted', ''); v.setAttribute('playsinline', ''); });
    var play = function (v) { var a = v.play(); if (a && a.catch) a.catch(function () {}); };
    if (!('IntersectionObserver' in window)) { videos.forEach(play); return; }
    var io = new IntersectionObserver(function (entries) {
      entries.forEach(function (en) {
        if (en.isIntersecting) play(en.target); else if (!en.target.paused) en.target.pause();
      });
    }, { threshold: 0.25 });
    videos.forEach(function (v) { io.observe(v); });
  }

  // Rodapé: janela do cupom da newsletter
  var couponLastFocus = null;
  function setCoupon(open) {
    var wrap = document.getElementById('GpCoupon');
    if (!wrap) return;
    if (open) couponLastFocus = document.activeElement;
    wrap.classList.toggle('open', open);
    wrap.setAttribute('aria-hidden', String(!open));
    if (open) {
      var focusEl = wrap.querySelector('input[type="email"]') || wrap.querySelector('[data-gp-copy]') || wrap.querySelector('.gp-close');
      setTimeout(function () { if (focusEl) focusEl.focus(); }, 60);
      if (wrap.querySelector('[data-gp-coupon-result="success"]')) {
        requestAnimationFrame(function () { wrap.classList.add('is-revealed'); });
      }
    } else if (couponLastFocus) {
      couponLastFocus.focus();
    }
  }
  document.addEventListener('click', function (e) {
    if (e.target.closest('[data-gp-coupon-open]')) { setCoupon(true); return; }
    if (e.target.closest('[data-gp-coupon-close]')) { setCoupon(false); return; }
    var copy = e.target.closest('[data-gp-copy]');
    if (copy) {
      var label = copy.textContent;
      var done = function () { copy.textContent = copy.dataset.done; setTimeout(function () { copy.textContent = label; }, 2200); };
      if (navigator.clipboard) navigator.clipboard.writeText(copy.dataset.gpCopy).then(done, function () {});
    }
  });
  document.addEventListener('keydown', function (e) {
    var wrap = document.getElementById('GpCoupon');
    if (e.key === 'Escape' && wrap && wrap.classList.contains('open')) setCoupon(false);
  });

  // Depois do envio a página recarrega: reabre a janela com o cupom ou com o erro
  function initCoupon(root) {
    if (root.querySelector('#GpCoupon [data-gp-coupon-result]')) setCoupon(true);
  }

  // Rodapé: olho do peixinho segue o mouse
  function initFishEye(root) {
    var pupil = root.querySelector('.gp-fish-pupil');
    if (!pupil || reduceMotion || !window.matchMedia('(pointer: fine)').matches) return;
    var svg = pupil.ownerSVGElement, pending = false, px = 0, py = 0;
    window.addEventListener('pointermove', function (e) {
      px = e.clientX; py = e.clientY;
      if (pending) return;
      pending = true;
      requestAnimationFrame(function () {
        pending = false;
        var r = svg.getBoundingClientRect();
        if (r.bottom < 0 || r.top > innerHeight) return;
        var s = r.width / 460, ex = r.left + 318 * s, ey = r.top + 272 * s;
        var dx = px - ex, dy = py - ey, d = Math.hypot(dx, dy) || 1, m = Math.min(4, d / 60);
        pupil.style.transform = 'translate(' + (dx / d * m) + 'px,' + (dy / d * m) + 'px)';
      });
    }, { passive: true });
  }

  // Rodapé: o traço do peixe se desenha quando ele entra na tela
  function initFishDraw(root) {
    var fish = root.querySelector('.gp-fish');
    if (!fish || reduceMotion || !('IntersectionObserver' in window)) return;
    fish.setAttribute('data-draw', '');
    var io = new IntersectionObserver(function (entries) {
      if (!entries[0].isIntersecting) return;
      requestAnimationFrame(function () { fish.classList.add('in'); });
      io.disconnect();
    }, { threshold: 0.35 });
    io.observe(fish);
  }

  // Rodapé: colunas viram sanfona no celular
  var footWide = window.matchMedia('(min-width: 990px)');
  function syncFootCols() {
    var wide = footWide.matches && document.body.classList.contains('gp-wide');
    document.querySelectorAll('[data-gp-foot-col]').forEach(function (d) { d.open = wide; });
  }
  if (footWide.addEventListener) footWide.addEventListener('change', syncFootCols);

  function init(root) {
    root = root || document;
    initCoupon(root);
    initFishEye(root);
    initFishDraw(root);
    syncFootCols();
    initDrag(root);
    initBeforeAfter(root);
    initGallery(root);
    initCream(root);
    initVideos(root);
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', function () { init(); });
  else init();
  document.addEventListener('shopify:section:load', function (e) { init(e.target); });
})();
