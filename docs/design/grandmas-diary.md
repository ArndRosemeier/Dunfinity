# Grandma's diary

Status: **draft 2, 2026-10-16. Built in the "Backstory and ancient scripts" thread.** Part of [lore.md](lore.md); fits the story spine in [town-and-first-strata.md](town-and-first-strata.md) §1, the tin in [recipe-box.md](recipe-box.md), and the key (lore.md §4.4).

Arnd's ask (2026-10-16): *make granny's diary and think about how to integrate it.*

---

## 1. The idea in one paragraph

Grandma kept a diary on her trips down, 1959–1966, in a small oilcloth notebook. When she came up for the last time she **tore out every page about down there** and left each one where she had written it. Her reason, in her own words: whoever goes down after her should learn only as much as they need, only as deep as they have got. What stayed in the book are the few pages she wrote at home afterwards, 1966–2026, in her careful old hand. So the diary is in the tin from the first minute, thin and full of stubs, and every stub carries the date of a page still lying somewhere below. Finding a page puts it back in the book. The book stays in the tin, so later grandchildren keep the pages the earlier ones found.

It does three jobs at once:
- **Story, by depth.** One page per stratum beat (lore.md §2), in her voice, the order the player can reach them.
- **A progress meter that is also a story.** The stubs show how much of her is still missing, and where (each stub has a date, and the dates go deeper).
- **A reason to explore sideways,** not just down: a page is somewhere on its level, not at the arrival.

Her name is **Margarete Hollmann, "Grete"** (my pick; nothing in game names her yet). Her father is **Josef Hollmann**, a miner lost in 1947. The diary is signed "G."; her full name is only ever seen scratched into the rock at level 40, next to his.

## 2. How it plays

| What | How |
|---|---|
| Open the diary | **J**, anywhere (it lives in the tin, and the tin goes down with you). A paper panel like the tin's: the kept pages and the found ones in date order, each torn-out page as a stub ("2 May 1959, torn out") |
| A page down there | Folded paper under a stone, the corner showing, somewhere on its level (found from the seed, like her camp: a good walk from the arrival, dry floor, headroom). **E: read the page** |
| Reading a page | Shows it in her young, fast hand; it goes back into the diary (a line on the HUD says so) and drifts in salt the first time anyone of the family reads it: *"Grandma was here."* |
| Carried over | Found pages are kept by the tin (like its salt and the key), so the next grandchild opens a fuller book |
| The rubbing | The level-9 camp note and rubbing stay as they are; the diary's 1963 stub points at it ("the camp page: left with my thermos") |
| The notary's letter | Gets one more line from her: *"Her diary is in the tin, what's left of it."* |

Built in draft 2:
- **Her hand.** Every page is a photographed notebook page in her handwriting, painted by Muse (`tools/lore/diaryPages.ts`, pictures in `public/diary/`), shown in the open diary with its text under it. Every picture was read against its text; long pages took a few takes (the model likes to write a word twice where a line wraps).
- **Rune pages.** Level 25 gives seven more Kerf runes (R, W, I, L, U, G, M; "R and W might be the other way round"), level 30 five Thread letters (K, T, S, N, O). Reading the page pencils them into the key.
- **His chalk and their names, on the rock.** The pages at 21, 33 and 40 lie at the foot of a face, and the face carries the marks in our capitals, following the rough rock: chalk *J.H. 1949* (21); chalk *J.H. 1953. STILL GOING DOWN* and *GRETEL GO HOME*, the second lower, at her eye height (33); *JOSEF HOLLMANN 1955* cut deep, *GRETE HOLLMANN 1966* scratched under it (40). Where a level has no face fit to write on, the page lies without them.

## 3. The text

**Inside the cover** (old hand): *Margarete Hollmann. Lindenstraße 4. If found, put it back in the tin. If you are reading it anyway: the pages that matter are not here. I left them where I wrote them.*

### Torn out, found below (young, fast hand)

