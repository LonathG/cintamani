// Product detail pages: add-to-cart feedback (placeholder until a real cart exists)
document.addEventListener("click", function (e) {
  var btn = e.target.closest(".art_cart");
  if (!btn || btn.classList.contains("is-added")) return;
  e.preventDefault();
  e.stopPropagation();

  var label = btn.querySelector(".art_cart_label");
  var original = label.textContent;
  btn.classList.add("is-added");
  label.textContent = "Added to cart";

  setTimeout(function () {
    label.textContent = original;
    btn.classList.remove("is-added");
  }, 2200);
});
