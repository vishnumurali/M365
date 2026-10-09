/* =====================================================================
   SP Codex - client script (no framework, works from file:// and http)
   ===================================================================== */
(function () {
  'use strict';

  var ROOT = window.SPC_ROOT || '';
  var doc = document;
  var html = doc.documentElement;
  var $ = function (s, el) { return (el || doc).querySelector(s); };
  var $$ = function (s, el) { return Array.prototype.slice.call((el || doc).querySelectorAll(s)); };
  var reduceMotion = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  var store = {
    get: function (k) { try { return window.localStorage.getItem(k); } catch (e) { return null; } },
    set: function (k, v) { try { window.localStorage.setItem(k, v); } catch (e) { /* storage unavailable */ } }
  };
  function escapeHtml(s) {
    return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  }
  function toast(msg) {
    var t = $('[data-toast]');
    if (!t) return;
    t.textContent = msg;
    t.classList.add('show');
    clearTimeout(toast._t);
    toast._t = setTimeout(function () { t.classList.remove('show'); }, 1800);
  }
  function copyText(text) {
    if (navigator.clipboard && window.isSecureContext) return navigator.clipboard.writeText(text);
    return new Promise(function (resolve, reject) {
      var ta = doc.createElement('textarea');
      ta.value = text; ta.setAttribute('readonly', ''); ta.style.position = 'fixed'; ta.style.opacity = '0';
      doc.body.appendChild(ta); ta.select();
      try { doc.execCommand('copy'); resolve(); } catch (e) { reject(e); }
      doc.body.removeChild(ta);
    });
  }

  /* ---------------- theme ---------------- */
  function setTheme(t) {
    html.setAttribute('data-theme', t);
    store.set('spc-theme', t);
    doc.dispatchEvent(new CustomEvent('spc:theme', { detail: t }));
  }
  $$('[data-theme-toggle]').forEach(function (b) {
    b.addEventListener('click', function () { setTheme(html.getAttribute('data-theme') === 'light' ? 'dark' : 'light'); });
  });

  /* ---------------- nav: mobile + mega menu ---------------- */
  var menuBtn = $('[data-menu-toggle]');
  if (menuBtn) menuBtn.addEventListener('click', function () {
    var open = doc.body.classList.toggle('nav-open');
    menuBtn.setAttribute('aria-expanded', open ? 'true' : 'false');
  });
  $$('[data-mega-toggle]').forEach(function (btn) {
    btn.addEventListener('click', function (e) {
      e.stopPropagation();
      var wrap = btn.parentElement;
      $$('.nav-mega.open').forEach(function (m) { if (m !== wrap) m.classList.remove('open'); });
      var open = wrap.classList.toggle('open');
      btn.setAttribute('aria-expanded', open ? 'true' : 'false');
    });
  });
  doc.addEventListener('click', function (e) {
    $$('.nav-mega.open').forEach(function (m) { if (!m.contains(e.target)) { m.classList.remove('open'); } });
  });

  /* ---------------- header: hide on scroll down, show on scroll up ---------------- */
  var lastY = window.scrollY || 0;
  var headTick = false;
  function onHeadScroll() {
    var y = window.scrollY || 0;
    var body = doc.body;
    body.classList.toggle('scrolled', y > 8);
    if (body.classList.contains('nav-open') || body.classList.contains('sidenav-open')) { lastY = y; return; }
    if (y > 220 && y > lastY + 6) {
      if (!body.classList.contains('hdr-hide')) {
        body.classList.add('hdr-hide');
        $$('.nav-mega.open').forEach(function (m) { m.classList.remove('open'); });
      }
    } else if (y < lastY - 6 || y <= 220) {
      body.classList.remove('hdr-hide');
    }
    lastY = y;
  }
  window.addEventListener('scroll', function () {
    if (headTick) return;
    headTick = true;
    requestAnimationFrame(function () { headTick = false; onHeadScroll(); });
  }, { passive: true });
  onHeadScroll();

  /* ---------------- reveal on scroll ---------------- */
  var revealEls = $$('.reveal');
  if ('IntersectionObserver' in window && !reduceMotion) {
    var io = new IntersectionObserver(function (entries) {
      entries.forEach(function (en) {
        if (en.isIntersecting) { en.target.classList.add('in'); io.unobserve(en.target); }
      });
    }, { rootMargin: '0px 0px -6% 0px', threshold: 0.06 });
    revealEls.forEach(function (el) { io.observe(el); });
  } else {
    revealEls.forEach(function (el) { el.classList.add('in'); });
  }

  /* =================================================================
     Search engine
     ================================================================= */
  var INDEX = null;
  var indexPromise = null;
  var SYN = {
    spfx: ['sharepoint framework'], onprem: ['on-premises', 'on premises', 'server'], 'on-prem': ['on-premises'],
    spo: ['sharepoint online'], sp: ['sharepoint'], pa: ['power apps', 'power automate'], flow: ['power automate'],
    nac: ['nintex automation cloud'], nwc: ['nintex workflow cloud'], rer: ['remote event receiver'],
    pha: ['provider-hosted', 'provider hosted'], hld: ['high-level design', 'high level design'],
    lld: ['low-level design', 'low level design'], brd: ['requirement'], crud: ['create', 'read', 'update', 'delete'],
    cds: ['dataverse'], dv: ['dataverse'], m365: ['microsoft 365'], o365: ['office 365', 'microsoft 365'],
    aad: ['entra'], azuread: ['entra'], pnp: ['pnp'], ssom: ['server object model'], csom: ['client object model', 'csom'],
    pcf: ['component framework'], ace: ['adaptive card extension'], spd: ['sharepoint designer'], wsp: ['farm solution'],
    sharegate: ['sharegate'], spmt: ['sharepoint migration tool'], ipfs: ['infopath forms services']
  };
  function norm(s) {
    return String(s || '').toLowerCase().normalize('NFKD').replace(/[̀-ͯ]/g, '')
      .replace(/[^a-z0-9#+.\-\s]/g, ' ').replace(/\s+/g, ' ').trim();
  }
  function prepare(idx) {
    if (!idx || idx._ready) return idx;
    idx.catMap = {};
    idx.cats.forEach(function (c) { idx.catMap[c.id] = c; });
    idx.items.forEach(function (it) {
      var cat = idx.catMap[it.c] || {};
      it._t = norm(it.t); it._k = norm(it.k); it._h = norm(it.h); it._s = norm(it.s);
      it._b = norm(it.b); it._c = norm(cat.t + ' ' + cat.s + ' ' + it.x);
    });
    idx._ready = true;
    return idx;
  }
  function loadIndex() {
    if (INDEX) return Promise.resolve(INDEX);
    if (window.SPC_INDEX) { INDEX = prepare(window.SPC_INDEX); return Promise.resolve(INDEX); }
    if (!indexPromise) {
      indexPromise = new Promise(function (resolve, reject) {
        var s = doc.createElement('script');
        s.src = ROOT + 'assets/js/search-index.js';
        s.onload = function () { INDEX = prepare(window.SPC_INDEX); resolve(INDEX); };
        s.onerror = reject;
        doc.head.appendChild(s);
      });
    }
    return indexPromise;
  }
  function termVariants(term) {
    var v = [term];
    if (SYN[term]) v = v.concat(SYN[term]);
    if (term.length > 4 && /s$/.test(term)) v.push(term.slice(0, -1));
    return v;
  }
  function wordStart(hay, needle) {
    var i = hay.indexOf(needle);
    if (i < 0) return -1;
    return i === 0 || /[\s\-.#/]/.test(hay.charAt(i - 1)) ? 2 : 1;
  }
  function search(q, scope) {
    if (!INDEX) return [];
    var nq = norm(q);
    var terms = nq.split(' ').filter(function (t) { return t.length > 0; });
    if (!terms.length) return [];
    var out = [];
    INDEX.items.forEach(function (it) {
      if (scope && it.c !== scope) return;
      var score = 0;
      for (var i = 0; i < terms.length; i++) {
        var vars = termVariants(terms[i]), best = 0;
        for (var j = 0; j < vars.length; j++) {
          var t = vars[j], s = 0, w;
          if ((w = wordStart(it._t, t)) > 0) s += w === 2 ? 14 : 8;
          if ((w = wordStart(it._k, t)) > 0) s += w === 2 ? 7 : 4;
          if ((w = wordStart(it._h, t)) > 0) s += w === 2 ? 4 : 2;
          if (it._s.indexOf(t) >= 0) s += 3;
          if (it._c.indexOf(t) >= 0) s += 3;
          if (it._b.indexOf(t) >= 0) s += 1;
          if (s > best) best = s;
        }
        if (!best) return;
        score += best;
      }
      if (terms.length > 1 && it._t.indexOf(nq) >= 0) score += 20;
      else if (terms.length > 1 && it._b.indexOf(nq) >= 0) score += 6;
      out.push({ it: it, score: score });
    });
    out.sort(function (a, b) { return b.score - a.score || a.it.t.localeCompare(b.it.t); });
    return out;
  }
  function highlight(text, q) {
    var safe = escapeHtml(text);
    var terms = norm(q).split(' ').filter(function (t) { return t.length > 1; });
    if (!terms.length) return safe;
    var re = new RegExp('(' + terms.map(function (t) { return t.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'); }).join('|') + ')', 'gi');
    return safe.replace(re, '<mark>$1</mark>');
  }
  function snippet(it, q) {
    var terms = norm(q).split(' ').filter(Boolean);
    var src = it.b || it.s || '';
    var low = src.toLowerCase();
    var pos = -1;
    for (var i = 0; i < terms.length && pos < 0; i++) pos = low.indexOf(terms[i]);
    if (pos < 0 || it._s.indexOf(terms[0]) >= 0) return it.s || src.slice(0, 160);
    var start = Math.max(0, pos - 60);
    return (start > 0 ? '…' : '') + src.slice(start, start + 180) + '…';
  }
  function resultHtml(r, q, cls, extra) {
    var it = r.it, cat = INDEX.catMap[it.c] || {};
    // full search page rows (cls === '') get the article's cover as a thumbnail
    var thumb = cls === '' ? '<img class="sr-thumb" src="' + ROOT + 'assets/covers/' + it.u.replace(/^articles\//, '').replace(/\.html$/, '.svg') + '" alt="" loading="lazy" decoding="async">' : '<span class="sr-dot"></span>';
    return '<a class="' + (cls == null ? 'sr' : cls) + '" href="' + ROOT + it.u + '" style="--c:' + cat.c + '" role="option">' +
      thumb + '<span class="sr-main"><span class="sr-t">' + highlight(it.t, q) + '</span>' +
      '<span class="sr-c">' + escapeHtml(cat.s || '') + ' · ' + escapeHtml(it.x) + ' · ' + escapeHtml(it.l) + '</span>' +
      '<span class="sr-s">' + highlight(snippet(it, q), q) + '</span>' + (extra || '') + '</span></a>';
  }

  /* ---------------- command palette ---------------- */
  var cmdk = $('[data-cmdk]');
  var cmdkInput = $('[data-cmdk-input]');
  var cmdkResults = $('[data-cmdk-results]');
  var cmdkScopes = $('[data-cmdk-scopes]');
  var cmdkAll = $('[data-cmdk-all]');
  var cmdkScope = '';
  var sel = 0;
  var lastFocus = null;

  function renderScopes() {
    if (!INDEX || !cmdkScopes || cmdkScopes.childElementCount) return;
    var h = '<button type="button" class="chip-btn active" data-cscope="">All</button>';
    INDEX.cats.forEach(function (c) { h += '<button type="button" class="chip-btn" data-cscope="' + c.id + '" style="--c:' + c.c + '">' + escapeHtml(c.s) + '</button>'; });
    cmdkScopes.innerHTML = h;
    $$('[data-cscope]', cmdkScopes).forEach(function (b) {
      b.addEventListener('click', function () {
        cmdkScope = b.getAttribute('data-cscope');
        $$('[data-cscope]', cmdkScopes).forEach(function (x) { x.classList.toggle('active', x === b); });
        runCmdk(); cmdkInput.focus();
      });
    });
  }
  function runCmdk() {
    if (!INDEX) return;
    var q = cmdkInput.value.trim();
    if (cmdkAll) cmdkAll.href = ROOT + 'search.html?q=' + encodeURIComponent(q) + (cmdkScope ? '&scope=' + cmdkScope : '');
    if (!q) {
      var cats = INDEX.cats.filter(function (c) { return !cmdkScope || c.id === cmdkScope; });
      cmdkResults.innerHTML = '<div class="sr-group">Jump to a tab</div>' + cats.map(function (c) {
        return '<a class="sr" href="' + ROOT + c.u + '" style="--c:' + c.c + '"><span class="sr-dot"></span><span class="sr-main"><span class="sr-t">' + escapeHtml(c.t) + '</span><span class="sr-c">' + c.n + ' articles</span></span></a>';
      }).join('');
    } else {
      var res = search(q, cmdkScope).slice(0, 30);
      cmdkResults.innerHTML = res.length
        ? '<div class="sr-group">' + res.length + (res.length === 30 ? '+' : '') + ' results</div>' + res.map(function (r) { return resultHtml(r, q); }).join('')
        : '<div class="sr-empty">No articles match “' + escapeHtml(q) + '”. Try fewer words or a different spelling.</div>';
    }
    sel = 0; markSel();
  }
  function markSel() {
    var items = $$('.sr', cmdkResults);
    items.forEach(function (el, i) { el.classList.toggle('sel', i === sel); });
    if (items[sel]) items[sel].scrollIntoView({ block: 'nearest' });
  }
  function openSearch(prefill) {
    if (!cmdk) return;
    lastFocus = doc.activeElement;
    cmdk.hidden = false;
    doc.body.style.overflow = 'hidden';
    if (typeof prefill === 'string') cmdkInput.value = prefill;
    cmdkInput.focus();
    cmdkInput.select();
    cmdkResults.innerHTML = '<div class="sr-empty">Loading index…</div>';
    loadIndex().then(function () { renderScopes(); runCmdk(); }).catch(function () {
      cmdkResults.innerHTML = '<div class="sr-empty">Search index could not be loaded.</div>';
    });
  }
  function closeSearch() {
    if (!cmdk || cmdk.hidden) return;
    cmdk.hidden = true;
    doc.body.style.overflow = '';
    if (lastFocus && lastFocus.focus) lastFocus.focus();
  }
  $$('[data-open-search]').forEach(function (b) { b.addEventListener('click', function () { openSearch(); }); });
  $$('[data-close-search]').forEach(function (b) { b.addEventListener('click', closeSearch); });
  if (cmdkInput) {
    cmdkInput.addEventListener('input', runCmdk);
    cmdkInput.addEventListener('keydown', function (e) {
      var items = $$('.sr', cmdkResults);
      if (e.key === 'ArrowDown') { e.preventDefault(); sel = Math.min(items.length - 1, sel + 1); markSel(); }
      else if (e.key === 'ArrowUp') { e.preventDefault(); sel = Math.max(0, sel - 1); markSel(); }
      else if (e.key === 'Enter') {
        e.preventDefault();
        if (items[sel]) window.location.href = items[sel].href;
        else if (cmdkInput.value.trim()) window.location.href = cmdkAll.href;
      }
    });
  }
  doc.addEventListener('keydown', function (e) {
    var tag = (e.target.tagName || '').toLowerCase();
    var typing = tag === 'input' || tag === 'textarea' || e.target.isContentEditable;
    if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') { e.preventDefault(); if (cmdk && cmdk.hidden) openSearch(); else closeSearch(); }
    else if (e.key === '/' && !typing) {
      var hero = $('[data-hero-input]');
      e.preventDefault();
      if (hero) hero.focus(); else openSearch();
    } else if (e.key === 'Escape') {
      closeSearch(); closeZoom(); doc.body.classList.remove('sidenav-open');
      if (doc.body.classList.contains('nav-open')) { doc.body.classList.remove('nav-open'); if (menuBtn) menuBtn.setAttribute('aria-expanded', 'false'); }
      $$('.nav-mega.open').forEach(function (m) { m.classList.remove('open'); });
    }
  });

  /* ---------------- hero search (home) ---------------- */
  var heroInput = $('[data-hero-input]');
  var heroResults = $('[data-hero-results]');
  if (heroInput && heroResults) {
    var heroSel = -1;
    var runHero = function () {
      var q = heroInput.value.trim();
      if (!q) { heroResults.hidden = true; return; }
      loadIndex().then(function () {
        var res = search(q).slice(0, 7);
        heroSel = -1;
        heroResults.innerHTML = res.length
          ? res.map(function (r) { return resultHtml(r, q); }).join('') + '<a class="sr" href="' + ROOT + 'search.html?q=' + encodeURIComponent(q) + '"><span class="sr-main"><span class="sr-t">See all results for “' + escapeHtml(q) + '” →</span></span></a>'
          : '<div class="sr-empty">No matches yet. Press Enter for a full search.</div>';
        heroResults.hidden = false;
      });
    };
    heroInput.addEventListener('input', runHero);
    heroInput.addEventListener('focus', function () { loadIndex(); if (heroInput.value.trim()) runHero(); });
    heroInput.addEventListener('keydown', function (e) {
      var items = $$('.sr', heroResults);
      if (e.key === 'ArrowDown' && items.length) { e.preventDefault(); heroSel = Math.min(items.length - 1, heroSel + 1); }
      else if (e.key === 'ArrowUp' && items.length) { e.preventDefault(); heroSel = Math.max(0, heroSel - 1); }
      else if (e.key === 'Enter' && heroSel >= 0 && items[heroSel]) { e.preventDefault(); window.location.href = items[heroSel].href; return; }
      else if (e.key === 'Escape') { heroResults.hidden = true; return; }
      else return;
      items.forEach(function (el, i) { el.classList.toggle('sel', i === heroSel); });
    });
    doc.addEventListener('click', function (e) { if (!e.target.closest('[data-hero-search]')) heroResults.hidden = true; });
    $$('.hero-popular a[data-q]').forEach(function (a) {
      a.addEventListener('click', function (e) {
        e.preventDefault();
        heroInput.value = a.getAttribute('data-q');
        heroInput.focus();
        runHero();
      });
    });
  }

  /* ---------------- search page ---------------- */
  var spInput = $('[data-search-input]');
  if (spInput) {
    var spResults = $('[data-search-results]');
    var spCount = $('[data-search-count]');
    var params = new URLSearchParams(window.location.search);
    var spScope = params.get('scope') || '';
    spInput.value = params.get('q') || '';
    var scopeBtns = $$('[data-scope]');
    scopeBtns.forEach(function (b) {
      b.classList.toggle('active', b.getAttribute('data-scope') === spScope);
      b.addEventListener('click', function () {
        spScope = b.getAttribute('data-scope');
        scopeBtns.forEach(function (x) { x.classList.toggle('active', x === b); });
        runSp();
      });
    });
    var runSp = function () {
      var q = spInput.value.trim();
      var url = new URL(window.location.href);
      if (q) url.searchParams.set('q', q); else url.searchParams.delete('q');
      if (spScope) url.searchParams.set('scope', spScope); else url.searchParams.delete('scope');
      try { window.history.replaceState(null, '', url.toString()); } catch (e) { /* file:// may refuse */ }
      if (!q) {
        spCount.textContent = 'Type to search ' + INDEX.items.length + ' articles.';
        spResults.innerHTML = '';
        return;
      }
      var res = search(q, spScope);
      spCount.textContent = res.length + ' result' + (res.length === 1 ? '' : 's') + ' for "' + q + '"';
      spResults.innerHTML = res.slice(0, 120).map(function (r) {
        var meta = '<span class="sr-meta"><span class="lvl lvl-' + r.it.l.toLowerCase() + '">' + escapeHtml(r.it.l) + '</span>' +
          (r.it.k ? '<span class="mono">' + escapeHtml(r.it.k.split(', ').slice(0, 5).join(' · ')) + '</span>' : '') + '</span>';
        return '<li>' + resultHtml(r, q, '', meta) + '</li>';
      }).join('') || '<li class="sr-empty">Nothing found. Try a broader term like “workflow”, “migration” or “REST”.</li>';
    };
    loadIndex().then(runSp);
    spInput.addEventListener('input', function () { clearTimeout(runSp._t); runSp._t = setTimeout(runSp, 120); });
    $('[data-search-form]').addEventListener('submit', function (e) { e.preventDefault(); runSp(); });
    spInput.focus();
  }

  /* =================================================================
     Read tracking (per browser)
     ================================================================= */
  var READ_KEY = 'spc-read';
  function readSet() {
    try { return JSON.parse(store.get(READ_KEY) || '[]'); } catch (e) { return []; }
  }
  function isRead(id) { return readSet().indexOf(id) >= 0; }
  function setRead(id, on) {
    var s = readSet().filter(function (x) { return x !== id; });
    if (on) s.push(id);
    store.set(READ_KEY, JSON.stringify(s));
    paintRead();
  }
  function paintRead() {
    var s = readSet();
    $$('[data-key]').forEach(function (el) { el.classList.toggle('is-read', s.indexOf(el.getAttribute('data-key')) >= 0); });
    var pill = $('[data-cat-progress]');
    if (pill) {
      var total = parseInt(pill.getAttribute('data-total'), 10) || 0;
      var n = $$('.a-card.is-read').length;
      $('.pp-bar i', pill).style.width = (total ? (n / total) * 100 : 0) + '%';
      $('.pp-text', pill).textContent = n + ' / ' + total + ' read';
    }
    var mark = $('[data-mark-read]');
    var art = $('[data-article]');
    if (mark && art) {
      var r = s.indexOf(art.getAttribute('data-article')) >= 0;
      mark.classList.toggle('done', r);
      $('span', mark).textContent = r ? 'Read ✓ (click to undo)' : 'Mark as read';
    }
  }
  paintRead();

  /* =================================================================
     Category page filters
     ================================================================= */
  var catPage = $('[data-cat-page]');
  if (catPage) {
    var filterInput = $('[data-cat-filter]');
    var levelBtns = $$('[data-level-filter]');
    var level = 'all';
    var applyFilter = function () {
      var q = (filterInput.value || '').toLowerCase().trim();
      var any = false;
      $$('[data-section]', catPage).forEach(function (sec) {
        var visible = 0;
        $$('.a-card', sec).forEach(function (card) {
          var ok = (level === 'all' || card.getAttribute('data-level') === level) && (!q || card.getAttribute('data-text').indexOf(q) >= 0);
          card.hidden = !ok;
          if (ok) { visible++; card.classList.add('in'); }
        });
        sec.hidden = !visible;
        if (visible) any = true;
      });
      $('[data-empty]', catPage).hidden = any;
    };
    filterInput.addEventListener('input', applyFilter);
    levelBtns.forEach(function (b) {
      b.addEventListener('click', function () {
        level = b.getAttribute('data-level-filter');
        levelBtns.forEach(function (x) { x.classList.toggle('active', x === b); });
        applyFilter();
      });
    });
  }

  /* ---------------- library filter ---------------- */
  var libFilter = $('[data-lib-filter]');
  if (libFilter) {
    libFilter.addEventListener('input', function () {
      var q = libFilter.value.toLowerCase().trim();
      $$('[data-lib-cat]').forEach(function (cat) {
        var shown = 0;
        $$('li[data-text]', cat).forEach(function (li) {
          var ok = !q || li.getAttribute('data-text').indexOf(q) >= 0;
          li.hidden = !ok; if (ok) shown++;
        });
        $$('.lib-sec', cat).forEach(function (sec) { sec.hidden = !$$('li:not([hidden])', sec).length; });
        cat.hidden = !shown;
        cat.classList.add('in');
      });
    });
  }

  /* =================================================================
     Article page
     ================================================================= */
  var artBody = $('[data-art-body]');
  if (artBody) {
    var artId = $('[data-article]').getAttribute('data-article');

    // reading progress + auto mark-as-read
    var bar = $('[data-read-progress]');
    var autoMarked = false;
    var onScroll = function () {
      var r = artBody.getBoundingClientRect();
      var total = r.height - window.innerHeight * 0.6;
      var p = Math.min(1, Math.max(0, -r.top / (total > 0 ? total : 1)));
      if (bar) bar.style.transform = 'scaleX(' + p.toFixed(4) + ')';
      if (p > 0.92 && !autoMarked) { autoMarked = true; if (!isRead(artId)) { setRead(artId, true); toast('Nice! Marked as read ✓'); } }
    };
    window.addEventListener('scroll', onScroll, { passive: true });
    onScroll();

    var markBtn = $('[data-mark-read]');
    if (markBtn) markBtn.addEventListener('click', function () { setRead(artId, !isRead(artId)); });

    // TOC scrollspy
    var tocLinks = $$('.toc a');
    if (tocLinks.length && 'IntersectionObserver' in window) {
      var map = {};
      tocLinks.forEach(function (a) { map[decodeURIComponent(a.getAttribute('href').slice(1))] = a; });
      var heads = Object.keys(map).map(function (id) { return doc.getElementById(id); }).filter(Boolean);
      var active = null;
      var sio = new IntersectionObserver(function (entries) {
        entries.forEach(function (en) {
          if (en.isIntersecting) {
            if (active) active.classList.remove('active');
            active = map[en.target.id];
            if (active) {
              active.classList.add('active');
              var wrap = $('.toc-wrap');
              if (wrap) {
                var lr = active.getBoundingClientRect(), wr = wrap.getBoundingClientRect();
                if (lr.top < wr.top || lr.bottom > wr.bottom) wrap.scrollTop += lr.top - wr.top - wr.height / 2;
              }
            }
          }
        });
      }, { rootMargin: '-80px 0px -70% 0px' });
      heads.forEach(function (h) { sio.observe(h); });
    }

    // side nav (mobile drawer) + keep the active item visible
    var sideNav = $('[data-side-nav]');
    var snToggle = $('[data-toggle-sidenav]');
    if (snToggle) snToggle.addEventListener('click', function (e) { e.stopPropagation(); doc.body.classList.toggle('sidenav-open'); });
    doc.addEventListener('click', function (e) {
      if (doc.body.classList.contains('sidenav-open') && sideNav && !sideNav.contains(e.target)) doc.body.classList.remove('sidenav-open');
    });
    var activeLink = sideNav && $('a.active', sideNav);
    if (activeLink) sideNav.scrollTop = activeLink.offsetTop - sideNav.clientHeight / 2;

    // tools
    var copyLink = $('[data-copy-link]');
    if (copyLink) copyLink.addEventListener('click', function () { copyText(window.location.href.split('#')[0]).then(function () { toast('Link copied'); }); });
    var printBtn = $('[data-print]');
    if (printBtn) printBtn.addEventListener('click', function () {
      $$('details.qa').forEach(function (d) { d.open = true; });
      window.print();
    });
    var qaToggle = $('[data-qa-toggle]');
    if (qaToggle) qaToggle.addEventListener('click', function () {
      var all = $$('details.qa');
      var open = !all.every(function (d) { return d.open; });
      all.forEach(function (d) { d.open = open; });
      $('span', qaToggle).textContent = open ? 'Collapse all answers' : 'Expand all answers';
    });
    // open a Q&A if the URL hash points at it
    if (window.location.hash) {
      var target = doc.getElementById(decodeURIComponent(window.location.hash.slice(1)));
      if (target && target.tagName === 'DETAILS') target.open = true;
    }
  }

  /* ---------------- code blocks: copy + tabs ---------------- */
  $$('.code-block').forEach(function (block) {
    var btn = $('.code-copy', block);
    if (!btn) return;
    btn.addEventListener('click', function () {
      var code = $('code', block).innerText;
      copyText(code).then(function () {
        btn.classList.add('done');
        $('span', btn).textContent = 'Copied';
        setTimeout(function () { btn.classList.remove('done'); $('span', btn).textContent = 'Copy'; }, 1600);
      });
    });
  });
  // group consecutive tabbed code blocks
  $$('.code-block[data-tab]').forEach(function (block) {
    if (block.parentElement.classList.contains('code-tabs-panes')) return;
    var group = [block];
    var n = block.nextElementSibling;
    while (n && n.classList.contains('code-block') && n.hasAttribute('data-tab')) { group.push(n); n = n.nextElementSibling; }
    if (group.length < 2) return;
    var wrap = doc.createElement('div');
    wrap.className = 'code-tabs';
    var barEl = doc.createElement('div');
    barEl.className = 'code-tabs-bar';
    barEl.setAttribute('role', 'tablist');
    var panes = doc.createElement('div');
    panes.className = 'code-tabs-panes';
    block.parentElement.insertBefore(wrap, block);
    group.forEach(function (b, i) {
      var t = doc.createElement('button');
      t.type = 'button';
      t.setAttribute('role', 'tab');
      t.textContent = b.getAttribute('data-tab');
      if (i === 0) t.classList.add('active'); else b.hidden = true;
      t.addEventListener('click', function () {
        $$('button', barEl).forEach(function (x) { x.classList.toggle('active', x === t); });
        group.forEach(function (g) { g.hidden = g !== b; });
      });
      barEl.appendChild(t);
      panes.appendChild(b);
    });
    wrap.appendChild(barEl);
    wrap.appendChild(panes);
  });

  /* ---------------- diagram zoom ---------------- */
  var zoom = $('[data-zoom]');
  var zStage = $('[data-zoom-stage]');
  var zScale = 1, zx = 0, zy = 0, zInner = null;
  function zApply() { if (zInner) zInner.style.transform = 'translate(' + zx + 'px,' + zy + 'px) scale(' + zScale + ')'; $('[data-zoom-reset]').textContent = Math.round(zScale * 100) + '%'; }
  function closeZoom() { if (zoom && !zoom.hidden) { zoom.hidden = true; zStage.innerHTML = ''; doc.body.style.overflow = ''; } }
  $$('.zoom-btn').forEach(function (b) {
    b.addEventListener('click', function () {
      var fig = b.closest('figure');
      var svg = fig && $('svg', fig);
      if (!svg || !zoom) return;
      var clone = svg.cloneNode(true);
      clone.removeAttribute('style');
      clone.removeAttribute('width');
      clone.removeAttribute('height');
      zInner = doc.createElement('div');
      zInner.className = 'zoom-inner';
      zInner.appendChild(clone);
      zStage.innerHTML = '';
      zStage.appendChild(zInner);
      var cap = $('figcaption', fig);
      $('[data-zoom-title]').textContent = cap ? cap.textContent : 'Diagram';
      zScale = 1; zx = 0; zy = 0; zApply();
      zoom.hidden = false;
      doc.body.style.overflow = 'hidden';
    });
  });
  if (zoom) {
    $('[data-zoom-close]').addEventListener('click', closeZoom);
    $('[data-zoom-in]').addEventListener('click', function () { zScale = Math.min(5, zScale * 1.25); zApply(); });
    $('[data-zoom-out]').addEventListener('click', function () { zScale = Math.max(0.3, zScale / 1.25); zApply(); });
    $('[data-zoom-reset]').addEventListener('click', function () { zScale = 1; zx = 0; zy = 0; zApply(); });
    zStage.addEventListener('wheel', function (e) { e.preventDefault(); zScale = Math.min(5, Math.max(0.3, zScale * (e.deltaY < 0 ? 1.1 : 0.9))); zApply(); }, { passive: false });
    var dragging = false, dx = 0, dy = 0;
    zStage.addEventListener('pointerdown', function (e) { dragging = true; dx = e.clientX - zx; dy = e.clientY - zy; zStage.setPointerCapture(e.pointerId); });
    zStage.addEventListener('pointermove', function (e) { if (!dragging) return; zx = e.clientX - dx; zy = e.clientY - dy; zApply(); });
    zStage.addEventListener('pointerup', function () { dragging = false; });
  }

  /* ---------------- back to top ---------------- */
  var toTop = $('[data-to-top]');
  if (toTop) {
    window.addEventListener('scroll', function () { toTop.classList.toggle('show', window.scrollY > 900); }, { passive: true });
    toTop.addEventListener('click', function () { window.scrollTo({ top: 0, behavior: reduceMotion ? 'auto' : 'smooth' }); });
  }

  /* ---------------- Mermaid (lazy, theme-aware) ---------------- */
  var mBlocks = $$('pre.mermaid');
  if (mBlocks.length) {
    mBlocks.forEach(function (b) { b.setAttribute('data-src', b.textContent); });
    var themeVars = function () {
      var light = html.getAttribute('data-theme') === 'light';
      // editorial palettes: warm paper/ink with muted accents (mirrors main.css tokens)
      return light ? {
        darkMode: false, background: '#ffffff', fontFamily: 'Inter, system-ui, sans-serif', fontSize: '15px',
        primaryColor: '#f4ede2', primaryTextColor: '#1d1a16', primaryBorderColor: '#8a6f55', lineColor: '#8a7f72',
        secondaryColor: '#e6eef6', secondaryBorderColor: '#2b6f9e', secondaryTextColor: '#1d1a16',
        tertiaryColor: '#e8f2ea', tertiaryBorderColor: '#2f7d4f', tertiaryTextColor: '#1d1a16',
        noteBkgColor: '#fbf1d6', noteTextColor: '#1d1a16', noteBorderColor: '#c8a24a',
        actorBkg: '#f4ede2', actorBorder: '#8a6f55', actorTextColor: '#1d1a16', actorLineColor: '#b5aa9a',
        signalColor: '#4a443c', signalTextColor: '#1d1a16',
        labelBoxBkgColor: '#f3efe6', labelBoxBorderColor: '#b5aa9a', labelTextColor: '#1d1a16', loopTextColor: '#1d1a16',
        activationBkgColor: '#ead9c6', activationBorderColor: '#8a6f55', sequenceNumberColor: '#ffffff',
        clusterBkg: '#faf8f3', clusterBorder: '#d3c9b6', edgeLabelBackground: '#ffffff', titleColor: '#1d1a16',
        textColor: '#1d1a16', nodeTextColor: '#1d1a16',
        pie1: '#b3401a', pie2: '#2b6f9e', pie3: '#2f7d4f', pie4: '#a8781a', pie5: '#8e4a8f', pie6: '#2f7d72', pie7: '#b8434b', pie8: '#4f56a6',
        pieTitleTextColor: '#1d1a16', pieSectionTextColor: '#ffffff', pieLegendTextColor: '#1d1a16', pieStrokeColor: '#ffffff',
        git0: '#b3401a', git1: '#2b6f9e', git2: '#2f7d4f', git3: '#a8781a',
        cScale0: '#f4ede2', cScale1: '#e6eef6', cScale2: '#e8f2ea', cScale3: '#fbf1d6', cScale4: '#f3e6ef', cScale5: '#e9e8f5'
      } : {
        darkMode: true, background: '#1c1916', fontFamily: 'Inter, system-ui, sans-serif', fontSize: '15px',
        primaryColor: '#2a2420', primaryTextColor: '#efe9df', primaryBorderColor: '#c49a7a', lineColor: '#a39686',
        secondaryColor: '#1f2a33', secondaryBorderColor: '#7fb0d6', secondaryTextColor: '#efe9df',
        tertiaryColor: '#1f2b23', tertiaryBorderColor: '#7cc49a', tertiaryTextColor: '#efe9df',
        noteBkgColor: '#3a3018', noteTextColor: '#f3e2b0', noteBorderColor: '#e0b860',
        actorBkg: '#2a2420', actorBorder: '#c49a7a', actorTextColor: '#efe9df', actorLineColor: '#5c544a',
        signalColor: '#cfc6b8', signalTextColor: '#efe9df', labelBoxBkgColor: '#24201c', labelBoxBorderColor: '#5c544a',
        labelTextColor: '#efe9df', loopTextColor: '#efe9df', activationBkgColor: '#3a2f27', activationBorderColor: '#c49a7a',
        sequenceNumberColor: '#151311', clusterBkg: '#1c1916', clusterBorder: '#4a433b', edgeLabelBackground: '#24201c',
        titleColor: '#efe9df', textColor: '#efe9df', nodeTextColor: '#efe9df',
        pie1: '#ef8a5f', pie2: '#7fb0d6', pie3: '#7cc49a', pie4: '#e0b860', pie5: '#d29bd3', pie6: '#6fc2b5', pie7: '#e8848b', pie8: '#8fa6e0',
        pieTitleTextColor: '#efe9df', pieSectionTextColor: '#151311', pieLegendTextColor: '#efe9df', pieStrokeColor: '#1c1916', pieOuterStrokeColor: '#4a433b',
        git0: '#ef8a5f', git1: '#7fb0d6', git2: '#7cc49a', git3: '#e0b860',
        cScale0: '#2a2420', cScale1: '#1f2a33', cScale2: '#1f2b23', cScale3: '#3a3018', cScale4: '#33222f', cScale5: '#24253a'
      };
    };
    var mermaidLib = null;
    var renderMermaid = function () {
      if (!mermaidLib) return;
      mermaidLib.initialize({
        // deterministic ids: the default Date.now()-based ids can collide when two diagrams
        // render in the same millisecond, and the second diagram is then drawn into the first SVG
        startOnLoad: false, securityLevel: 'loose', theme: 'base', themeVariables: themeVars(), deterministicIds: true,
        flowchart: { curve: 'basis', htmlLabels: true, padding: 12 }, sequence: { mirrorActors: false, showSequenceNumbers: false },
        timeline: { disableMulticolor: false }
      });
      mBlocks.forEach(function (b) { b.removeAttribute('data-processed'); b.innerHTML = escapeHtml(b.getAttribute('data-src')); });
      mermaidLib.run({ nodes: mBlocks, suppressErrors: true }).catch(function (err) { if (window.console) console.warn('Mermaid:', err); });
    };
    var loadMermaid = function () {
      import('https://cdn.jsdelivr.net/npm/mermaid@11/dist/mermaid.esm.min.mjs').then(function (m) {
        mermaidLib = m.default;
        renderMermaid();
        doc.addEventListener('spc:theme', renderMermaid);
      }).catch(function () { mBlocks.forEach(function (b) { b.classList.add('mermaid-offline'); }); });
    };
    if ('IntersectionObserver' in window) {
      var mio = new IntersectionObserver(function (entries) {
        if (entries.some(function (en) { return en.isIntersecting; })) { mio.disconnect(); loadMermaid(); }
      }, { rootMargin: '600px 0px' });
      mBlocks.forEach(function (b) { mio.observe(b); });
    } else loadMermaid();
  }

  /* footer "back to top" link */
  $$('[data-scroll-top]').forEach(function (a) { a.addEventListener('click', function (e) { e.preventDefault(); window.scrollTo({ top: 0, behavior: 'smooth' }); }); });
})();
