# Podestalia — 250-point plan

This is the brief turned into 250 bullets:

- **Part A (1–100):** what the site needs in order to be usable and safe.
- **Part B (101–250):** ideas for taking it as far as it can go.

`[x]` means the item is built and working in this version. `[ ]` means it's a next step. The `[x]` marks are honest: everything ticked can be found in the code.

---

## Part A — Usable and safe (100)

### Scrolling and navigation
1. [x] Keep the browser's own scrolling. Nothing hijacks it, so the keyboard, scrollbar, trackpad and screen readers all behave normally.
2. [x] Smooth the scroll value used by the 3D scene without touching the page's actual scroll position.
3. [x] Drive every 3D state from story time, so scrolling back up exactly reverses any transition.
4. [x] Add a numbered chapter rail (00–11) that shows the current chapter and jumps to any chapter on click.
5. [x] Show scroll progress: a lime fill on the rail, and a bar along the bottom on phones.
6. [x] Put chapter shortcuts in the header (Carbine, GT3, Voyager, Gallery).
7. [x] Add a "Skip to the gallery" link as the first thing keyboard users reach.
8. [x] Make in-page jumps smooth, or instant when reduced motion is on.
9. [x] Size chapters by scroll length so text never gets pushed off-screen while a panel is showing.
10. [x] Always show a "Scroll" cue on the opening screen.
11. [ ] Give each chapter a URL hash, so a link can open straight to the GT3 or the Bow.
12. [ ] Offer a "Replay intro" control after the opening pop has played.

### Motion and comfort
13. [x] Follow the operating system's reduced-motion setting.
14. [x] Add a Motion On/Off toggle in the header that overrides the OS setting.
15. [x] Remember the motion choice on this device (localStorage, wrapped in try/catch).
16. [x] With motion off, freeze idle animation (sway, dust, ocean, flow pulses) but keep scroll-driven changes.
17. [x] With motion off, calm the particle swirl and remove the letter-by-letter animation.
18. [x] Skip the intro pop when motion is reduced or the page loads part-way down.
19. [x] Keep camera parallax subtle, and turn it off when motion is reduced.
20. [x] Limit chromatic aberration and flash so transitions never strobe.
21. [x] Clamp brightness spikes so bloom can never white out the screen.
22. [ ] Add an "Essentials" mode: a short scroll with no particle morphs, for people sensitive to vestibular motion.

### Readability and layout
23. [x] Put chapter text on solid or glass cards so it stays readable over the 3D.
24. [x] Use fixed panel layers so text sits still while the 3D moves.
25. [x] Shift the camera sideways so models clear the text panels.
26. [x] Place callouts so they avoid panels, each other and the screen edges.
27. [x] Hide callouts whose anchor point is behind the camera.
28. [x] Use high-contrast colours: off-white on charcoal, dark ink on lime and orange.
29. [x] Use tabular numbers for every statistic.
30. [x] Collapse the layout for phones: panels move to the bottom and the rail becomes a progress bar.
31. [x] On portrait screens, pan the gallery across the pedestals instead of shrinking them.
32. [x] Pull the camera back automatically on tall or narrow screens.
33. [x] Use `svh` units so mobile address bars don't cause jumps.
34. [x] Keep body text at 13.5px or larger on phones.
35. [ ] Run a full WCAG 2.2 AA contrast audit against every panel variant.

