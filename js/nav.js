(function () {
  const nav = document.querySelector('nav');
  const navLinks = document.querySelector('.nav-links');
  if (!nav || !navLinks || !navLinks.children.length) return;

  const btn = document.createElement('button');
  btn.className = 'hamburger';
  btn.setAttribute('aria-label', 'Menu');
  btn.innerHTML = '<svg viewBox="0 0 24 24"><line x1="3" y1="7" x2="21" y2="7"/><line x1="3" y1="12" x2="21" y2="12"/><line x1="3" y1="17" x2="21" y2="17"/></svg>';
  nav.appendChild(btn);

  btn.addEventListener('click', e => {
    e.stopPropagation();
    navLinks.classList.toggle('mobile-open');
  });

  document.addEventListener('click', () => navLinks.classList.remove('mobile-open'));
  navLinks.addEventListener('click', e => e.stopPropagation());

  btn.addEventListener('mouseenter', () => document.body.classList.add('hovering'));
  btn.addEventListener('mouseleave', () => document.body.classList.remove('hovering'));
})();
