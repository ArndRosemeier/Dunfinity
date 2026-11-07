# Actors 0.34.4 and the latest AssetGenerator

- Humans come from Actors 0.34.4: shoes and boots fit the foot instead of standing a size too big, no leg cut away above cuffed or flared boots, no see-through lace hiding skin, and the "humans only" creator offers no horns, tails, scales, leaf hair or crest fins.
- AssetGenerator submodule on its latest main (a0eae25).
- Shader hooks take AssetGenerator's fix for a three.js bind-group bug: a mesh disposed before its shader was built no longer takes shared uniforms down with it ("writeBuffer: not a GPUBuffer", parts of a figure vanishing).
