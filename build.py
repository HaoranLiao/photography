#!/usr/bin/env python3
"""Build the photography site.

Reads site.json and the photos in originals/<album>/, writes a ready-to-publish
static site into docs/ (resized images + HTML). Only new or changed photos are
re-processed, and photos you delete from originals/ are removed from docs/.

    python3 build.py                 # build into docs/
    python3 build.py --serve         # build, then preview at http://localhost:8000
"""

import argparse
import html
import json
import re
import shutil
from pathlib import Path

from PIL import Image, ImageOps

ROOT = Path(__file__).resolve().parent
PHOTO_EXTS = {".jpg", ".jpeg", ".png", ".webp", ".tif", ".tiff"}

FULL_LONG_EDGE = 2400      # full-screen viewer image
THUMB_LONG_EDGE = 1000    # album grid preview (uncropped)
COVER_SIZE = (1200, 676)   # home page album cover, ~16:9
ACTIVE = ' class="active"'


def natural_key(p):
    return [int(t) if t.isdigit() else t.lower() for t in re.split(r"(\d+)", p.name)]


def find_album_dir(src, album):
    wanted = {album["slug"].lower(), album["title"].lower()}
    for d in src.iterdir():
        if d.is_dir() and d.name.lower() in wanted:
            return d
    return None


def save_jpeg(img, path):
    path.parent.mkdir(parents=True, exist_ok=True)
    # Saving without exif= drops camera metadata (including GPS location).
    img.save(path, "JPEG", quality=85, optimize=True, progressive=True)


def process_photo(src_path, out_dir, stem):
    """Write full-size + thumbnail JPEGs; return (width, height) of the full-size one."""
    full = out_dir / f"{stem}.jpg"
    thumb = out_dir / "thumb" / f"{stem}.jpg"
    if full.exists() and thumb.exists() and full.stat().st_mtime >= src_path.stat().st_mtime:
        with Image.open(full) as im:
            return im.size
    with Image.open(src_path) as im:
        im = ImageOps.exif_transpose(im).convert("RGB")
        big = im.copy()
        big.thumbnail((FULL_LONG_EDGE, FULL_LONG_EDGE), Image.LANCZOS)
        save_jpeg(big, full)
        small = im.copy()
        small.thumbnail((THUMB_LONG_EDGE, THUMB_LONG_EDGE), Image.LANCZOS)
        save_jpeg(small, thumb)
        print(f"  + {src_path.relative_to(src_path.parents[1])}")
        return big.size


def make_cover(src_path, out_path):
    with Image.open(src_path) as im:
        im = ImageOps.exif_transpose(im).convert("RGB")
        save_jpeg(ImageOps.fit(im, COVER_SIZE, Image.LANCZOS), out_path)


def build_album(src, out, album):
    album_dir = find_album_dir(src, album)
    out_dir = out / "img" / album["slug"]
    photos = []
    if album_dir:
        files = sorted((p for p in album_dir.iterdir() if p.suffix.lower() in PHOTO_EXTS), key=natural_key)
        stems = set()
        for p in files:
            stem = re.sub(r"[^a-z0-9_-]+", "-", p.stem.lower()).strip("-")
            stems.add(stem)
            w, h = process_photo(p, out_dir, stem)
            photos.append({"src": p, "stem": stem, "w": w, "h": h})
        # Drop outputs whose original was deleted.
        for f in list(out_dir.glob("*.jpg")) + list(out_dir.glob("thumb/*.jpg")):
            if f.stem not in stems and not f.name.startswith("cover"):
                f.unlink()
    if photos:
        # Cover: originals/_covers/<album>.jpg if present, else the photo named in site.json, else the first photo.
        custom = [p for p in (src / "_covers").glob(f'{album["slug"]}.*') if p.suffix.lower() in PHOTO_EXTS]
        named = [ph["src"] for ph in photos if ph["src"].name == album.get("cover")]
        cover_src = (custom or named or [photos[0]["src"]])[0]
        make_cover(cover_src, out_dir / "cover.jpg")
        # Optional second cover shown on mouse-over: originals/_covers/<album>-hover.jpg
        hover = [p for p in (src / "_covers").glob(f'{album["slug"]}-hover.*') if p.suffix.lower() in PHOTO_EXTS]
        album["_hover"] = bool(hover)
        if hover:
            make_cover(hover[0], out_dir / "cover-hover.jpg")
        elif (out_dir / "cover-hover.jpg").exists():
            (out_dir / "cover-hover.jpg").unlink()
    return photos


# ---------------------------------------------------------------- HTML

def esc(s):
    return html.escape(str(s), quote=True)


def social_links(site, prefix):
    items = []
    for s in site.get("social", []):
        items.append(
            f'<a href="{esc(s["url"])}" target="_blank" rel="noopener" aria-label="{esc(s["type"])}">'
            f'<img src="{prefix}assets/icons/{esc(s["type"])}.svg" alt="" width="12" height="12"></a>'
        )
    return f'<div class="social">{"".join(items)}</div>' if items else ""


