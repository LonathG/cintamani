// Cintamani shop data — the single source of truth for products, sizes, delivery and
// bank-transfer details. Loaded in the browser (window.CINTAMANI_SHOP) and imported by
// the order API (netlify/functions/api.mjs), so prices are always checked server-side.
(function (root, data) {
  if (typeof module === "object" && module.exports) module.exports = data;
  else root.CINTAMANI_SHOP = data;
})(this, {
  currency: "LKR",

  // Finished garments — chosen by size only (no colour option).
  sizes: ["XS", "S", "M", "L", "XL"],
  maxQtyPerLine: 10,

  // TODO(client): confirm delivery charge. Flat island-wide fee in LKR.
  deliveryFee: 450,

  // TODO(client): replace with the real account the client wants customers to pay into.
  bank: {
    bankName: "Commercial Bank of Ceylon PLC",
    accountName: "Cintamani Linens",
    accountNumber: "0000 0000 0000",
    branch: "Colombo Fort",
  },

  // Every piece can be made in any of these colours (shown as swatches on the product pages).
  // TODO(client): placeholder linen tones — replace with the client's 24 colours (names + hex,
  // or add `image: "Images/Colours/<file>.jpg"` to show a real fabric photo instead of a flat tone).
  colours: [
    { name: "Ivory", hex: "#efe8d8" },
    { name: "Natural Flax", hex: "#d9cbb0" },
    { name: "Oat", hex: "#c9b896" },
    { name: "Sand", hex: "#bfa47c" },
    { name: "Stone", hex: "#a39a8b" },
    { name: "Clay", hex: "#b07a5e" },
    { name: "Terracotta", hex: "#a5553a" },
    { name: "Rust", hex: "#8f3f26" },
    { name: "Burgundy", hex: "#6e1f2b" },
    { name: "Rose", hex: "#c48a8f" },
    { name: "Blush", hex: "#e2bfb7" },
    { name: "Magenta", hex: "#b03a6f" },
    { name: "Mustard", hex: "#c79a2e" },
    { name: "Ochre", hex: "#a8772c" },
    { name: "Olive", hex: "#6f6d3a" },
    { name: "Sage", hex: "#9fae8f" },
    { name: "Moss", hex: "#5c6741" },
    { name: "Forest", hex: "#2f4a35" },
    { name: "Teal", hex: "#2f5e60" },
    { name: "Aqua Blue", hex: "#7fb3b5" },
    { name: "Navy", hex: "#1f2a44" },
    { name: "Lilac", hex: "#b7a4c4" },
    { name: "Charcoal", hex: "#3b3a38" },
    { name: "Black", hex: "#141312" },
  ],

  // TODO(client): the WhatsApp number contact-page messages are sent to — country code
  // first, digits only (e.g. 94771234567 for 077 123 4567).
  whatsapp: "94770000000",

  // id = product page (art/u-N.html). image/swatch paths are relative to frontend_assets/.
  products: [
    { id: "u-2",  name: "Leela Co-ord",   subline: "Two-piece silhouette in olive",       colour: "Olive",     price: 6660, image: "Images/studio compressed/2.jpg",  swatch: "Images/About/PXL06017.jpg", fabric: "2.5 yards of fabric", description: "Tube top with back tie, 8 panel maxi skirt with extra volume towards the end and side zipper." },
    { id: "u-1",  name: "Seetha Dress",   subline: "Elegant open back dress in burgundy", colour: "Burgundy",  price: 6660, image: "Images/studio compressed/1.jpg",  swatch: "Images/About/PXL06006.jpg", fabric: "2.5 yards of fabric", description: "Halter neck with back tie. Smocked back. Flared skirt." },
    { id: "u-6",  name: "Sumana Co-ord",  subline: "Textured tailored set in sage",       colour: "Sage",      price: 5550, image: "Images/studio compressed/6.jpg",  swatch: "Images/About/PXL06017.jpg", fabric: "2 yards of fabric", description: "Cropped top with boat neck. Tight skirt with back slit and zipper." },
    { id: "u-8",  name: "Anula Dress",    subline: "Slotted side-split dress in beige",   colour: "Beige",     price: 6660, image: "Images/studio compressed/8.jpg",  swatch: "Images/About/PXL06022.jpg", fabric: "2.5 yards of fabric", description: "A-line shape with flared skirt. Square-scoop neckline." },
    { id: "u-4",  name: "Devi Dress",     subline: "Classic draped silhouette in red",    colour: "Red",       price: 6660, image: "Images/studio compressed/4.jpg",  swatch: "Images/About/PXL06010.jpg", fabric: "2.5 yards of fabric", description: "V neck. Low waistline. Midi length." },
    { id: "u-12", name: "Manike Co-ord",  subline: "Relaxed office set in black",         colour: "Black",     price: 6660, image: "Images/studio compressed/12.jpg", swatch: "Images/About/PXL06003.jpg", fabric: "2.5 yards of fabric", description: "Waistcoat top. Classic office pants with pockets, elastic on back and side zipper." },
    { id: "u-7",  name: "Susila Dress",   subline: "Asymmetrical linen dress in navy",    colour: "Navy",      price: 6660, image: "Images/studio compressed/7.jpg",  swatch: "Images/About/PXL06027.jpg", fabric: "2.5 yards of fabric", description: "Parallel needle detailing. Front knot. Deep V neck. Sleeve collars. Front slit." },
    { id: "u-3",  name: "Meena Dress",    subline: "Deep neck pure linen dress in lilac", colour: "Lilac",     price: 4440, image: "Images/studio compressed/3.jpg",  swatch: "Images/About/PXL06019.jpg", fabric: "1.5 yards of fabric", description: "High neck Chinese collar with deep slit in front. Mini length A-line skirt and dividing yoke." },
    { id: "u-9",  name: "Amala Dress",    subline: "Statement summer dress in rust",      colour: "Rust",      price: 4440, image: "Images/studio compressed/9.jpg",  swatch: "Images/About/PXL06024.jpg", fabric: "1.5 yards of fabric", description: "Deep cut V back with bow. Boat neckline. Mini length." },
    { id: "u-11", name: "Nila Dress",     subline: "Relaxed day dress in aqua blue",      colour: "Aqua Blue", price: 6660, image: "Images/studio compressed/11.jpg", swatch: "Images/About/PXL06013.jpg", fabric: "2.5 yards of fabric", description: "High round neckline. Princess cut skirt. Short cap sleeves." },
    { id: "u-10", name: "Chandra Co-ord", subline: "Minimalist two-piece set in ivory",   colour: "Ivory",     price: 7770, image: "Images/studio compressed/10.jpg", swatch: "Images/About/PXL06026.jpg", fabric: "3.5 yards of fabric", description: "Relaxed top with straight boat neckline. Lengthy palazzo pants." },
    { id: "u-5",  name: "Roja Shirt",     subline: "Relaxed fit resort shirt in magenta", colour: "Magenta",   price: 4440, image: "Images/studio compressed/5.jpg",  swatch: "Images/About/PXL06039.jpg", fabric: "1.75 yards of fabric", description: "Long sleeves. Shirt collar. Oversized." },
  ],
});
