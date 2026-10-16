# Grandma's ghost (brainstorm)

Status: **draft 3, 2026-10-16: Arnd picked A, with her ghost kept free to appear deeper down, briefly, in fitting moments (§7). Cellar built (#158); the glimpses below in the next PR.** Part of [lore.md](lore.md); leans on [grandmas-diary.md](grandmas-diary.md), the tin ([recipe-box.md](recipe-box.md)) and the intro (#139).

Arnd's ask (2026-10-16): *How about introducing grandma's ghost? We got ghosts now. Let's brainstorm that.*

---

## 1. What she has to fit

- **She is dead.** The intro: Grete Hollmann died this year, at 86, unseen by the family for thirty years. The notary's letter carries her last words: *"The tin is on the chair. Start with the first card. Mind the arch."*
- **She chose not to tell.** She tore the pages out so whoever comes after "learns it the way I did: a bit at a time, only as deep as they've got. That way they will turn back sooner." Any ghost that explains things breaks the one rule she set herself, and the diary with it.
- **The arch was broken open when the first grandchild arrived.** She bricked it in 1966 and kept it 60 years. Who broke it, and when, the game has never said. That's the best open door we have for her.
- **Permadeath.** Grandchildren die one after another; the notary gets wearier, Frau Weber stops making soup. Nobody in the game has ever grieved them *as family*. Grandma could.
- **The ghosts we have** (#131) are the old races: one to a haunt, walk a beat, turn to you, say one line, fade. Not foes; salt does not stop them. Drawn with the humanoid ghost look (dwarves pale gold, elves silver-blue).
- **D11:** nothing that makes you stronger carries over. A ghost grandma who heals or buffs is out.

## 2. Five concepts

### A. The keeper in the armchair (home only)
She died in her armchair in the round room, and she is still keeping the circle. The ghost is the old Grete, cardigan and all, seen through and salt-blue, sitting or standing by the chair. **She never goes past the arch.** Each time a grandchild comes back down the cellar stairs she may say one line (not always), and she speaks to the grandchild by name:
- after a death, to the next one: about the cousin who fell ("Ms. Haddad got as far as the water. She was braver than me at her age.");
- about what the family has reached, never beyond it (the same rule as Frau Weber and the diary);
- about the circle: the 2019 page says it wants new salt every winter. She can ask for a pinch from the tin. (Light touch: a ritual, not an economy.)

*Strong:* gives the death loop its heart; one place, one figure, cheap to build; the cellar becomes the hub's quiet beat. *Weak:* she never sees the dungeon, so the depth story gets nothing new from her.

### B. Young Grete, walking ahead (echoes below)
Down there the blue salt keeps what passed through it. On a level where one of her pages lies, the player sometimes catches **the young Grete, 19 to 26**, walking far ahead along the route she took, lamp up, never noticing you, and fading where her page is. At 18 she is seen pouring her first ring of salt; at 40, running, with something behind her on the stair.

*Strong:* shows instead of tells, and every echo matches a page we already wrote. *Weak:* close to a guide arrow to loot; only as good as the animations; she never talks to the family.

### C. Not her at all
Something wears her shape. At the window of the house at night, at the top of the cellar stairs after a death, once in the dungeon where she can't have been. It is the climber that followed her up in 1966, and it is what broke the arch once she was dead and the circle went unminded.

*Strong:* real dread, and it answers the arch. *Weak:* it turns her sixty years of keeping into a horror twist and her face into a monster's. Hard to undo, and it decides the climbers' motive (LO4 keeps that open). I'd not do this as the main idea.

### D. The grandmas of every world
Below level 11, each buried world had its own grandma (Agnes "who kept the door" is the first we meet). Their ghosts stand by their own bricked arches, each a drifted copy of Grete: the same chin, other clothes, older and stranger with depth. Grete herself never appears.

*Strong:* the purest fit with stacked worlds (LO1); one of the best "oh no" moments the lore could have. *Weak:* it is a lore beat for 11+, not "grandma's ghost"; most players meet none of it for hours.

### E. Presence, no figure
Her armchair holds a dent, the tin falls open at the right card, the circle brightens when a grandchild steps in, a cup of tea is warm on the side table after a death. Nothing is ever seen.

*Strong:* costs almost nothing and never breaks the mystery. *Weak:* not what you asked for; we already have the ghost tech.

## 3. My pick: A, the keeper in the armchair, with one exception

A, because the game's biggest unspent feeling is the family dying one by one, and she is the only one who would mourn them. The depth story already has a voice (the diary), and two Gretes talking would compete. A keeps her where she spent sixty years, which is also why she never comes down: she is still keeping the circle.

**The one exception, later:** if the family reaches level 40, by the two names cut in the rock, she appears there once ever, young (the B look), and the last diary line pays off: *"If you find Papa, tell him I came."* After that, back in the cellar, she has one line she never had before. That's a reward for the deepest players and leaves B's idea as a single beat rather than a system.

**The broken arch** stays open, but she knows something about it. Asked nothing, she sometimes looks at the arch instead of at you. Late in the family's run (say after level 10) she says it: *"I didn't break it. I want you to know that."* Who did stays a question for the deep.

## 4. What she must never do

- **Never explain.** No climbers, no worlds, no first world, nothing a page hasn't told the family yet. She keeps her own rule.
- **Never go past the arch** (the level-40 beat aside), never guide, never point to a page, a find or a way.
- **Never help in a fight,** heal, buff, revive or warn (D11).
- **Never answer questions.** No dialogue tree: she speaks when she chooses, one line, then she's quiet. Most visits she says nothing at all.
- **Never contradict the diary,** and never speak of 1959–1966 in more detail than her pages do.
- **Never be scary.** Her ghost is the one warm thing in the cellar; dread belongs to what's below.

## 5. Questions for Arnd

1. **Which concept?** A (my pick), B, C, D or E. They mix: A plus the level-40 beat is my pick; D can join any of them later as an 11+ lore beat.
2. **Old or young?** Old Grete at home (my pick), young Grete only at 40.
3. **The circle's salt:** she asks for a pinch each "winter" (each few grandchildren) as a small ritual, or no mechanic at all (my pick to start: no mechanic, just lines).

## 6. How it would build (after a pick, A)

Small and on existing seams: a ghost on Scale's human body with the humanoid ghost look (`Humanoid.create(look, { ghost })`, her own salt-blue tint) in the cellar's round room; her lines as data keyed to the family's deepest level, the notary's list of the fallen and the pages found (the same "known" record Frau Weber reads); one line per return down the stairs at most. The level-40 beat with the diary's marks at 40 (`DiaryPage.marks`).

## 7. Decision (Arnd, 2026-10-16)

**A, the keeper in the armchair.** And: *"reserve the ghost as a possibility to appear later deeper down too, only in fitting moments and briefly."*

So the "never go past the arch" rule softens to: **she comes below only at a few set moments, for a few seconds, once each per family.** My defaults for those (built after the cellar):
- Level 10, the first time the Tall One is seen: she stands between it and you for a moment, at the salt, and is gone. (Her 1963 page: "It has not followed. I don't think it is allowed to.")
- Level 18, where she laid her first ring (her page's spot): seen standing there, far off (10–22 m), as you come in sight of it.
- Level 40, by the two names: she reads them, and says the only line she ever says below: *"I came, Papa."* Then gone; back home she has one new line: *"You saw his name. And mine under it." She looks at you a long time. "That's far enough now. For all of us."*

Other defaults: she is the old Grete everywhere (one ghost, one body; the young look is dropped), salt-blue; questions 2 and 3 of §5 go with my picks (old; no salt mechanic, only lines). At home she shows only when she has something to say: she rises by the armchair as a grandchild comes into the round room, says one line, and fades.

## Changelog
- 2026-10-16 draft 3: cellar ghost built (#158); glimpses below built as set out in §7 (each once per family, kept in the tin).
- 2026-10-16 draft 2: Arnd picked A; deeper appearances reserved for set moments (§7).
- 2026-10-16 draft 1: five concepts, pick A with the level-40 beat, the nevers, questions.
