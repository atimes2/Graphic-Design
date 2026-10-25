# 02: Network-level blocking

The TV settings stop *personalization*, but the TV still contacts Roku's ad and logging
servers. The only way to stop that on a Roku is to block those domains on your network with a
DNS blocker. It's the same idea as an ad blocker, applied to your whole Wi-Fi.

## Pick one

| Option | Cost | Setup | Notes |
|---|---|---|---|
| **NextDNS** (nextdns.io) | Free up to 300k queries/mo, then ~$2/mo | 10 min, nothing to install | Easiest. Has a built-in "Native tracking protection → Roku" toggle. |
| **AdGuard Home** (github.com/AdguardTeam/AdGuardHome) | Free | Raspberry Pi, old PC, or some routers | Nicer UI than Pi-hole and built-in DNS rewrite rules. |
| **Pi-hole** (github.com/pi-hole/pi-hole) | Free | Raspberry Pi or any always-on Linux box | The classic option, with the biggest community and most guides. |

If you've never done this before, start with **NextDNS**.

## Lists to add

From most targeted to broadest:

1. **This folder's lists.** Add [`blocklists/roku-starter.txt`](blocklists/roku-starter.txt) first.
   After a few days with nothing broken, add [`blocklists/roku-aggressive.txt`](blocklists/roku-aggressive.txt).
   In Pi-hole or AdGuard Home you can paste the domains in, or push this repo and add the
   GitHub *raw* URL as a list so it stays in sync.
2. **HaGeZi Roku Tracker** (Roku only, maintained, about 57 domains):
   - Domains format (Pi-hole, NextDNS, most tools):
     `https://raw.githubusercontent.com/hagezi/dns-blocklists/main/wildcard/native.roku-onlydomains.txt`
   - AdBlock format (AdGuard Home):
     `https://raw.githubusercontent.com/hagezi/dns-blocklists/main/adblock/native.roku.txt`
   - In **NextDNS**: *Privacy → Native Tracking Protection → Roku*.
   - ⚠ It blocks `wwwimg.roku.com` and `assets.sr.roku.com`. If home-screen artwork or app icons
     disappear, allow-list those two.
3. **Perflyst Smart-TV list** (every TV brand; Roku section is small):
   `https://raw.githubusercontent.com/Perflyst/PiHoleBlocklist/master/SmartTV.txt`
4. **hkamran80 Smart-TV list** (every brand, updated 2025):
   `https://raw.githubusercontent.com/hkamran80/blocklists/main/smart-tv.txt`

You don't need all four. **This folder's starter list plus HaGeZi Roku** covers everything in the
other two and more.

## The Roku DNS gotcha (important)

Roku devices are widely reported to fall back to **Google DNS (8.8.8.8 / 8.8.4.4)** when your
own DNS server blocks something, which bypasses your blocker completely. To make blocking stick,
you have to handle this **on your router**:

1. Point your router's DHCP DNS at your Pi-hole / AdGuard Home (or NextDNS's addresses).
2. Add a **NAT / port-forward rule that redirects all outbound port 53 (DNS) traffic to your
   blocker**, except traffic from the blocker itself. Search "\<your router model\> redirect DNS
   port 53". Ubiquiti, OPNsense/pfSense, OpenWrt, Asus-Merlin and Firewalla all support it, but
   most ISP-supplied routers don't.
3. If your router can't do this, NextDNS's **router setup** or **Linked IP** setup is the
   fallback.

**Don't** just hard-block 8.8.8.8 or null-route it. Users report the Roku then acts as if it has
no internet at all. *Redirecting* the queries to your blocker works. *Dropping* them doesn't.

## Check it's working

From a computer on the same network:

```bash
python3 scripts/roku_tool.py check-dns
```

Run it once **before** you set up blocking and once after. A handful of domains are dead and
show BLOCKED both times; what matters is the jump. Then on the TV, open a few apps and the home
screen and watch your blocker's query log. You should see blocked Roku domains, and none of
them should be getting through to 8.8.8.8.

## If something breaks

Roll back in this order and test after each step:

| Symptom | Likely cause | Fix |
|---|---|---|
| Antenna / Live TV guide is blank | `*.logs.roku.com` family (aggressive list) | Remove `roku-aggressive.txt` |
| Missing artwork/icons on home screen | `wwwimg.roku.com`, `assets.sr.roku.com` (HaGeZi) | Allow-list those two |
| No preview thumbnails when fast-forwarding | `bif.sr.roku.com` | Allow-list it |
| A specific app won't play or keeps buffering | That app's own ad server is on a broad list | Check the query log while it fails, then allow-list that domain |
| Channel Store / sign-in fails | Something too broad got blocked | Temporarily disable blocking for the TV's IP and find the domain in the log |
| TV says "not connected" | 8.8.8.8 is being blocked, not redirected | Change the router rule to a redirect (see above) |

Most blockers let you set a **per-device / per-client** group, so you can test aggressive rules
on the TV without affecting phones and laptops.
