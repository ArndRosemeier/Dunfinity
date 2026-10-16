# A loading screen, and a clear message when the browser cannot draw

- The game opens on a black screen with its name, a bar and what it is doing (laying out the level, dressing the figures, warming up the shaders, carving the rock), from the very first moment until the first level is on screen.
- A browser that can draw neither with WebGPU nor with WebGL 2, or whose graphics will not start, now gets a plain message saying so and what to try, instead of a black screen. Any other failed start says what broke, too.
- Going home, starting again as the next grandchild or jumping with the debug menu now waits in the dark (with a quiet "The rock takes shape") until the new level's rock is there, instead of showing it half built. Nothing moves while it waits.
