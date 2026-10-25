# 01: On-TV settings checklist

All of this uses the Roku remote. Menu names drift a little between Roku OS versions. If a path
doesn't match exactly, look for the closest name in the same menu. Tick items off as you go.

> **Hisense note:** owners report the ACR toggle (step 2) can turn itself back on after a power
> cycle or software update. Re-check steps 1–2 after every update, and again a day after you first
> set them.

## Privacy and tracking

- [ ] **1. Turn off personalized ads.**
      *Settings > Privacy > Advertising* → uncheck **Personalized ads** (older versions call it
      **Limit ad tracking**, which you *check*). In the same menu, choose **Reset advertising
      identifier**.
      You still get the same number of ads, but they aren't built from your viewing.

- [ ] **2. Turn off ACR (automatic content recognition).**
      *Settings > Privacy > Smart TV experience* → uncheck **Use info from TV inputs**.
      ACR fingerprints whatever is on screen, *including your HDMI devices and antenna*, and
      reports it back. This is the most invasive setting on the TV.

- [ ] **3. Lock down the microphone.**
      *Settings > Privacy > Microphone* → **Channel microphone access: Never allow**, and turn off
      per-channel permissions for anything listed.

- [ ] **4. Stop channels phoning home with your viewing.**
      If you see *Settings > Privacy > Advertising > Measurement* (or similar), turn it off. Some
      Roku OS versions have it and some don't.

## Stop seeing the home screen

- [ ] **5. Boot straight to your input.** *(Biggest single win.)*
      *Settings > System > Power > Power on* → **Last used TV input** (or a specific HDMI).
      The TV now skips the home screen and its autoplaying ad on power-up.
      *Don't see "Power on"?* Owners report it's missing on TVs first set up in **Store** mode
      rather than **Home** mode. A factory reset set up in Home mode brings it back.

- [ ] **6. Turn off Fast TV Start.**
      *Settings > System > Power > Fast TV Start* → off. This keeps the TV from sitting
      half-awake on the network all night. Startup takes a few seconds longer.

## Declutter the home screen

- [ ] **7. Hide sidebar items.**
      *Settings > Home screen > Menu items* → hide **Live TV**, **What to Watch / For You**,
      **Featured Free**, **Sports**, **Daily Trivia**, and anything else you don't use.

- [ ] **8. Hide recommendation rows.**
      *Settings > Home screen > Recommendation rows* → **Hide**.

- [ ] **9. Hide Quick Access.**
      *Settings > Home screen > Quick Access* → **Hide**.

- [ ] **10. Remove channels you didn't install.**
      On the Home screen, highlight a channel tile → press **\*** on the remote → **Remove channel**
      → confirm. Repeat for each one. `python3 scripts/roku_tool.py apps <ip>` lists everything
      installed and marks what's removable.
      *Can't be removed:* The Roku Channel, Live TV, Search, and the Channel Store are part of
      Roku OS. Hide what you can in step 7.

- [ ] **11. Hide unused inputs.**
      *Settings > TV inputs* → pick each input you don't use (AV, HDMI ports with nothing plugged
      in, Antenna if you have none) → **Hide** / **Set up input → Hide**.

- [ ] **12. If you use an antenna, hide the streaming "channels" in the guide.**
      *Settings > TV inputs > Live TV > Hide streaming TV channels* → **Hide all**. The guide then
      shows only real over-the-air channels instead of hundreds of free ad-supported ones.

## Screensaver and extras

- [ ] **13. Pick a screensaver without ads.**
      *Settings > Theme > Screensavers*. **Roku City** has carried paid movie and brand placements.
      Pick a plain one (clock, photos) or the shortest "turn off TV" timer instead.

- [ ] **14. Turn off feature-update nags and auto-play.**
      Look under *Settings > Home screen* and *Settings > Accessibility* for autoplay/preview
      settings and turn off **Autoplay** / **Featured Content** previews where available.

- [ ] **15. Leave software updates on.**
      Don't block or disable system updates. They're security fixes, and the Roku OS never asks
      before installing them anyway.

## Turn on remote control (for the script)

- [ ] **16. Allow ECP on your network.**
      *Settings > System > Advanced system settings > Control by mobile apps > Network access*
      → **Default** (works for most networks) or **Permissive** (if the script gets a 403).
      After you finish with the script, you can set it back to **Limited**. The official Roku
      phone app also needs this.

## After a factory reset or software update

Go back through 1, 2, 5, 7, 8, and 9. Updates are known to reset some of these.
