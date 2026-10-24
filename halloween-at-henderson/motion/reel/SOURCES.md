# Archival footage sources

Every clip in the collab Reels comes from the [Prelinger Archives](https://archive.org/details/prelinger) on archive.org. Only films whose archive.org record carries a public-domain licence marking were used (checked 2026-10-24). *Halloween Party* (1953) was considered and left out because its record has no licence marking.

| Film | Year | archive.org | Licence marking | Clips used |
| --- | --- | --- | --- | --- |
| Junior Prom | 1946 | [JuniorPr1946](https://archive.org/details/JuniorPr1946) | [public domain](http://creativecommons.org/licenses/publicdomain/) | `car_night`, `car_couples`, `dance_curtain`, `dance_band`, `dance_twirl`, `dance_close`, `dance_smile`, `gown` |
| As We Like It | ca. 1952 | [AsWeLikeIt](https://archive.org/details/AsWeLikeIt) | [public domain](http://creativecommons.org/licenses/publicdomain/) | `pour_spot`, `pour_tray`, `tap_pour`, `brew_tanks`, `bar_toast`, `bar_hand`, `bar_smile` |
| Coney Island | ca. 1940s | [ConeyIsl1940](https://archive.org/details/ConeyIsl1940) | [public domain](http://creativecommons.org/licenses/publicdomain/) | `coney_carousel`, `coney_luna`, `coney_lights`, `coney_sunburst`, `coney_crowd` |
| World's Fair Night Aerials |  | [tmp_1964Worl](https://archive.org/details/tmp_1964Worl) | [public domain](http://creativecommons.org/licenses/publicdomain/) | `fair_fountain`, `fair_radial`, `fair_rings` |
| Soundie - Jiveroo |  | [soundie_11](https://archive.org/details/soundie_11) | [public domain](http://creativecommons.org/licenses/publicdomain/) | `jive_a`, `jive_b`, `jive_c`, `jive_d` |
| Soundie - Hollywood Boogie | 1946 | [soundie_12](https://archive.org/details/soundie_12) | [public domain](http://creativecommons.org/licenses/publicdomain/) | `horns` |
| [Amateur film: New Orleans Carnival Week, February 22, 1941] | 1941 | [NewOrlea1941](https://archive.org/details/NewOrlea1941) | [public domain](http://creativecommons.org/licenses/publicdomain/) | `mask_crowd`, `mask_red`, `mask_man`, `mask_group`, `mask_group2`, `crowd_street` |
| What Makes A Good Party? | 1950 | [WhatMake1950](https://archive.org/details/WhatMake1950) | [public domain](http://creativecommons.org/licenses/publicdomain/) | `arrive_door`, `arrive_group` |
| Dating: Do's and Don'ts | 1949 | [DatingDo1949](https://archive.org/details/DatingDo1949) | [public domain](http://creativecommons.org/licenses/publicdomain/) | `phone_boy`, `phone_girl` |
| Spot News | 1937 | [SpotNews1937](https://archive.org/details/SpotNews1937) | [public domain](http://creativecommons.org/licenses/publicdomain/) | `news_phones`, `news_desk`, `news_editor`, `news_editor2` |

Clip in/out points: `footage.json`. `prep_footage.py` downloads any missing film into `footage-src/` and grades the clips into `footage/`.

## Silent horror and animation (Reels D, E, F, G)

Public domain in the US (published before 1931) **and** in Canada (director and principal authors died before 1972, so life + 50 years has run out). Checked 2026-10-24.

| Film | Year | archive.org | Licence marking | Clips used |
| --- | --- | --- | --- | --- |
| Nosferatu (dir. F. W. Murnau, d. 1931) | 1922 | [Nosferatu_DVD_quality](https://archive.org/details/Nosferatu_DVD_quality) | [public domain](http://creativecommons.org/licenses/publicdomain/) | `h_orlok_rise`, `h_orlok_window`, `e_orlok`, `e_orlok_win` |
| The Phantom of the Opera (dir. Rupert Julian, d. 1943) | 1925 | [PhantomOfTheOpera1925HD](https://archive.org/details/PhantomOfTheOpera1925HD) | [public domain mark](http://creativecommons.org/publicdomain/mark/1.0/) | `h_ball_*`, `h_red_death`, `h_unmask*`, `h_skull`, `e_stairs`, `e_ball*`, `e_red_death`, `e_unmask`, `e_skull` |
| Häxan (dir. Benjamin Christensen, d. 1959) | 1922 | [Haxan_201510](https://archive.org/details/Haxan_201510) | [public domain mark](http://creativecommons.org/publicdomain/mark/1.0/) | `h_cauldron`, `h_devil`, `h_sabbath_*`, `e_cauldron`, `e_sabbath`, `e_devil` |
| The Skeleton Dance (Disney Silly Symphony; animated by Ub Iwerks, d. 1971; Walt Disney, d. 1966) | 1929 | [the-skeleton-dance-1929](https://archive.org/details/the-skeleton-dance-1929) | [public domain mark](https://creativecommons.org/publicdomain/mark/1.0/) | `sk_*`, `h_sk_*` (picture only: Carl Stalling's score is not used) |
| The Cabinet of Dr. Caligari (dir. Robert Wiene, d. 1938) | 1920 | [DasKabinettdesDoktorCaligari…](https://archive.org/details/DasKabinettdesDoktorCaligariTheCabinetofDrCaligari) | [public domain](http://creativecommons.org/licenses/publicdomain/) | `cal_wake`, `cal_jane`, `h_cal_*` |
| Dr. Jekyll and Mr. Hyde (dir. John S. Robertson, d. 1964) | 1920 | [Dr.JekyllAndMr.Hyde1920…](https://archive.org/details/Dr.JekyllAndMr.Hyde1920DirectorJohnS.Robertson) | none on the record; the film is public domain (US: published 1920; Canada: director died 1964) | `jek_*`, `h_jek_*` |
| Frankenstein (Edison; dir. J. Searle Dawley, d. 1949) | 1910 | [frankenstein-1910-1080p-hd-2017-restoration](https://archive.org/details/frankenstein-1910-1080p-hd-2017-restoration) | [CC0](http://creativecommons.org/publicdomain/zero/1.0/) | `frank_rise`, `h_frank_rise` |

*The Skeleton Dance* entered the US public domain on 1 January 2025. Only its picture is used, never Disney's name or characters. Universal's *Dracula* and *Frankenstein* (1931) are still under US copyright until 1 January 2027, so they are not used.

Left out: *Night of the Living Dead*, *House on Haunted Hill* and *Carnival of Souls* are public domain in the US but **not** in Canada.

## Film dialogue (Reel D)

Short lines lifted from the soundtracks of three Bela Lugosi films, in `reel/audio/clips/`. All are public domain in the US (copyright not renewed) and in Canada (the directors died before 1972).

| Line | Film | archive.org |
| --- | --- | --- |
| "Is it Halloween?", "Who can ever be sure what's behind the mask?", "Are you afraid now?" | Scared to Death (1947, dir. Christy Cabanne, d. 1950) | [Scared_to_Death](https://archive.org/details/Scared_to_Death) |
| "Ladies and gentlemen.", "Won't you please come in?" | Bowery at Midnight (1942, dir. Wallace Fox, d. 1958) | [Bowery_at_Midnight](https://archive.org/details/Bowery_at_Midnight) |
| "Well, would you like to dance?", "Come right in." | The Corpse Vanishes (1942, dir. Wallace Fox) | [TheCorpseVanishes](https://archive.org/details/TheCorpseVanishes) |

## Music

Acoustic 78 rpm recordings from the Library of Congress [National Jukebox](https://www.loc.gov/collections/national-jukebox/) on archive.org, all marked public domain. Every recording is from before 1926, so it is public domain in the US, and more than 50 years old, so it is public domain in Canada. Every composer and arranger died before 1972.

| Reel | Recording | archive.org |
| --- | --- | --- |
| B | Funeral March of a Marionette (Gounod), Victor Symphony Orchestra, 1922 | [loc-jukebox-62411](https://archive.org/details/loc-jukebox-62411-funeral-march-of-a-marionette) |
| D | Danse Macabre (Saint-Saëns), Vessella's Italian Band, 1914 | [loc-jukebox-134348](https://archive.org/details/loc-jukebox-134348-danse-macabre) |
| E | Peer Gynt Suite No. 1 (Grieg, arr. Tobani), *In the Hall of the Mountain King*, Victor Concert Orchestra, 1916 | [loc-jukebox-187843](https://archive.org/details/loc-jukebox-187843-peer-gynt-suite-no-1-arranged) |
| F | Skeleton Jangle, Original Dixieland Jazz Band, 1918 | [loc-jukebox-28585](https://archive.org/details/loc-jukebox-28585-skeleton-jangle) |
| G | Valse triste (Sibelius, d. 1957), Victor Concert Orchestra, 1915 | [loc-jukebox-12029](https://archive.org/details/loc-jukebox-12029-valse-triste) |

Instagram's rights matching can still flag an old recording, because some labels have claimed reissues of them. If a Reel gets muted, re-post it with one of Instagram's own audio tracks, or post it silent.

## Narration (Reels B, E, G)

The narration is synthetic: [Kokoro-82M](https://huggingface.co/hexgrad/Kokoro-82M) (Apache-2.0), run locally through kokoro-onnx. Voices: `am_michael` (B), `bm_george` (E), `bf_emma` (G). No real person's voice was cloned.

## Event visuals (Reel F)

The colour footage of lasers, beams, mapped walls and the DJ booth (`v_*` clips) is Holographic Realms' own footage from past events. They are the visuals team for the night, and their clips are in `../whatsapp-videos/` (sent over WhatsApp on Oct 24). F credits them on screen as "VISUALS BY HOLOGRAPHIC REALMS". `prep_footage.py` reads those clips through `footage-src/wa0.mp4` … `wa10.mp4` (links to the files in name order) and keeps their own colour (the `color` grade).
