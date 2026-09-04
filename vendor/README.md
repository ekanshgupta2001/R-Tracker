# vendor/

Third-party code shipped with the site so that no page loads anything from another origin.
Each file was downloaded once, at implementation time, and committed. Nothing here is
fetched at runtime.

## three/ — three.js r128 (MIT)

| File | Source | SHA-256 |
|---|---|---|
| `three.min.js` | https://cdnjs.cloudflare.com/ajax/libs/three.js/r128/three.min.js | `9274bbcec8d96168626c732b5d31c775aa8cfb7eaa0599bec0c175908a2c1ce2` |
| `STLLoader.js` | https://cdn.jsdelivr.net/npm/three@0.128.0/examples/js/loaders/STLLoader.js | `c392b93d1331e64082cbd76deb850fe5de11385472a3f4c5b7fe82ba216cb49e` |
| `OrbitControls.js` | https://cdn.jsdelivr.net/npm/three@0.128.0/examples/js/controls/OrbitControls.js | `02bb4ade710f3e607329e37a21f098bc3ac70eb6e33daf8a65e79f4db785e7b2` |

Verify with `shasum -a 256 -c vendor/three/SHA256SUMS` (run from `vendor/three/`).

Network note for the audit: `three.min.js` contains `XMLHttpRequest` (inside `FileLoader`) and
`STLLoader.js` has a `load(url)` method that uses it. Neither path is reachable in R-Tracker:
`js/teleop/view3d.js` reads the student's STL file with a `FileReader` and calls
`STLLoader.parse(arrayBuffer)` only, so a grep for network calls can exclude `vendor/`.

License: MIT — Copyright 2010-2021 Three.js Authors (header retained in `three.min.js`).

## Fonts

The Inter variable font lives in `assets/fonts/` (`InterVariable.woff2`, from
https://github.com/rsms/inter, SIL Open Font License 1.1 — see `assets/fonts/OFL.txt`) and is
declared in `css/fonts.css`.
