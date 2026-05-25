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

  /* ---------- Footer dynamic year ---------- */
  document.querySelectorAll('[data-current-year]').forEach(function (el) {
    el.textContent = new Date().getFullYear();
  });

  /* ---------- Trial / setup form (used on index) ---------- */
  var form = document.getElementById('trial-form');
  if (form) {
    form.addEventListener('submit', function (event) {
      event.preventDefault();
      var nameInput = document.getElementById('full-name');
      var emailInput = document.getElementById('work-email');
      var name = nameInput ? nameInput.value.trim() : '';
      var email = emailInput ? emailInput.value.trim() : '';
      if (!name || !email) {
        alert('Please enter your full name and work email.');
        return;
      }
      var subject = encodeURIComponent('Setup link request');
      var body = encodeURIComponent(
        'Hi,\n\nPlease send a setup link for Missed Calls Dental.\n\n' +
        'Name: ' + name + '\n' +
        'Work email: ' + email + '\n\nThank you.'
      );
      // Trigger mail client in a way that does not navigate the current page.
      var mailLink = document.createElement('a');
      mailLink.href = 'mailto:support@missedcallsdental.com?subject=' + subject + '&body=' + body;
      mailLink.style.display = 'none';
      document.body.appendChild(mailLink);
      mailLink.click();
      document.body.removeChild(mailLink);
      // Show the branded confirmation page.
      window.setTimeout(function () {
        window.location.href = 'confirm.html';
      }, 180);
    });
  }
})();
