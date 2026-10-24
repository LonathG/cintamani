// Cintamani shop data — the single source of truth for products, sizes, delivery and
// bank-transfer details. Loaded in the browser (window.CINTAMANI_SHOP) and imported by
// the order API (netlify/functions/api.mjs), so prices are always checked server-side.
(function (root, data) {
  if (typeof module === "object" && module.exports) module.exports = data;
  else root.CINTAMANI_SHOP = data;
})(this, {
  currency: "LKR",

  // Sizes a piece can be ordered in (same as the size chart below).
  sizes: ["XS", "S", "M", "L", "XL", "XXL", "3XL", "4XL"],

  // Size chart from the client: body measurements in inches (the site can also show cm).
  sizeChart: [
    { size: "XS",  bust: 30, waist: 24, hip: 34 },
    { size: "S",   bust: 32, waist: 26, hip: 36 },
    { size: "M",   bust: 34, waist: 28, hip: 38 },
    { size: "L",   bust: 36, waist: 30, hip: 40 },
    { size: "XL",  bust: 38, waist: 32, hip: 42 },
    { size: "XXL", bust: 40, waist: 34, hip: 44 },
    { size: "3XL", bust: 42, waist: 36, hip: 46 },
    { size: "4XL", bust: 44, waist: 38, hip: 48 },
  ],
  maxQtyPerLine: 10,

  // Island-wide delivery by SL Post courier, charged by parcel weight (slpost.gov.lk rates).
  // Parcel weight = each piece's packed weight (products below) × quantity + one lot of packaging.
  delivery: {
    courier: "SL Post courier",
    packagingGrams: 150,
    // [up to this many grams, LKR]
    rates: [
      [250, 200], [500, 250], [1000, 350], [2000, 400], [3000, 450], [4000, 500],
      [5000, 550], [6000, 600], [7000, 650], [8000, 700], [9000, 750], [10000, 800],
      [15000, 850], [20000, 1100], [25000, 1600], [30000, 2100], [35000, 2600], [40000, 3100],
    ],
  },

  // Customers pay into this account by bank transfer (account name exactly as the bank has it).
  bank: {
    bankName: "People's Bank",
    accountName: "TMDK Thennakoon",
    accountNumber: "026200130073790",
    branch: "Gampaha",
  },

  // Every piece can be made in any of these colours (shown as swatches on the product pages).
  // From the client's colour book, "The Color Story": name = the Cintamani name, shade = the plain
  // colour name. Add `image: "Images/Colours/<file>.jpg"` to show a real fabric photo instead of a flat tone.
  colours: [
    { name: "Walaakulu White",     shade: "Snow White",         hex: "#ffffff" },
    { name: "Tuskers’ White",      shade: "Ivory",              hex: "#f9f9e9" },
    { name: "Midnight Kaala",      shade: "Black",              hex: "#000000" },
    { name: "Wadi Kahata Maroon",  shade: "Wine Red",           hex: "#5e2132" },
    { name: "Kandyan Crimson",     shade: "Classic Red",        hex: "#9c111e" },
    { name: "Jaffna Grape",        shade: "Midnight Purple",    hex: "#27102c" },
    { name: "Banana Dalu",         shade: "Pear Green",         hex: "#87965a" },
    { name: "Horton Olive",        shade: "Dusty Olive",        hex: "#494c39" },
    { name: "Hikka Dive",          shade: "Lagoon",             hex: "#7aa29f" },
    { name: "Monara Blue",         shade: "Ocean Teal",         hex: "#316b7a" },
    { name: "Annasi Yellow",       shade: "Golden Honey",       hex: "#ce8924" },
    { name: "Long-lived Gadolu",   shade: "Dark Brown",         hex: "#372624" },
    { name: "Sambal Sunset",       shade: "Terracotta Sunset",  hex: "#ad5116" },
    { name: "Sunset Lilac",        shade: "Old Lilac",          hex: "#936b7d" },
    { name: "Indian Saagara",      shade: "Navy Blue",          hex: "#23314e" },
    { name: "Ahasa Blush",         shade: "Clay Pink",          hex: "#c2736f" },
    { name: "Kandukara Gloom",     shade: "Charcoal Ash",       hex: "#545555" },
    { name: "Sinharaja Scent",     shade: "Pine Needle",        hex: "#1e342f" },
    { name: "Puskola Page",        shade: "Cacao",              hex: "#b2906b" },
    { name: "Thamba Panni",        shade: "Rust",               hex: "#a14332" },
    { name: "Thamarasa Magenta",   shade: "Raspberry Red",      hex: "#b8245d" },
    { name: "Pinus Trail",         shade: "Taupe",              hex: "#79655b" },
    { name: "Sel-Roo Paint",       shade: "Beige",              hex: "#bba98a" },
    { name: "Goyam Blend",         shade: "Moss",               hex: "#746131" },
  ],

  // WhatsApp number contact-page messages are sent to — country code first, digits only
  // (071 120 9383).
  whatsapp: "94711209383",

  // gallery = more photos shown on the product page after the main image (arrows / swipe).
  //   Each is a path, or { src, y } to show a higher (y: 0) or lower (y: 100) band of the photo.
  // weight = estimated packed weight of one piece in grams, used for the delivery charge.
  // id = the product's permanent id (orders store it); slug = its page, /collection/<slug>.
  // image/swatch paths are relative to frontend_assets/.
  products: [
    { id: "u-2",  slug: "leela-co-ord", name: "Leela Co-ord",   subline: "Two-piece silhouette in olive",       colour: "Horton Olive",     price: 6660, image: "Images/studio compressed/2.jpg", gallery: ["Images/Gallery/leela-co-ord-a.jpg", "Images/Gallery/leela-co-ord-b.jpg"],  swatch: "Images/About/PXL06017.jpg", weight: 450, fabric: "2.5 yards of fabric", description: "Tube top with back tie, 8 panel maxi skirt with extra volume towards the end and side zipper.", closeups: [{ label: "Tube top", x: 0.50, y: 0.40 }, { label: "Waistband", x: 0.50, y: 0.51 }, { label: "8-panel maxi skirt", x: 0.50, y: 0.80 }] },
    { id: "u-1",  slug: "seetha-dress", name: "Seetha Dress",   subline: "Elegant open back dress in burgundy", colour: "Wadi Kahata Maroon",  price: 6660, image: "Images/studio compressed/1.jpg", gallery: ["Images/Gallery/seetha-dress-a.jpg", "Images/Gallery/seetha-dress-b.jpg", "Images/Gallery/seetha-dress-c.jpg"],  swatch: "Images/About/PXL06006.jpg", weight: 450, fabric: "2.5 yards of fabric", description: "Halter neck with back tie. Smocked back. Flared skirt.", closeups: [{ label: "Halter neck", x: 0.50, y: 0.27 }, { label: "Smocked back & waist", x: 0.50, y: 0.39 }, { label: "Flared skirt", x: 0.50, y: 0.70 }] },
    { id: "u-6",  slug: "sumana-co-ord", name: "Sumana Co-ord",  subline: "Textured tailored set in sage",       colour: "Banana Dalu",      price: 5550, image: "Images/studio compressed/6.jpg", gallery: ["Images/Gallery/sumana-co-ord-a.jpg"],  swatch: "Images/About/PXL06017.jpg", weight: 370, fabric: "2 yards of fabric", description: "Cropped top with boat neck. Tight skirt with back slit and zipper.", closeups: [{ label: "Cropped top", x: 0.50, y: 0.31 }, { label: "Skirt waist", x: 0.50, y: 0.42 }, { label: "Back slit skirt", x: 0.50, y: 0.76 }] },
    { id: "u-8",  slug: "anula-dress", name: "Anula Dress",    subline: "Slotted side-split dress in beige",   colour: "Sel-Roo Paint",     price: 6660, image: "Images/Products/anula-dress-beige-a-line-linen-dress.jpg", gallery: ["Images/Gallery/anula-dress-a.jpg"],  swatch: "Images/About/PXL06022.jpg", weight: 450, fabric: "2.5 yards of fabric", description: "A-line shape with flared skirt. Square-scoop neckline.", closeups: [{ label: "Square-scoop neckline", x: 0.47, y: 0.34 }, { label: "A-line waist", x: 0.47, y: 0.53 }, { label: "Flared skirt", x: 0.47, y: 0.80 }] },
    { id: "u-4",  slug: "devi-dress", name: "Devi Dress",     subline: "Classic draped silhouette in red",    colour: "Kandyan Crimson",       price: 6660, image: "Images/studio compressed/4.jpg", gallery: [{ src: "Images/Gallery/devi-dress-a.jpg", y: 8 }],  swatch: "Images/About/PXL06010.jpg", weight: 450, fabric: "2.5 yards of fabric", description: "V neck. Low waistline. Midi length.", closeups: [{ label: "V neckline", x: 0.50, y: 0.31 }, { label: "Low waistline", x: 0.50, y: 0.49 }, { label: "Midi skirt", x: 0.50, y: 0.78 }] },
    { id: "u-12", slug: "manike-co-ord", name: "Manike Co-ord",  subline: "Relaxed office set in black",         colour: "Midnight Kaala",     price: 6660, image: "Images/studio compressed/12.jpg", gallery: ["Images/Gallery/manike-co-ord-a.jpg", "Images/Gallery/manike-co-ord-b.jpg", { src: "Images/Gallery/manike-co-ord-c.jpg", y: 15 }], swatch: "Images/About/PXL06003.jpg", weight: 450, fabric: "2.5 yards of fabric", description: "Waistcoat top. Classic office pants with pockets, elastic on back and side zipper.", closeups: [{ label: "Waistcoat top", x: 0.50, y: 0.42 }, { label: "Pocket & waist", x: 0.50, y: 0.56 }, { label: "Office pants", x: 0.50, y: 0.79 }] },
    { id: "u-7",  slug: "susila-dress", name: "Susila Dress",   subline: "Asymmetrical linen dress in navy",    colour: "Indian Saagara",      price: 6660, image: "Images/studio compressed/7.jpg", gallery: [{ src: "Images/Gallery/susila-dress-a.jpg", y: 15 }],  swatch: "Images/About/PXL06027.jpg", weight: 450, fabric: "2.5 yards of fabric", description: "Parallel needle detailing. Front knot. Deep V neck. Sleeve collars. Front slit.", closeups: [{ label: "Deep V neck", x: 0.47, y: 0.34 }, { label: "Front knot", x: 0.47, y: 0.63 }, { label: "Front slit", x: 0.46, y: 0.80 }] },
    { id: "u-3",  slug: "meena-dress", name: "Meena Dress",    subline: "Deep neck pure linen dress in lilac", colour: "Sunset Lilac",     price: 4440, image: "Images/studio compressed/3.jpg", gallery: [{ src: "Images/Gallery/meena-dress-a.jpg", y: 0 }],  swatch: "Images/About/PXL06019.jpg", weight: 280, fabric: "1.5 yards of fabric", description: "High neck Chinese collar with deep slit in front. Mini length A-line skirt and dividing yoke.", closeups: [{ label: "Chinese collar", x: 0.50, y: 0.28 }, { label: "Front slit", x: 0.50, y: 0.44 }, { label: "A-line hem", x: 0.50, y: 0.74 }] },
    { id: "u-9",  slug: "amala-dress", name: "Amala Dress",    subline: "Statement summer dress in terracotta",      colour: "Sambal Sunset",      price: 4440, image: "Images/Products/amala-dress-terracotta-linen-mini-dress.jpg", gallery: [{ src: "Images/Gallery/amala-dress-a.jpg", y: 15 }],  swatch: "Images/About/PXL06024.jpg", weight: 280, fabric: "1.5 yards of fabric", description: "Deep cut V back with bow. Boat neckline. Mini length.", closeups: [{ label: "Boat neckline", x: 0.50, y: 0.37 }, { label: "Bodice", x: 0.50, y: 0.55 }, { label: "Mini hem", x: 0.50, y: 0.79 }] },
    { id: "u-11", slug: "nila-dress", name: "Nila Dress",     subline: "Relaxed day dress in aqua blue",      colour: "Hikka Dive", price: 6660, image: "Images/Products/nila-dress-aqua-blue-linen-day-dress.jpg", gallery: [{ src: "Images/Gallery/nila-dress-a.jpg", y: 15 }], swatch: "Images/About/PXL06013.jpg", weight: 450, fabric: "2.5 yards of fabric", description: "High round neckline. Princess cut skirt. Short cap sleeves.", closeups: [{ label: "Round neckline", x: 0.50, y: 0.33 }, { label: "Cap sleeve", x: 0.66, y: 0.41 }, { label: "Princess-cut skirt", x: 0.50, y: 0.77 }] },
    { id: "u-10", slug: "chandra-co-ord", name: "Chandra Co-ord", subline: "Minimalist two-piece set in ivory",   colour: "Tuskers’ White",     price: 7770, image: "Images/studio compressed/10.jpg", gallery: [{ src: "Images/Gallery/chandra-co-ord-a.jpg", y: 25 }, "Images/Gallery/chandra-co-ord-b.jpg", "Images/Gallery/chandra-co-ord-c.jpg", { src: "Images/Gallery/chandra-co-ord-d.jpg", y: 15 }], swatch: "Images/About/PXL06026.jpg", weight: 630, fabric: "3.5 yards of fabric", description: "Relaxed top with straight boat neckline. Lengthy palazzo pants.", closeups: [{ label: "Boat neckline", x: 0.50, y: 0.34 }, { label: "Relaxed top", x: 0.50, y: 0.48 }, { label: "Palazzo pants", x: 0.50, y: 0.79 }] },
    { id: "u-5",  slug: "roja-shirt", name: "Roja Shirt",     subline: "Relaxed fit resort shirt in magenta", colour: "Thamarasa Magenta",   price: 4440, image: "Images/studio compressed/5.jpg", gallery: ["Images/Gallery/roja-shirt-a.jpg"],  swatch: "Images/About/PXL06039.jpg", weight: 320, fabric: "1.75 yards of fabric", description: "Long sleeves. Shirt collar. Oversized.", closeups: [{ label: "Shirt collar", x: 0.44, y: 0.31 }, { label: "Long sleeve", x: 0.66, y: 0.50 }, { label: "Oversized fit", x: 0.45, y: 0.70 }] },
  ],

  // Delivery for a list of { id, qty } lines -> { grams, fee }. Used by the cart and by the order
  // API (so the charge on the receipt is always the one the server accepts).
  parcelFor: function (lines) {
    var grams = this.delivery.packagingGrams;
    for (var i = 0; i < lines.length; i++) {
      for (var j = 0; j < this.products.length; j++) {
        if (this.products[j].id === lines[i].id) grams += (this.products[j].weight || 0) * (lines[i].qty || 0);
      }
    }
    var rates = this.delivery.rates, fee = rates[rates.length - 1][1];
    for (var k = 0; k < rates.length; k++) {
      if (grams <= rates[k][0]) { fee = rates[k][1]; break; }
    }
    return { grams: grams, fee: fee };
  },
});
