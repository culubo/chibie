// chibie: nav shadow on scroll + fade-in of .reveal elements
(function () {
  var nav = document.querySelector('.nav');
  function onScroll() { if (nav) nav.classList.toggle('scrolled', scrollY > 8); }
  addEventListener('scroll', onScroll, { passive: true }); onScroll();

  var els = document.querySelectorAll('.reveal');
  if (!('IntersectionObserver' in window)) { els.forEach(function (el) { el.classList.add('in'); }); return; }
  var io = new IntersectionObserver(function (entries) {
    entries.forEach(function (e) { if (e.isIntersecting) { e.target.classList.add('in'); io.unobserve(e.target); } });
  }, { rootMargin: '0px 0px -8% 0px' });
  els.forEach(function (el) { io.observe(el); });
})();

// Count-up for big numbers (.big): every number in the text rolls up from 0 when it scrolls into view.
(function () {
  var els = document.querySelectorAll('.big');
  if (!els.length || matchMedia('(prefers-reduced-motion: reduce)').matches || !('IntersectionObserver' in window)) return;
  els.forEach(function (el) {
    var text = el.textContent, parts = text.split(/(\d+(?:\.\d+)?)/);
    if (parts.length < 2) return;
    el.setAttribute('aria-label', text);
    var render = function (t) {
      el.textContent = parts.map(function (p, i) {
        if (i % 2 === 0) return p;
        var dec = (p.split('.')[1] || '').length;
        return (parseFloat(p) * t).toFixed(dec);
      }).join('');
    };
    render(0);
    var io = new IntersectionObserver(function (en) {
      if (!en[0].isIntersecting) return;
      io.disconnect();
      var start = performance.now(), dur = 1400;
      (function step(now) {
        var k = Math.min(1, (now - start) / dur), ease = 1 - Math.pow(1 - k, 3);
        render(ease);
        if (k < 1) requestAnimationFrame(step); else el.textContent = text;
      })(start);
    }, { rootMargin: '0px 0px -10% 0px' });
    io.observe(el);
  });
})();
