# Pretendard web font files

`pretendard.css` declares `@font-face` for **Pretendard** using `local()` sources first and then
`url()` sources served from this folder. The woff2 files are not committed (built offline); the CSP
keeps `font-src 'self'`, so do **not** switch to the jsDelivr CDN.

## Drop the files in

1. Download the official release: https://github.com/orioncactus/pretendard/releases (Pretendard 1.3.9 or later).
2. From the archive copy into `apps/web/public/fonts/`:
   - `web/variable/woff2/PretendardVariable.woff2` → `PretendardVariable.woff2`
   - `web/variable/woff2-dynamic-subset/PretendardVariable.subset.woff2` (optional; if you use the dynamic
     subset, also copy the `PretendardVariable.subset.*.woff2` slices and append the generated
     `unicode-range` `@font-face` rules from `PretendardVariable-dynamic-subset.css` to `pretendard.css`,
     fixing the `url()` paths to `./`).
   - Static weights (optional, for browsers without variable-font support):
     `Pretendard-Regular.subset.woff2`, `Pretendard-SemiBold.subset.woff2`, `Pretendard-Bold.subset.woff2`, `Pretendard-ExtraBold.subset.woff2`.
3. Nothing else changes: the `url()` entries in `pretendard.css` already point at those names, and
   `font-display: swap` keeps the fallback stack ("Noto Sans KR", "Malgun Gothic", system-ui) visible until
   the file arrives.

Pretendard is licensed under the SIL Open Font License 1.1.
