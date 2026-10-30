# Ichigo 3D Model

A procedural Vasto Lorde Ichigo character studio built with Three.js and Vite.

## Run locally

Install Node.js, then run:

```sh
npm ci
npm run dev
```

Open the local URL printed by Vite. To create a production build, run `npm run build`.

## Studio controls

- Click the character to center and zoom toward the selected area. Drag elsewhere to orbit.
- Drag the orange wrist handles to pose either arm. The katana follows its hand.
- Use **Reset Hand Pose** or refresh the page to restore the original pose.
- Use the view presets, including **Full Body**, to return to a fixed inspection view.
- Toggle character and katana aura effects below the view buttons.
- Adjust hair motion, cloth motion, geometry layers, lighting, and aura settings in the studio panel.

The character uses procedural geometry, symmetric face landmarks, generated materials, layered hair, animated cloth, and temporary arm posing. Reference artwork is included in `public/reference/`; reusable modeling guidance is in `skills/`.

## Geometry and interaction checks

```sh
node scripts/check-face.mjs
node scripts/check-body.mjs
node scripts/check-hair.mjs
node scripts/check-hair-motion.mjs
node scripts/check-cloth-motion.mjs
node scripts/check-hand-pose.mjs
node scripts/check-model-focus.mjs
```

Local dependencies, generated builds, intermediate backups, and review captures are excluded from Git.
