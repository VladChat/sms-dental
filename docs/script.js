(function () {
  'use strict';

  /* ---------- Theme toggle ---------- */
  function applyTheme(theme) {
    document.documentElement.setAttribute('data-theme', theme);
    try { localStorage.setItem('theme', theme); } catch (e) {}
    document.querySelectorAll('.theme-toggle').forEach(function (btn) {
      var next = theme === 'dark' ? 'light' : 'dark';
      var label = 'Switch to ' + next + ' theme';
      btn.setAttribute('aria-label', label);
      btn.setAttribute('title', label);
    });
  }

  function currentTheme() {
    return document.documentElement.getAttribute('data-theme') === 'light' ? 'light' : 'dark';
  }

  document.querySelectorAll('.theme-toggle').forEach(function (btn) {
    var label = 'Switch to ' + (currentTheme() === 'dark' ? 'light' : 'dark') + ' theme';
    btn.setAttribute('aria-label', label);
    btn.setAttribute('title', label);
    btn.addEventListener('click', function () {
      applyTheme(currentTheme() === 'dark' ? 'light' : 'dark');
    });
  });

  /* ---------- Mobile menu toggle ---------- */
  var toggle = document.querySelector('.menu-toggle');
  var nav = document.getElementById('primary-nav');
  function closeMenu() {
    if (toggle) toggle.setAttribute('aria-expanded', 'false');
  }
  if (toggle && nav) {
    toggle.addEventListener('click', function () {
      var expanded = toggle.getAttribute('aria-expanded') === 'true';
      toggle.setAttribute('aria-expanded', expanded ? 'false' : 'true');
    });
    document.addEventListener('keydown', function (e) {
      if (e.key === 'Escape' && toggle.getAttribute('aria-expanded') === 'true') {
        closeMenu();
        toggle.focus();
      }
    });
    document.addEventListener('click', function (e) {
      if (toggle.getAttribute('aria-expanded') !== 'true') return;
      if (toggle.contains(e.target) || nav.contains(e.target)) return;
      closeMenu();
    });
  }

  /* ---------- Anchor scroll offset (accounts for sticky header) ---------- */
  function scrollToAnchor(hash) {
    var target = document.querySelector(hash);
    if (!target) return false;
    var header = document.querySelector('.site-header');
    var headerH = header ? header.getBoundingClientRect().height : 0;
    var top = target.getBoundingClientRect().top + window.pageYOffset - headerH - 14;
    window.scrollTo({ top: Math.max(0, top), behavior: 'smooth' });
    return true;
  }

  document.querySelectorAll('a[href^="#"]').forEach(function (a) {
    var href = a.getAttribute('href');
    if (!href || href.length < 2) return;
    a.addEventListener('click', function (e) {
      var target = document.querySelector(href);
      if (!target) return;
      e.preventDefault();
      closeMenu();
      // brief wait so the menu collapses before scrolling
      window.setTimeout(function () {
        scrollToAnchor(href);
        if (history.replaceState) {
          history.replaceState(null, '', href);
        }
      }, 20);
    });
  });

  // Correct scroll offset when the page is opened with a hash already in the
  // URL (e.g. arriving from sign-in.html → index.html#start-trial) and when
  // the hash changes for any other reason.
  function correctHashScroll() {
    var hash = window.location.hash;
    if (!hash || hash.length < 2) return;
    // Run after layout so sticky-header height is measurable.
    window.setTimeout(function () { scrollToAnchor(hash); }, 60);
  }
  if (window.location.hash && window.location.hash.length > 1) {
    if (document.readyState === 'complete') {
      correctHashScroll();
    } else {
      window.addEventListener('load', correctHashScroll, { once: true });
    }
  }
  window.addEventListener('hashchange', correctHashScroll);

  /* ---------- Footer dynamic year ---------- */
  document.querySelectorAll('[data-current-year]').forEach(function (el) {
    el.textContent = new Date().getFullYear();
  });

  /* ---------- Sign-in form (front-end demo: always show inline error) ---------- */
  var signinForm = document.getElementById('signin-form');
  if (signinForm) {
    var signinError = document.getElementById('signin-error');
    signinForm.addEventListener('submit', function (event) {
      event.preventDefault();
      if (signinError) {
        signinError.hidden = false;
      }
    });
  }

  /* ---------- Setup-request form (POSTs to app.missedcallsdental.com) ---------- */
  var form = document.getElementById('trial-form');
  if (form) {
    var trialError = document.getElementById('trial-error');
    function setTrialError(message) {
      if (!trialError) return;
      trialError.textContent = message || '';
      trialError.hidden = !message;
    }
    var submitBtn = form.querySelector('button[type="submit"]');
    var submitDefaultLabel = submitBtn ? submitBtn.textContent : 'Send setup link';
    function setSubmitting(state) {
      if (!submitBtn) return;
      submitBtn.disabled = !!state;
      submitBtn.textContent = state ? 'Sending…' : submitDefaultLabel;
    }

    var emailInput = document.getElementById('work-email');
    if (emailInput) {
      emailInput.addEventListener('input', function () {
        setTrialError('');
      });
    }

    form.addEventListener('submit', function (event) {
      event.preventDefault();
      var email = emailInput ? emailInput.value.trim() : '';
      if (!email) {
        setTrialError('Please enter your work email.');
        return;
      }
      setTrialError('');
      setSubmitting(true);

      var actionUrl = form.getAttribute('action') || '';
      var confirmUrl = form.getAttribute('data-confirm-url') || 'confirm.html';

      fetch(actionUrl, {
        method: 'POST',
        mode: 'cors',
        credentials: 'omit',
        headers: { 'content-type': 'application/json', accept: 'application/json' },
        body: JSON.stringify({ work_email: email }),
      })
        .then(function (res) {
          return res.json().catch(function () { return null; }).then(function (data) {
            return { ok: res.ok, status: res.status, data: data };
          });
        })
        .then(function (result) {
          if (!result.ok) {
            var msg = (result.data && result.data.error && result.data.error.message)
              || 'We could not send your setup link right now. Please try again in a moment.';
            setTrialError(msg);
            setSubmitting(false);
            return;
          }
          var nextUrl = (result.data && result.data.confirm_url) || confirmUrl;
          window.location.href = nextUrl;
        })
        .catch(function () {
          setTrialError('We could not reach the server. Please try again in a moment.');
          setSubmitting(false);
        });
    });
  }
})();
