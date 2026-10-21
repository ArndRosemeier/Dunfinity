# Actors figures' shadows warmed, and shared

- The title screen and the character creator no longer build shadow shaders on the render path when the townsfolk come into the scene.
- An Actors figure's solid clothes now share one shadow shader with every other figure's (their shadow ignores colour), so the village warms far fewer shaders; the body and hair, which differ per figure, are warmed one by one.
- The old humans' hair is warmed hairstyle by hairstyle for the same reason.
- An Actors figure's teeth, tongue and eyes cast no shadow (too small to see, and each would need a shader).
