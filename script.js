/* =========================================================
   Stagedossier
   - stapel op de beginpagina: kantelen bij hover, banden uitklappen
   - hoofdstukpagina's via #/slug, gevuld uit de <article>'s in index.html
   - overgang: de map wordt uit de stapel getrokken
   - doorscrollen: aan het eind van een map begint de volgende
   ========================================================= */
(function () {
  'use strict';

  var header = document.querySelector('.site-header');
  var headerTitle = document.querySelector('.site-header__title');
  var homeView = document.querySelector('.view--home');
  var chapterView = document.querySelector('.view--chapter');
  var nextWidget = document.querySelector('.next-widget');
  var stack = document.querySelector('.stack');
  if (!stack || !homeView || !chapterView) return;

  var bands = Array.prototype.slice.call(stack.querySelectorAll('.band'));
  var last = bands.length - 1;
  var canHover = window.matchMedia('(hover: hover) and (pointer: fine)');
  var reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)');
  var EASE = 'cubic-bezier(.33, 1, .68, 1)';
  var HOME_TITLE = document.title;

  if ('scrollRestoration' in history) history.scrollRestoration = 'manual';

  /* =======================================================
     Stapel
     ======================================================= */

  var unfolded = last; // de voorste band is standaard open
  var hovered = -1;

  // hoe ver de banden ervoor moeten zakken zodat de omschrijving van band k
  // vrij komt, inclusief de tabs van de volgende band die erboven uitsteken
  function unfoldHeight(k) {
    var desc = bands[k].querySelector('.band__desc');
    var next = bands[k + 1];
    if (!desc || !next) return 0;
    var strip = next.offsetTop - bands[k].offsetTop;
    var tabs = next.querySelector('.band__tabs').offsetHeight;
    return Math.max(0, Math.ceil(desc.offsetTop + desc.offsetHeight + 20 + tabs - strip));
  }

  function setUnfolded(k) {
    unfolded = k;
    var shift = k < last ? unfoldHeight(k) : 0;

    bands.forEach(function (band, i) {
      var open = i === k;
      band.classList.toggle('is-unfolded', open);
      band.querySelector('.band__toggle').setAttribute('aria-expanded', String(open));
      band.style.setProperty('--shift', i > k ? shift + 'px' : '0px');
    });
    stack.style.setProperty('--unfold-h', shift + 'px');
  }

  function setHover(k) {
    if (k === hovered) return;
    hovered = k;
    bands.forEach(function (band, i) {
      band.classList.toggle('is-tilted', k > -1 && i >= k);
      band.classList.toggle('is-hovered', i === k);
    });
  }

  stack.addEventListener('click', function (e) {
    var toggle = e.target.closest('.band__toggle');
    if (toggle) {
      var k = bands.indexOf(toggle.closest('.band'));
      setUnfolded(k === unfolded ? last : k);
      return;
    }
    // een tab: onthoud welke, zodat de router de map uit de stapel kan trekken
    var tab = e.target.closest('.tab');
    if (tab) pending = { mode: 'pull', source: tab };
  });

  stack.addEventListener('pointerover', function (e) {
    if (!canHover.matches || reduceMotion.matches) return;
    var band = e.target.closest('.band');
    setHover(band ? bands.indexOf(band) : -1);
  });
  stack.addEventListener('pointerleave', function () { setHover(-1); });

  // toetsenbord: kantel de band waarin de focus staat
  stack.addEventListener('focusin', function (e) {
    if (reduceMotion.matches) return;
    var band = e.target.closest('.band');
    setHover(band ? bands.indexOf(band) : -1);
  });
  stack.addEventListener('focusout', function (e) {
    if (!stack.contains(e.relatedTarget)) setHover(-1);
  });

  var resizeTimer;
  window.addEventListener('resize', function () {
    clearTimeout(resizeTimer);
    resizeTimer = setTimeout(function () {
      if (!homeView.hidden) setUnfolded(unfolded);
    }, 120);
  });

  /* =======================================================
     Hoofdstukken: gegevens uit de stapel + de <article>'s
     ======================================================= */

  var chapters = [];
  var bySlug = {};

  bands.forEach(function (band, b) {
    var bandName = band.querySelector('.band__toggle span').textContent.trim();
    band.querySelectorAll('.tab').forEach(function (tab) {
      var slug = tab.getAttribute('href').replace(/^#\/?/, '');
      var article = document.getElementById(slug);
      if (!article) return;
      var style = getComputedStyle(tab);
      var ch = {
        slug: slug,
        index: chapters.length,
        band: bandName,
        bandIndex: b,
        tab: tab.querySelector('.tab__label').textContent.trim(),
        title: article.querySelector('h2').textContent.trim(),
        color: style.getPropertyValue('--c').trim(),
        text: style.getPropertyValue('--t').trim() || '#fdfaf7',
        article: article,
        tabEl: tab
      };
      chapters.push(ch);
      bySlug[slug] = ch;
    });
  });

  chapters.forEach(function (ch) {
    ch.siblings = chapters.filter(function (o) { return o.bandIndex === ch.bandIndex; });
    ch.next = chapters[ch.index + 1] || null;
  });

  /* =======================================================
     Opbouw van een hoofdstukpagina
     ======================================================= */

  function esc(s) {
    return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  }

  function pad(n) { return (n < 10 ? '0' : '') + n; }

  function colorVars(ch) {
    return '--c:' + ch.color + ';--t:' + ch.text;
  }

  // titel in losse letters, zodat ze één voor één kunnen opkomen
  function splitTitle(text) {
    var d = 0;
    return text.split(' ').map(function (word) {
      var chars = Array.from(word).map(function (c) {
        return '<span class="ch" style="--d:' + (d++) + '">' + esc(c) + '</span>';
      }).join('');
      return '<span class="w">' + chars + '</span>';
    }).join(' ');
  }

  function headHTML(ch, teaser) {
    var home = teaser ? '<span>Dossier</span>' : '<a href="#/">Dossier</a>';
    var tag = teaser ? 'p' : 'h1';
    return '<div class="cv-head">' +
      '<p class="cv-crumbs">' + home + '<span>' + esc(ch.band) + '</span><span>' + pad(ch.index + 1) + ' / ' + pad(chapters.length) + '</span></p>' +
      '<' + tag + ' class="cv-title"' + (teaser ? '' : ' tabindex="-1"') + '>' +
        '<span class="sr-only">' + esc(ch.title) + '</span>' +
        '<span aria-hidden="true">' + splitTitle(ch.title) + '</span>' +
      '</' + tag + '>' +
    '</div>';
  }

  function vtabsHTML(ch, teaser) {
    var items = ch.siblings.map(function (s) {
      var attrs = ' class="vtab" style="' + colorVars(s) + '"';
      if (teaser) return '<span' + attrs + '>' + esc(s.tab) + '</span>';
      return '<a' + attrs + ' href="#/' + s.slug + '"' + (s === ch ? ' aria-current="page"' : '') + '>' + esc(s.tab) + '</a>';
    }).join('');
    return teaser
      ? '<div class="vtabs">' + items + '</div>'
      : '<nav class="vtabs" aria-label="Mappen in ' + esc(ch.band) + '">' + items + '</nav>';
  }

  // onder de map: het begin van de volgende, zodat je kunt doorscrollen
  function afterHTML(ch) {
    var next = ch.next;
    if (!next) {
      return '<div class="cv-end">' +
        '<p class="cv-end__title">Einde van het dossier</p>' +
        '<a class="cv-end__btn" href="#/">Naar het overzicht →</a>' +
      '</div>';
    }
    return '<a class="cv-next" href="#/' + next.slug + '" style="' + colorVars(next) + '" aria-hidden="true" tabindex="-1">' +
      headHTML(next, true) +
      '<div class="cv-main"><div class="folder"><div class="sheet"></div></div>' + vtabsHTML(next, true) + '</div>' +
    '</a>';
  }

  function renderChapter(ch) {
    var a = ch.article;
    chapterView.setAttribute('style', colorVars(ch));
    chapterView.innerHTML =
      headHTML(ch, false) +
      '<div class="cv-main">' +
        '<div class="folder">' +
          '<div class="sheet"><div class="sheet__aside"></div><div class="sheet__text"></div></div>' +
          '<section class="collage" aria-label="Notities"></section>' +
        '</div>' +
        vtabsHTML(ch, false) +
      '</div>' +
      afterHTML(ch);

    var aside = chapterView.querySelector('.sheet__aside');
    var textBox = chapterView.querySelector('.sheet__text');
    var collage = chapterView.querySelector('.collage');
    var photos = Array.prototype.slice.call(a.querySelectorAll('.photo'));
    var meta = a.querySelector('.meta');
    var text = a.querySelector('.text');

    if (photos[0]) aside.appendChild(photos[0].cloneNode(true));
    if (meta) aside.appendChild(meta.cloneNode(true));

    if (text) {
      Array.prototype.forEach.call(text.children, function (node) {
        textBox.appendChild(node.cloneNode(true));
      });
      // tussenkoppen worden h2 onder de h1 van de pagina
      textBox.querySelectorAll('h3').forEach(function (h3) {
        var h2 = document.createElement('h2');
        h2.innerHTML = h3.innerHTML;
        h3.replaceWith(h2);
      });
    }

    var items = Array.prototype.slice.call(a.querySelectorAll('.notes > .note'));
    photos.slice(1).forEach(function (photo, i) {
      items.splice(1 + i * 2, 0, photo);
    });
    items.forEach(function (item) { collage.appendChild(item.cloneNode(true)); });
    if (!items.length) collage.remove();
  }

  function renderNextWidget(ch) {
    var next = ch.next;
    var href = next ? '#/' + next.slug : '#/';
    var name = next ? next.title : 'Einde van het dossier';
    var band = next ? next.band : 'Terug naar het begin';
    var label = next ? 'Volgende →' : 'Naar het overzicht →';

    nextWidget.setAttribute('style', next ? colorVars(next) : '--c:#fdfaf7;--t:#141414');
    nextWidget.innerHTML =
      '<a class="next-widget__card" href="' + href + '" tabindex="-1" aria-hidden="true">' +
        '<span class="next-widget__name">' + esc(name) + '</span>' +
        '<span class="next-widget__band">' + esc(band) + '</span>' +
      '</a>' +
      '<a class="next-widget__btn" href="' + href + '"' + (next ? ' aria-label="Volgende map: ' + esc(next.title) + '"' : '') + '>' +
        '<span class="next-widget__fill" aria-hidden="true"></span>' +
        '<span class="next-widget__label next-widget__label--default">' + label + '</span>' +
        '<span class="next-widget__label next-widget__label--near" aria-hidden="true">Blijf scrollen voor de volgende map</span>' +
      '</a>';
  }

  /* =======================================================
     Router
     ======================================================= */

  var current = null;   // null = beginpagina
  var pending = null;   // hoe de volgende navigatie moet verlopen
  var homeScroll = 0;
  var navToken = 0;
  var cleanups = [];
  var continuing = false;
  var firstRoute = true;

  // stop een lopende overgang als er opnieuw genavigeerd wordt
  function cancelTransition() {
    navToken++;
    cleanups.splice(0).forEach(function (fn) { fn(); });
  }

  function later(fn, ms) {
    var id = setTimeout(fn, ms);
    cleanups.push(function () { clearTimeout(id); fn(); });
  }

  function route() {
    var p = pending;
    pending = null;
    var slug = location.hash.replace(/^#\/?/, '');

    if (slug === '') return showHome();
    if (bySlug[slug]) return showChapter(bySlug[slug], p);
    // onbekende route: terug naar het overzicht; gewone ankers (#main) negeren
    if (location.hash.indexOf('#/') === 0) {
      history.replaceState(null, '', '#/');
      showHome();
    }
  }

  function showHome() {
    cancelTransition();
    var from = current;
    current = null;

    document.title = HOME_TITLE;
    header.classList.remove('is-titled');
    nextWidget.hidden = true;
    nextWidget.classList.remove('is-visible', 'is-near');
    chapterView.hidden = true;
    chapterView.innerHTML = '';
    homeView.hidden = false;
    setHover(-1);
    setUnfolded(unfolded);

    if (from) {
      window.scrollTo(0, homeScroll);
      if (!reduceMotion.matches) {
        homeView.classList.add('is-returning');
        later(function () { homeView.classList.remove('is-returning'); }, 1400);
      }
      from.tabEl.focus({ preventScroll: true });
    }
  }

  function showChapter(ch, p) {
    cancelTransition();
    var fromHome = current === null && !homeView.hidden;
    if (fromHome) homeScroll = window.scrollY;
    current = ch;

    document.title = ch.title + ' · Stagedossier';
    headerTitle.textContent = ch.title;

    if (p && p.mode === 'pull' && fromHome && !reduceMotion.matches) {
      pullOut(ch, p.source);
    } else if (p && p.mode === 'continue') {
      mount(ch, 'is-continuing');
      later(function () { chapterView.classList.remove('is-continuing'); }, 900);
      focusTitle();
    } else {
      mount(ch, 'is-entering is-landing');
      later(function () { chapterView.classList.remove('is-entering', 'is-landing'); }, 1300);
      if (!firstRoute) focusTitle();
    }
  }

  function mount(ch, classes) {
    renderChapter(ch);
    renderNextWidget(ch);
    homeView.hidden = true;
    chapterView.hidden = false;
    chapterView.className = 'view view--chapter ' + classes;
    nextWidget.hidden = false;
    continuing = false;
    window.scrollTo(0, 0);
    updateScroll();
  }

  function focusTitle() {
    var h1 = chapterView.querySelector('h1.cv-title');
    if (h1) h1.focus({ preventScroll: true });
  }

  /* ---------- de map uit de stapel trekken ---------- */
  function pullOut(ch, tab) {
    var token = navToken;
    var band = tab.closest('.band');
    var br = band.getBoundingClientRect();
    var tr = tab.getBoundingClientRect();
    var lift = 'translateY(-5vh) rotateX(12deg) rotate(-2.5deg)';

    setHover(-1);

    var overlay = document.createElement('div');
    overlay.className = 'pull';
    overlay.setAttribute('aria-hidden', 'true');
    overlay.setAttribute('style', colorVars(ch));

    var folder = document.createElement('div');
    folder.className = 'pull__folder';
    folder.style.left = br.left + 'px';
    folder.style.top = br.top + 'px';
    folder.style.width = br.width + 'px';
    folder.style.height = (window.innerHeight + 200) + 'px';

    var clone = tab.cloneNode(true);
    clone.removeAttribute('href');
    clone.style.left = (tr.left - br.left) + 'px';
    folder.appendChild(clone);
    overlay.appendChild(folder);
    document.body.appendChild(overlay);

    var anims = [];
    cleanups.push(function () {
      anims.forEach(function (a) { a.cancel(); });
      overlay.remove();
      homeView.style.opacity = '';
      chapterView.classList.remove('is-arriving', 'is-entering', 'is-landing');
    });

    anims.push(homeView.animate([{ opacity: 1 }, { opacity: 0 }], { duration: 380, easing: 'ease-out', fill: 'forwards' }));
    var liftAnim = folder.animate([{ transform: 'none' }, { transform: lift }], { duration: 480, easing: EASE, fill: 'forwards' });
    anims.push(liftAnim);

    liftAnim.finished.then(function () {
      if (token !== navToken) return;
      mount(ch, 'is-arriving is-entering');

      var target = chapterView.querySelector('.cv-main .folder').getBoundingClientRect();
      var fly = folder.animate([
        { left: br.left + 'px', top: br.top + 'px', width: br.width + 'px', transform: lift },
        { left: target.left + 'px', top: target.top + 'px', width: target.width + 'px', transform: 'none', borderTopLeftRadius: '0px' }
      ], { duration: 720, easing: EASE, fill: 'forwards' });
      anims.push(fly);
      anims.push(clone.animate([{ opacity: 1 }, { opacity: 0 }], { duration: 320, fill: 'forwards' }));

      return fly.finished.then(function () {
        if (token !== navToken) return;
        chapterView.classList.remove('is-arriving');
        chapterView.classList.add('is-landing');
        overlay.remove();
        focusTitle();
        later(function () { chapterView.classList.remove('is-entering', 'is-landing'); }, 1100);
      });
    }).catch(function () { /* geannuleerd door een nieuwe navigatie */ });
  }

  /* =======================================================
     Scrollen in een map
     ======================================================= */

  var ticking = false;

  function updateScroll() {
    ticking = false;
    if (!current) return;

    var title = chapterView.querySelector('h1.cv-title');
    var past = !!title && title.getBoundingClientRect().bottom < header.offsetHeight;
    header.classList.toggle('is-titled', past);
    nextWidget.classList.toggle('is-visible', past);

    var teaser = chapterView.querySelector('.cv-next');
    if (!teaser) return;
    var top = teaser.getBoundingClientRect().top;
    var progress = Math.min(1, Math.max(0, 1 - top / window.innerHeight));
    nextWidget.style.setProperty('--p', progress.toFixed(3));
    nextWidget.classList.toggle('is-near', progress > 0.05);

    // de volgende map staat bovenaan: wissel naadloos door
    if (top <= 0 && !continuing && current.next) {
      continuing = true;
      pending = { mode: 'continue' };
      location.hash = '#/' + current.next.slug;
    }
  }

  window.addEventListener('scroll', function () {
    if (!ticking) {
      ticking = true;
      requestAnimationFrame(updateScroll);
    }
  }, { passive: true });

  /* =======================================================
     Start
     ======================================================= */

  window.addEventListener('hashchange', route);
  setUnfolded(unfolded);
  route();
  firstRoute = false;
})();
