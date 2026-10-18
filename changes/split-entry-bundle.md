# Smaller download: the game's code split up

- The Blender props pack is a file of its own (`src/gen/models.pack.bin`), fetched once and shared by the page and its workers, instead of 2 MB of text baked into the page's code and again into each worker's.
- three.js comes in a chunk of its own, so it stays in the browser's cache across new versions of the game.
- The Lab's code loads only for `?lab`.
- The entry chunk drops from 4.33 MB to 1.33 MB (1.68 MB to 0.49 MB gzipped); each worker from about 2.2 MB to about 0.2 MB. No more chunk size warning.
