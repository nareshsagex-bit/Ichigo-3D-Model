---
name: procedural-character-anatomy
description: Refine procedural Three.js character bodies, shoulder and neck transitions, and hands gripping props from turnaround references.
---

# Procedural character anatomy

Inspect the existing model before changing it. Establish shared head, neck, acromion, elbow, wrist, pelvis and ground landmarks from front and profile references. Drawing proportions are starting guides; prioritize the actual character silhouette.

Construct the ribcage and pelvis first, connect the shoulder girdle, then wrap the deltoid from clavicle/acromion/scapula into the upper arm. Avoid a separate ball perched on each shoulder. Blend the trapezius into the neck and clavicle; use continuous lofts or smooth implicit unions for continuous skin. Recompute smooth normals after deformation, including across duplicated UV coordinates where appropriate. Keep collar fur from hiding a defective neck joint during review.

For a power grip, define one handle coordinate frame shared by the prop and hand. Wrap four finger centerlines around the handle, with pads contacting its radius, and place the thumb in opposition. Build the palm and wrist connection behind the curled fingers. Attach the prop to a hand socket so subsequent pose changes preserve their relationship. Keep a relaxed hand a separate pose instead of forcing bilateral hand symmetry.

Validate front, profile and three-quarter silhouettes, plus close-ups of the shoulder/neck junction and grip. Check finite geometry, outward normals, torso symmetry, wrist overlap, chest apertures, floor contact and prop attachment. Structural checks do not establish likeness: verify the actual rendered form against the reference.

## Sources

- [Proko shoulder bones](https://www.proko.com/course-lesson/how-to-draw-the-shoulder-bones): shoulder girdle construction.
- [Proko deltoids](https://www.proko.com/course-lesson/how-to-draw-deltoids-anatomy-for-artists/): deltoid attachment and wrapping form.
- [Proko neck muscles](https://www.proko.com/course-lesson/how-to-draw-neck-muscles-form/): neck transitions and muscle masses.
- [Proko hands holding objects](https://www.proko.com/course-lesson/hands-holding-stuff-n-things): hand construction around a held object.
- [Three.js MarchingCubes](https://threejs.org/docs/pages/MarchingCubes.html): optional implicit-surface extraction tool.

The procedural implementation choices synthesize these lessons; no fixed proportions guarantee a likeness.
