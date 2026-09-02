// Floating page TOC — highlight the section currently in view.
(function () {
  var toc = document.querySelector(".page-toc");
  if (!toc) return;
  var links = Array.prototype.slice.call(toc.querySelectorAll("a"));
  var heads = links
    .map(function (a) { return document.getElementById(decodeURIComponent(a.hash.slice(1))); })
    .filter(Boolean);
  function update() {
    var cur = heads[0];
    for (var i = 0; i < heads.length; i++) {
      if (heads[i].getBoundingClientRect().top <= 130) cur = heads[i];
      else break;
    }
    links.forEach(function (a) {
      a.classList.toggle("active", !!cur && a.hash === "#" + cur.id);
    });
  }
  addEventListener("scroll", update, { passive: true });
  addEventListener("resize", update, { passive: true });
  update();
})();
