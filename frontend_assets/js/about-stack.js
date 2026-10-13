// About page "A (Journey) Through Time" image stack.
// The hosted template script (lumen-artspace.vercel.app/dist/main.js) offsets the stack by
// 30px per image, which was tuned for 5 images; with more images the stack starts lower and
// smaller. Once that script has set the stack up, rebuild the same animation with the step
// scaled so the total offset stays at the original 120px whatever the number of images.
(function () {
  var TOTAL_OFFSET = 120; // 5 images x 30px steps in the original design

  function rebuild(slide, pin, medias) {
    var n = medias.length;
    var step = TOTAL_OFFSET / (n - 1);

    ScrollTrigger.getAll().forEach(function (st) {
      var anim = st.animation;
      if (!anim || !anim.getChildren) return;
      var ours = anim.getChildren().some(function (tw) {
        return tw.targets && tw.targets().some(function (t) { return medias.indexOf(t) !== -1; });
      });
      if (ours) { anim.kill(); st.kill(); }
    });
    gsap.killTweensOf(medias);

    var segment = (pin.clientHeight - window.innerHeight) / n;
    gsap.set(medias, { y: step * (n - 1), z: -step * (n - 1), yPercent: 0, scale: 1, rotation: 0 });
    medias.forEach(function (el, idx) {
      var tl = gsap.timeline({
        scrollTrigger: {
          trigger: pin,
          start: "top top+=" + segment * idx,
          end: "bottom bottom+=" + segment * idx,
          scrub: 0.5,
        },
      });
      for (var k = 0; k < n - 1; k++) {
        tl.to(el, { y: "-=" + step, z: "+=" + step, ease: "back.inOut(3)" });
      }
      tl.to(el, { yPercent: -80, y: "-50vh", scale: 1.2, rotation: 50 * (Math.random() - 0.5), ease: "power4.in" });
    });
    ScrollTrigger.refresh();
  }

  window.addEventListener("load", function () {
    var slide = document.querySelector(".about_slide");
    if (!slide) return;
    var pin = slide.querySelector(".about_pin_height");
    var medias = Array.prototype.slice.call(slide.querySelectorAll(".about_media"));
    if (medias.length <= 5) return; // original tuning already fits

    // Wait for the template script to apply its own starting offset, then replace it
    var tries = 0;
    var timer = setInterval(function () {
      tries++;
      var ready = window.gsap && window.ScrollTrigger &&
        Math.round(gsap.getProperty(medias[0], "y")) === 30 * (medias.length - 1);
      if (ready) {
        clearInterval(timer);
        rebuild(slide, pin, medias);
      } else if (tries > 100) {
        clearInterval(timer);
      }
    }, 100);
  });
})();
