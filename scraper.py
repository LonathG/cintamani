import json
import os
from urllib.parse import urljoin
from bs4 import BeautifulSoup
import requests

# Set up target URL and local image output directory
BASE_URL = "https://www.lumenartspace.com/"
GALLERY_URL = "https://www.lumenartspace.com/gallery"
IMAGE_DIR = "downloaded_images"

# Create image folder if it doesn't exist
os.makedirs(IMAGE_DIR, exist_ok=True)

HEADERS = {
    "User-Agent": (
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) "
        "AppleWebKit/537.36 (KHTML, like Gecko) "
        "Chrome/120.0.0.0 Safari/537.36"
    )
}


def download_image(img_url, filename):
  """Downloads an image file from a URL and saves it locally."""
  try:
    res = requests.get(img_url, headers=HEADERS, stream=True)
    if res.status_code == 200:
      filepath = os.path.join(IMAGE_DIR, filename)
      with open(filepath, "wb") as f:
        for chunk in res.iter_content(chunk_size=8192):
          f.write(chunk)
      return filepath
  except Exception as e:
    print(f"Failed to download image {img_url}: {e}")
  return None


def scrape_lumen_artspace():
  print("Connecting to Lumen Artspace...")
  response = requests.get(GALLERY_URL, headers=HEADERS)

  if response.status_code != 200:
    print(f"Failed to fetch page. Status code: {response.status_code}")
    return

  soup = BeautifulSoup(response.text, "html.parser")
  scraped_artworks = []

  # Find image elements across the gallery page
  img_tags = soup.find_all("img")
  print(f"Found {len(img_tags)} image elements on the page.")

  count = 1
  for img in img_tags:
    src = img.get("src") or img.get("data-src")
    if not src or "logo" in src.lower() or "icon" in src.lower():
      continue  # Skip UI assets, logos, and icons

    # Ensure full absolute URL for image
    full_img_url = urljoin(BASE_URL, src)

    # Derive image title/alt description
    alt_text = img.get("alt", "").strip() or f"Artwork_{count}"
    clean_filename = f"{count}_{alt_text.replace(' ', '_').lower()}.jpg"

    print(f"[{count}] Downloading image: {alt_text}...")
    local_image_path = download_image(full_img_url, clean_filename)

    artwork_item = {
        "id": count,
        "title": alt_text,
        "medium": "Lacquer on Wood",
        "original_image_url": full_img_url,
        "local_image_path": local_image_path,
    }

    scraped_artworks.append(artwork_item)
    count += 1

  # Save structured metadata to a JSON file
  json_output_path = "artworks.json"
  with open(json_output_path, "w", encoding="utf-8") as f:
    json.dump(scraped_artworks, f, indent=4, ensure_ascii=False)

  print("\nDone!")
  print(f"Saved metadata for {len(scraped_artworks)} items to {json_output_path}")
  print(f"Saved images to ./{IMAGE_DIR}/")


if __name__ == "__main__":
  scrape_lumen_artspace()