### Accessibility
36. [x] Use semantic landmarks: header, nav, main, sections, aside.
37. [x] Give each chapter a section with a heading, linked through `aria-labelledby`.
38. [x] Animate headings letter by letter, with a hidden plain-text copy so screen readers read whole words.
39. [x] Mark decorative layers (canvas, SVG, callouts, poster frame) `aria-hidden`.
40. [x] Announce inspector open and close, paint changes and motion changes through `aria-live`.
41. [x] Make gallery pedestals real `<button>`s with descriptive labels.
42. [x] Move focus into the inspector when it opens, and back to the pedestal when it closes.
43. [x] Close the inspector with Esc and switch models with ← / →.
44. [x] Zoom with + / − from the keyboard.
45. [x] Toggle buttons expose `aria-pressed`; paint swatches are a radio group with `aria-checked`.
46. [x] Show focus clearly with a lime outline.
47. [x] Give bar charts and the radar chart `role="img"` and text labels.
48. [x] Keep the custom cursor ring as an extra, never a replacement for the real cursor, and remove it on touch screens.
49. [ ] Offer a text transcript of the whole story as a single readable page.
50. [ ] Test with VoiceOver and NVDA on real devices.

### Fallbacks and resilience
51. [x] Check for WebGL before starting, and switch to a readable static mode if it's missing.
52. [x] Provide a `<noscript>` message and stylesheet so the page still reads without JavaScript.
53. [x] Hide the loader on a CSS timer if JavaScript never runs.
54. [x] If the 3D build fails, catch the error and show the static story instead.
55. [x] If the graphics context is lost, stop the loop and show a short message.
56. [x] Remove NaN and Inf pixels before bloom, so one bad sample can't black out the screen.
57. [x] Guard every shader `pow()` against negative inputs, which MSAA can produce.
58. [x] Cap the frame time step, so returning to the tab doesn't make the scene jump.
59. [x] Pause rendering while the tab is hidden.
60. [x] Debounce resizes to one per animation frame.
61. [ ] On context restore, rebuild the scene automatically instead of asking for a reload.

### Performance
62. [x] Pick a quality tier from device signals (pointer type, memory, CPU cores, screen size).
63. [x] Lower resolution automatically when frames slow down, and raise it again once things recover.
64. [x] Compile every shader before reveal, so the first morph never stutters.
65. [x] Hide lines, ocean, particles and kits whenever they're off-screen in the story.
66. [x] Skip the dissolve noise maths whenever a model is fully revealed.
67. [x] Draw thousands of lines with one mesh per line set (screen-space fat lines).
68. [x] Merge small details (rail teeth, louvres, loungers) into one mesh each.
69. [x] Use one particle system for every morph.
70. [x] Scale particle brightness with particle count, so every tier looks the same.
71. [x] Allow quality overrides for testing: `?q=low|mid|high`, `?msaa=0`, `?bloom=0`.
72. [ ] Move geometry building into a Web Worker to free the main thread during load.
73. [ ] Set and enforce performance budgets in CI (frame time, JS size, first-frame time).

### Privacy and security
74. [x] Use no trackers, analytics, cookies or third-party requests.
75. [x] Self-host three.js and pin it to 0.160.0 instead of loading it from a CDN.
76. [x] Self-host the fonts, loading only the Latin subset.
77. [x] Add a Content-Security-Policy: `default-src 'self'`, and the inline import map allowed only by its hash.
78. [x] Allow no inline event handlers and no inline style attributes in the markup.
79. [x] Block plugins, frames and form posting (`object-src 'none'`, `frame-src 'none'`, `form-action 'none'`).
80. [x] Set the referrer policy to `strict-origin-when-cross-origin`.
81. [x] Store only one preference (motion), and only on the visitor's device.
82. [x] Use a reserved `.example` address as the contact placeholder, so the demo can't email a real stranger.
83. [x] Build any markup that includes data with `textContent` or measured numbers, never raw user input.
84. [ ] In production, send CSP, HSTS, `frame-ancestors`, `X-Content-Type-Options` and `Permissions-Policy` as real HTTP headers (see the README).
85. [ ] Add integrity hashes for module scripts once browsers support them for import maps.
86. [ ] Build a real commission form with server-side validation, rate limiting and spam protection.

