# Changelog

## v0.261 — Salt Sight

- New: grandma's Salt Sight on G (a "Sight" button by touch). While it is on, every creature in sight gets a slowly creeping line of salt around it, coloured by how tough it is for you right now: pale blue easy, green a fair fight, amber risky, orange run, red deadly. Your breath does not come back while you look.
- It measures the fight against you as you are (your weapon, your practice, your helmet), not against the depth: a ten-metre grazer reads deadly on level 1, a young giant can read fair.
- A kind your family has never killed gives only a rough read (looks harmless, dangerous or deadly) with a dashed, wavering line; the first few kills give a guess ("risky?"); after that it is sure.
- The target's health bar now says how tough it is under its salt-grown frame.

## v0.260 — Buying and selling across the counter

- Stepping up to Kemal's or Ilse's counter (E) now opens a proper shop window: what they sell, with its price and what it does, beside what of your pack they would buy, and grandma's purse at the top.
- Buy or sell one line at a time (W/S and E, or click its button); at Ilse's, sell all your finds in one go.
- Ilse now also buys spare items from your pack, for half what Kemal asks for them new. Kemal still buys nothing used.
- The shop window is one counter for any merchant, so a trader met below can use it later.

## v0.259 — The hall between worlds

- Stepping through a thin place, its way back, a gate or Way Home's door no longer cuts to black: you stand in a long hall of the world you are going to, the window you came through glowing behind you.
- Walk down it while that world is built behind it. Its far doorway lights up once the world is ready; until then the hall goes on.
- Walk through the lit doorway and you are there, as the hall fades. Nothing there moves while you are in the hall.
- A thin place's pocket only starts counting down once you are out of the hall.

## v0.258 — Minimap names fit

- The minimap names places short (Grandma, Kemal's, Ilse's, Weber) and puts a name on the other side of its dot when it would run off the edge, so every name reads whole.

## v0.257 — A gift waits in every thin-place pocket

- Stepping through a thin place, a crystal of that deeper world glows on the floor a few steps ahead, and a thread of rising salt leads to it. Take it before the pocket lets go of you.
- The crystal is a find like the others: it goes in your rucksack and the shops buy it, worth more the deeper the world it came from.

## v0.256 — A minimap

- A small map in the bottom right corner of the screen, north up and centred on you, in the map's salt-vein look: what you have seen below, the whole village with its shops and grandma's house up top.
- It hides while the big map (M) is open and once you are dead. Settings → Graphics → Minimap turns it off.
- Played by touch it sits top right, under the purse, out of the thumb's way.

## v0.255 — Hanging from a sun shows you

- Hanging from a sun, your grandchild is drawn under it, arms up (the figure had stayed on the floor).
- A sun's halo dims when you are close to it, so riding one no longer blinds the view.

## v0.254 — Way Home opens a door you walk through

- Grandma's Way Home no longer fades to black: after the eyes-shut wait a window like a thin place's opens a few steps ahead, showing grandma's room with her armchair. Walk into it to go home.
- Used again by her armchair, Way Home leads back down: the window shows the place you left, as you saw it when you shut your eyes there, and walking in puts you back on that spot.
- The way back works with the card at its first rank; its second rank now opens the way sooner (2 s instead of 4).

## v0.253 — The way down is easy to find and safe

- E to climb down a shaft now shows anywhere round its rim, not only at one small spot beside the ladder: the climb walks round the hole to the ladder by itself. Grandma's old shaft has its ladder on the far side, so the spot was easy to miss.
- The prompt no longer flickers: once shown it holds a little farther out, and a moment off the floor (a bump in the rock) does not take it away. The way up is offered from a little farther off too.
- Falling into a shaft is no longer instant death: the nobody catches hold of the ladder and climbs on down to the next level.
- The first steps' hint says to press E anywhere at the edge of the shaft.

## v0.252 — Featherfall: an umbrella, a salt feather, an owl-down cloak

- Some things worn now slow a fall, so letting go of a sun orb high up need not kill. With any of them on, no landing hurts.
- Kemal sells a big black umbrella for the off hand (key 9 at his counter, €25).
- Ilse sells grandma's salt feather as a trinket (€60).
- Once the stranger from below is in town, Ilse also sells an owl-down cloak (€140). With it you sink like a feather from any height.
- The slowest piece worn wins, and a finer one slows the fall more.

## v0.251 — Shop signs no longer flicker

- The painted panel on Kemal's and Ilse's sign boards sat exactly flush with the board's face, so the two fought and flickered; it now stands 2 cm proud of the board.

## v0.250 — Suns over the glowing rock

- Now and then a sun rises out of glowing rock: a boiling ball of light 1 to 4 m across, not quite round, with a wide warm halo.
- It wanders the level for about five minutes at varying speeds, bobbing up and down, and keeps clear of the rock. At the end it sinks low and shrinks to nothing.
- Prominences swell on it, break off and fall as burning drops that splash on the floor.
- It lights the halls far around it (bigger suns farther) and puts what it lights on the map.
- Stand under one and press E to hang on and fly along. It climbs high with you. Press E to let go; when it fades you fall. The fall can kill you.
- New `Body.featherfall` hook for worn items that let you float down.
- Debug menu: "Call a sun".
- Sounds: a warm swell as one rises, a hiss where a drop splashes, a low roar near a sun.

## v0.249 — Every new game gets its own world

- Each new family now plays a dungeon of its own: a fresh random world seed is drawn when a family begins (first visit, or New Game in Rogue like or Adventure) and kept in its save, so Continue and Load bring back the same world.
- Before, every game without a seed in the link played world 1.
- New Game over a kept family restarts the page once onto the new world, then opens the character creator and the introduction.
- Unchanged on purpose: the village and grandma's cellar look the same in every game, and links with `?seed=` (and test views) keep the world they name.

## v0.248 — Weapons held in a closed fist

- Grandma's knife sits in a fist closed round its handle, the thumb wrapped over, instead of lying across the top of a half-open hand.
- Held ready, the knife's blade, the hatchet's and the pick's heads and the crowbar point ahead at the foe, not back at your own face.
- The pick's blow brings its head down ahead into the rock instead of pointing it at the sky (the Salt-Touched mine the same way).
- Every swing, block, throw, roll and pick-up keeps the weapon in the fist.

## v0.247 — A rucksack on the back

- What the pack holds now comes from the rucksack on a grandchild's back, a new Back slot in the pack panel. Every grandchild starts with a canvas rucksack (8 things, as before). Without one, only the pockets (2).
- Kemal sells an army rucksack (key 8 at his counter, €40) that holds 14.
- Once the stranger from below is in town, Ilse sells a salt-woven satchel (key 1 at her counter, €150) that holds 40, far more than it is big.
- A rucksack's quality scales what it holds. One is only taken off or swapped when what is carried fits in what is left.

## v0.246 — Sounds for the sun orbs

- New sounds for the big sun orbs: `sun_rise` (fire catching and swelling as a sun pulls out of the rock, two takes), `sun_drip` (a burning drop splashing on stone with a hiss, three takes) and `sun_hum` (a low, steady flame roar, looped, to place near a sun).

## v0.245 — The title's hiss fades as the melody comes up

- Once the TV report is over, the set's hiss and its crackles fade to a whisper while the title melody swells to the foreground (it used to get louder).

## v0.244 — Targeting what you see

- Tab now only picks creatures you can actually see: on screen and not behind rock or a house. Before, it also went through creatures hidden behind walls, so a rat right in front of you could stay out of reach of Tab.
- Each Tab goes round every creature you see before coming back to the first, even while they move about.
- Clicking a creature with the mouse free picks it as your target, and a stab with no target picks the creature right where you look.
- Something that hurts you while you have no target becomes your target.

## v0.243 — Title melody

- A title theme for the start screen: a wistful, slightly eerie lullaby on music box, celesta, cello and strings (Lyria), looped seamlessly at 78.9 s where its theme comes back. It is the `title` track in the score, ready for the title screen to play under the TV report and bring up once the report ends.

## v0.242 — The title's report airs once, then snow and a melody

- The TV report on the title plays once instead of looping; afterwards the set shows snow and hisses on.
- A title melody plays quietly under the report and swells to the foreground once it ends (track `title`, made by the sound thread; silent until it is in the music list).

## v0.241 — The village on the map

- Up in the village the map (M) shows all of it from the start: the streets, gardens and fields, every house outlined in salt, the quarry hill in contour lines. Below, it still shows only what you have seen.
- Grandma's house, Kemal's hardware store, Ilse's pawn shop and Frau Weber's house are named on it.

## v0.240 — One can walk into the shops

- Kemal's and Ilse's open doors had an invisible wall on the threshold: the doorway's air ended just where the street's began, and the seam was too narrow for a body. The doorway's air now reaches well into the room and out over the street.
- A test walks a body in off the street to each counter.

## v0.239 — Quiet mouse capture

- Capturing the mouse goes through one place (`Controls.capture`): it asks only when the browser allows it (right after a click or a key other than Escape) and a refusal no longer shows errors in the console.
- Leaving the pause menu or Grandma's tin with Escape leaves the mouse free; one click on the game captures it again.

## v0.238 — Footsteps in time with the feet

- Footsteps now sound when the figure's heel actually comes down in the walk, jog, sprint and crouch animations, two a gait cycle. They used to sound every 0.75 m walked, much faster than the feet.
- Climbing rock and ladders keep their own rhythm.

## v0.237 — Every kind of creature in every workings

- The Quarry, the Salt Works, the Cisterns and the Threshold now each have every kind of creature: feral dogs, brine eels, scavengers, the Salt-Touched and cave crickets can turn up in workings that used to have none, only fewer of them there.

## v0.236 — Mobs on every level

- Slimes, scavengers and brine eels can turn up on any level now, not only from levels 2, 4 and 5. Above their usual depth they are rare and few: a lone eel, a single scavenger at a fire, a small colony of smaller slimes. Eels met early bite less.
- Any kind of strange creature may live on any level: hunting kinds and a third peaceful kind can appear near the top too, just less often, and more often the deeper you go.
- A giant near the top is a young one, much smaller and weaker, and grows with depth.
- Herds and hunters' dens grow gradually more common with depth instead of jumping at level 11.

## v0.235 — Passages between styles never cut off nearby

- The field looked for the passages between styles only among the regions of other styles up to 280 m (blend distance) from a point, and only for passages from the point's own region. So where a style carried a passage's end deep into its region, or where a point stepped from one region into the next of the same style, a passage's air dropped out of the field a few metres from it. Deep in the rock, but the field jumped there (and a mesh chunk next to it could have been skipped).
- Now each region keeps a list of every passage near it, whichever regions it runs between (`Regions.regionsRound` finds the regions round a point), so a passage drops out only hundreds of metres off, deep in rock.

## v0.234 — Nothing kept for the deep

- Every ten levels from level 1 are a region: each world draws its workings (the Quarry, the Salt Works, the Cisterns, the Threshold) and three to five styles from all of them, on any level (Arnd: most players never see what was kept for level 40).
- Depth only shifts the odds: lava, geodes and the strange styles are rare near the top and common deep; fallen workings the other way round.
- A region is named for what it is most made of: the Ossuaries, the Old Halls, the Root Hollows, the Geodes, the Burning Deep and more; plain caves keep their workings' name.
- Level 1 stays easy to read, near the town: the workings round the ladder and one other style.
- Root hollows cut through the Salt Works' tall workings stack a little (one burrow over another), which the goblin warrens' look test now compares against Threshold-cut levels only.

## v0.233 — Crickets, slimes and eels feed and rest

- Cave crickets nibble the salt off their rock and sleep on it with their group, one staying up as a sentry.
- Lumen ooze off to lick the glowing salt off the rock and Murk to the water's edge; both sleep with their colony.
- Brine eels nose along the bottom of their pool for food and lie still on it in their hours of rest.
- Asleep, each notices you only when you come closer.
- New Blender clips: Graze and Rest for the cricket and the eel, Feed and Sleep for the slimes.
- Animals no longer get stuck short of their food: when the straight way is blocked, they walk round the rock to it, and their food spots are only ones they can actually reach.
- Animals are no longer placed in water or shoved into rock by their herd while they feed or rest.
- A hunting creature that fights back now shows its full tell before the blow lands, the same as when it hunts.

## v0.232 — Steadier shadow warm-up under the title

- The shader warm-up waits half a second before drawing its shadow frames. The first shadow build no longer runs over the 100 ms budget while the title plays (it took 40 to 125 ms before, 37 to 53 ms now, measured in software GL).

## v0.231 — Clothes for your grandchild

- The character creator has a Clothes tab: a top (T-shirt, shirt, sweater, hoodie or dress), something over it (jacket, rain jacket, blazer or coat), jeans, chinos, shorts or a skirt, trainers, shoes or boots, and a cap or a beanie.
- Each garment takes a colour; tops and coats can be plain, striped or checked, a jacket can be leather.
- Today's clothes, brought over from Scale's wardrobe (no superhero tights).
- "Someone else" also picks a new everyday outfit; the clothes are saved with the family.
- A hard hat found below replaces the cap or beanie.

## v0.230 — Passages between styles never cut off nearby

- The field looked for the passages between styles only among the regions of other styles up to 280 m (blend distance) from a point, and only for passages from the point's own region. So where a style carried a passage's end deep into its region, or where a point stepped from one region into the next of the same style, a passage's air dropped out of the field a few metres from it. Deep in the rock, but the field jumped there (and a mesh chunk next to it could have been skipped).
- Now each region keeps a list of every passage near it, whichever regions it runs between (`Regions.regionsRound` finds the regions round a point), so a passage drops out only hundreds of metres off, deep in rock.

## v0.229 — Rats and dogs on the one animal mind

- Quarry rats, town rats, feral dogs and village dogs now act through the same animal mind as the strange creatures, on the same aggression scale, with tempers and fighting styles.
- Quarry rats are a swarm that rears up when it spots you; town rats only ever flee.
- The dogs' circling attack from behind is now the "flank" fighting style, which pack-living strange creatures can draw too.
- Village dogs are curious about you, fight back when hit and calm down again; feral dogs go to the water to drink.

## v0.228 — One mind for every animal (groundwork)

- No change in play yet. The strange creatures' behaviour now lives in one shared place, ready for the rats, dogs and other animals to move onto it, so every animal follows the same rules for aggression, temper and fighting style.

## v0.227 — Contact us opens the Futuremagic board

- The title screen's Contact us button now opens https://board.futuremagic.de/ in a new tab instead of writing a mail.

## v0.226 — Shader check follows New Game's mode question

- The on-demand shader check (and the title probe) picks a game mode after New Game before it waits for the character creator, so its title part runs again.

## v0.225 — Animals that feed and sleep

- Every animal, the strange ones as well as the rats and dogs, now lives between fights instead of standing about: it walks off to feed, head down and chewing.
- What it eats depends on the animal: some crop the floor, some lick the salt off the walls, some drink at the water's edge, some browse the salt blooms.
- Each den keeps its own hours. Now and then the whole lot goes to a sheltered nook nearby and lies down to sleep, with one of a bigger group staying up as a sentry.
- A sleeping animal notices you only when you come close, and a startled sentry wakes them all.
- Rats and dogs have new animations for it: a rat nibbling and curled up asleep, a dog with its head down eating. The deep beasts' glowing eyes dim while they sleep.

## v0.224 — The presenter speaks every shot again, in step

