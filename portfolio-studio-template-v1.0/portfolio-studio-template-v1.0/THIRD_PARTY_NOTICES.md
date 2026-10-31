# Licenses and asset provenance

Application code and original demo assets are distributed under the MIT license in LICENSE.

All included project images, avatar placeholder, contact icons and three geometric GLB models were generated specifically for this starter. Demo MP4 clips are programmatic FFmpeg test patterns, with no music or third-party footage. No original personal portfolio media or third-party font binaries are included.

External packages retain their own licenses. Astro, Three.js, Sharp, esbuild and Miniflare are installed by npm; inspect each installed package's LICENSE and transitive dependencies before redistributing vendor bundles. No dependency binaries or node_modules are shipped in the ZIP. FFmpeg is not included; install a separately licensed build only if regenerating demo MP4s.

The optional advanced character modules require compatible rigs/textures; the starter does not include any external character model. `demo:generate` can regenerate the geometric assets with FFMPEG_PATH pointing to your own executable.