### Honesty and content
87. [x] Measure every part, mesh, triangle and material count live from the geometry. None are typed in.
88. [x] Build the bar charts from real per-part triangle counts.
89. [x] Draw the radar chart from measured stats, scaled to the largest model in the series.
90. [x] Show real model-space vertex coordinates in the vertex log.
91. [x] Mark the ship and livery as fictional, the carbine as a non-functional display model, and say the site isn't affiliated with any brand.
92. [x] Keep the carbine purely about design: an anatomy and exploded view, with no firing or ballistics.
93. [x] Keep copy short and concrete, explaining what happens on screen.
94. [ ] Have a domain expert review the part names and real-world specs.

### Quality assurance
95. [x] Run headless Chrome over every chapter at desktop and phone sizes (`tools/snapshot.mjs`).
96. [x] Test the gallery inspect flow (open, explode, paint, blueprint, switch, Esc).
97. [x] Test reduced-motion and no-WebGL modes.
98. [ ] Add visual regression snapshots for each chapter.
99. [ ] Test on real devices: iPhone Safari, Android Chrome, low-end laptops.
100. [ ] Add a Lighthouse and axe accessibility check to CI.

---

## Part B — Taking it to its full potential (150)

### Design language (from the references)
101. [x] An acid-lime, orange, charcoal and sage palette taken from the industrial boards.
102. [x] Modular spec cards with header bars, numbered cells and corner `+` marks.
103. [x] Museum-style `OBJ-01` codes on panels, pedestals, tags and the inspector.
104. [x] A Swiss construction grid with 12 numbered columns and `+` crosshairs.
105. [x] Orange and lime diagonal guides that draw in and out at every chapter change.
106. [x] Poster furniture: corner registration marks and vertical side captions.
107. [x] A live telemetry readout (story time, chapter, camera angles, particles, FPS, resolution).
108. [x] A dot-matrix loader card based on the "2,3m." font card.
109. [x] Numbered vertical tab strips that wipe away to reveal the scene, based on the Délavé reference.
110. [x] A parchment museum data sheet for the inspector, with a radar chart and vertex log.
111. [x] Lime blueprint edges and glowing reveal fronts on every model.
112. [x] Huge grotesk statements, with the second line in lime.
113. [x] Telemetry bar charts on lime and orange cards.
114. [ ] Optional light theme in sage and parchment that recolours the scene to match.
115. [ ] Duotone, halftone paper texture on the cards, like the collage reference.
116. [ ] Rotating radar sweep animation in the inspector, like the MUSEUM poster.
117. [ ] Printable, downloadable posters for each object.

### Story and choreography
118. [x] The carbine pops in behind the title with a spring, an edge flash and a floor shockwave.
119. [x] Orbit rings draw on around the carbine during the intro.
120. [x] A labelled exploded view, with parts moving along designed paths.
121. [x] The carbine dissolves into particles that rebuild as an exploded GT3, which then snaps together.
122. [x] Particles travel in sync with the dissolve front, paired by their order along each model.
123. [x] Wheels spin and the floor grid scrolls during the GT3 chapter.
124. [x] Wind-tunnel lines flow over the GT3's real body shape.
125. [x] A light sweeps along the car's clearcoat.
126. [x] The car breaks apart, the ocean rises, and the ship's decks stack down one by one.
127. [x] Four ship close-ups: bow, stern, broadside and top view.
128. [x] Finale: a particle galaxy with three arms, spiral ribbons, a wireframe globe and a radial burst.
129. [x] Pedestals rise from the floor while light arcs guide the particles to each one.
130. [x] Each model prints onto its pedestal from the bottom up, in blueprint glow.
131. [x] Spotlight cones and accent rings light the gallery.
132. [x] Hand-drawn scribbles sweep in at each transformation, scrubbed by scroll.
133. [x] Flowing ribbons across the screen that bend with scroll speed.
134. [ ] A morph mode where camera and particles keep moving between scroll stops.
135. [ ] Alternate routes, such as jumping from the GT3 straight to the gallery.
136. [ ] An idle "screensaver" that cycles the gallery after a minute without input.

