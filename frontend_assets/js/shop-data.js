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

  // id = product page (art/u-N.html). image/swatch paths are relative to frontend_assets/.
  products: [
    { id: "u-2",  name: "Leela Co-ord",   subline: "Two-piece silhouette in olive",       colour: "Olive",     price: 4150, image: "Images/Studio Shoot/2.jpg",  swatch: "Images/About/PXL06017.jpg" },
    { id: "u-1",  name: "Seetha Dress",   subline: "Elegant open back dress in burgundy", colour: "Burgundy",  price: 4650, image: "Images/Studio Shoot/1.jpg",  swatch: "Images/About/PXL06006.jpg" },
    { id: "u-6",  name: "Sumana Co-ord",  subline: "Textured tailored set in sage",       colour: "Sage",      price: 4250, image: "Images/Studio Shoot/6.jpg",  swatch: "Images/About/PXL06017.jpg" },
    { id: "u-8",  name: "Anula Dress",    subline: "Slotted side-split dress in beige",   colour: "Beige",     price: 5850, image: "Images/Studio Shoot/8.jpg",  swatch: "Images/About/PXL06022.jpg" },
    { id: "u-4",  name: "Devi Dress",     subline: "Classic draped silhouette in red",    colour: "Red",       price: 3950, image: "Images/Studio Shoot/4.jpg",  swatch: "Images/About/PXL06010.jpg" },
    { id: "u-12", name: "Manike Co-ord",  subline: "Relaxed office set in black",         colour: "Black",     price: 4450, image: "Images/Studio Shoot/12.jpg", swatch: "Images/About/PXL06003.jpg" },
    { id: "u-7",  name: "Susila Dress",   subline: "Asymmetrical linen dress in navy",    colour: "Navy",      price: 4850, image: "Images/Studio Shoot/7.jpg",  swatch: "Images/About/PXL06027.jpg" },
    { id: "u-3",  name: "Meena Dress",    subline: "Deep neck pure linen dress in lilac", colour: "Lilac",     price: 4350, image: "Images/Studio Shoot/3.jpg",  swatch: "Images/About/PXL06019.jpg" },
    { id: "u-9",  name: "Amala Dress",    subline: "Statement summer dress in rust",      colour: "Rust",      price: 4100, image: "Images/Studio Shoot/9.jpg",  swatch: "Images/About/PXL06024.jpg" },
    { id: "u-11", name: "Nila Dress",     subline: "Relaxed day dress in aqua blue",      colour: "Aqua Blue", price: 5250, image: "Images/Studio Shoot/11.jpg", swatch: "Images/About/PXL06013.jpg" },
    { id: "u-10", name: "Chandra Co-ord", subline: "Minimalist two-piece set in ivory",   colour: "Ivory",     price: 4550, image: "Images/Studio Shoot/10.jpg", swatch: "Images/About/PXL06026.jpg" },
    { id: "u-5",  name: "Roja Shirt",     subline: "Relaxed fit resort shirt in magenta", colour: "Magenta",   price: 4200, image: "Images/Studio Shoot/5.jpg",  swatch: "Images/About/PXL06039.jpg" },
  ],
});
