# Actors figures' shadows warmed one by one

- The title screen and the character creator no longer build shadow shaders on the render path when the townsfolk come into the scene: each Actors figure has shadow shaders of its own, and the shadow warm-up now draws every part it wears instead of one per kind.
- The old humans' hair is warmed hairstyle by hairstyle for the same reason.
- An Actors figure's teeth, tongue and eyes cast no shadow (too small to see, and each would need a shader).