- The title's presenter no longer skips shots or starts late: his next clip is decoded before its shot comes, and a clip begins as far into it as the shot already is (after a late start of the sound, a slow frame, or a set switched on partway).
- He speaks at his own pitch: the random detune for repeated effects no longer touches his voice.
- The first click or key on the title starts the sound even while the game is still setting up (it used to be lost, leaving the set silent until the next one).

## v0.223 — Gates in the walls

- Now and then a thin place hangs still, flat in a rock wall: a gate. Through it you see the world it leads to, the level above or the level below. A blue rim leads down, a green rim leads up.
- Walk into it and you come out of its twin on that level, a few hundred metres from where its own ladder would bring you. The twin hangs behind you, so every gate has a way back.
- The other end of the gate nearest you is prepared in the background, so going through is quick.
- No gate leads into grandma's cellar.

## v0.222 — Walk-in shops for Kemal and Ilse

- Kemal's hardware store and Ilse's pawn shop are open: their doors stand folded back and one walks in off the street into a small room.
- Kemal stands behind his counter in a brown shop coat, among shelves of boxes and tins, his hatchets, crowbar and pick hung on the wall behind him, a barrel of handles, buckets, rope and shovels on the floor.
- Ilse stands behind a glass-topped counter of rings and watches, among shelves of jars, candlesticks and vases, sideboards crowded with clocks, a gramophone by the window.
- One deals across the counter now, not at the door: buy from Kemal with 1–7, sell finds to Ilse with E. Both turn to whoever comes in, talk with their hands over a deal, and say a few words when called on (E).
- The day reaches in, and a lamp hangs over each counter.
- The debug menu's places list both counters.

## v0.221 — The next levels are ready before you get there

- While the level you are on is loaded, the level below and the level above are built in the background, round where a ladder would bring you out on them.
- Climbing down or up then only has to show what is already built, so the black between levels is much shorter.
- Lately seen rock and props are kept too (within a fixed amount of memory), so going back up a ladder you just came down is quick as well.

## v0.220 — Rogue like and Adventure, and several families at once

- New Game asks how the family will play: Rogue like (the default) or Adventure. The families you already have stay kept, so several runs can go on side by side.
- Rogue like: each grandchild has one save, and it is gone when they die (grandma's tin, her purse and the notary's list carry on to the next grandchild, as before). Save and quit in the menu keeps the game and takes you back to the title.
- Adventure: Save in the menu keeps the game as it stands, as often as you like (the last eight are kept). Load goes back to any of them at any time, even after a death. Quit to title keeps where you are.
- The title has Load: every family with its mode, grandchild, depth and when it was last played, to play or forget.
- Settings shows the mode of the family you are playing. A family kept from before plays Rogue like.

## v0.219 — Step through a thin place

- Walk into a thin place while it is open and you stand in the world it shows, 8 to 40 levels down: its stone, its light, its air, on open floor near where that world's ladder comes in.
- Nothing there wakes or can hurt you, and nothing there counts as reached; the way back hangs open behind you.
- After a short while the pocket grows unstable: the way back flickers, the edges of sight shake and go blue. Then it lets go and you are back where you stepped in. Walk into the way back to go home sooner.
- Thin places stay open a little longer, so there is time to reach one.

## v0.218 — The townsfolk of today

- The game happens today: the village's people now wear present-day clothes (jeans and a hoodie, a yellow rain jacket, a puffer and leggings, a fleece, a red parka, a white shirt; trainers and boots) instead of 1966 ones.
- The lore bible has a Timeline section: the town and the player are of today, and the past shows only through grandma's diary, the 1966 TV report and the old mine.

## v0.217 — People in the village

- Townsfolk walk the village's streets by day: twenty of them in 1966 clothes, young and old, on the right of the road. They turn into other streets, cross the square, now and then stop to look about, and turn back where a street leaves the village.
- They never walk into you: they stop, turn to you with a smile and wait until you step aside.

## v0.216 — Your salt pet is kept in the save

- A salt pet that is out when you leave comes back when you return, as hurt as it was, standing up out of salt at your side.

## v0.215 — Creatures with tempers of their own

- Every strange creature now has a temper grown with its body. Some plod and graze for ages, some dart and freeze like lizards, some never settle. Herds keep together, walk in single file behind a leader, spread out, or live alone.
- Some are curious: they come over, look at you from a little way off and trail after you a while. Shy ones bolt from far away.
- When one takes fright, its herd bolts, scatters every which way, freezes stock still, or bunches up with the big ones facing you.
- Some rear up as a warning before they fight. While grazing they have habits: pecking at the floor, rearing up to look round, a tail flick or a claw wave.
- Some are drawn to your headlamp like moths and mill in its beam; some walk out of it.
- No creature is a hunter by type anymore. Each has an aggression dial: the most passive only ever run, even when hit; a little less passive, they fight back; from there on they come for you, from further off the more aggressive they are. How they fight (a pack taking turns, an ambush, a swarm, a charge) is part of their temper.
- The debug menu's creature maker has an Aggression slider and says each creature's temper.

## v0.214 — A flashlight from Kemal's

- Kemal sells a flashlight for €15 (key 7 at his counter). It goes in the off hand, beside whatever weapon is in the main hand.
- L switches it on and off (the Torch button by touch). On, the beam narrows, burns much brighter and lets you see about twice as far into the dark. The headlamp stays the wide, dim light you always have.
- The crickets flee the narrower beam.

## v0.213 — Kills by your salt pet and grandma's cards count as yours

- What your salt pet, a Matchstick's fire, a Flour Bag's burst, Flame, Pin, Snapdragons or Horseradish kills now gives salt and counts in your kill tally, like a knife kill. Kills by other creatures still don't.

## v0.212 — The village by day

- Out in the village it is now day: a pale blue sky with haze over the far fields, the sun from the south-west, and bright light from the sky. The street lamps and lanterns are out and the windows show glass, not lamplight.
- Grandma's house gets some of the day through its windows. The cellar and everything below stay as dark as before, and the eye takes a moment to adjust going in and out.

## v0.211 — Grandma's furniture, modelled

- Grandma's house and cellar get Blender-made furniture in place of stacked boxes: her wing armchair (in the salt circle and in the living room), the lamp table, the sofa, the kitchen table, chairs, stove and sink cupboard, the bed, the wardrobe, the sideboard, the coat stand and the cellar shelves.
- Her cardigan now hangs over a proper chair.

## v0.210 — Your salt pet comes along down and up the levels

- Taking stairs, a ladder or a gate to another level no longer kills your salt pet: it follows you, keeps the health it had, and stands up out of salt at your side.

## v0.209 — Glowing eyes in the deep, ordinary rats and dogs in the town

- The quarry rats and feral dogs of the deep now have the salt in their eyes: a hot blue-white glow in the veins' blue with a soft halo round each eye, flickering a little, so they read as no ordinary animals. The light goes out when one dies.
- The town above has ordinary rats and village dogs. The rats live in holes along the house walls, scurry off when you come right up to them and bolt when hit. The dogs lie about the farmyards and lanes and trot round. They have dark, ordinary eyes.
- The town's animals let you be. Hit a village dog and its lot turns on you until it calms down; a badly hurt one runs from you instead. A rat cannot fight you, so it runs.
- The town's animals drop no infused salt.
- The debug menu's teleport list has "Town rats" and "Village dogs".

## v0.208 — Your salt pet's health under yours

- While a salt pet is with you, the HUD shows its name and health bar under your health and stamina, in the veins' blue.

## v0.207 — Grandma's salt circle, quiet and alive

- The circle of salt round grandma's armchair, and the ward traced round it, no longer shine as a bright ring. They glow softly on the flagstones, with a faint halo spilling round them.
- The glow breathes slowly and a shimmer drifts through the salt, and the whole circle turns, very slowly, once round in about five minutes.

## v0.206 — Alpha stamp, contact button, the television first, every line spoken

- The title screen says plainly that this is an alpha: a big ALPHA stamp on the name, and a line on what that means (bugs, gaps, changes, a family that may not survive an update).
- A Contact us button opens a mail to the makers, with the version in the subject. The address is scrambled in the game's code and only put together when the button is pressed.
- The television comes on within a few seconds of opening the game. The figures, the level and the shaders are prepared behind it while the report plays, instead of behind a loading box first. Choosing New Game before that is done keeps the set playing until the game is ready.
- Clicking the title screen no longer captures the mouse.
- The presenter now reads every shot's words in full, in one voice, each shot as long as his reading (the six partial lines are gone).

## v0.205 — The way back to grandma's

- Out in the village the hint line no longer speaks of a cold draft: it says which way grandma's house is ("Grandma's house is to the right"), and when it is a long way off. In her house, the cellar and below, the draft points the way down as before.

## v0.204 — Full narration for the title TV report

- The presenter of "The Unexplained" now has a recording of every caption, word for word: ten clips `report_1` to `report_10`, one per shot, in one voice with the same 1960s TV-speaker sound. They replace the six partial `news_*` lines once the title screen switches to them.

## v0.203 — Goblin camps all the way down

- Below level 10 the scavenger camps are goblins too, no longer the old peoples of the buried worlds: the only living people in the dark are goblins.
- The stranger at Ilse's pawn shop is still there in town.

## v0.202 — Goblins and skeletons instead of people below

- No people of ours live down there any more. The scavenger camps on levels 4 to 10 are goblins now, come up the rift to pick over what the miners left: small, hissing, with crowbars, and some camps still only want you to keep away from their fire.
- The Salt-Touched are the lost miners' skeletons: old bone crusted with salt, a pale glow deep in the eye sockets, still in their hard hats and rotting work trousers, still swinging their picks.
- The Foreman on level 5 is a three-metre skeleton, his bones thick with salt.
- Grandma's ghost and her traces below stay as they were.

## v0.201 — The report sounds like 1966

- The neighbour's line on the title screen's television no longer remarks on black-and-white sets, which were simply normal then. The blue light was gone before the camera came.

## v0.200 — Make your grandchild

