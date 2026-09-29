SENTRAX HOMEPAGE SCROLL STORY: SPEC

1. PURPOSE
- A short, flashy, scroll-driven 3D story for the Sentrax homepage, for visitors who are just scrolling. It must be understood in about 20 to 30 seconds with nothing to learn.
- It explains one use case: finding mobile medical equipment in a hospital with BiLink.
- It is generic (no real customer), built first for an internal team demo. Stories based on real use cases come later.
- The full interactive demo (SPEC.md) stays exactly as it is and is linked from the end of the story. Do not change or regress it.
- SPEC.md section 3 (content and claims policy) and the no em-dash, no italics rule apply here too.

2. EXPERIENCE
- A sticky full-viewport stage stays pinned while the visitor scrolls through about 6 viewport heights. Scroll position is the only control until the final beat.
- Each beat has one headline (max 8 words) and one line of body text (max 18 words), as real HTML text over the stage, large and bold.
- No menus, layer toggles, dashboard, quality menu or dev UI. A small "Illustrative animation" label sits in a corner.
- Scrolling backwards plays the story backwards smoothly.
- One tap at the end, then two buttons, both opening in a new tab:
  - "Book a meeting" (primary, booking URL from SPEC.md).
  - "Explore the full demo" (secondary, VITE_DEMO_URL or this app's demo).

3. THE STORY: BILINK IN A HOSPITAL (draft copy, all approved: false)
Beat 1, establishing:
- Visual: a wide cinematic shot of the ward on the dark stage; a nurse at the station, looking around.
- Headline: "Where is the infusion pump?"
- Body: "A nurse needs one now. It could be in any room on the ward."
Beat 2, tag:
- Visual: the camera dives to a pump in a patient room; its PINIX tag lights up and emits glowing pulses.
- Headline: "Every device carries a Sentrax tag."
- Body: "Small, battery-powered, and always signalling where it is."
Beat 3, rooms listen:
- Visual: the camera rises; the NODIX CEN-1 anchor in each room pulses and each room's volume lights up in turn. A tag in the corridor just outside a door stays unassigned (no hallway bleed), shown subtly.
- Headline: "Each room listens."
- Body: "A BiLink anchor in every room hears its tags and knows which room they are in."
Beat 4, relay:
- Visual: light arcs travel from the room anchors to the corridor gateways, then a data stream rises to a SOLIX node above the building.
- Headline: "No gateway in every room."
- Body: "Anchors relay verified room events to a shared gateway, and on into SOLIX. No cables to each room."
Beat 5, the tap:
- Headline: "Try it: find the pump." with a large "Find the pump" button.
- On tap: the camera flies to Room 104, a beam of light marks the pump, and a phone-style card animates in: "Infusion pump P-07 / Room 104 / just now".
- Then: headline "Found. Room 104.", body "Every tagged device, visible on screen in real time.", plus the two buttons.
- If the visitor scrolls past without tapping, the find plays automatically so nobody hits a dead end.

4. VISUAL DIRECTION: FLASHY, NOT MUTED
Target feel: a premium tech product launch page. Bold, cinematic, glowing, high contrast. Not muted, neutral or corporate grey.
Build three looks as switchable presets (?look=a, ?look=b, ?look=c; default a). I will pick one after demoing to my team.
- Look A "Night model":
  - Near-black stage tinted from brand purple #352E86, with a soft gradient and vignette.
  - The building as a clean matte white architectural model, with no realistic textures.
  - Strong rim lighting, a subtle floor reflection, and signals as neon glows.
- Look B "Glass":
  - Frosted translucent walls with bright edges.
  - Cool blue-white light and stronger bloom; more futuristic.
- Look C "Realistic night":
  - The existing realistic materials, relit at night with pools of practical light and window glow.
  - The same neon signals as the other looks.
Colour in all looks:
- Signals and effects in brand colours with bloom: logo blue #6683C2 for radio pulses and room glows, and purple for data streams.
- Button red #D31F4C only for the found-pump beam and the primary button. Use brighter tints of these colours for glow where needed.
- Bloom is allowed in this mode. The no-bloom decision applies to the full demo only.
Camera and effects in all looks:
- Eased dolly, orbit and dive camera moves, with depth of field on close-ups.
- Animated light trails on relay arcs, a particle data stream, pulse rings, and room volumes that fill with light.
Typography in all looks:
- Poppins headlines, very large and bold, with an animated word-by-word reveal. Lato for body text.
- White text on the dark stage; red accent only on the primary button.
Other rules for all looks:
- Characters stay faceless mannequins, finished to match each look.
- Keep it tasteful: smooth, eased motion, never jittery or cluttered, with at most one effect drawing the eye per beat.

5. SCENE AND TIMELINE
- Reuse the hospital world, devices, characters and engine. Crop to what the story needs (for example the corridor, 4 patient rooms, storage and the nurse station) to keep the payload small.
- Run the simulation once with a fixed seed and record agent positions and events into a timeline. Scroll scrubs that recording, so the same scroll position always shows the same frame, forwards or backwards.
- Stories are data: /src/scroll/stories/<id>.ts defines the beats (text, camera keyframes, timeline range, highlights, effects, tap action). Adding a warehouse story or a real use-case story later must only need a new data file.

6. DEVICES AND FALLBACKS
3D, where the device can handle it:
- Requires WebGL2 and a quick performance probe in the first second (median frame time under 40 ms).
- If performance drops later, crossfade to video.
Video, on weak devices:
- Used when WebGL2 is missing, the probe fails, Save-Data is on, or navigator.deviceMemory is 2 or less.
- One short muted looping clip per beat, as MP4 (H.264) and WebM with poster frames, in the same look, switched by scroll position.
- Generate the clips with a repo script from the recorded timeline (headless capture plus ffmpeg) so they can be regenerated when the story changes. Commit the output.
Static:
- A poster image per beat when prefers-reduced-motion is set, or with ?force=static.
Testing and phones:
- ?force=3d, ?force=video and ?force=static override detection for testing.
- Phones get portrait framing per keyframe, with the text card in the lower third over a gradient.

7. EMBEDDING AND PREVIEW
Embedding:
- It must run inside the WordPress (Elementor) homepage, driven by the host page's scroll, without breaking or restyling the host page.
- Choose the approach (for example a small loader script passing scroll progress to an iframe via postMessage, or a Shadow DOM mount without an iframe) and explain the choice in DECISIONS.md.
- The loader is 10 KB gzip or less and loads nothing heavy until the section is within about one viewport of the screen. No layout shift on the host page.
- Write EMBED.md with the exact snippet to paste into an Elementor HTML widget, and test it in a plain HTML host page in the repo.
Homepage mock at /home-preview/, for my team demo:
- The Sentrax header and logo, then a hero using the live homepage's current wording.
- Then the scroll story, then two placeholder sections and a footer.
- A small "Mock" label in a corner. With ?looks=1 it also shows a small look switcher.

8. BUDGETS
Story JS:
- 350 KB gzip or less, beyond the loader.
3D assets per look:
- Looks A and B: 6 MB or less on desktop and 3 MB or less on phones.
- Look C: 9 MB or less on desktop and 4 MB or less on phones.
Video fallback:
- 4 MB or less for all clips combined at phone resolution, per look.
Frame rate:
- Target 60 fps on a recent laptop and 30 fps or better on a mid-range phone.
Analytics, via the existing track():
- scroll_story_view, scroll_beat (with beat id), find_tapped, find_auto, cta_clicked, fallback_used (with reason).
