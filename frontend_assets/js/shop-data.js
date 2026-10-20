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

  // TODO(client): the WhatsApp number contact-page messages are sent to — country code
  // first, digits only (e.g. 94771234567 for 077 123 4567).
  whatsapp: "94770000000",

  // id = the product's permanent id (orders store it); slug = its page, /collection/<slug>.
  // image/swatch paths are relative to frontend_assets/.
  products: [
    { id: "u-2",  slug: "leela-co-ord", name: "Leela Co-ord",   subline: "Two-piece silhouette in olive",       colour: "Horton Olive",     price: 6660, image: "Images/studio compressed/2.jpg",  swatch: "Images/About/PXL06017.jpg", fabric: "2.5 yards of fabric", description: "Tube top with back tie, 8 panel maxi skirt with extra volume towards the end and side zipper.", closeups: [{ label: "Tube top", x: 0.50, y: 0.40 }, { label: "Waistband", x: 0.50, y: 0.51 }, { label: "8-panel maxi skirt", x: 0.50, y: 0.80 }] },
    { id: "u-1",  slug: "seetha-dress", name: "Seetha Dress",   subline: "Elegant open back dress in burgundy", colour: "Wadi Kahata Maroon",  price: 6660, image: "Images/studio compressed/1.jpg",  swatch: "Images/About/PXL06006.jpg", fabric: "2.5 yards of fabric", description: "Halter neck with back tie. Smocked back. Flared skirt.", closeups: [{ label: "Halter neck", x: 0.50, y: 0.27 }, { label: "Smocked back & waist", x: 0.50, y: 0.39 }, { label: "Flared skirt", x: 0.50, y: 0.70 }] },
    { id: "u-6",  slug: "sumana-co-ord", name: "Sumana Co-ord",  subline: "Textured tailored set in sage",       colour: "Banana Dalu",      price: 5550, image: "Images/studio compressed/6.jpg",  swatch: "Images/About/PXL06017.jpg", fabric: "2 yards of fabric", description: "Cropped top with boat neck. Tight skirt with back slit and zipper.", closeups: [{ label: "Cropped top", x: 0.50, y: 0.31 }, { label: "Skirt waist", x: 0.50, y: 0.42 }, { label: "Back slit skirt", x: 0.50, y: 0.76 }] },
    { id: "u-8",  slug: "anula-dress", name: "Anula Dress",    subline: "Slotted side-split dress in beige",   colour: "Sel-Roo Paint",     price: 6660, image: "Images/studio compressed/8.jpg",  swatch: "Images/About/PXL06022.jpg", fabric: "2.5 yards of fabric", description: "A-line shape with flared skirt. Square-scoop neckline.", closeups: [{ label: "Square-scoop neckline", x: 0.47, y: 0.34 }, { label: "A-line waist", x: 0.47, y: 0.53 }, { label: "Flared skirt", x: 0.47, y: 0.80 }] },
    { id: "u-4",  slug: "devi-dress", name: "Devi Dress",     subline: "Classic draped silhouette in red",    colour: "Kandyan Crimson",       price: 6660, image: "Images/studio compressed/4.jpg",  swatch: "Images/About/PXL06010.jpg", fabric: "2.5 yards of fabric", description: "V neck. Low waistline. Midi length.", closeups: [{ label: "V neckline", x: 0.50, y: 0.31 }, { label: "Low waistline", x: 0.50, y: 0.49 }, { label: "Midi skirt", x: 0.50, y: 0.78 }] },
    { id: "u-12", slug: "manike-co-ord", name: "Manike Co-ord",  subline: "Relaxed office set in black",         colour: "Midnight Kaala",     price: 6660, image: "Images/studio compressed/12.jpg", swatch: "Images/About/PXL06003.jpg", fabric: "2.5 yards of fabric", description: "Waistcoat top. Classic office pants with pockets, elastic on back and side zipper.", closeups: [{ label: "Waistcoat top", x: 0.50, y: 0.42 }, { label: "Pocket & waist", x: 0.50, y: 0.56 }, { label: "Office pants", x: 0.50, y: 0.79 }] },
    { id: "u-7",  slug: "susila-dress", name: "Susila Dress",   subline: "Asymmetrical linen dress in navy",    colour: "Indian Saagara",      price: 6660, image: "Images/studio compressed/7.jpg",  swatch: "Images/About/PXL06027.jpg", fabric: "2.5 yards of fabric", description: "Parallel needle detailing. Front knot. Deep V neck. Sleeve collars. Front slit.", closeups: [{ label: "Deep V neck", x: 0.47, y: 0.34 }, { label: "Front knot", x: 0.47, y: 0.63 }, { label: "Front slit", x: 0.46, y: 0.80 }] },
    { id: "u-3",  slug: "meena-dress", name: "Meena Dress",    subline: "Deep neck pure linen dress in lilac", colour: "Sunset Lilac",     price: 4440, image: "Images/studio compressed/3.jpg",  swatch: "Images/About/PXL06019.jpg", fabric: "1.5 yards of fabric", description: "High neck Chinese collar with deep slit in front. Mini length A-line skirt and dividing yoke.", closeups: [{ label: "Chinese collar", x: 0.50, y: 0.28 }, { label: "Front slit", x: 0.50, y: 0.44 }, { label: "A-line hem", x: 0.50, y: 0.74 }] },
    { id: "u-9",  slug: "amala-dress", name: "Amala Dress",    subline: "Statement summer dress in terracotta",      colour: "Sambal Sunset",      price: 4440, image: "Images/studio compressed/9.jpg",  swatch: "Images/About/PXL06024.jpg", fabric: "1.5 yards of fabric", description: "Deep cut V back with bow. Boat neckline. Mini length.", closeups: [{ label: "Boat neckline", x: 0.50, y: 0.37 }, { label: "Bodice", x: 0.50, y: 0.55 }, { label: "Mini hem", x: 0.50, y: 0.79 }] },
    { id: "u-11", slug: "nila-dress", name: "Nila Dress",     subline: "Relaxed day dress in aqua blue",      colour: "Hikka Dive", price: 6660, image: "Images/studio compressed/11.jpg", swatch: "Images/About/PXL06013.jpg", fabric: "2.5 yards of fabric", description: "High round neckline. Princess cut skirt. Short cap sleeves.", closeups: [{ label: "Round neckline", x: 0.50, y: 0.33 }, { label: "Cap sleeve", x: 0.66, y: 0.41 }, { label: "Princess-cut skirt", x: 0.50, y: 0.77 }] },
    { id: "u-10", slug: "chandra-co-ord", name: "Chandra Co-ord", subline: "Minimalist two-piece set in ivory",   colour: "Tuskers’ White",     price: 7770, image: "Images/studio compressed/10.jpg", swatch: "Images/About/PXL06026.jpg", fabric: "3.5 yards of fabric", description: "Relaxed top with straight boat neckline. Lengthy palazzo pants.", closeups: [{ label: "Boat neckline", x: 0.50, y: 0.34 }, { label: "Relaxed top", x: 0.50, y: 0.48 }, { label: "Palazzo pants", x: 0.50, y: 0.79 }] },
    { id: "u-5",  slug: "roja-shirt", name: "Roja Shirt",     subline: "Relaxed fit resort shirt in magenta", colour: "Thamarasa Magenta",   price: 4440, image: "Images/studio compressed/5.jpg",  swatch: "Images/About/PXL06039.jpg", fabric: "1.75 yards of fabric", description: "Long sleeves. Shirt collar. Oversized.", closeups: [{ label: "Shirt collar", x: 0.44, y: 0.31 }, { label: "Long sleeve", x: 0.66, y: 0.50 }, { label: "Oversized fit", x: 0.45, y: 0.70 }] },
  ],
});
