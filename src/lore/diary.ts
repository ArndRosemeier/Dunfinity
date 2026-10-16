/**
 * Grandma's diary (docs/design/grandmas-diary.md): the small oilcloth notebook she kept on her trips
 * down, 1959–1966. When she came up for the last time she tore out every page about down there and
 * took each back to where she had written it, so whoever came after would learn it a bit at a
 * time, only as deep as they had got. What stayed in the book are the pages she wrote at home
 * after, in her careful old hand. A torn-out page lies on its level; read, it goes back in the book.
 *
 * Pure data.
 */

export interface DiaryPage {
  /** The level it lies on (torn out), or null (kept in the book). */
  readonly depth: number | null;
  readonly date: string;
  readonly text: string;
}

/** Inside the cover. */
export const COVER = 'Margarete Hollmann. Lindenstraße 4. If found, put it back in the tin. If you are reading it anyway: the pages that matter are not here. I left them where I wrote them.';

/** Every page, in the order of the book (the dates' order). */
export const PAGES: readonly DiaryPage[] = [
  { depth: 1, date: '2 May 1959', text: 'Went through the arch tonight. Mother thinks I\'m at Liesel\'s. Rooms and rooms of square pillars, all the same, all dark. Somebody chalked numbers on them and the numbers count down. I counted with them as far as forty and came home with my knees shaking. I\'m nineteen. Papa went down every day for twenty years.' },
  { depth: 2, date: '23 August 1959', text: 'The chalk numbers are Papa\'s. He crossed his sevens like the French do, and so do these. They lead away from the old shaft, not towards it. He wasn\'t trying to get out. He was going somewhere.' },
  { depth: 3, date: '8 November 1959', text: 'The salt down here is blue, and it gives off light like a watch face. Mother\'s "tonic" that the company sent every Christmas after 1947 was this, I\'m sure. I put a pinch on my tongue. It tasted of nothing and I could see in the dark for an hour. Not telling anyone.' },
  { depth: 5, date: '14 February 1960', text: 'Met one of the miners. Still down here, thirteen years on, and more salt than man now. He had Herr Kranz\'s watch chain. I said "Herr Kranz?" and he stopped, as if he was listening for someone a long way off. Then he came at me. I ran. I\'m sorry, Herr Kranz.' },
  { depth: 7, date: '19 June 1960', text: 'Water running uphill, quietly, along a channel, as if that were normal. I followed it up to a bunker the army built in the war: chairs, a stove, a calendar left at September 1947. Somebody was living here after the mine closed.' },
  { depth: 8, date: '30 October 1961', text: 'Found the duty roster for the last shift nailed up in the bunker. 11 September 1947. J. Hollmann, fourth name down. Somebody ticked the names off as they came back. His has no tick. Somebody had written next to it in pencil, very small: went down. Not missing. Went down.' },
  { depth: 10, date: '2 April 1963', text: 'The big stair. At the top of it something was standing. Tall, thin, very still, its head bent under the roof. It did not move for an hour and neither did I. When I went it turned its head to watch me go. It has not followed. I don\'t think it is allowed to.' },
  { depth: 11, date: '17 September 1963', text: 'Under the caves there is a town. A whole town, buried, with a river bed and a street that bends where ours bends. A house where ours stands. In its cellar, an arch, bricked up. Someone did this before me. Someone was me before me.' },
  { depth: 14, date: '3 March 1964', text: 'Gravestones in the old town, in words I can read: Here lies Agnes, who kept the door. The door is a sealed arch with a ring of marks round it, like letters hanging from a washing line. The things down here walk round the ring and never through it. I copied it, every stroke.' },
  { depth: 18, date: '26 July 1964', text: 'Tried it. A ring of the blue salt in the shape of the marks, round my camp. Something stood outside it all night, breathing. In the morning there were tracks right round it and none inside. Agnes, thank you.' },
  { depth: 21, date: '9 January 1965', text: 'Halls cut square out of black stone, big enough to hold the church. Gold lines in the walls, and writing, all straight strokes. And on a pillar, in chalk: J.H. 1949. Two years after they stopped looking. Two years.' },
  { depth: 25, date: '22 May 1965', text: 'Papa was learning the runes. Under one line of them he had chalked letters, one under each: T, H, E. I\'ve got more of them now. The rest I\'ll get from the walls.' },
  { depth: 30, date: '15 October 1965', text: 'Another kind of hall, all arches, grown more than cut, writing up the ribs in the same hanging marks as Agnes\'s door. The square people say the tall ones come up to take back what was taken. The arch people say they\'re only going home. Papa believed the first. I don\'t know what I believe.' },
  { depth: 33, date: '6 February 1966', text: 'J.H. 1953. Still going down. Gretel, go home. He knew I\'d come. He knew and he wrote it anyway, at the height of my eyes, not his.' },
  { depth: 37, date: '11 June 1966', text: 'Every stair down here goes up. Every one, in every hall, too big for people. Things are coming up from the bottom, slowly, a stair at a time. And everything down here is a copy of something up there, or the other way round.' },
  { depth: 40, date: '2 September 1966', text: 'Found his name cut deep into a column: JOSEF HOLLMANN 1955. I scratched mine under it. This is as far as I go. Something is on the stair behind me. It has been for three days. I\'m going home the fast way, and it\'s coming.' },
  { depth: null, date: '4 September 1966', text: 'Bricked up the arch tonight, with the blue salt in the mortar, and laid the circle. It stood on the bottom step and watched me do it. It\'s still there. It will be there in the morning. I\'ll be here too.' },
  { depth: null, date: '5 September 1966', text: 'Tore the pages out and took them back down, each to where I wrote it. If someone has to go after me, let them learn it the way I did: a bit at a time, only as deep as they\'ve got. That way they will turn back sooner.' },
  { depth: null, date: '1 March 1971', text: 'Started writing the cards. If one of them has to go, they\'ll go well fed and clever, or not at all.' },
  { depth: null, date: '12 July 1996', text: 'The little one drew me a picture of the cellar. A monster with a hat on. Into the tin it goes. Their parents won\'t come again. I said too much at supper. Better that than too little.' },
  { depth: null, date: '3 January 2019', text: 'The circle wants new salt every winter now, and I\'m seventy-nine. One of them will have to do it. I\'ve left it as long as I could.' },
  { depth: null, date: '2026', text: 'To whoever has the tin. I\'m sorry. Start with the first card. Mind the arch. Don\'t go further than you have to. And if you find Papa, tell him I came.' },
];

/** The torn-out page that lies on level `depth`, if one does. */
export function pageOn(depth: number): DiaryPage | null {
  return PAGES.find((p) => p.depth === depth) ?? null;
}

/** The book as it stands: every page in order, its text if it is in the book (kept, or found by someone of the family), or null (a stub). */
export function theBook(found: (depth: number) => boolean): { page: DiaryPage; text: string | null }[] {
  return PAGES.map((page) => ({ page, text: page.depth === null || found(page.depth) ? page.text : null }));
}