| Level | Date | Page |
|---|---|---|
| 1 | 2 May 1959 | Went through the arch tonight. Mother thinks I'm at Liesel's. Rooms and rooms of square pillars, all the same, all dark. Somebody chalked numbers on them and the numbers count down. I counted with them as far as forty and came home with my knees shaking. I'm nineteen. Papa went down every day for twenty years. |
| 2 | 23 August 1959 | The chalk numbers are Papa's. He crossed his sevens like the French do, and so do these. They lead away from the old shaft, not towards it. He wasn't trying to get out. He was going somewhere. |
| 3 | 8 November 1959 | The salt down here is blue, and it gives off light like a watch face. Mother's "tonic" that the company sent every Christmas after 1947 was this, I'm sure. I put a pinch on my tongue. It tasted of nothing and I could see in the dark for an hour. Not telling anyone. |
| 5 | 14 February 1960 | Met one of the miners. Still down here, thirteen years on, and more salt than man now. He had Herr Kranz's watch chain. I said "Herr Kranz?" and he stopped, as if he was listening for someone a long way off. Then he came at me. I ran. I'm sorry, Herr Kranz. |
| 7 | 19 June 1960 | Water running uphill, quietly, along a channel, as if that were normal. I followed it up to a bunker the army built in the war: chairs, a stove, a calendar left at September 1947. Somebody was living here after the mine closed. |
| 8 | 30 October 1961 | Found the duty roster for the last shift nailed up in the bunker. 11 September 1947. J. Hollmann, fourth name down. Somebody ticked the names off as they came back. His has no tick. Somebody had written next to it in pencil, very small: *went down*. Not *missing*. Went down. |
| 10 | 2 April 1963 | The big stair. At the top of it something was standing. Tall, thin, very still, its head bent under the roof. It did not move for an hour and neither did I. When I went it turned its head to watch me go. It has not followed. I don't think it is allowed to. |
| 11 | 17 September 1963 | Under the caves there is a town. A whole town, buried, with a river bed and a street that bends where ours bends. A house where ours stands. In its cellar, an arch, bricked up. Someone did this before me. Someone was me before me. |
| 14 | 3 March 1964 | Gravestones in the old town, in words I can read: *Here lies Agnes, who kept the door.* The door is a sealed arch with a ring of marks round it, like letters hanging from a washing line. The things down here walk round the ring and never through it. I copied it, every stroke. |
| 18 | 26 July 1964 | Tried it. A ring of the blue salt in the shape of the marks, round my camp. Something stood outside it all night, breathing. In the morning there were tracks right round it and none inside. Agnes, thank you. |
| 21 | 9 January 1965 | Halls cut square out of black stone, big enough to hold the church. Gold lines in the walls, and writing, all straight strokes. And on a pillar, in chalk: *J.H. 1949*. Two years after they stopped looking. Two years. |
| 25 | 22 May 1965 | Papa was learning the runes. Under one line of them he had chalked letters, one under each: T, H, E. I've got more of them now: R, W, I, L, U, G, M. R and W might be the other way round. The rest I'll get from the walls. |
| 30 | 15 October 1965 | Another kind of hall, all arches, grown more than cut, writing up the ribs in the same hanging marks as Agnes's door. The square people say the tall ones come up to take back what was taken. The arch people say they're only going home. Papa believed the first. I don't know what I believe. Some of the hanging marks I can read now: the hook is K, the dot is T, the curl is S, the sweep is N, the ring above is O. |
| 33 | 6 February 1966 | *J.H. 1953. Still going down. Gretel, go home.* He knew I'd come. He knew and he wrote it anyway, at the height of my eyes, not his. |
| 37 | 11 June 1966 | Every stair down here goes up. Every one, in every hall, too big for people. Things are coming up from the bottom, slowly, a stair at a time. And everything down here is a copy of something up there, or the other way round. |
| 40 | 2 September 1966 | Found his name cut deep into a column: JOSEF HOLLMANN 1955. I scratched mine under it. This is as far as I go. Something is on the stair behind me. It has been for three days. I'm going home the fast way, and it's coming. |

### Kept in the book (at home, the old careful hand)

| Date | Page |
|---|---|
| 4 September 1966 | Bricked up the arch tonight, with the blue salt in the mortar, and laid the circle. It stood on the bottom step and watched me do it. It's still there. It will be there in the morning. I'll be here too. |
| 5 September 1966 | Tore the pages out and took them back down, each to where I wrote it. If someone has to go after me, let them learn it the way I did: a bit at a time, only as deep as they've got. That way they will turn back sooner. |
| 1 March 1971 | Started writing the cards. If one of them has to go, they'll go well fed and clever, or not at all. |
| 12 July 1996 | The little one drew me a picture of the cellar. A monster with a hat on. Into the tin it goes. Their parents won't come again. I said too much at supper. Better that than too little. |
| 3 January 2019 | The circle wants new salt every winter now, and I'm seventy-nine. One of them will have to do it. I've left it as long as I could. |
| 2026 (no day) | To whoever has the tin. I'm sorry. Start with the first card. Mind the arch. Don't go further than you have to. And if you find Papa, tell him I came. |

## 4. Fit with what exists

- Spine (town-and-first-strata §1): 1947 mine closes, she was seven (born 1940); 1959–1966 trips; 1966 the tall one; bricks the arch; cards in the old hand; the drawing in the tin (1996, "thirty years ago"). All kept.
- Lore (lore.md §1–3): her father's chalk dated 1949, 1953 (and 1955 at 40); the Ossuaries town is ours one world older; Agnes is that world's grandma; the climbers; the two accounts; first-world salt holds them. Kept.
- Level 9 camp note (1963) stays the one page she never tore out (it was never in the book: a loose note).
- Level 10: the Tall One "is not allowed to follow" (salt: the circle, lore §1).

## 5. Build

1. `src/lore/diary.ts`: the pages as data (date, depth, hand, text). `src/gen/diaryPages.ts`: where a level's page lies (pure, from the seed, like the camp).
2. `level.writing` gets the page as a third kind; the prop pass lays the folded paper under a stone; E reads it.
3. The tin keeps which pages are found (`Tin.page(depth)`, salt once); `DiaryView` (J) shows the book.
4. Rune pages teach letters (`DiaryPage.key`); the marks on the rock (`DiaryPage.marks`, `faceBeside`, `markLine`, `latin`); the pages painted in her hand.

## Changelog
- 2026-10-16 draft 1: the diary, its text, how it plays.
- 2026-10-16 draft 2: rune pages, his chalk and both names on the rock, the pages in her hand.
