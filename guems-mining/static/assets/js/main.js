/* GUEM'S MINING SARL — scripts du site (sans dépendance). */
(function () {
  'use strict';

  var store = {
    set: function (k, v) { try { localStorage.setItem(k, v); } catch (e) { /* stockage indisponible */ } }
  };

  /* ------------------------------------------------ En-tête au défilement */
  var header = document.querySelector('[data-header]');
  if (header) {
    var onScroll = function () { header.classList.toggle('is-scrolled', window.scrollY > 8); };
    onScroll();
    window.addEventListener('scroll', onScroll, { passive: true });
  }

  /* ------------------------------------------------ Menu mobile */
  var toggle = document.querySelector('[data-menu-toggle]');
  var nav = document.querySelector('[data-nav]');
  if (toggle && nav) {
    var label = toggle.querySelector('.sr-only');
    var setOpen = function (open, restoreFocus) {
      toggle.setAttribute('aria-expanded', String(open));
      nav.classList.toggle('is-open', open);
      document.body.classList.toggle('menu-open', open);
      label.textContent = toggle.getAttribute(open ? 'data-label-close' : 'data-label-open');
      if (open) {
        var first = nav.querySelector('a');
        if (first) first.focus();
      } else if (restoreFocus) {
        toggle.focus();
      }
    };
    toggle.addEventListener('click', function () {
      setOpen(toggle.getAttribute('aria-expanded') !== 'true', false);
    });
    document.addEventListener('keydown', function (e) {
      if (e.key === 'Escape' && nav.classList.contains('is-open')) setOpen(false, true);
    });
    nav.addEventListener('click', function (e) {
      if (e.target.closest('a')) setOpen(false, false);
    });
    window.matchMedia('(min-width: 981px)').addEventListener('change', function (m) {
      if (m.matches) setOpen(false, false);
    });
  }

  /* ------------------------------------------------ Langue mémorisée */
  document.querySelectorAll('[data-lang]').forEach(function (a) {
    a.addEventListener('click', function () { store.set('gm-lang', a.getAttribute('data-lang')); });
  });

  /* ------------------------------------------------ Apparition au défilement */
  var reveals = document.querySelectorAll('.reveal');
  if ('IntersectionObserver' in window && !window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
    var io = new IntersectionObserver(function (entries) {
      entries.forEach(function (en) {
        if (en.isIntersecting) { en.target.classList.add('is-visible'); io.unobserve(en.target); }
      });
    }, { rootMargin: '0px 0px -8% 0px', threshold: 0.08 });
    reveals.forEach(function (el) { io.observe(el); });
  } else {
    reveals.forEach(function (el) { el.classList.add('is-visible'); });
  }

  /* ------------------------------------------------ Filtres des actualités */
  var filters = document.querySelector('[data-filters]');
  if (filters) {
    var cards = document.querySelectorAll('[data-news-grid] [data-category]');
    var empty = document.querySelector('[data-filter-empty]');
    var apply = function (cat) {
      var shown = 0;
      cards.forEach(function (c) {
        var ok = !cat || c.getAttribute('data-category') === cat;
        c.hidden = !ok;
        if (ok) { shown++; c.classList.add('is-visible'); }
      });
      filters.querySelectorAll('[data-filter]').forEach(function (b) {
        b.setAttribute('aria-pressed', String(b.getAttribute('data-filter') === cat));
      });
      if (empty) empty.hidden = shown > 0;
    };
    filters.addEventListener('click', function (e) {
      var b = e.target.closest('[data-filter]');
      if (!b) return;
      var cat = b.getAttribute('data-filter');
      apply(cat);
      var url = new URL(location.href);
      if (cat) url.searchParams.set('categorie', cat); else url.searchParams.delete('categorie');
      history.replaceState(null, '', url);
    });
    var initial = new URLSearchParams(location.search).get('categorie');
    if (initial && filters.querySelector('[data-filter="' + CSS.escape(initial) + '"]')) apply(initial);
  }

  /* ------------------------------------------------ Copier le lien */
  document.querySelectorAll('[data-copy]').forEach(function (btn) {
    btn.addEventListener('click', function () {
      var status = btn.closest('.share').querySelector('.copy-status');
      var done = function () { status.textContent = btn.getAttribute('data-copied'); setTimeout(function () { status.textContent = ''; }, 3000); };
      if (navigator.clipboard) navigator.clipboard.writeText(btn.getAttribute('data-copy')).then(done, function () {});
    });
  });

  /* ------------------------------------------------ Formulaire de contact */
  var form = document.querySelector('[data-contact-form]');
  if (!form) return;

  var i18n = JSON.parse(document.getElementById('form-i18n').textContent);
  var statusBox = document.querySelector('[data-form-status]');
  var submit = form.querySelector('[type="submit"]');
  var submitHtml = submit.innerHTML;
  var ts = form.querySelector('[data-ts]');
  if (ts) ts.value = String(Date.now());

  var showStatus = function (type, key) {
    statusBox.hidden = false;
    statusBox.className = 'form-status ' + (type === 'success' ? 'is-success' : 'is-error');
    statusBox.textContent = i18n.status[key] || i18n.status.error;
    statusBox.focus();
  };

  // Retour du serveur sans JavaScript actif (redirection ?envoi=...).
  var back = new URLSearchParams(location.search).get('envoi');
  if (back && i18n.status[back]) showStatus(back === 'sent' ? 'success' : 'error', back);

  var emailRe = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;
  var phoneRe = /^[0-9+()\s.\-]{6,40}$/;
  var rules = {
    name: function (v) { return v.trim().length >= 2; },
    email: function (v) { return emailRe.test(v.trim()); },
    phone: function (v) { return phoneRe.test(v.trim()) && v.replace(/\D/g, '').length >= 6; },
    subject: function (v) { return v !== ''; },
    message: function (v) { return v.trim().length >= 10; },
    consent: function (v, el) { return el.checked; }
  };

  var validateField = function (name) {
    var el = form.elements[name];
    var wrap = form.querySelector('[data-field="' + name + '"]');
    var err = document.getElementById('e-' + name);
    var ok = rules[name](el.value, el);
    wrap.classList.toggle('has-error', !ok);
    el.setAttribute('aria-invalid', String(!ok));
    err.hidden = ok;
    err.textContent = ok ? '' : i18n.errors[name];
    return ok;
  };

  Object.keys(rules).forEach(function (name) {
    var el = form.elements[name];
    // Revalidation pendant la saisie (et non au « blur ») : la disparition d'un message
    // d'erreur ne doit pas décaler la mise en page au moment d'un clic.
    el.addEventListener('input', function () { if (el.getAttribute('aria-invalid')) validateField(name); });
    el.addEventListener('change', function () { if (el.getAttribute('aria-invalid')) validateField(name); });
  });

  form.addEventListener('submit', function (e) {
    e.preventDefault();
    var firstInvalid = null;
    Object.keys(rules).forEach(function (name) {
      if (!validateField(name) && !firstInvalid) firstInvalid = form.elements[name];
    });
    if (firstInvalid) {
      statusBox.hidden = false;
      statusBox.className = 'form-status is-error';
      statusBox.textContent = i18n.errors.summary;
      firstInvalid.focus();
      return;
    }

    submit.disabled = true;
    submit.textContent = submit.getAttribute('data-sending');

    fetch(form.action, {
      method: 'POST',
      body: new FormData(form),
      headers: { Accept: 'application/json' }
    }).then(function (res) {
      return res.json().catch(function () { return {}; }).then(function (data) {
        // Le succès n'est affiché que si le serveur confirme réellement l'envoi.
        if (res.ok && data && data.ok === true) {
          showStatus('success', 'sent');
          form.reset();
          if (ts) ts.value = String(Date.now());
        } else {
          showStatus('error', (data && data.error) || (res.status === 503 ? 'unavailable' : 'error'));
        }
      });
    }).catch(function () {
      showStatus('error', 'error');
    }).then(function () {
      submit.disabled = false;
      submit.innerHTML = submitHtml;
    });
  });
})();
