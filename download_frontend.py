import os
import re
from urllib.parse import urljoin, urlparse
from bs4 import BeautifulSoup
import requests

BASE_URL = "https://www.lumenartspace.com/"
HEADERS = {
    "User-Agent": (
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) "
        "AppleWebKit/537.36 (KHTML, like Gecko) "
        "Chrome/120.0.0.0 Safari/537.36"
    )
}

OUTPUT_DIR = "frontend_assets"
ART_DIR = os.path.join(OUTPUT_DIR, "art")

os.makedirs(f"{OUTPUT_DIR}/css", exist_ok=True)
os.makedirs(f"{OUTPUT_DIR}/js", exist_ok=True)
os.makedirs(ART_DIR, exist_ok=True)


def download_asset(url, target_path):
  try:
    res = requests.get(url, headers=HEADERS)
    if res.status_code == 200:
      with open(target_path, "w", encoding="utf-8") as f:
        f.write(res.text)
  except Exception as e:
    print(f"Failed asset download {url}: {e}")


def capture_all_pages():
  print("1. Fetching Main Pages (Home, Gallery, About)...")
  main_pages = {
      "index.html": BASE_URL,
      "about.html": urljoin(BASE_URL, "about"),
      "gallery.html": urljoin(BASE_URL, "gallery"),
  }

  sub_page_urls = set()

  # Discover all artwork detail page URLs across the site
  for filename, page_url in main_pages.items():
    res = requests.get(page_url, headers=HEADERS)
    if res.status_code == 200:
      soup = BeautifulSoup(res.text, "html.parser")
      for a in soup.find_all("a", href=True):
        href = a["href"]
        if "/art/" in href:
          full_art_url = urljoin(BASE_URL, href)
          sub_page_urls.add(full_art_url)

  print(f"\nDiscovered {len(sub_page_urls)} artwork sub-pages to download!")

  # 2. Download each artwork detail sub-page
  for art_url in sub_page_urls:
    slug = urlparse(art_url).path.strip("/").split("/")[-1]
    if not slug:
      continue

    art_filename = f"{slug}.html"
    art_filepath = os.path.join(ART_DIR, art_filename)

    print(f"  Downloading sub-page: {art_url} -> art/{art_filename}")
    art_res = requests.get(art_url, headers=HEADERS)

    if art_res.status_code == 200:
      soup = BeautifulSoup(art_res.text, "html.parser")

      # Rewrite internal links for local navigation
      for a in soup.find_all("a", href=True):
        href = a["href"]
        if href in [
            "/",
            "https://www.lumenartspace.com",
            "https://www.lumenartspace.com/",
        ]:
          a["href"] = "../index.html"
        elif "/about" in href:
          a["href"] = "../about.html"
        elif "/gallery" in href:
          a["href"] = "../gallery.html"
        elif "/art/" in href:
          art_slug = urlparse(href).path.strip("/").split("/")[-1]
          a["href"] = f"{art_slug}.html"

      with open(art_filepath, "w", encoding="utf-8") as f:
        f.write(str(soup))

  # 3. Save main pages with updated links pointing into art/ directory
  print("\n3. Saving Main Pages with converted links...")
  for filename, page_url in main_pages.items():
    res = requests.get(page_url, headers=HEADERS)
    if res.status_code == 200:
      soup = BeautifulSoup(res.text, "html.parser")

      for a in soup.find_all("a", href=True):
        href = a["href"]
        if href in [
            "/",
            "https://www.lumenartspace.com",
            "https://www.lumenartspace.com/",
        ]:
          a["href"] = "index.html"
        elif "/about" in href:
          a["href"] = "about.html"
        elif "/gallery" in href:
          a["href"] = "gallery.html"
        elif "/art/" in href:
          art_slug = urlparse(href).path.strip("/").split("/")[-1]
          a["href"] = f"art/{art_slug}.html"

      page_path = os.path.join(OUTPUT_DIR, filename)
      with open(page_path, "w", encoding="utf-8") as f:
        f.write(str(soup))

  print("\nComplete! All artwork detail pages are saved in './frontend_assets/art/'")


if __name__ == "__main__":
  capture_all_pages()