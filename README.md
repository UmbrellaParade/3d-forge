# 3d-forge

Codex-driven workspace for making and repairing 3D models, starting with
SD/chibi character workflows.

This project is intentionally optimized for Codex operation:

- Put source images and GLB files in `input/`.
- Keep human-readable intent in `configs/*.json`.
- Let Codex run commands, edit configs, and export new assets.
- Use the browser viewer only for visual confirmation and light tuning.

## Repository Name

Recommended GitHub repository name:

```txt
3d-forge
```

Short alternatives:

- `chibi3d-forge`
- `sd-3d-forge`
- `chibi-model-lab`
- `codex-3d-forge`
- `umbrella-3d-forge`

## Folder Layout

```txt
input/
  character_front.png
  character_back.png
  character_left.png
  character_right.png
  input.glb
  references/

configs/
  character.json
  parts.json
  fix_requests.json

output/
  draft.glb
  fixed.glb
  previews/

tools/
  generate_3d.py
  inspect_glb.py
  stage_viewer_assets.py
  export_glb.py

public/
  models/
  runtime/

src/
  main.js
  styles.css
```

## First Workflow

```bash
npm install
npm run stage
npm run dev
```

Then open the local URL printed by Vite.

## Codex Workflow

1. Add source assets to `input/`.
2. Edit `configs/character.json` and `configs/fix_requests.json`.
3. Run `npm run generate` for a draft placeholder or future image-to-3D engine.
4. Run `npm run export` to create `output/fixed.glb`.
5. Run `npm run stage` to copy the latest model/configs into the viewer.
6. Run `npm run dev` and inspect the model visually.

## Current Status

This is a v0 scaffold:

- Three.js viewer.
- Codex-readable config files.
- GLB inspection helper.
- Staging helper for the viewer.
- Placeholder generation/export scripts.
- Parametric overlay parts in the viewer, starting with a devil-tail tip.

Future versions can plug in TripoSR, Stable Fast 3D, Hunyuan3D, Blender Python,
or a custom parts library.