### Models
137. [x] A 29-part carbine with a gold bolt carrier, a curved magazine, a lit optic reticle and a helical buffer spring.
138. [x] A 29-part GT3 with a lofted body, analytic smooth normals, swan-neck wing, center-lock wheels, a decal and light bars.
139. [x] A 37-part liner with a raked bow, 10 terraced decks, 16 lifeboats, a funnel, slides, a pool and a turning radar.
140. [x] Procedural livery in the shader: stripes, sill and a "03" roundel.
141. [x] About four thousand windows drawn by the shader, with randomly lit rooms.
142. [x] Ship names painted onto the hull and transom in the shader.
143. [x] A clearcoat car paint that can be changed live from five colours.
144. [ ] Optional high-detail GLTF versions (Draco and KTX2) loaded on demand.
145. [ ] More detail: brake ducts, a cockpit with roll cage, rifle internals, ship balconies with railings.
146. [ ] Tyre wear, dust and grime as an alternative "used" finish.
147. [ ] Damage and wear sliders in the inspector.
148. [ ] An ambient-occlusion bake for the procedural meshes.
149. [ ] Level-of-detail versions for phones.
150. [ ] A fourth object slot ("OBJ-04 · Yours?") filled from a commission.

### Rendering
151. [x] HDR pipeline with ACES tone mapping and selective bloom.
152. [x] A custom studio environment with soft boxes for controlled reflections.
153. [x] A lens pass: chromatic aberration, vignette, grain and an assembly flash.
154. [x] Shader-based sweep dissolve with a noisy glowing edge.
155. [x] Blueprint edge lines that run ahead of the reveal and linger after the dissolve.
156. [x] A rim-light mode for exploded views.
157. [x] A vector ocean with wave contours, a grid, foam and a Kelvin wake.
158. [x] Contact shadows under the gallery models on their pedestals.
159. [x] MSAA on the high tier.
160. [ ] Screen-space ambient occlusion on desktop.
161. [ ] Screen-space reflections on the floor and the pedestal caps.
162. [ ] Depth of field during the ship close-ups.
163. [ ] Motion blur on fast scroll.
164. [ ] Temporal anti-aliasing to replace MSAA.
165. [ ] Real-time shadows from the key light (cascaded on desktop).
166. [ ] Volumetric god rays through the gallery spotlights.
167. [ ] WebGPU renderer with compute-shader particles.
168. [ ] GPU-simulated particles (GPGPU), with curl-noise trails and collisions.
169. [ ] Instanced, physically based spray on the bow wave.
170. [ ] A night-sky dome with stars and moonlight that matches the ocean glint.

### Interaction
171. [x] Hover and click pedestals in 3D, or use the matching buttons.
172. [x] Inspect mode: orbit by dragging, zoom with wheel or pinch, double-click to reset.
173. [x] Explode toggle in the gallery.
174. [x] Blueprint toggle (a scan transition into wireframe).
175. [x] Turntable toggle.
176. [x] Lights toggle for the ship's windows.
177. [x] Next and previous model with the keyboard.
178. [x] The cursor ring shows "Inspect" and "Drag" labels.
179. [ ] Click any part in inspect mode to isolate it with its name and triangle count.
180. [ ] A section slider that cuts through a model.
181. [ ] A measure tool for real-world dimensions.
182. [ ] Material swatches for every model (anodizing colours, hull liveries).
183. [ ] A drag-to-explode slider instead of a toggle.
184. [ ] Gyroscope parallax on phones (with permission).
185. [ ] Gamepad support for the inspector.
186. [ ] A shareable link that captures camera, paint and explode state.
187. [ ] A screenshot button that exports a branded poster PNG.
188. [ ] "View in AR" using WebXR, or Quick Look on iOS with exported USDZ files.

### Audio (opt-in)
189. [ ] Ambient sound design, off by default, with a clear toggle.
190. [ ] A mechanical click when the carbine's parts seat.
191. [ ] An engine note that follows the car's wheel speed.
192. [ ] Waves and a horn for the ship chapter.
193. [ ] A rising tone for the finale, timed to the pedestals.
194. [ ] Visual captions for every sound cue.