def page(site, *, title, prefix, active, body):
    albums = site["albums"]
    nav_items = "".join(
        f'<li><a href="{prefix}{a["slug"]}/"{ACTIVE if active == a["slug"] else ""}>{esc(a["title"])}</a></li>'
        for a in albums
    )
    work_active = active != "work"  # grey on the home page only, as on Adobe
    full_title = site["name"] if title is None else f'{site["name"]} - {title}'
    return f"""<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>{esc(full_title)}</title>
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Rosario:wght@300..700&display=swap">
<link rel="stylesheet" href="{prefix}assets/style.css">
</head>
<body{' data-no-download' if site.get("disable_right_click") else ''}>
<div class="site">
  <aside class="sidebar">
    <a class="logo" href="{prefix}">{esc(site["name"])}</a>
    <button class="menu-toggle" aria-label="Menu" aria-expanded="false"><span></span><span></span><span></span></button>
    <nav>
      <a class="nav-heading{' active' if work_active else ''}" href="{prefix}">Work</a>
      <ul>{nav_items}</ul>
      {social_links(site, prefix)}
    </nav>
  </aside>
  <main>
{body}
    <footer>{social_links(site, prefix)}</footer>
  </main>
</div>
<button class="back-to-top" aria-label="Back to top">
  <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M12 20V4M5 11l7-7 7 7"/></svg>
</button>
<script type="module" src="{prefix}assets/site.js"></script>
</body>
</html>
"""


def cover_grid(albums, prefix, cls):
    tiles = "".join(
        f'<a class="cover" href="{prefix}{a["slug"]}/">'
        f'<img src="{prefix}img/{a["slug"]}/cover.jpg" alt="{esc(a["title"])}" width="{COVER_SIZE[0]}" height="{COVER_SIZE[1]}" loading="lazy">'
        + (f'<img class="cover-hover" src="{prefix}img/{a["slug"]}/cover-hover.jpg" alt="" width="{COVER_SIZE[0]}" height="{COVER_SIZE[1]}" loading="lazy">'
           if a.get("_hover") else "")
        + f'<span class="cover-title">{esc(a["title"])}</span></a>'
        for a in albums
    )
    return f'<div class="{cls}">{tiles}</div>'


def gallery_tile(slug, p):
    scale = min(1, THUMB_LONG_EDGE / max(p["w"], p["h"]))
    tw, th = round(p["w"] * scale), round(p["h"] * scale)
    full, thumb = f'../img/{slug}/{p["stem"]}.jpg', f'../img/{slug}/thumb/{p["stem"]}.jpg'
    return (f'<a href="{full}" data-pswp-width="{p["w"]}" data-pswp-height="{p["h"]}">'
            f'<img src="{thumb}" srcset="{thumb} {tw}w, {full} {p["w"]}w" sizes="33vw" '
            f'alt="" width="{tw}" height="{th}" loading="lazy"></a>')


def build_pages(site, out, photos_by_album):
    albums = [a for a in site["albums"] if photos_by_album[a["slug"]]]
    if not albums:
        empty = '<p class="empty">No photos yet. Add some to <code>originals/&lt;album&gt;/</code> and run <code>python3 build.py</code>.</p>'
    (out / "index.html").write_text(page(
        site, title=None, prefix="", active="work",
        body=cover_grid(albums, "", "covers main-covers") if albums else empty))

    for a in site["albums"]:
        photos = photos_by_album[a["slug"]]
        d = out / a["slug"]
        d.mkdir(parents=True, exist_ok=True)
        tiles = "".join(gallery_tile(a["slug"], p) for p in photos)
        gallery = f'<div class="gallery" data-row-height="{a.get("row_height", 137)}">{tiles}</div>' if photos else \
            f'<p class="empty">No photos yet. Add some to <code>originals/{a["slug"]}/</code> and run <code>python3 build.py</code>.</p>'
        # "You may also like": the next two albums in menu order, wrapping around.
        others = [o for o in albums if o["slug"] != a["slug"]]
        if a in albums:
            i = albums.index(a)
            others = (albums[i + 1:] + albums[:i])[:2]
        else:
            others = others[:2]
        more = (f'<section class="more"><h3>You may also like</h3>{cover_grid(others, "../", "covers")}</section>'
                if others else "")
        (d / "index.html").write_text(page(
            site, title=a["title"], prefix="../", active=a["slug"], body=gallery + more))


def main():
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("--src", default=ROOT / "originals", type=Path, help="folder with one sub-folder per album")
    ap.add_argument("--out", default=ROOT / "docs", type=Path, help="output folder (published by GitHub Pages)")
    ap.add_argument("--serve", action="store_true", help="preview at http://localhost:8000 after building")
    args = ap.parse_args()

    site = json.loads((ROOT / "site.json").read_text())
    out = args.out
    out.mkdir(parents=True, exist_ok=True)
    (out / ".nojekyll").touch()
    shutil.copytree(ROOT / "static", out / "assets", dirs_exist_ok=True)

    photos_by_album = {}
    for a in site["albums"]:
        print(f'{a["title"]}:')
        photos_by_album[a["slug"]] = build_album(args.src, out, a)
        print(f'  {len(photos_by_album[a["slug"]])} photos')
    build_pages(site, out, photos_by_album)
    print(f"Built site in {out}")

    if args.serve:
        import functools, http.server
        handler = functools.partial(http.server.SimpleHTTPRequestHandler, directory=str(out))
        print("Preview at http://localhost:8000  (Ctrl+C to stop)")
        http.server.ThreadingHTTPServer(("127.0.0.1", 8000), handler).serve_forever()


if __name__ == "__main__":
    main()