- New Game now opens a character creator before the introduction (Scale's, brought over): your first grandchild stands in grandma's cellar, lit by your lamp, and you shape their body, face, hair, skin and eyes. Drag to turn them, scroll to look at the face, or roll the dice for someone else.
- New Game no longer waits for "Lighting the lamps": the rest of the game's shaders build while the creator is open, and "Go down" wakes once they are ready, so there is no visible warm-up.
- The look is kept with the family: Continue brings back the grandchild you made.

## v0.199 — Root hollows run smoothly again

- The root hollows (and the fungal grotto and geodes) no longer drag the frame rate down: every step a creature took there looked up all the roots of the nearby chambers again. Now each 2 m patch of floor remembers its nearby roots once. The game's own work per frame there drops from about 15 ms to the level of the other caves; the rock looks exactly the same.

## v0.198 — Creature maker in the debug menu

- The debug menu (`) has a creature maker. Pick a role, a body plan, a skin, a seed and a strangeness, or press Randomize for a new one.
- Under "Its genome", every value a procedural creature is grown from is a slider: torso length and girth, legs, neck, head, snout, eyes, horns, tail, spikes, shell, arms, hue, pattern, glow and see-through skin.
- Spawn puts the creature down a few of its lengths in front of you, facing you and standing still so you can look at it. With one out, letting go of a slider remakes it in place. Remove takes it away.

## v0.197 — Footsteps without the whoosh

- Walking no longer makes a continuous whooshing hiss: the stone and water footstep clips were long stretches of amplified scuffing noise that blurred together. They are now single steps cut at their impact with a fast decay (0.2 s on stone, 0.35 s in water), from new louder takes with clear, separate steps.

## v0.196 — A country village round grandma's street

- The town is no longer one street in a closed valley: it is a whole village, laid out like Scale's country villages, with fields all round it.
- A lane runs from opposite grandma's door to the village square, where the church stands with its tall spired tower.
- Country roads wander out of the square across the fields, lanes and side lanes branch off them, and houses line every street, closer and taller near the square, now and then a barn at the edge.
- Out in the fields: a patchwork of wheat, barley, green cereal, maize, ploughed earth, pasture, rapeseed and stubble, hedgerows along some of the borders, and farmsteads with their farmhouse, barn and shed round a yard, a dirt track out to the road.
- Street lamps along the village streets and round the square; windows lit here and there, front and back.
- Grandma's street, her house, Kemal's store next door, Ilse's pawn shop and Frau Weber's across the street are where they were. The quarry hill still rises behind her house, curving away round the village.

## v0.195 — The presenter speaks

- On the title screen's television, the presenter, Horst Weidner, now speaks his lines: the opening, the baker's sighting, the dogs, the milk, the mine's "no comment" and his good night.
- His opening and closing shots stay up a little longer, so he can finish speaking.

## v0.194 — The TV presenter speaks

- On the title screen's old television, the presenter of "The Unexplained" now reads his report aloud through a tinny 1960s loudspeaker, six lines in one voice.

## v0.193 — The title is an old television

- The title screen is now a 1960s television in a dark living room, playing a late-night programme, "The Unexplained", from 10 September 1966: a sensational report on what walked through grandma's town eight nights before. Grainy black-and-white stills, the presenter, name straps and the words along the bottom.
- The signal has its troubles: snow, a rolling hum bar, torn lines. Each time a shader builds behind the title, the picture's vertical hold slips with a crackle.
- The set clunks on and hisses (louder when the signal is rough), once the browser lets sound start (the first touch or key).
- A first visit watches from the start; later visits switch on partway through. The menu is there from the start and wakes once the game is warm.
- On a phone held upright the set sits above the name and menu.
- The game's own level streams in behind the title instead of the old scenes on deeper levels.

## v0.192 — No invisible walls in thin, holed rock walls

- The rock walls between the old workings are never thinner than 2 m any more. Where the openings had worn one down to a sliver full of holes, it is open now: the holes the game drew were bigger than the rock had, so the nobody stood at an invisible wall (level 4 of seed 1 had one).
- Walking into a bank about as steep as one can still walk up now starts a climb instead of stalling at its foot, and a climb over a low sill hops over its top instead of letting go.

## v0.191 — Sounds for the 1960s television on the title screen

- The old television on the title screen can now hiss and hum, crackle when its signal breaks up, and clunk on with the whine of its picture tube.

## v0.190 — Panels and HUD for tablets

- Your pack: tap a line to choose it, tap it again to use it (leave a find, put on or take off an item); lines are taller under a finger.
- Grandma's tin: with a card chosen, tap a slot on the bar to put it there, and tap it there again to take it off (dragging still works).
- The map pinches nearer and farther with two fingers.
- Played by touch, the panels' key hints give way to what fingers do.
- On a tablet the help card sits at the top in two pairs of columns, out of the left thumb's way, and the corner buttons (Menu, What's new, Settings) are big enough for a fingertip.
- A tablet starts on medium graphics (one pixel per screen point) until you pick another; the line at the bottom left now shows how many milliseconds a frame takes, to check it keeps up.
- Fixed a stray line in the HUD's stylesheet that kept the help card from hiding on narrow screens.

## v0.189 — Playing on a tablet: touch controls

- On a touch screen the game shows a thumb stick where your left thumb lands (push it to the rim to run), and dragging anywhere else looks round; two fingers pinch the camera nearer or farther.
- Big buttons on the right stab, jump, use, pick a target and sneak; by the fire a Tin button opens grandma's tin. Map, pack, diary, headlamp and fire sit along the top, and with a panel open a Close button shuts it.
- Bar slots fire the moment a finger touches them, and prompts name the button ("Use: pick up") instead of a key.
- A key or mouse click puts the game back on keyboard and mouse at once; `?touch` shows the touch controls on a desktop for trying them out.

## v0.188 — Floating islands

- The third alien style for the deep (61 on): the floor gives way to round drops with no bottom in sight, and in each one flat-topped islands hang in the void, tapering beneath like mountains turned over, mossy on top and lit by tufts of glowing lichen.
- Natural arches join every island to the rim or to another island, so all of them can be walked to; a walk over the drops is a test that every island is reached.
- Step off the edge and you fall into the dark: you come back where you last stood, hurt by the fall (25 health) but never killed by it.
- Creatures never step off an island or the rim.
- Ground over a void is found by stepping down from above: `level.groundAt(x, z, from)` gives the first rock under a height. Walkers, pets, thrown things and spells pass their own height, so something under an island stands on what is under it, not on the island's top.
- A level with a void has no water table over it: it drains into the drops.
- Genes: drop size, islands per drop, island size and how far apart their heights lie.

## v0.187 — Singing crystals

- In a geode, now and then the crystals sing: a short phrase of a few notes, one crystal at a time, always in tune with itself. Longer crystals sing lower.
- Each crystal glows in its geode's colour while it rings, a shimmer running up to its tip, fading as the note dies away.

## v0.186 — Glyph-cut halls

- A second alien style for the deep (61 on): lines of giant Kerf runes cut into the rock, each rune 20 m wide and 40 m long, every stroke a straight-walled trench a house tall under a flat roof.
- It is real writing: each line is an English sentence spelt in Kerf, so a player who knows the runes can read the level off the map.
- Ruled trenches run along the foot and head of every line, and a cut between words leads on to the next line, so every stroke can be walked to.
- Light is inlaid down the middle of the strokes (cyan, violet or gold by the level's genes), with a lamp now and then.
- Genes: rune size, trench height, trench width and the inlay's hue.
- The distance to a segment now lives once in `src/gen/shapes.ts` (`segDist`), used by the passages between regions and the glyph trenches.

## v0.185 — Organic gullets

- New level style for the deep (61 and below), the first of the alien styles: the inside of something alive. Long gullets run side by side down the level, ringed every six metres like a windpipe, and swollen bladders open between them, round chambers that join one gullet to the next.
- Wet flesh in reds and purples, paler on the rings and threaded with dark veins. Clusters of pustules glow a sickly yellow, and the bright ones light the flesh round them.
- Its genes stray with each deep stratum: how wide the gullets are, how close and how deep the rings, how many bladders, and the flesh's hue (violet, or a bruised green, in some worlds). `?style=organic` shows a level of them.
- The lava tubes' round-roof bound is now one shared helper (`roundRoof`), which the gullets use too.

## v0.184 — The title warms the game while it plays

- The title screen shows up sooner: only what the street needs is compiled behind the loading screen; the figures and their shadows compile while the title plays, one shader at a time within the shader policy.
- Continue and New Game stay greyed out under a "Lighting the lamps…" line until that is done, so play never stutters; the deeper shots wait for it too.
- Shadows of things streamed in later (a deeper level's props, the creatures) have their shaders built ahead too, one at a time within the shader policy, instead of in the middle of play.
- The game's HUD (health, help, Menu and Settings) no longer shows through the title.

## v0.183 — Creature look pass

- Insects and spiders among the procedural creatures now have a body in parts: a swollen abdomen behind, a narrow waist, and a smaller thorax in front that carries the legs. Before, they were one capsule.
- Thin legs swell along each segment and narrow into the joints, instead of being plain tubes.
- A creature's outline catches a faint blue from the cave's salt veins, so one standing off in the dark still reads as a shape.

## v0.182 — Grandma's Salt Pet

- New chapter in grandma's tin: Company, with the Salt Pet card. Its bar slot makes you kneel and pour pinches of the tin's salt, which stand up as an animal made of salt: a salt rat at rank 1 (2 pinches, 45 health, bites 6–9) or a salt dog at rank 2 (3 pinches, 90 health, bites 11–16). One at a time, every 20 s.
- It keeps at your heel and stands still there. It goes for whatever comes at you, or your Tab target, and comes back once that is dead or far off.
- What it bites turns on it, so it can die. It mends like you do, once it hasn't been hurt for a while.
- When it dies it falls over and slumps back into salt. If you leave it far behind (up a ladder, onto a ledge it can't reach), it falls to salt and stands up again at your side. It comes along from level to level, but not into a saved game.
- It wears the rat's and the dog's own models and clips in a coat of crusted salt, with the rock's blue veins glowing slowly through it and salt glinting off it.
- Every creature now fights back against whatever bit it, not only against you.

## v0.181 — Salt blooms

- Here and there on the floor, mostly where the rock is salt, a bloom of salt crystals spreads out from a point while you watch, crackling softly. Each little cube glows the veins' blue as it forms, then turns to plain glittering salt.
- After a while the bloom crumbles away to nothing with a lower crackle, and later it blooms again.
- The debug menu can take you to the nearest one.

## v0.180 — Weapons with their own swing

- Kemal now sells a hatchet, a crowbar and a miner's pick (keys 4, 5 and 6 at his counter). Each swings its own way: the hatchet chops overhead, slower and harder than the knife; the crowbar swats wide and knocks things well back; the pick comes down two-handed, slowest and hardest, with the longest reach.
- They are held in the hand as the new modelled tools, and the Salt-Touched's picks and the scavengers' crowbars use the same models now.
- Grandma's knife is never lost: with a weapon in hand it waits in the belt, and putting the weapon away in the pack (I) takes the knife back out. Her knife cards work with whatever is in the hand, and the whetstone still hones the knife.

## v0.179 — Procedural hunters

- The level's own procedural species now include hunters, lurkers, swarmers and brutes, from level 1. Each is grown to a fair fight for its level, so a level-1 hunter is a small thing and a deep brute a big one.
- They stalk you and take turns: at most two of a pack strike at once. Every blow has a wind-up before the lunge or the slam, and after it they spring back. A lurker lies still until you are nearly on it.
- Badly hurt, a hunter runs. Its pack comes for you if you hurt one of them.
- Big and low-bodied animals no longer get stuck where they are born.

## v0.178 — A pulse in the veins

- Now and then the glowing blue veins in the rock draw a breath: a ring of brighter light starts a little behind you, runs through the veins past you and on, always towards the nearest way down, and fades.
- It happens only where the rock has glowing veins, about once every minute and a half.

## v0.177 — Peaceful animals in the levels

- Every level now has a few herds of its own animals, grown by the creature generator: grazers, scuttlers, watchers, drifters and giants. They are rare on levels 1 to 10 and more common deeper.
- They graze, wander, watch you from a distance and keep out of your way. None of them comes after you.
- Attack one and it fights back, or runs if the fight is hopeless. Its strength is its size, so leave the giants alone.

## v0.176 — Light wisps out of the glowing rock

- Now and then a small light pulls itself out of the glowing salt veins, drifts slowly along the rock and lights it up around it, swells, and pops in a bright flash. They are harmless: there for wonder, not to fight.
- They come where the rock glows (the Salt Works most, the Threshold and glowing strata now and then, rarely where the seams only glow faintly, never in the cellar), never more than three at a time.

## v0.175 — Grandma's tin, reworked, with drag and drop onto the bar

- The tin now stands above the main bar instead of over it, and the bar stays shown while the tin is open.
- Grandma's dividers run down the left, one per chapter, each with how many of its cards you have cooked. A click (or A/D) jumps to that chapter.
- Every card is laid out as a little recipe card in one scrolling sheet, under its chapter's heading. Each shows a big coloured capital, its ranks as grains of salt, what the next rank costs, and the bar key it is on. Any number of cards fits.
- The chosen card is shown in full on the right, with a Cook button that shows the cost.
- Drag a cooked card onto a bar slot to put it there. Drag one slot onto another to swap them. Drag a slot's card back up into the tin to take it off the bar. Pressing 1–8 still works.
- The mouse is free while the tin is open, and is captured again when it closes.

## v0.174 — Grandma's Horseradish

- New card in The Garden: Horseradish. Its bar slot sets a root at your feet that tunnels under the floor at 9 m/s to your Tab target (or the foe nearest where you look), comes up under it and bites, then shrivels.
- Rank 1 bites once (16–24), rank 2 twice, rank 3 three times (18–26 each). It costs 2 stamina, and you can set one every 10 s (9 s at rank 3).
- If its quarry gets away between bites, it dives and tunnels after it. If the quarry dies, it goes after the nearest other foe. It never bites you.
- While it tunnels, only its ruff of leaves shows, over a hump of earth with crumbs flying. Then a pale knobbly root bursts out of the floor and snaps with split, fibrous jaws.

## v0.173 — Procedural creatures, first look

- A creature generator: ten body plans (four-legged, two-legged, insects, spiders, crabs, centipedes, snakes, slugs, walking stars, drifting bells), each with its own skeleton, and parts that vary inside it: heads, jaws, horns, eyes, feelers, eye stalks, lures, claws, tails, plates and shells.
- Peaceful roles (scuttlers, grazers, drifters, watchers, giants) as well as hunters; the deeper, the stranger, with a little strangeness from the first level.
- They move by themselves: gaits by leg count, feet planted on the ground, tails and feelers that trail, heads that watch you, and actions that wind up before they strike.
- For now they live only in the Level Lab (`?lab&critters`, or `?lab&critters=<depth>` for that level's creatures).
- Many of them are colourful: warning colours, complements, jewel tones, pastels; and now and then a peaceful giant some ten metres long.

## v0.172 — Thin places

- Now and then, a little way ahead of you in open air, the air ripples and opens like a window, and for a few seconds you look into a hall of another of the stacked worlds below: its stone, its light, its haze, faint and silent. Then it closes again.
- The stranger a level, the more often it happens. Never at home, never a way through.
- As it opens you hear a faint, far-off choir.

## v0.171 — An eight-slot main bar

- Grandma's cards no longer have keys of their own. They go on a main bar of eight slots, used with 1–8 (each slot can be moved to another key in the settings) or a click.
- A card you cook goes into the first free slot. With more than eight, swap them at the fire: open the tin, choose a card, press the slot's number.
- Cards that work by themselves take no slot, and neither do Spring in Your Step (Space just jumps higher) and Tiptoe (Z sneaks).
- The right and middle mouse buttons are free now: the thrown knife and the match sit on the bar like everything else.

## v0.170 — Grandma's flour and matches

- A new chapter in grandma's tin, Baking, with two cards that work together.
- Flour Bag (Y): throw a bag of flour at a creature up to 16 m off. It bursts into a cloud 3 m round that hangs for 6 seconds. Anything in it loses you, stumbles about and cannot land a blow on you, until a moment after it gets out. Flour shakes off what it blinded.
- Matchstick (middle mouse): flick a lit match at the nearest flour cloud ahead. The cloud goes up all at once, 18–28 damage to everything in it, and shoves them out. Clouds touching it go up too. So does whoever stands in it, you included.
- Cooked again: a bigger cloud that hangs longer and blinds for longer; a fiercer blast that shoves twice as hard.

## v0.169 — Checks that take minutes, not a quarter of an hour

- The shader check no longer runs on every change: it is started on demand (Actions → Shaders → Run workflow), every so often and after render changes.
- The tests run on three machines side by side, and the slowest test file is split in three, so a change is checked in about two minutes.

## v0.168 — The map grows over with salt

- The map (M) is redrawn: the floor you have seen has soft edges, is shaded by height and has faint contour lines, and the edge of what you have not seen fades into the dark instead of stopping in hard squares.
- The rock walls you have seen glow like grandma's salt veins, with little veinlets and buds running off into the stone and some moss by the walls. Light runs slowly along them now and then (still when less motion is asked for).
- Your lamp shows as a warm pool and a beam the way you look; the ways down are dark wells ringed in salt, the way up a golden ladder, your fire a flickering glow.
- A compass, a 10 m scale bar, and zoom: + and − (or the mouse wheel while the map is open). Escape closes it too. The map's frame grows salt like the other panels.

## v0.167 — Faster checks on every change

- CI runs the tests and the two halves of the shader check (the Lab, the game) as three jobs side by side instead of one after another.
- A pull request that changes nothing the browser loads (only docs, change notes, tests or tools) skips the shader check; main always runs it.
- The slow cap test inside it runs only when the shader scheduling code changes (and always on main).
- A new push to a pull request cancels that pull request's older run.
- Two stale lines left in the duplication baseline are gone, so main's checks are green again.

## v0.166 — Your kit on the body

- Kemal's miner's helmet, a dented green enamel hard hat with its lamp, sits on the grandchild's head with the hair tucked under it, and his work gloves are on their hands.
- A worn piece looks more worn than a fine one.

## v0.165 — What you wear and hold

- The pack (I) now shows what you wear and hold, slot by slot: head, body, hands, legs, feet, main hand, off hand and a trinket.
- Choose a line with W and S, then press E to take a piece off into your pack, put on a spare one, or leave a find on the floor.
- Kemal's gloves and helmet are things you wear now, and his whetstone hones grandma's knife to fine.
- The pack's 8 places hold finds and spare things together.

## v0.164 — Sounds for the deep wonders, the flour bag and the match

- Singing crystals hum in five notes that sound well together, a distant choir swells when a thin place opens, and salt blooms crackle faintly as they grow.
- The flour bag bursts with a soft thump, the flour cloud goes up with a deep fiery whoomph, and the matchstick scratches and flares.

## v0.163 — Held tool models

- Blender-made hatchet, miner's pick and crowbar models (`held_hatchet`, `held_pick`, `held_crowbar`) are now in the model pack, ready for the inventory's weapons.

## v0.162 — Snapdragon leaves above the floor

- The rosette of leaves at a snapdragon's foot sits on the floor and curls up, instead of sinking into it.

## v0.161 — Glow-worm skies

- Here and there the roof of a high cavern is covered with tiny blue-green lights, like a night sky, with brighter stars drawn into constellations that are not ours. They twinkle slowly and fade where your headlamp falls on them, as glow-worms do.
- The stranger a level, the stranger its sky: deeper down the lights change colour, and their glow turns slowly round the roof in arms, like a galaxy.
- The debug menu can take you to the nearest one.

## v0.160 — Grandma, briefly, below

- The first time the Tall One looks at anyone of the family, grandma's ghost stands between it and you for a moment, then is gone.
- On level 18, far off, she is seen where she laid her first ring of salt.
- On level 40, by the two names cut in the rock, she comes and stands beside you, looking at her father's name: "I came, Papa." Back home she has one more thing to say.
- Each of these happens once for the whole family, never again.

## v0.159 — Miner's hard hat model

- A Blender-made miner's hard hat (`wear_hard_hat`) is now in the model pack, ready for the inventory's head slot: dented dark green enamel, a crown ridge, a brim and a lamp on the front.

## v0.158 — Living stalagmites

- Here and there, under a little stalactite, water starts to drip, and a stalagmite grows under it while you watch: about a metre in a minute, its fresh tip glinting blue each time a drop lands.
- When the dripping stops it stands a while, wet and dark, then sinks slowly back into the floor; after a rest the dripping starts again. The whole round takes about three minutes.
- A few on every level below the cellar, more by water and in the salt. The debug menu can take you to the nearest one.
- You hear each drop land when you are near.

## v0.157 — Grandma's ghost

- Grandma Grete is still keeping her circle. When a grandchild comes into the round room, the first time or back up from below, she sometimes rises beside her armchair, a ghost in the salt's blue, says one thing, and fades.
- A new grandchild hears a word from her about the cousin who fell before them. Coming back up, she may have one of a few lines, only ever about what the family has already seen. Most visits she says nothing.

## v0.156 — Snapdragons sound like themselves

- A snapdragon coming up and its bite now have their own sounds.

## v0.155 — Grandma's Snapdragons

- A new chapter in grandma's tin, The Garden, with its first card: Snapdragons (U, or its slot on the bar).
- Toss a seed: where it lands the floor bursts green and a snapping plant shoots up in under two seconds.
- For 12 seconds it turns to the nearest living thing within 2.2 m and bites it, coiling back, lunging and snapping its jaws shut. That includes you, so step back.
- Cooked again, it bites harder, further (3 m) and for longer (15 s).

## v0.154 — Sounds for the light wisps, the dripping stalagmite and the Snapdragons

- The light wisps that rise out of glowing salt rock now have a soft wind-chime shimmer as they rise and a short glassy ting when they pop.
- Water drops landing on the living stalagmite now make a plink with a short cave echo, in four variations.
- Grandma's Snapdragons have their own sounds: a whooshing burst as the plant shoots up out of the floor and a sharp snap when it bites.

## v0.153 — Strange from the start

- Levels 1–10 are a little strange too (Arnd, after playtesting): strangeness starts at 0.7 on level 1 and reaches 1 on level 4, instead of creeping up from nothing.
- Each of levels 1–10 has one law of its own (tinted light, thick air, older drums, and from level 7 water running uphill), never one its band already shows.
- Genes may stray into their strange range from level 4 on, level by level; deeper, a stratum still strays as one.
- `strangeFrom(depth)` names the run of levels that strays together.

## v0.152 — The camera stays out of grandma's rooms' walls

- In grandma's house the camera no longer swings through the thin walls between the hall, the kitchen, her bedroom and the living room: it pulls in at them as it does at rock.
- The same holds for every prop in the way: shut doors, the sheds' boards, carts, stacked crates.

## v0.151 — Your pack

- I opens your pack: every find you carry with what Ilse might pay for it, the knife and Kemal's gear you own.
- The pack holds 8 finds. When it is full, open it, pick a find with W and S and press E to leave it on the floor, then pick up the better one.
- The HUD shows how full the pack is ("5 of 8 finds").

## v0.150 — Glowing veins creep twice as fast

- The blue salt veins now creep about 5 cm a second, twice as fast as before (Arnd asked for double the movement).

## v0.149 — The salt stays on the panels' edges

- The salt growing on a menu or panel now follows the panel's real size. Before, it kept the size the panel had when it opened, so after a settings tab, a font or new text made the panel taller, a vein ran through the middle of it.
- A panel redrawn while open keeps its salt grown; it does not grow in again.
- The veins and their curls stay outside the border instead of wandering a few pixels in.

## v0.148 — A live title screen

- The game now opens on a title screen: DUNFINITY over the game itself, going down. The nobody stands on one level after another, each deeper than the last (grandma's street at night, the Quarry, the Salt Works and the Foreman's hall, the Tall One's lair, then the strange strata far below), knife in hand, while what lives there moves about and the camera drifts round behind them.
- Continue goes on with the family you have; New Game starts a new one (it asks first, since grandma's tin and everything found is forgotten).
- Links with a seed, depth, place or style still go straight into the game; `?title` shows the title anyway.

## v0.147 — The introduction: a prologue and first steps

- A new game opens with a short prologue played in the game itself, behind black bars: the town at night, your figure walking up the street to grandma's house and opening her front door, then her cellar with the armchair, the salt circle and the broken arch. Captions tell who she was and why the house is yours. Click (or Space) for the next caption, Escape to skip.
- Then a small paper card at the top right lists your first steps. In the cellar they come one at a time: read the notary's letter, stand in her salt circle, cook a card from her tin, look into her diary, and go down the old shaft. On level 1 they come all at once: stab something, climb a rock face, pick something up, rest by a fire, and find the way down. Each line is struck through as you do it, and when the list is done the card says goodbye.
- The list is kept with the family's save. A new family sees it again, later grandchildren don't, and `?intro` plays it all on any load.

## v0.146 — Every race in the Lab

- The Level Lab can stand every race side by side for looking them over: `?lab&races` puts a man and a woman of each of Norgo's ten races in two rows before the view.
- `?lab&races=<race>` (human, elf, dwarf, orc, halfling, goblin, sylvan, drakeborn, umbral, giantkin) shows one race close up: its man and woman side by side, with the view at their eye height.

## v0.145 — A HUD that belongs to the game

- Health and stamina are bars in a small panel top left, with what just hurt you under them. Grandma's salt, her purse and your pack sit top right, and a boss's name and bar sit at the top.
- Arriving on a level shows its name large in the middle of the screen for a few seconds. Notices and salt gained appear below it, and what E (or another key) would do now appears above the ability bar with the key drawn as a keycap.
- The keys are a card at the bottom left while you are in the cellar. It goes once you have been below.
- The notary's letter, grandma's note and the diary pages under stones are read on paper, the pages with grandma's handwriting as painted. E, Escape or walking away puts them down.
- Escape with the mouse already free (or the Menu button) opens a pause menu: the game stands still, with the way to the settings and the keys as you have bound them.
- The death screen's sheet takes the same paper, type and button as the rest.

## v0.144 — A loading screen, and a clear message when the browser cannot draw

- The game opens on a black screen with its name, a bar and what it is doing (laying out the level, dressing the figures, warming up the shaders, carving the rock), from the very first moment until the first level is on screen.
- A browser that can draw neither with WebGPU nor with WebGL 2, or whose graphics will not start, now gets a plain message saying so and what to try, instead of a black screen. Any other failed start says what broke, too.
- Going home, starting again as the next grandchild or jumping with the debug menu now waits in the dark (with a quiet "The rock takes shape") until the new level's rock is there, instead of showing it half built. Nothing moves while it waits.

## v0.143 — Sheds you can go into

- The quarry sheds' doors open and shut (E), and swing out on their hinges. The first time you open one you see what the miners left: a half-full cup, a calendar stuck on March 1947, boots still laced.
- Inside: a black iron stove under its pipe, a bunk under the window, a table and stool, a shelf with tins. In a shed whose lamp still burns, it hangs over the table.
- Sheds hold the miners' things: one or two finds on the table, the shelf or the bunk, for Ilse's pawn shop.
- A shed is a shelter: shut the door behind you and nothing outside notices you, and you can rest there as by a fire (if nothing is already after you). Grandma's tin opens there too.
- Inside, the camera stays within the walls and under the roof.

## v0.142 — Settings: volumes, your own keys, graphics quality

- A Settings panel (O, or the button at the bottom right) with three tabs. The game stops listening while it is open and the mouse is free.
- Sound: sliders for the overall volume, effects, ambience and music, and switches for sound and music (N and B still flip them).
- Keys: click any action and press the new key, or click with a mouse button. A key another action had swaps over to it, so nothing is ever on two actions. Esc, ` and the bar's 1–0, - and = stay where they are. The ability bar, the hints and the help line show your keys. Reset keys puts them all back.
- Graphics: Low, Medium and High (the default, as before). Lower draws fewer pixels, a smaller headlamp shadow and coarser rock far off; it applies at once without recompiling any shader.
- Reduced motion (on the Graphics tab) keeps the interface still.
- Everything is kept between visits.

## v0.141 — A shack with its doorway open

- The miners' shack now also comes with an open doorway, ready for a door that swings.

## v0.140 — The interface grows salt

- One look for the whole interface: old printed type for titles, a book face for grandma's tin, diary and the inscriptions, and a clean face for the game's own text, with keys shown as keycaps.
- Grandma's tin, her diary, the inscriptions you read, What's new and the ability bar are restyled to match: paper for what you read, lamp-lit dark for the rest, lamp gold for what is chosen or ready.
- Slow blue salt veins and a little moss grow along the frames of the panels and the ability bar. They creep very slowly and catch the light now and then, and they grow thicker the deeper you go. They stand still if your system asks for less motion.
- Panels fade and rise in when they open.

## v0.139 — A bug sweep and balance pass of levels 1 to 10

- Rats that cannot get up to you (you stand on a ledge) no longer freeze mid-chase below you: they mill about, give up and go home for a while.
- Something that cannot reach you, and cave crickets still up on their wall, no longer count as after you, so you can rest at your fire and take the Way Home.
- Rats and slimes no longer wake up inside the rock beside a ledge.
- Feral dogs hang on a moment after a bite, so you can stab back, wait longer between lunges, bite a little softer and fall to fewer stabs. A pack is still the hardest fight of the Cisterns, but no longer kills you most times.
- Fewer cave crickets in the Quarry, and their landing knocks you a little less.
- Scavengers' crowbars hit a little softer.

## v0.138 — A proper death, and the next grandchild

- Dying now plays out: the view darkens round the body, then Herr Brüggemann's sheet comes up with how it ended, and he crosses the name off his list stroke by stroke and writes the next heir's under it.
- The sheet says what the family keeps (grandma's tin and its salt, how deep the family has been, diary pages, letters of the old scripts, her purse, finds taken) and what went down with the grandchild (cards cooked, practice, gear, the pack).
- The next grandchild can only be sent once the pen is down (R, or the button), so keys pressed in the fight do not skip it. Then the screen goes black, a line says who the next letter is for, and they wake in the cellar.
- Scavengers, goblins and the Tall One now have their own death lines.

## v0.137 — Glowing veins creep

- The blue veins of infused salt now creep slowly through the rock, a few centimetres a second: a line wanders, splits and fades over a minute or two, slow enough to notice only when you stop and look.

## v0.136 — Kin: the deep's copies of our animals

- From level 11 down, every stratum has its own drafts of our rats, crickets, slimes, eels and dogs, all of one stratum's alike: a coat of another colour, darker or paler, striped or spotted, a longer or squatter body, a bigger head, a longer tail, huge ears or feelers.
- Close to the surface they are only a little off; the deeper the stratum, and the stranger it is, the further they stray.
- They move and fight as before, and a longer body takes longer strides, so their feet stay planted.

## v0.135 — Fungal and lava genes

- The fungal forest reads its genes: how thick the giant mushrooms stand, how tall they grow (still under the dome) and how broad their caps spread. Its cave strays by the karst's genes.
- The lava tubes read theirs: how far apart the tubes lie, how wide they flowed, how many branches and skylights they have, and how often a level's flows are still hot.
- No giant mushroom grows on a chamber's middle any more, nor low over it, so a passage always ends in the open there.

## v0.134 — Sounds for the prologue

- New sounds ready for the prologue and grandma's list: a page turning, a pencil ticking off a line, and the cold draft from the broken arch.

## v0.133 — The peoples of the deep

- Below level 10 the people you meet aren't ours any more. Each game has two peoples of the buried worlds, drawn from Norgo's orcs, halflings, sylvans, drakeborn and umbral, and each stratum belongs to one of them. Scavenger camps there are of that people. A new game meets others.
- They speak an older tongue, almost like ours. Their warnings and threats come out as words you nearly catch.
- Once the family has been below level 10, a stranger of the first people of the deep stands at night by Ilse's pawn shop, in a dark travelling coat, selling her things from below. Press E to speak to it.

## v0.132 — Ghosts of the dwarves and elves

- The dwarven halls and elven vaults are haunted now. A pale gold dwarf walks a beat between the columns of the halls, and a pale silver-blue elf walks under the vaults. Both are Norgo's races on the same bodies as the people, and you can see through them. Their edges glow and they flicker a little.
- A ghost that sees you stops and turns to you. Come close and it speaks once, a line of its people's account. The dwarves say the climbers are coming to take back what they dug out. The elves say the climbers are only going home. Then it fades away and is gone for this visit.
- Ghosts aren't foes. The knife goes through them and they never touch you.
- The debug menu lists the nearest ghost.

## v0.131 — Collapse genes

- The collapse style reads its genes: chamber size (walls, floors and the wander of the walls scale with it), dome height, how many scars and fallen blocks, and how many blocks stand on end. Deep strata get their own fallen halls.
- Floors and domes blend over a longer stretch when chambers grow, so no deep collapse is steeper than ours.
- A passage into a collapse chamber now ends clear of fallen blocks, also where many of them came down.

## v0.130 — Grandma's diary in her own hand

- Every diary page is now a photographed page in grandma's handwriting: fast blue fountain pen on the pages she tore out, careful black ballpoint on the ones she kept at home.
- The page at level 25 teaches seven more dwarven runes, and the page at level 30 five letters of the elven script; reading them pencils the letters into her key.
- Her father's chalk is on the rock beside the pages: "J.H. 1949" at level 21, "J.H. 1953. Still going down" and "Gretel go home" at level 33.
- At level 40 his name is cut deep into the rock, JOSEF HOLLMANN 1955, with hers scratched under it.

## v0.129 — Rift genes

- The rift now reads six genes for its level: how far apart its faults lie, how wide and how tall its canyons are, how far their walls lean, and how many ledges and wedged boulders they have. Deep strata may push them far (canyons twice as wide or half as tall, faults crowded or far apart), the same way on every level of a stratum.
- The genes test (`test/styleGenes.test.ts`) now judges a style's slope by its 99.9th percentile, since a style's own roughness makes the very steepest probe a matter of luck.

## v0.128 — Karst genes: a deep world's caves stray from ours

- The karst now reads six genes for its level: how big the whole cave is, how high its domes rise, how many cells have a chamber, how wide its tubes are, and how far its outline meanders and how big its scallops are. Levels 1–10 vary only inside the safe ranges; deep strata may push a few genes far out (caves half or one and a half times our size, flat or soaring domes, packed or sparse chambers), the same way on every level of the stratum.
- Root hollows and the fungal grotto are carved from a karst, so they stray with it.
- Every style is now made with its level's genes (`Traits`); a new test proves a style at the ends of its genes no steeper than at our standard, its floors walkable, open, and roomy at its portals. The edge tests also sample a level 131 world.

## v0.127 — Grandma's diary

- Grandma's diary is in her tin: press J anywhere to read it. What's left in the book are the pages she wrote at home after 1966. The pages from her trips down, 1959 to 1966, are stubs: she tore them out and took each one back to where she wrote it.
- Sixteen of those pages lie on levels 1 to 40, folded under a stone somewhere away from the arrival. Press E to read one. It goes back into the book and puts infused salt in the tin the first time anyone in the family finds it.
- Found pages stay in the tin, so the next grandchild opens a fuller book. The notary's letter now mentions the diary.

## v0.126 — Goblins live in the warrens

- The goblin warrens are lived in now: goblins squat in threes and fours in the dens, some round a cook fire. They're Norgo's goblin race on the same bodies as the people: small and big-headed, with long arms, green to ochre skin, ears that stick out and faintly glowing eyes. They wear stolen clothes and each carries a stolen kitchen knife.
- The first goblin to see you jumps up and shrieks, and the whole den comes. Each one runs round to its own side of you before it jabs, then circles again, so they come at you from all sides.
- A jab that lands may snatch the best thing in your pack. The thief runs off with it. Kill it and your find drops where it falls, ready to pick up again.
- A badly hurt goblin runs. Salt doesn't stop them.
- The debug menu lists the nearest goblin den, and the first goblin you kill gives salt like a scavenger.

## v0.125 — Deep laws: water that climbs, pillars on older stone

- Two new laws for deep strata. In some, water runs up the rock wherever it laps it, as it does in a few places in the Cisterns, but everywhere. In others, the old workings' pillars stand on drums of an older people's stone.
- Like the light laws, a stratum keeps them on all its levels. Levels 1–10 are unchanged.

## v0.124 — Bone hollows

- New level style, bone hollows: caverns inside the carcasses of something enormous and long dead, lying one after another down the level's grain and joined by low passages.
- Each carcass tapers up its tail into a ribcage, where great ivory ribs every seven metres stand out from the dark rock between them and a spine of vertebrae runs down the roof; then the neck narrows into a domed skull chamber with two eye-holes going on ahead.
- Bones and skulls lie about the floors, and pale lichen glows on the feet of the ribs, some patches bright enough to light the ribcage. Before People (levels 41–60) draw them; `?style=bones` shows a level of them.

## v0.123 — Dwarven runes and elven script in the Threshold, the halls and the vaults

- The crypt fronts in the Threshold's caverns (levels 9–10) carry a worn line of dwarven runes cut across the lintel. Stand in front and press E to read it.
- Grandma's note at her camp on level 9 has a pencil rubbing folded into it: the runes she was sure of, which go into the key in her tin.
- The dwarven halls (levels 21–40) are written in: each hall's name in gold runes over its gates, and gold friezes along the backs of the wall panels with the dwarves' own account (they dug for the first fire; the climbers come up to take back what they took) and the hall's records (who cut it, who fell, how many fathoms to the fire). Every one can be read with E.
- The elven vaults are written in too: some ribs carry a line of elven Thread script in salt-white, running up over the point of the arch. It is the elves' own account (the climbers are only going home; they sang the doors shut) and laments for their lost. Stand under one in the nave and press E to read it.

## v0.122 — Deep strata draw their own stone

- From level 11 on, each stratum draws its eight kinds of stone from genes: the familiar stones, nudged in hue, brightness, beds, veins and crystals, and further down genuinely new stone (green, purple, banded, gold-veined).
- A deep stratum may have glowing veins all through its rock.
- Every level of a stratum carries the same stone; levels 1–10 look as before.

## v0.121 — The deep's own light and air

- Below level 10, each stratum of a world now has its own light: the colour of the air and the fog, the tint of your headlamp, how far you can see.
- The first laws of the deep: in some strata the light is another colour, the air hangs thick and close, or the rock glows in its seams. A stratum keeps its laws on every one of its levels.
- Levels 1–10 and the town look exactly as before.

## v0.120 — Goblin warrens

- New level style, goblin warrens: low, round, crooked burrows dug from knot to knot, most knots swelling into a small den, and a second storey of burrows over the first, joined by steep ramps and climbing shafts.
- Dug through soft sandstone, shale and limestone, scratched and soot-black over the dens; bones, skulls and stolen crates, barrels, ropes and buckets about the burrows, and a cook fire in some dens.
- The Old Halls (levels 21–40) draw them as a minority style; `?style=goblin` shows a level of them.

## v0.119 — Rock types become recipes

- The rock shader no longer hard-codes its eight kinds of stone: each is now a recipe of sixteen numbers (colours, beds, laminae, veins and how they glow, crystals, cleavage, salt) loaded into eight slots per level, so a level can carry any stone without a new shader.
- Today's eight rock types are the eight presets and look the same as before (a side-by-side check of four long walls differs by at most 1 in 255 per pixel).

## v0.118 — New cards: salt-magic and Spring in Your Step

- Stove Flame (Fire & Frost, R): a gout of flame 4 m ahead burns everything in it (6–10 damage, every 2.5 s, 3 stamina); rank 2 reaches 5.5 m, 9–14 damage, every 1.8 s.
- Cold Larder (Fire & Frost, K): cold spreads over the floor round you; whatever it catches within 4 m moves at 40% for 4 s, with frost glinting on it; rank 2: 5.5 m, 30%, 6 s.
- Rolling Pin (Force, P): a shove 3.5 m ahead knocks everything in it back hard; rank 2 reaches 4.5 m and shoves twice as hard.
- Spring in Your Step (Footwork, Space): jump about twice as high (2 m) for 1 stamina, with a puff of salt at your feet; rank 2 jumps once more in mid-air (about 3.5 m in all), and you land unhurt.
- All four open at level 0, show on the ability bar, have a visible effect, and the spells go at the Tab target if there is one. The bar's slots now answer to 1–0, - and =.

## v0.117 — Moss, bark, plaster and roof tiles

- Moss grows on the floors, ledges and tops of the root caverns and between the fungal grotto's mushrooms, lush in patches, thin and broken at its edges, a few tufts up the walls.
- The roots in the root caverns are furrowed bark with pale lichen, mossy at their feet.
- Both are drawn by the rock shader itself, and bare rock skips their work.
- The town's houses have blotchy, rain-streaked, cracked plaster walls in their own colours and roofs of overlapping clay or slate tiles, from a light house material of their own.

## v0.116 — Strangeness, measured

- Every level now knows how strange it is: how far it is from our world, rising with depth and never topping out. Each deep stratum leans its own way, so now and then a deep world is an almost faithful copy of ours.
- Nothing looks different yet. This is the number the coming deep content (rock, styles, creatures, music) will read.
- The Level Lab shows it next to the depth, and a new tool photographs one seed at many depths side by side.

## v0.115 — The ability bar and Tab targeting

- A bar along the bottom of the screen shows every cooked card that is used by a key: its number, its key, how soon it is ready again, and whether it is on (the lid up, tiptoeing, a salt circle keeping).
- The slots answer to 1–8 as well as their own keys (not at Kemal's counter, where 1–3 still buy). With the mouse free (Esc), a click on a slot uses it; a click on the lid or Tiptoe holds it until the next click.
- The cards that work by themselves (Hold It Properly, Chicken Soup, Kneading) are listed under the bar as always on.
- Tab targeting (optional): Tab picks the foe nearest where the camera looks, and each further Tab the next one. A red mark with its health shows over it. Stabs, the Pound and thrown knives turn to it; Escape (with the mouse free), its death or 30 m of distance let it go.

## v0.114 — Every level style cut through its own mix of rock

- Each of the thirteen level styles now names the rocks it is cut through, so no area is one stone: the karst is limestone with beds of shale and sandstone, the rift shale, sandstone, granite and slate, the catacombs limestone and clay-dark shale, the lava tubes and basalt columns basalt with slate, the geodes and flooded galleries limestone with marble, the dwarven halls granite with marble and slate, the elven vaults marble with limestone, and so on.

## v0.113 — Swimming with the head out of the water

- The swimmer was drawn completely under water: the body floats with its feet 1.4 m down, but the swim pose lies flat at hip height, so head and back sat about a quarter metre under the surface.
- The figure is now lifted to the swim pose's water line while swimming (eased in and out), so the head rides at the surface with the face out, treading or crawling. The body's float, and so sumps and the reachability check, are unchanged.
- The headlamp sits just over the water while swimming instead of a metre under it.
- `tools/shot/swim-probe.mjs` puts the nobody in deep water headless and reports how high the head rides.

## v0.112 — The rift's story and two old scripts

- The background story is written down: the dungeon is a rift through buried worlds down to the first one (docs/design/lore.md).
- The dwarves' Kerf runes and the elves' Thread script are real alphabets you can learn to read.
- Round grandma's salt circle in the cellar, traced in the same blue salt, runs a line of elven writing. Press E near it to read the marks; each new inscription you read teaches you one letter, pencilled into the key in her tin, and the next grandchild finds it there.

## v0.111 — Elven vaults, and the dwarven halls furnished

- A new level style for the Old Halls (levels 21–40): elven vaults, long naves under pointed vaults 25–35 m high, with a lower aisle each side behind an arcade of slender clustered columns, ribs across the vault at every bay and transepts crossing between the naves. Pale silver-grey stone, the ribs and columns paler still, and a dark polished floor.
- The dwarven halls are furnished: a stern dwarf king before some wall panels and a burning forge before others, braziers by the columns (half of them lit) and heavy chains hanging over the nave. The forges and lit braziers light the halls.
- The dwarven halls and elven vaults keep their floors clear of the water table, so you no longer swim down a nave or wade into a hall.

## v0.110 — Debug menu: level styles, copy position, invulnerable for real

- "Copy position" in the debug menu (the key left of 1) puts a small block on the clipboard to paste into the chat: the version, a link straight back to the spot (seed, level, position, where the camera looks), the level style and region underfoot, what the body is doing, and how far the rock and any props are. "Go there" takes such a block, or just the link, and puts you back on that spot.
- A button for every level style (karst, rift, collapse, catacombs, dungeon, roots, fungal, lava, geode, basalt, flooded, dwarven and the excavation halls) puts you inside the nearest region of that style: on this level if it has one, else on the nearest level that does. Lava first turns up very deep, so that button goes a long way down.
- Invulnerable now means nothing touches you at all: no red flash, flinch or cry, no knockback, no "a rat bites: -0", and falls do nothing either. Health never actually dropped before, but every other sign of a hit still showed.
- The places listed on a level now include the nearest toadstools and puffcaps.

## v0.109 — Each place its own rock

- Level styles can now say which rock they are cut through, as a mix of rock types the walls show in patches and beds; where two styles meet, their rock blends across the edge like their colour. Styles that don't say keep their band's rock.
- Three new kinds of rock: black basalt with pale specks, white marble with grey veins, and blue-grey slate split along its cleavage. The Threshold now shows slate between its granite and shale.
- Broad colour changes across a cave are a little less orange.

## v0.108 — Every way of playing starts at level 0

- Every chapter of grandma's tin is open from the start; depth now opens a chapter's stronger cards (`Card.opens`), not whole chapters.
- Tenderising, Tiptoe, Way Home and Pot Lid can be cooked from the first fire.
- Plan: the salt-worker path starts in the kitchen (Stove Flame, Cold Larder, Rolling Pin) in docs/design/recipe-box.md §6.

## v0.107 — Stone of every kind

- The rock is no longer one flat colour. The stone itself now has colour texture at several sizes: fine grain, mineral flecks, iron and grey stains, and lighter and darker patches and warmer and cooler stretches a few metres across, on floors as well as walls; across the cave, whole stretches of wall tens of metres long run lighter or darker, ochre or grey-brown.
- Each kind of place has its own surface on top: in the old workings the walls show rows of pick marks, each row slanting its own way; natural rock has its beds and partings, hairline cracks, and specks of other minerals; caves are smooth creamy flowstone with drip ribs and coloured bands; dungeon rooms are dressed blocks in courses with worn edges and sunk joints over flagged floors; grandma's cellar is brick; the catacombs' tuff is chisel-marked.
- Each band finishes its stone its own way too: the Salt Works are cut in rock as in a real salt mine: rough, lumpy, mostly dark grey-brown, with salt showing as pale, near white layers and streaks running level through it, a tan bed here and there, thin clay seams and the cutting machines' groove rings; the Cisterns' walls are concrete cast against boards, with the boards' lines and the tie holes; the Cisterns and the Threshold run wet and shine in the lamps.
- Water is no longer flat grey: it is clear over the shallows so the floor shows through, near black where it is deep, and slow ripples move across it so the lamps glint on it.
- The lamps burn a little less orange.
- No band is one stone any more: each cuts through several rock types that change in patches and beds 5 to 30 metres across, as layers along a wall and lenses in it. There's pale cream limestone, ochre sandstone in hand-thick beds, dark shale split into thin layers, and grey speckled granite. The Salt Works are salt only in places, with dark shale and other rock between. Each band has its own mix (`band.finish.rocks`).

## v0.106 — Mushroom monsters, and creatures that move

- New in the fungal grotto: toadstools. Each looks like one of the grotto's giant fly agarics until you come close. Then it shivers, tears six roots out of the ground and stands up on them, tipping its cap back to show two yellow eyes under the gills. It scuttles after you, rears back and slams its cap down on you. Lose it, and it walks back to its spot and roots itself again.
- New in the fungal grotto: puffcaps. These are tall, pale cave mushrooms with faintly glowing gills that never move. One that sees you turns to you, draws its cap in (the warning), then flares it and lobs a glowing ball of spores. The ball bursts into a cloud that burns while you stand in it.
- Fixed: the dogs, rats, cave crickets, slimes and brine eels now actually play their animations; before, they slid around frozen in one pose.

## v0.105 — Real brine eels

- The brine eels are new: three metres of pale, slimy eel modelled, rigged and animated in Blender, with a blunt head, an underslung jaw of needle teeth, milky eyes and a fin running down its back into the tail.
- Its body still swims along the water in a wave, and its head now acts: it weaves and breathes as it swims, rears up with its jaw dropping wide before it strikes, snaps shut in the strike, jerks when stabbed, and goes slack, belly up, when it dies.

## v0.104 — Things for the dwarven halls

- Props for the dwarven halls are modelled and ready to set out: a stone forge with its anvil and glowing coals, a stern dwarf king carved in granite with a gold crown, a three-legged iron brazier and a heavy chain hanging from the roof.

## v0.103 — Dwarven halls

- A new level style for the Old Halls (levels 21–40): vast carved halls of dark granite, all lying the same way, their roofs carried on two rows of massive square columns, with deep panels cut in the walls and gold-brown inlay lines.
- Halls stand at different heights, joined end to end by great gates and side to side by narrow passages, with real half-metre stairs between them.
- Many halls are crossed by a chasm that drops forty metres to the glowing forges below, with a stone bridge over it.

## v0.102 — Flooded galleries

- A new kind of place: half-drowned tubes where the water nearly meets the roof. Most of them you swim, with your head in a gap of a metre or so under the rock. Every 30 to 60 m you come up into an air bell, a domed chamber with a little beach to stand on. Some tubes are higher galleries with a ledge along one wall, just over the water, to walk on. The rock is dark and wet, with a pale band of calcite where the water stood for a long time. Try `?style=flooded&depth=7`.
- The Cisterns (levels 6–8) now hold a little of them, and the strata from level 11 down have more.

## v0.101 — Tidy-up: one box shape

- Behind the scenes: the styles that build with boxes (workings, rifts, catacombs, fallen blocks, dungeon rooms) now share one box-distance helper instead of seven copies. Nothing looks different.

## v0.100 — Smoother cave floors

- Where a cave's tube meets a chamber whose floor lies a few metres higher or lower, the floor now rises over a longer stretch instead of jumping. That is gentler underfoot and leaves fewer odd ledges in the karst caves, root hollows and fungal grottoes.

## v0.099 — Basalt columns, and things on the new floors

- A twelfth kind of place: where a thick flow cooled slowly and cracked into hexagonal columns. The whole floor is column tops 4 m across, each a step above or below its neighbours, so you hop and climb your way across. Towards the walls the columns rise like giant stairs, and the walls are columns standing to the roof like organ pipes. The basalt is black-grey, every column a shade of its own, with a pale rim round each top. Try `?style=basalt`.
- It is one of the styles the strata below level 20 are made of: now and then in the Old Halls, often in Before People.
- The new kinds of place now have things of their own on their floors. The root hollows get ferns, moss, pale flowers and vines hanging from the roof. The fungal grotto gets clumps of small mushrooms, and the catacombs get piles of bones, skulls and burnt-down candles. Each geode gets crystal clusters in its own colour, and the lava tubes get lava stalactites and fallen blocks.

## v0.098 — Wet slimes

- The slimes shine wet now, and Murk is properly black and oily instead of grey.

## v0.097 — Change notes instead of version fights

- Behind the scenes: each change now brings its own short note, and the version number is given when it lands. Several helpers working at once no longer trip over each other's version numbers, so fixes reach the game sooner.

## v0.096 — Rock you can see

- The rock no longer burns out to flat white near a light. The burning lamps were far too bright close up and the screen simply clipped everything over full white, so the walls round every lamp, and the floor at your feet in your headlamp, read as blank white. Now the picture is tone-mapped like a film camera (bright light rolls off into warm highlights instead of clipping), the lamps and the headlamp fall off more gently, and the headlamp is a touch whiter. The stone's colour, cracks and tool marks show right up to the light.

## v0.095 — Strata below the Threshold

- Below level 10 the world goes on in strata, each a place of its own: the Ossuaries (levels 11–20, catacombs and fallen ground), the Old Halls (21–40, rifts, halls and the first lava), Before People (41–60, fungal grottoes, geodes, root hollows, lava tubes), and from 61 the Deep, where any kind of place can turn up, a new make-up every ten levels.
- Every world draws its own make-up for each stratum: three to five kinds of place, so your Ossuaries are not someone else's. Its levels share that make-up and each leans its own way.
- Dungeon rooms stay a sprinkle; you always arrive in old workings with a ladder up and a way down not far off.

## v0.094 — Real slimes

- The slimes are new: sculpted, rigged and animated in Blender. Lumen is a pale, glossy jelly with glowing motes in its skin; Murk is black, lumpy and oily.
- Every move shows: they slump and tremble at rest, crawl in pulses (heaping up, then pouring forward, the front lobe first), squash down before a blow and throw themselves at you with it, quiver when hit, and melt into a puddle when they die.

## v0.093 — Up from the fire

- Resting by a fire you sit only while your wounds close or you get your breath back; once you are whole you stand up again. Walking on always gets you up, and the hint by the fire says so.

## v0.092 — Every level its own mix

- Every level from 1 to 10 is now a mix of kinds of place, not one quarry with different stone. The Quarry is mostly old workings with some fallen ground and caves; the Salt Works adds more collapse and a rift or two; the Cisterns mix workings, caves, dungeon rooms and root hollows; the Threshold is everything at once, from catacombs to fungal grottoes.
- No two levels of a band are alike: each level leans its own way, one more caves, the next more workings.
- Where you arrive is always old workings with a ladder up, and a way down is never far, even on levels that are mostly caves.

## v0.091 — Real cave crickets

- The cave crickets are new: sculpted, rigged and animated in Blender like the dogs and rats. Each one is a pale, humped cave cricket with banded plates, great chevroned hind legs with spined shins, and feelers longer than its body that never stop sweeping (fast and twitchy once it is after you).
- Every move shows: the six-legged scuttle and the hops along the floor, the crouch before a leap, the hind legs kicked out straight behind in the air, the bite with the mandibles working, a flinch when hit, and over onto its back with its legs folding when it dies. On the rock it still clings head down.
- Dogs and rats: their teeth and eyes now stay put when they move (a few were tied to the wrong bone).

## v0.090 — Geodes

- An eleventh kind of place, and a wonder: hollow shells in the rock, 20 to 70 m across, lined all over with a crust of glittering crystal in one hue each (amethyst, celestine, rose or emerald). Big crystals stand in from the walls, longest overhead, and a few rise out of the pale crystal sand underfoot to climb round. Pale agate rings show where the shell breaks open. Short cracks in the rock, the only ways in, join each hollow to its neighbours. Try `?style=geode`.
- They belong to the deep strata, which aren't built yet, so for now they only appear when asked for by name.

## v0.089 — Lava tubes

- A tenth kind of place: tunnels where molten rock once ran and drained away. They are long and round, 8–18 m across, and meander side by side for hundreds of metres. Their floors are the last flow's flat glassy crust with ropes of pahoehoe bowed downstream. Benches along the walls show where the flow once stood. Smaller tubes branch across to the next, and here and there a skylight rises from the roof into a dome where the crust fell in. The basalt is black with rust-red crusts, and on hot levels the floor still glows through its cracks. Try `?style=lava`.
- They belong to the deep magma strata, which aren't built yet, so for now they only appear when asked for by name.

## v0.088 — Rats that stop fidgeting

- Rats (and every other walking creature) no longer jiggle on the spot when they cannot get where they want to be. Shoved back by a nest-mate, stuck behind a block of fallen rock, or under a ledge they cannot climb, a rat used to try this way and that, a few centimetres back and forth, again and again. Now one that gets no nearer for a moment stands still for about half a second, then tries again. Over 48 nests in four kinds of rock, back-and-forth twitches dropped from 429 to 49.

## v0.087 — Real rats

- The quarry rats are new: sculpted, rigged and animated in Blender like the dogs. Each one is a fat, grizzled sewer rat with a darker back, naked pink ears and feet, a long ringed tail, orange front teeth and eyes that catch your light.
- Everything they do shows: sniffing about with the nose going, the pottering scurry, the bounding run when they come for you, up on the hind legs when they notice you, the bite (rearing back with the mouth wide open, then the snap forward), a flinch when you hit one, and over onto the back with the legs curling up when one dies.

## v0.086 — Real dogs

- The feral dogs are new. They were built from a few ellipsoids in code; now each one is a gaunt street dog sculpted, rigged and animated in Blender (AssetGenerator). It has a deep narrow chest, ribs and spine showing, bristling hackles and tail, a rough coat with a dark saddle and a black muzzle, a mouth that opens on its teeth, and eyes that throw your headlamp back.
- Everything they do has its own animation: lying up at the den, standing and looking about, a trot, a gallop round you, a low stalk with the head down and lips drawn back while they circle, down on the haunches before a lunge (the tell), the lunge with the jaw wide, the snap, a flinch when you stab one, and a fall onto its side when it dies. The paws stay planted at every speed, and one action fades into the next, so nothing pops or flickers.

## v0.085 — Things for the new places

- Props are modelled for the new kinds of place and ready to set out. For the crypts there are skulls, heaps of bones for the niches, candles standing in their own wax and an iron gate to close a gallery. For the rifts, a coil of old rope on its piton and plank bridges with rope rails. For the root hollows, ferns, moss cushions, hanging vines and pale flowers. For the geodes, crystal clusters and great single spars. For the lava tubes, drips of cooled lava and a fallen basalt block.

## v0.084 — Carts and shacks

- The ore carts on the rails are modelled now: a riveted iron tub on four flanged wheels, some still heaped with ore.
- The miners' shacks too: plank walls on a timber frame, a door, a window and a tarred roof with eaves.
- Ten kinds of mushroom are made and waiting for the damp places: fly agarics, penny buns, inkcaps, honey clusters, chanterelles, puffballs, morels, pale cave caps, brackets on the rock and a giant three metres tall.

## v0.083 — Fungal grottoes

- A second living kind of place: warm, wet caves overgrown with giant mushrooms, from knee-high ones to giants 14 m tall. Pale fibrous stalks hold up broad caps in the level's own hue (violet, teal, amber or rose) with paler spots, and their gills glow faintly underneath. The big caps are wide and flat enough to climb onto and walk across, a second storey over the dark loam. Try `?style=fungal`.
- A share of the Threshold (levels 9–10). On the map (M) they show violet.

## v0.082 — Root hollows

- The first living kind of place: caves a forest grew into from above. Giant roots as thick as a cart come down through the roof, writhe across the chambers, split and plunge into the floor. Some cross low enough to walk along their backs, and root tips hang from the roof. The floor is a moss carpet over humps of tangled root mat, and the walls are damp dark soil. Try `?style=roots`.
- A share of the Cisterns (levels 6–8). On the map (M) they show moss green.

## v0.081 — Things made properly

- The things miners left against the rock are now modelled in Blender instead of built from boxes: crates of nailed planks, barrels with staves and iron hoops, a pick and a shovel leant on the rock, a pail with its handle dropped to one side, and squared blocks with tool marks and knocked corners. Shadows sit in their creases and under them.
- More props will follow the same way: the shacks, the carts and things for the new kinds of place.

## v0.080 — Dungeon rooms

- A seventh kind of place, and the first one anybody built on purpose: rooms of dressed grey stone with flagged floors, joined by short corridors that dog-leg from door to door. Little cells, guard rooms, long halls with two rows of square pillars, and great rooms under a barrel vault. Each room stands a step or few higher or lower than the next, and the corridors ramp between them. Try `?style=dungeon`.
- Never the whole level: a share of the Cisterns (levels 6–8) and of the Threshold (9–10), between the caves and the workings. On the map (M) it shows grey.

## v0.079 — Catacombs

- A fifth kind of place, the first from the crypts: a warren of narrow vaulted galleries cut into soft pale stone, their walls lined floor to vault with rows of burial niches full of old bones, here and there opening into a round domed chapel. Not every stretch was dug, so it branches, loops and dead-ends. Soot blackens the vaults where lamps once burned. Try `?style=catacombs`.
- A trace of them already lies in the Threshold, behind the crypt fronts. On the map (M) they show bone-pale.

## v0.078 — Collapses

- A fourth kind of place: chambers whose roofs came down. Huge domed halls, walled off from each other by thick rock that is broken through here and there. Where slabs fell, the roof has angular scars reaching higher into the rock, and under each one the floor heaps up into a hill of fallen blocks: tilted, freshly broken and pale, a few standing on end. You climb over them or find the valleys between. Try `?style=collapse`.
- You meet them in the Salt Works, where the old mine has given way in places. On the map (M) they show as pale broken stone.

## v0.077 — Rifts

- A third kind of place: rifts, where the rock was torn apart. Long canyons run side by side through the stone, all one way, a few metres wide at the bottom and thirty to eighty metres tall, their walls leaning in and out as they rise and pinching shut far overhead. Ledges run along both walls at different heights, broken in places; boulders hang wedged between the walls high up; now and then a low cut leads across to the next canyon. Between them, solid rock. The beds of the rock are tilted and banded, rust-stained low down. Try `?style=rift`.
- You meet them in the Salt Works (a few) and in the Threshold (a quarter of the level). Where a mine or a cave meets a rift, a tunnel leads into the nearest canyon. On the map (M) the rifts show rust-grey.

## v0.076 — Caves on the map

- The map (M) shows what kind of place you walked through: the miners' worked stone stays its warm brown, the natural caves show as pale flowstone. So you can see where the workings break into the caves and find your way back to them.

## v0.075 — Try one kind of place

- For testing: add `?style=karst` to the address and every level below the cellar is all caves, but where you arrive. Each new kind of place gets its name here as it is added.

## v0.074 — Caves among the workings

- Levels are no longer one kind of place. From the first level down, parts of a level are natural karst caves: big smooth domed chambers joined by round tubes, pale flowstone walls, no pillars and no miners' things. The rest is the old excavation. The Quarry is mostly workings with a few caves; the Cisterns are about a third cave; the Threshold is more cave than mine.
- Where a mine meets a cave, the floor ramps, the rock and its colour blend, and a tunnel always leads from the workings into the nearest chamber, so every cave can be walked into.
- You always arrive in the workings by a ladder, and ways down, the Foreman's hall and grandma's camp stay in ground the miners worked.

## v0.073 — Ready for more kinds of place

- Behind the scenes: the first step towards levels that really differ. The way a level's rock is made is now one "style" of several to come, with a plan for how two styles meet so their edges look natural ([level-styles.md](docs/design/level-styles.md)). Nothing changes in play yet: every level is exactly as it was.

## v0.072 — Salt Line

- Grandma's first lost card. Read her note at the camp on level 9 and you find a card torn out of her tin, tucked under the thermos: Salt Line. It shows up in the tin once found and is cooked at a fire like the others.
- Cooked, press L: you kneel and pour a circle of salt round you, and it shows going round as you pour. For a minute nothing that is an animal will cross it: rats, crickets, slimes and dogs stop at the line. The Salt-Touched and people walk straight over it. The Tall One won't cross it, just like grandma's own circles. Its crystals go dull one by one before it gives out. Rank 2: a wider circle that keeps for two minutes.
- A found lost card belongs to the grandchild who found it. The next one has to find it again.

## v0.071 — Sound and music

- The game has sound. Footsteps on stone (and splashing in water), landings, the knife's swish and the thud when it lands, getting hurt, dying, ladders, doors creaking open and shut, picking things up, Ilse's coins, striking a match for a fire and the fire crackling.
- The creatures make themselves heard: rats squeak when they come for you and when they bite, cave crickets chirp on their perches and rustle when they leap, the dogs growl and bark, eels burst out of the water, slimes squelch, the Salt-Touched chip at the rock while they work and grunt when they swing, the Foreman's bell rings through the halls, and the Tall One's stare comes with a cold whoosh.
- Every place has its own background: the town at night, grandma's cellar with the clock ticking upstairs, the Quarry's deep rumble, the Salt Works, the dripping Cisterns, the wind in the Threshold's caverns.
- Music, scored sparsely: now and then a piece for the place you are in (the town, the cellar, the Quarry, the Salt Works, the Cisterns, the Threshold), a quiet one when you rest by a fire, tense loops while something is after you, a heavier one for the Foreman and the Tall One, and an elegy when a grandchild does not come back.
- N turns all sound off and on, B the music. Both are remembered.
- The sounds are made with ByteDance Seed Audio and the music with Lyria 3 Pro. A listening model checked every take, and prompts that came out wrong were rewritten.

## v0.070 — A debug menu

- Press the key left of 1 (` on English keyboards, ^ on German ones) to open a debug menu. It lets go of the mouse; click the game to look round again.
- "Give me all abilities": every recipe card in grandma's tin at its top rank, and all of Kemal's gear.
- Invulnerable: blows and falls still land (the red flash) but take nothing. Tireless: stamina stays full, so you can climb anything.
- Go to any level: buttons for 0 to 12, and a box for any deeper one.
- Teleport on this level: in grandma's house her armchair, the notary's letter, the cellar door, her hall, the street, Ilse's, Kemal's, Frau Weber and the old shaft; below, the way up, the nearest way down, the Foreman (level 5), grandma's camp (level 9), the Tall One and a salt circle (level 10), and the nearest den of every creature living on the level (rats, Salt-Touched, crickets, both slimes, dogs, eels, scavengers).
- What you do with it is kept in the save like anything else.

## v0.069 — Tidying up

- Behind the scenes: a sweep for repeated code. The dogs, rats, slimes and cave crickets now share one way of putting their figures where they stand. Nothing changes in play.

## v0.068 — The preview link, spelled right

- Fix: the preview link has a capital D: https://arndrosemeier.github.io/Dunfinity/ (the small-d one shows "not found").

## v0.067 — Frau Weber

- Old Frau Weber lives across the street, just down from the lane opposite grandma's door. She is up at night, standing on her step in her lit doorway, and turns to watch you when you come near.
- Press E by her to call on her. She knew your grandmother for sixty years. She has hints and stories, and the deeper the family has been, the more she remembers to tell. When one of you doesn't come back, she knows.

## v0.066 — Over the top

- Fix: in the Quarry and below, where three workings meet, the floor could jump by several metres in a hand's width. That made a sheer step you could neither climb nor see properly, an invisible wall across what looked like an open gap. The floors now ramp smoothly there.
- Climbing up onto a ledge, you no longer fall back down at the top. She grabs the edge, pulls herself up with her hands flat on the rock, gets a knee and then a foot over, and stands up on the ledge.
- Walking into a steep bank at the foot of a wall now starts a climb instead of leaving you stuck pushing at it.
- Fix: some patches of rock high up in tall halls were missing from the picture.
- Cave crickets no longer perch low on a slope, and no longer back off and come again when a lunge carries them too close.

## v0.065 — A preview link

- Every change that lands is now playable at https://arndrosemeier.github.io/Dunfinity/ a few minutes later, without publishing.

## v0.064 — Rock with a surface

- The rock no longer looks untextured. Its walls show cracks, rust-brown streaks running down, warmer and cooler stretches of stone, and darker hollows. Damp patches on the floors are darker and a little shiny.
- In the Quarry and the Salt Works, the walls carry the miners' pick marks: shallow parallel scallops slanting one way or the other course by course. Natural caverns and the cisterns' concrete barely show them.

## v0.063 — The right knee

- Fix: running (and walking over uneven ground), the right knee turned inward or sideways, sometimes all the way round. The legs' footing worked out which way is forward from the wrong thing for the right leg (the left hip's turn). Both knees now bend forward.

## v0.062 — Doors

- Grandma's house has real doors now: the front door, the kitchen, her bedroom and the living room. Press E at a door to open or shut it. A shut door stops you, and a door won't swing through you if you stand in its way.
- The cellar door, at the foot of the stairs, is a strange one: near-black, iron-banded, seven little brass locks (none of them locked), and her salt signs glowing faintly on both faces. It has something to say when you open it, and it shuts itself once nobody is near.

## v0.061 — Nothing to walk through on the cellar stairs

- Fix: the back wall of grandma's house, drawn from the street down, cut across the cellar stairs where they pass under the hill, and you walked straight through it. It now starts where the hill meets it.

## v0.060 — Kemal's hardware store

- Next door to grandma's, up the street, Kemal's hardware store is lit, with crates, a coil of rope and a shovel outside. Stand at his door and press 1, 2 or 3 to buy, with euros from grandma's purse: work gloves (€20, climbing tires you less), a whetstone (€35, the knife bites deeper) or a miner's helmet (€45, blows hurt less; falls still hurt as much).
- Each is bought once per grandchild and is lost with them. The purse stays with the family.
- Fix: walking at a slant into a wall of grandma's room no longer starts a climb (it trapped you against the wall beside the doorway). Brick, plaster and house walls are not climbed now; you slide along them into the opening. Her doorway and the broken arch are wider, and the passage beyond is higher.

## v0.059 — Ilse's pawn shop

- Across the street from grandma's, a little way up, Ilse's pawn shop is still open: two lit windows full of other people's things, three brass balls over the door. Stand at her door with finds in your pack and press E: she buys the lot and the euros go into grandma's purse.
- The purse belongs to the family, like the salt in the tin: it is kept when a grandchild dies. Euros buy ordinary things up here (the hardware store is next); they never turn into salt.

## v0.058 — The street

- Grandma's front door is open now. Outside is her street at night: cobbles, street lamps, rows of old houses on both sides with a few windows still lit, her own living-room window glowing, and the quarry hill rising behind her side of the street. The valley closes the town in.
- Nobody is about yet, and the shops are not open. The way down is still through her cellar.

## v0.057 — Upstairs

- The cellar stairs now lead up into grandma's house. Her ground floor is as she left it: the hall with her coat on the stand and the front door shut, the kitchen with the table set for one, her bedroom, and the living room with her photographs on the sideboard and on the wall. It is night at the windows.
- The town outside comes later; the front door does not open yet.

## v0.056 — The map

- Press M for a map of what this grandchild has seen: the floor they have walked by, lighter where it is higher and darker where it is lower, water in blue, the ways down they have found (the way up in yellow), their fire, and themselves as a red arrow. Nothing they have not seen is shown.
- Each level is remembered separately, and the map is kept with the save. A new grandchild starts with a blank map.

## v0.055 — Room to get out

- The doorway out of grandma's room and the broken arch behind her chair were narrower than they looked: you could get stuck in them. Both are passable now, and so is the way from the cellar onto the stairs.

## v0.054 — Sweep

- Tidying behind the scenes after the last ten versions, with nothing new to see. Things held in the hand (the knife, the pick, the crowbar, the pot lid) are now all built the same way.

## v0.053 — The notary's list

- When a grandchild dies, Herr Brüggemann crosses out their name. The death screen shows his list: the fallen crossed out, each with where it happened and what did it, and at the bottom the name of the next heir, whose letter is already on its way. The list is kept with the save.
- The second heir's letter now names the cousin who went down first.

## v0.052 — Saved between visits

- The game now keeps itself in your browser every few seconds and when you leave. That covers grandma's tin and the salt in it, which grandchild is next, the finds already taken, and the grandchild now down there with where they stand, how hurt they are, their cards, their practice and their pack. Come back later and you carry on where you were.
- A grandchild who dies is not kept, so reloading sends the next one down. Each seed has its own save, and `?fresh` starts over.

## v0.051 — Practice

- Using things now makes you better at them. Blows that land train Kitchen Work, knives that hit train Throwing, rolls train Footwork, metres climbed train Climbing, and blows stopped with the lid train Guard. Each goes up at 10, 30 and 70: more damage for the knife and thrown knives, and less stamina for rolling, climbing and blocking. A line tells you when one goes up.
- Like the cards, practice belongs to the grandchild, and the next one starts fresh.
- Grandma's tin now lists her cards on the left and the chosen card on the right, with what you have practised beneath it.

## v0.050 — Pot Lid

- A new card in grandma's tin: **Pot Lid** (Guard). Its divider opens once one of the family has reached level 10. Once it is cooked, the dented lid of her big pot hangs on your back. Hold X to raise it and face where you look, walking slowly behind it.
- Blows from in front then do only 30% and knock you back less, but each one costs some breath. At rank 2 they do only 10%, and each costs less breath. Blows from behind, or when you are out of breath, get through.

## v0.049 — Tenderising

- A new card in grandma's tin: **Tenderising** (Heavy Things). Its divider opens once one of the family has reached level 5. Once it is cooked, V turns the knife round and brings the handle down overhead with both hands. It is slower than a stab but hits harder (14–20) and knocks things far back, and it costs a little stamina. At rank 2 it hits harder still and strikes everything in reach.

## v0.048 — Way Home

- A new card in grandma's tin: **Way Home**. Its divider opens once one of the family has reached level 8. Once it is cooked, press H with nothing after you. You kneel and shut your eyes while the salt in the floor rises round you, and after four seconds you are back by her armchair. Anything that comes for you in the meantime breaks it.
- At rank 2 it also works the other way. Press H standing in her salt circle and you go back down to the deepest level this grandchild has reached.

## v0.047 — Tiptoe

- A new card in grandma's tin: **Tiptoe** (Quiet). Its divider opens once one of the family has been down to level 5. Once it is cooked, hold Z to creep along slowly, crouched. While you do, creatures notice you only from half as far, or from a third as far at rank 2, when you also creep a little faster.
- The camera no longer looks through the rock when you climb a wall under a low ceiling.

## v0.046 — The salt circle and the notary's letter

- Grandma's ring of infused salt in her strange room is a fire that never goes out. Stand still in it to rest and heal, and press T to open her tin and cook, with no fire to light.
- The notary's letter lies on her side table. E reads it. Herr Brüggemann writes to each new grandchild, and he grows wearier with every heir.

## v0.045 — Grandma's cellar

- Every grandchild now starts in grandma's cellar, under her house. It is a vaulted brick cellar with shelves of jars, crates, a barrel and a bare bulb, and the stairs go up to the house door (shut).
- Through a low doorway is her strange little room: her armchair with the tin on its seat, her side table with a lamp, the knife block and a letter, and a ring of glowing infused salt on the floor round them.
- In the far wall, the arch she bricked up in 1966 has been broken through. The bricks lie where they fell. Behind it a rough passage leads to the old shaft, and its ladder goes down to the Quarry. Climbing back up from level 1 brings you home.

## v0.044 — Sweep

- Tidying behind the scenes after the last ten versions, with nothing new to see. Putting something onto a rock face (the chalk numbers, the water running uphill) is now done one way, and the game's passing notices go through one helper.

## v0.043 — Sunday Candle

- A new card in grandma's tin: **Sunday Candle** (Light). Once it is cooked, G tosses a lit candle a few metres ahead. It stands where it lands and burns for 40 seconds, lighting the floor round it.
- Rats and cave crickets hate it. Rats run from it even when they are after you, and crickets scatter from its light as they do from your headlamp. At rank 2 two candles can burn at once.

## v0.042 — Second Helpings

- A new card in grandma's tin: **Second Helpings** (Throwing). Once it is cooked, the right mouse button throws a kitchen knife. It flies in an arc to the nearest creature roughly where you look, turning end over end, and drops off it. A knife that misses sticks where it hits and fades after a while. There are always more knives in the block. At rank 2 you throw again sooner.

## v0.041 — Duck

- A new card in grandma's tin: **Duck** (Footwork). Once it is cooked, Q rolls you the way you are going, or backwards if you are standing still. Blows miss you for most of the roll, but it costs stamina. At rank 2 it is cheaper and blows miss you for nearly all of it.

## v0.040 — Grandma's recipe tin

- Resting by your fire, press T to open grandma's tin. Her cards are sorted by chapter, and the dividers for deeper chapters stay shut until one of the family has been that deep. W and S choose a card, E cooks it with infused salt, and T closes the tin.
- The first three cards: **Hold It Properly** (the knife hits harder, and from rank 2 stabs faster), **Chicken Soup** (resting by a fire heals two, then three times as fast) and **Kneading** (climbing tires you much less). Cook a card again to rank it up, and grandma adds a line.
- You kneel and stir while it cooks, and the salt drifts from the fire into you. What a grandchild has cooked dies with them; the salt left in the tin stays.

## v0.039 — Infused salt

- Grandma's tin now holds infused salt. It starts with three pinches. More forms wherever something happens for the first time: the first of each kind of creature you kill (the Foreman and the Tall One are worth a great deal), a level deeper than any of the family has been, one of grandma's camps.
- You see it come: pale blue motes rise where it formed, swirl, then stream into you. The HUD says how much and why.
- It rewards variety, not grinding. The second and third of a kind give less, the fifth, tenth and twentieth a pinch, then nothing. The tin outlives each grandchild.

## v0.038 — Chalk numbers

- Here and there in the Quarry someone has chalked a number on a pillar, underlined now and then. It is how far it is to the nearest way down, in tens of metres. Walk towards the shaft and the numbers count down.

## v0.037 — The Cisterns are wrong

- In places in the Cisterns, water runs up the rock. A thin, glossy sheet leaves a pool and climbs a pillar or a wall for a few metres, rippling upwards, with a faint cold shimmer on it.
- Some of the Cisterns' pillars stand on something older: a wide, round drum of dark, greenish stone laid in courses, with the square concrete pillar built on top of it.

## v0.036 — A fire to rest by

- Press C to kneel and light a small fire, anywhere dry, as long as nothing is after you. Stand still by it and you rest: your wounds close far faster than they do on their own and you get your breath back. The fire burns for two minutes, then dies down to ash. When you are badly hurt the game reminds you that you can.

## v0.035 — The Tall One

- Level 10 has its guardian. In a cavern a long walk from where you arrive stands the Tall One: four metres, gaunt, grey, quiet, its eyes white. Once it has seen you it follows, never hurrying and never giving up while you are near. From a distance it opens its arms and stares, and the cold of it goes through you. Close up it reaches down with its long arm.
- It will not cross infused salt. Round its cavern lie the circles of glowing salt grandma poured in 1966 to get away from it. Stand in one and it cannot touch you or stare at you: it waits at the edge.

## v0.034 — Tidying up

- Nothing new to see: a sweep through the code for things written twice. The creatures now share how the dead lie, how a fighter closes in to swing, and the Foreman is drawn the same way as the other people down there.

## v0.033 — Grandma's first camp

- Somewhere on level 9, a good walk from where you arrive, is the camp grandma made in 1963 when she came down looking for her father: a canvas tent with her bedroll, a ring of stones round a fire long cold, and on a flat stone her thermos and a note. Bend down and read it (E).

## v0.032 — Ruins older than the mine

- In the Threshold's caverns, against the rock, now and then stands something no miner made: the front of a crypt, columns and a heavy gable around a doorway of darkness, or a stair of steps far too tall for people, climbing into the rock towards nothing that is left.

## v0.031 — The Threshold

- Levels 9 and 10 are the Threshold, where the mine runs out. Natural caverns break through between the last, deepest workings: wide, rough caves with vaulted roofs and rolling floors, columns of rock the water never dissolved, and stalagmites rising to meet stalactites. The fallen stones in them are round boulders, and the veins of infused salt glow in the walls.
- No crew ever worked the caverns: no rails, lamps or shacks in them.

## v0.030 — Scavengers

- From level 4 you are not the only living person down here. Scavengers camp in twos and threes round small fires, sitting on crates. Most want to be left alone: they get up as you come near, one of them warns you off, and they let you pass at a distance. Walk into their camp or stab one and they all come for you with crowbars.
- Some camps are robbers. They want your pack and come for you as soon as they see you.
- A badly hurt scavenger drops everything and runs.

## v0.029 — Brine eels

- From level 5 there is something in the water. Pale brine eels, three metres long, lie deep in the brine lakes of the Salt Works and the flooded halls of the Cisterns. Wade into their water, or stand at its edge, and one comes for you, its back breaking the surface. It rears its head out of the water (your warning), strikes, and sinks back to come round again. They never leave the water: get out of it.
- Fix: when more creatures of a kind are near than can be drawn, the nearest are the ones you see.

## v0.028 — Feral dogs

- In the Cisterns, packs of feral dogs lie up in dry corners. Once they have seen you they do not rush you. The pack spreads out round you and circles, and one at a time the dog furthest behind your back drops onto its haunches (that is your warning), lunges in, bites and springs back to its place. Keep turning to face them.
- They glare: their eyes throw your headlamp back.

## v0.027 — The Cisterns

- Levels 6 to 8 are a new place: the Cisterns, a forgotten water-works and wartime bunker built into the mine. Long, regular halls of plain concrete pillars, about half of them standing in water you wade through, a few flooded deep enough to swim.
- Along the walls: rusted pipes on brackets with valve wheels, old pumps on their concrete plinths, and where it stayed dry the bunker's 1940s furniture (a table and chairs by a filing cabinet, bunk beds).
- Fewer Salt-Touched down here, and no cave crickets; the slimes are still about.

## v0.026 — The Foreman

- Level 5 has a boss. In a salt cathedral, beside an old mine bell on its timber frame, waits the Foreman: a Salt-Touched three metres tall. Rouse him and he strikes the bell with his pick, and every Salt-Touched of his crew working the rock round the hall comes for you, however far off. Then he comes himself: slow, with a long wind-up, and a blow that takes nearly half your health.
- His chest is crusted with salt, so a knife from in front mostly skids off. Get behind him. Badly hurt, he goes back and rings the bell once more, and that is your chance.
- His health shows at the top of the screen while he is after you.
- The tally of the killed now counts only what you killed (slimes kill each other too).

## v0.025 — Slimes

- From level 2 the floors have slimes, in colonies of three to five, and they come in two kinds at war. Lumen are pale jelly with glowing motes in them; Murk are black and oily. Where a Lumen colony and a Murk colony meet, they fight.
- Murk come for you. Lumen leave you alone, until you stab one; then that whole colony is after you (they calm down once you have been gone a while).
- They move in pulses, squeezing and flowing. Before a blow a slime squashes down (your warning), then throws itself forward. Hit, it quivers; dead, it melts into a puddle.
- Behind the scenes: all four kinds of creature now pick their den sites the same way.

## v0.024 — Sweep

- Behind the scenes: a duplication sweep (both finders). The five local frames of the props generator fold into one helper, and the nobody and the Salt-Touched find the floor under their feet the same way. Nothing changes in play.

## v0.023 — Cave crickets

- Pale cave crickets the size of a dog cling to the pillars and walls a few metres up, in little groups, feelers sweeping. Come near and they drop on you one after another: each sinks onto its long hind legs (that is your warning), leaps, lands on you with a knock, bites, and leaps off to come again from another side.
- They hate light. One that your headlamp is on will not leap at you, and one caught in the beam on the floor scatters into the dark and waits there before it tries again. Keep your light on them and they come at you from the sides.
- From level 1, and in the Salt Works too.

## v0.022 — Watchers

- Some of the salt miners on their plinths are watchers. Look away from one for a moment, and when you look back it is facing you. It never moves while you look.

## v0.021 — The Salt-Touched

- In the Salt Works you are no longer alone. The lost miners are still down there, changed: grey skin crusted with salt crystals, pale glowing eyes, salt-white hair, in their salt-stiff work clothes. Each one still works the rock where it stood, and you hear the pick before you see it.
- Come close, or stab one, and it turns, trudges after you and brings the pick down over its head. It is slow and the wind-up is long and plain, so you can step back out of it; if it lands, it takes a third of your health and throws you back. Get far enough away and it goes back to its rock. The knife works on them too; the ones you lay to rest stay down.
- Rats and the Salt-Touched now walk the floor the same way, so neither can jitter.
- Fix: a badly hurt rat was meant to bolt now and then, and never did. Now it does.

## v0.020 — Chapels and statues

- The salt miners carved. Against the salt walls and pillars stand statues of miners on their plinths: one leans on his pick, one prays, one holds a lamp up into the dark. Here and there a little chapel: steps up to an altar, a cross cut into the rock above, candles still burning.
- Old electric lamps hang on long chains from the roof of the Salt Works halls. Most of them still burn, though nothing down here has power.
- Loose stones and cut blocks are salt in the Salt Works.

## v0.019 — The Salt Works

- From level 3 down you are in the Salt Works: grey-white rock salt instead of limestone, its pillars fluted where the miners cut them, the pools brine. Thin blue veins glow in the salt, slowly pulsing, so the halls are never quite dark.
- The level name in the HUD says which band you are in.

## v0.018 — Solid things, steady knees

- You can no longer walk through the props. Carts, shacks, crates, barrels, stacked blocks, lamp posts, derricks, big fallen stones and the railings round the shafts stop you, and the rats run round them too. Rails, sleepers and chippings you still step over.
- Fix: a standing knee could fold backwards or snap bent on uneven ground (Scale's humans had it too). The leg's IK lost track of which way the knee bends when the leg was nearly straight, and it popped on and off with tiny ground offsets. Now knees always bend forward and settle smoothly.

## v0.017 — Dust and leavings

- Dust hangs in the air: fine specks drift in the headlamp's beam, and only there, so the cone of light shows in the dark.
- The quarrymen left more behind. Against pillars and walls: crates (one stacked on another now and then) and a barrel, a pick and a shovel leant on the rock with a bucket, or a stack of squared blocks that were never hauled up. Out in the halls, here and there, a wooden derrick for lifting blocks, its rope and hook still hanging, sometimes over the block it never lifted.

## v0.016 — Shadows

- The headlamp casts shadows. It is a cone now, carried above the nobody's head and shining where you look, with a little light spilling all round. Stones, pillars, props, rats and the nobody throw shadows away from it, so from behind you see them stretch ahead into the dark.
- Fix: the first moments in a level built a dozen shaders while you played (a stutter). The lamp was moved onto the figure after the warm-up, and that alone changed what every shader is keyed by. Now no shader is built after the warm-up, shadows included.

## v0.015 — Rats you can see coming

- Rats no longer jitter. Before, a rat by your legs could flick back and forth between two spots: its place round you turned as it moved, it overshot and came back, and it dithered left and right round a stone. Now each rat takes its own place round you (fixed by where its nest lies), slows as it arrives and stops, and keeps to one side going round things. Tests check that no rat goes back and forth, at 60 fps, at 10 fps and round a walking player.
- Every rat action shows. A rat that notices you stands up on its hind legs a moment, nose to you, before the charge. A bite rears back with the mouth up, then lunges in, head down and paws out, and the rat really jumps forward and back. A lunge stops at your legs instead of running into them.
- Getting hurt shows: the edges of the screen flash red (in first person too), as well as the flinch.

## v0.014 — Stones underfoot

- Loose stones on the floors of the Quarry: a few everywhere, a skirt of chippings round the feet of the pillars and walls where the miners cut, and heaps of broken blocks where the roof came down. Limestone breaks blocky, so they are slabs and blocks, half sunk in the dust, in the same limestone as the walls.
- Props tiles carry a `stones` mesh, drawn in the `ROCK` kind.

## v0.013 — Limestone

- The rock looks like rock: limestone mottled in patches a metre or two across, a fine grain, dark bedding seams that come and go along the walls and pillars, gritty dusty floors, and a bumpy surface the headlamp rakes across. All worked out in the shader from where a point is, so it never repeats and needs no textures.
- The new `ROCK` material kind (one shader, compiled in the warm-up like the rest).

## v0.012 — Finds

- Things to find: what the miners left on the floor of the Quarry (old Pfennigs, brass tally tokens, chisels, clay pipes, tobacco tins, a carbide lamp now and then) and what the rats dragged into their nests (rats hoard shiny things: silver spoons, medals, a pocket watch, gold rings only there). A faint twinkle gives a find away in the dark.
- E picks up the find at your feet (the nobody stoops for it). The HUD says what you carry and what the pawn shop up top might pay for it. A dead nobody's pack stays down there; a find once taken is gone from the level for the next grandchild too.
- The knife is held for a thrust now: the blade carries on the line of the arm instead of pointing back.
- Fix: a key pressed where it meant nothing no longer fires later. E pressed during a climb used to send you straight back down the next shaft you came out at; R pressed while alive used to skip the death screen.
- Health comes back slowly once nothing has hurt you for ten seconds.
- `Finds`, `Pack`, `FindView`, `meshOf`, `Controls.endFrame`.

## v0.011 — Rats and the kitchen knife

- Rats: the first enemy. Fat quarry rats, about 40 cm with the tail, with glowing eyes; they live in nests a few to a nest on the dry floor of the workings (none near where you arrive, a few more on each level down). They sniff about the nest; get close and the nest notices, and they run at you, spread round you and bite. Badly hurt ones bolt for a moment. They scramble up knee-high ledges, but not up walls.
- The nobody carries grandma's kitchen knife. Click (with the mouse captured) to stab: it turns you to the nearest rat ahead and lunges. Two stabs kill most rats. The knife comes out when rats are after you and goes back after a while.
- Bites hurt and make the nobody flinch; the HUD says what hurt you, and if the rats get you, it says so. "rats killed" counts this level's rats.
- The dead stay dead while you are on the level.
- `src/combat/combat.ts` (blows and damage for anyone who can be hit), `Rats`, `RatView`, `CellMemo`, the METAL material kind.

## v0.010 — What's new

- The version is shown top right; click it for this history, newest first (Esc closes it). Each merge to main is one version: v0.001, v0.002, ...

## v0.009 — Down the ladder

- Climbing a shaft's ladder is played out instead of a cut to black: the nobody walks to the ladder, turns their back to the shaft, lowers themself over the rim and climbs down hand over hand, hands and feet on the rungs (Scale's manhole climb). A few metres down the picture fades, and the next level comes up out of the dark.
- Below the first level you arrive at the foot of the way back up: an iron ladder bolted up the side of a pillar, into a shaft through the ceiling, with a burning lamp beside it. You climb the last metres down it, step off, and turn away.
- E at the foot of that ladder climbs back up to the level above, coming out over the rim of its nearest shaft.
- The camera turns to watch the climb (behind the climber, looking at the ladder).
- `ladderOf(shaft)` (rungs, the wall, where one gets on and off), `level.ascent`, `LadderClimb` (the puppet scene), `nobody.puppet`.

## v0.008 — Skin on WebGPU

- Fix: on WebGPU (Chrome, Edge) the nobody had no skin, only eyes, teeth, hair and clothes. The skin mesh needed 9 vertex buffers, one more than WebGPU allows, so its shader never built. Face coordinates and the expression column now share one attribute (`@futuremagic/humanoid`). WebGL was not affected.

## v0.007 — The way down

- Mine shafts: the Quarry's ways down. Round shafts 40 m deep, cut into the floor of intact workings, with a timber headframe, a pulley and a rope, a burning lamp, a railing round the rim and an iron ladder down one wall. None near where you arrive, more and more of them further out (the Territories rule): the nearest is usually 400–700 m away.
- Find one by the draft: within 600 m the HUD says where cold air comes from (ahead, to the left, behind-right…), stronger when close.
- At the ladder, E climbs down: a fade to black, and you come out on the next level with the health you had. Falling into a shaft is fatal. R after a death starts the next grandchild at the top again.
- `level.descents` and `level.arrival`; the level field carries the shafts, so meshing, collision and the camera all know them. `LevelView.go(level)` swaps the streamed rock and props without touching shaders (0 builds on the way down).

## v0.006 — The nobody is a person

- The box stand-in is gone: the nobody is Scale's human (decision D1), a grandchild with a face, hair and a body of their own from the seed, in rags (a patched tunic, worn trousers, foot wraps). Motion-captured animation follows the body: standing idle, walking, sprinting, jumping, falling, climbing, swimming and dying; the feet find the rock.
- Scale's humans now live in the shared `@futuremagic/humanoid` package (AssetGenerator): the pure body build plus a node-material-only renderer side (`Humanoid`: character, garments, animator, clips). Games bring their own clothes through a `Wardrobe` hook.
- The human assets (bodies, clips) are served from the package under `/humanoid/`.
- Shaders: the human's materials compile in the warm-up (`stage.warmUp(extra)`); after it, 0 builds while walking.

## v0.005 — Walk the Quarry

- The game is now the default page: you are the nobody, standing in a grand hall of the Quarry in the dark, with a lamp. The Level Lab moved to `?lab`.
- Movement on the rock itself (no physics engine, the level's distance field is the collision): walk, run, jump; walk into any rock to climb it while stamina lasts, except overhangs (decision L1), and lunge up or push off with Space; climb over the top onto a ledge; swim in water deeper than the chest; hard landings hurt and a long fall kills. Death is final: R sends the next grandchild.
- Third-person camera that orbits with the mouse and pulls in where rock is in the way; the wheel zooms down to first person (decision D9). A stand-in figure of boxes until Scale's human arrives.
- Shared setup: `LevelView` (scene, fixed lights, warm-up, rock and props) for the Lab and the game, `Controls` for input, `level.normal` and `level.trace`.
- Fix: the shader warm-up compiled only the material kinds in front of the camera; it now compiles all of them wherever the camera looks.

## v0.004 — Water in the Quarry

- Groundwater: each level has a water table a little above the lowest floor terrace, wandering slowly across the level. Low workings below it are flooded (pillars standing in dark, still water), others only hold puddles in dips, and the higher terraces stay dry. Deep water is darker than shallow water.
- Water surfaces are built with the props, per 64 m tile in workers, with a new glossy `water` material kind (compiled in the warm-up, like every kind).
- Tracks, lamps, shacks and crates keep out of the water; the Lab spawn is always dry.
- Level: `level.waterAt(x, z)`, the water surface height.

## v0.003 — Lamps and the miners' leftovers

- The Quarry's intact workings now hold what the quarrymen left: narrow-gauge tracks down the aisles between pillars, ore carts (some still loaded), lamp posts beside the tracks, lamps on pillar faces, and site shacks with a lamp over the door and sometimes a lit window and crates. Everything follows the working's pillar grid and comes from the seed, in 64 m tiles built in workers.
- Lamplight: about half the lamps still burn. Eight point lights, fixed before the shader warm-up, follow the burning lamps nearest the viewer and flicker a little; unused ones sit at zero, so lights never cause a shader build. Lamp flames and lit windows use a new unlit `glow` material kind.
- Lab: `F` now dims the ambient light and the headlamp too, so the lamps show; `?dark` starts that way. The HUD counts prop tiles and burning lamps.
- Level: `level.columnAt` and `level.groundAt` (the rock surface under a point, roughness included). The worker side of the pool protocol is one helper (`serve`), and worker mesh data becomes a three.js mesh in one place (`meshFromData`).

## v0.002 — The Quarry in the Level Lab

- First level generator band: the Quarry (levels 1–2). Room-and-pillar limestone workings about 220 m across, each with its own pillar grid, height and floor terrace; grand halls with 30–55 m pillar spacing; collapsed workings with broken pillars, rubble hills and domed ceilings; natural rock between workings, broken through in many places. Floors, ceilings and collapse blend across the borders between workings.
- One density function per level (`level.sdf`), meshed with surface nets in chunks of 32³ cells, at four levels of detail (1, 2, 4, 8 m cells) out to 900 m. Chunks next to coarser ones overlap them so there are no cracks. Meshing runs in a worker pool; the terrain swaps chunk sets in one frame, so moving never opens holes.
- Lab: spawns in an intact grand hall; HUD shows the working you are in and mesh stats; `V` cycles colours (rock, working, detail level), `F` switches between survey fog and headlamp darkness. New URL params `look=yaw,pitch` and `color=`.
- `@futuremagic/core`: cellular results now name the second nearest cell, and `cellBorder` gives the exact Voronoi border distance (AssetGenerator PR #5).

## v0.001 — Scaffold and Level Lab shell

- Vite + TypeScript app, three.js r186 `WebGPURenderer` (WebGL 2 fallback, TSL materials only). Builds for `/dunfinity/` with `npm run build:publish`.
- Level Lab: free-fly camera, seed, depth and position from the URL, `?gl` forces WebGL 2.
- Shared code from `@futuremagic/core` (AssetGenerator, git submodule): seeded RNG, noise, math, heap.
- Shader policy ([docs/SHADERS.md](docs/SHADERS.md)): material registry, Stage (warm-up, compile before add), cap of 5 per second at least 200 ms apart, monitor, renderer hooks. Checked headless with `npm run check:shaders`.
- Code guards in `npm test`: banned patterns, layer boundaries, duplication ratchet over `src/` and the shared package (Toolbox finders).
- Seam index ([docs/ARCHITECTURE.md](docs/ARCHITECTURE.md)), design docs in `docs/design/`.