### Content and storytelling
195. [ ] A short "making of" section explaining how each model is built in code.
196. [ ] A material-by-material breakdown per model.
197. [ ] A timeline of each object's real-world history, sourced and dated.
198. [ ] Designer's notes as optional annotation layers.
199. [ ] Case studies for commissioned objects.
200. [ ] A press kit with logos, stills and a fact sheet.
201. [ ] Translated versions (i18n), with right-to-left support.
202. [ ] An editorial chapter comparing the three objects' scale.

### Gallery and commerce
203. [ ] Limited-edition 3D prints of each object (exported STL).
204. [ ] Downloadable desktop and phone wallpapers rendered from the scene.
205. [ ] A licensing page for the models (game-ready versions).
206. [ ] A commission brief builder (object type, style, budget).
207. [ ] Booking a call through a privacy-friendly scheduler.
208. [ ] A newsletter, double opt-in, with no third-party pixels.

### Engineering
209. [x] One renderer and one scene for the whole story, with no reloads.
210. [x] A `Kit` abstraction: parts, explode paths, home positions, edges and stats.
211. [x] A shared shader patch, so every material gets reveal, rim and glow for free.
212. [x] A geometry toolkit: superellipse lofts, smooth tables, strokes and warped extrusions.
213. [x] A Director that maps story time to every scene parameter.
214. [x] A scroll mapper that measures chapters from the DOM.
215. [x] A debug handle (`?debug`) that exposes scene, director and scroll.
216. [ ] TypeScript types for the Kit and Director contracts.
217. [ ] Unit tests for the geometry toolkit and timeline sampling.
218. [ ] A bundler build with code splitting (gallery code loaded on demand).
219. [ ] A visual timeline editor for keyframes, instead of hand-tuned numbers.
220. [ ] Hot-reloadable keyframes during design reviews.
221. [ ] A model config format, so new objects plug in without code.
222. [ ] A headless renderer for generating Open Graph images automatically.
223. [ ] Error reporting that stays private (self-hosted, no personal data).

### Delivery
224. [ ] Static hosting with HTTP/2, Brotli and long-cache immutable assets.
225. [ ] Content-hashed file names.
226. [ ] A service worker for offline repeat visits.
227. [ ] Early hints and preloads for the module graph.
228. [ ] Real-user performance monitoring that respects privacy (aggregate frame times only).
229. [ ] Staged rollout of rendering changes behind feature flags.
230. [ ] CDN edge caching with a strict CSP header.

### Delight
231. [ ] An easter egg: type "TRA" to swap the GT3 for an autonomous strider (reference board).
232. [ ] A hidden fourth pedestal that appears after visiting every chapter.
233. [ ] Seasonal liveries for the GT3.
234. [ ] A day mode for the ocean, with gulls.
235. [ ] A visitor counter rendered as dot-matrix (privacy-safe, aggregate).
236. [ ] A "museum after hours" mode: lights off, torch cursor.
237. [ ] A guestbook wall drawn in vector lines (moderated).
238. [ ] A photo mode with free camera, filters and a frame overlay.
239. [ ] A cinematic auto-play trailer mode for presentations.
240. [ ] A "build it yourself" puzzle: drag parts into place to assemble the carbine.

### Measuring success
241. [ ] Track chapter completion with privacy-friendly aggregate counts, after consent.
242. [ ] Measure how often inspect is used and which model wins.
243. [ ] A/B test the transition lengths for drop-off.
244. [ ] Watch real-device frame-time distributions per tier.
245. [ ] Gather qualitative feedback with a one-question survey after the gallery.
246. [ ] Track commission enquiries through to signed briefs.
247. [ ] Run an accessibility feedback channel.
248. [ ] Check search visibility for "3D model showcase".
249. [ ] Watch social shares of generated posters.
250. [ ] Review all of the above every quarter and retire what doesn't earn its place.
