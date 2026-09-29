# Photography

Haoran Liao's photo albums, a static site served by GitHub Pages. It replaces the old Adobe Portfolio site (lhr.myportfolio.com) and keeps its layout.

## How it works

```
site.json          name, social links, album list (order = menu order)
originals/<album>/ your full-size photos (full-size Lightroom exports, committed)
static/            stylesheet, script and icons
build.py           resizes photos and writes the site into docs/
docs/              the published site (commit this)
```

## Adding or changing photos

1. Put photos into `originals/landscape/`, `originals/night/`, and so on. JPEG, PNG, WebP and TIFF all work.
2. Run the build:
   ```bash
   python3 build.py --serve
   ```
   Then open http://localhost:8000 to preview. Only new or changed photos are processed, and photos you remove from `originals/` are removed from the site.
3. Commit and push. The live site updates about a minute later.

- **Order:** photos are sorted by filename. Rename them with a number in front (`01-...`, `02-...`) to reorder.
- **Album cover:** by default it's the first photo. To choose another, set `"cover": "filename.jpg"` for that album in `site.json`. You can also use an image that isn't in the album: save it as `originals/_covers/<album>.jpg`. Add `originals/_covers/<album>-hover.jpg` to show a second image on mouse-over, as the Travel cover does.
- **Layout:** album photos are never cropped. They're arranged in rows of equal height, as on Adobe Portfolio. Each album's `row_height` in `site.json` sets the target row height (137 by default; Night uses 250, which gives it 2 photos per row). Larger numbers mean bigger photos and fewer per row.
- **New album:** add an entry to `albums` in `site.json` and create a matching folder in `originals/`.
- **Privacy:** camera metadata, including GPS location, is removed from the images the site serves. The files in `originals/` are committed unchanged, so anyone can download them from the repository with their metadata.

## Publishing (one-time)

On GitHub, go to Settings → Pages → Build and deployment. Choose "Deploy from a branch", then branch `main`, folder `/docs`.
