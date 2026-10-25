# 03: Repos and sources

Everything this folder was built from. Accurate as of October 2026.

## Blocklist repos

| Repo | What's useful | Notes |
|---|---|---|
| [hagezi/dns-blocklists](https://github.com/hagezi/dns-blocklists) | `native.roku` Roku Tracker list (57 domains, last updated Oct 2026) | The best-maintained Roku list. Also has Samsung, LG, Amazon, and other per-vendor lists. |
| [Perflyst/PiHoleBlocklist](https://github.com/Perflyst/PiHoleBlocklist) | `SmartTV.txt`, a Roku section with `*.logs.roku.com` and `ravm.tv` | The classic smart-TV list. Last version tag is 2023. |
| [hkamran80/blocklists](https://github.com/hkamran80/blocklists) | `smart-tv.txt`, a Roku section with ad, trace, and log domains | Successor to the gist below. Updated Sept 2025. |
| [hkamran80 smart-TV gist](https://gist.github.com/hkamran80/779019103fcd306979411d44c8d38459) | Older version of the above | No longer maintained. Use the repo. |
| [SystemJargon/filters](https://github.com/SystemJargon/filters) | General smart-TV and OS telemetry list | Broad, so expect more breakage. |
| [Pyenb/Pi-hole-blocklist](https://github.com/Pyenb/Pi-hole-blocklist) | General ads and telemetry | Broad, not Roku-specific. |

## DNS blockers

- [pi-hole/pi-hole](https://github.com/pi-hole/pi-hole)
- [AdguardTeam/AdGuardHome](https://github.com/AdguardTeam/AdGuardHome)
- [NextDNS](https://nextdns.io), a hosted service with a Roku toggle under Native Tracking Protection

## Roku ECP (remote control API) projects

| Repo | Notes |
|---|---|
| [jcarbaugh/python-roku](https://github.com/jcarbaugh/python-roku) | `pip install roku`. Lists apps, sends remote keys. Good if you want to script more than `roku_tool.py` does. |
| [ctalkington/python-rokuecp](https://github.com/ctalkington/python-rokuecp) | Async ECP client. It's what Home Assistant's Roku integration uses. |
| [RoseSecurity/Abusing-Roku-APIs](https://github.com/RoseSecurity/Abusing-Roku-APIs) | Shows how open ECP is on a LAN, which is why you should set *Control by mobile apps* back to **Limited** when you're done. |
| [remoku (PyPI)](https://pypi.org/project/remoku) | Desktop remote built on ECP |

ECP has **no uninstall command**. A Roku developer-forum thread
([Remove a channel via ECP](https://forum.developer.roku.com/t/remove-a-channel-via-ecp/9192))
confirms it, and found that trying an uninstall path just returns 404. The workaround is to open
the channel's page via search and finish on the remote, which is what `roku_tool.py remove` does.

## Settings guides and reporting

- [The Markup: Your smart TV knows what you're watching](https://themarkup.org/privacy/2023/12/12/your-smart-tv-knows-what-youre-watching): the ACR and ad settings per brand, Roku included
- [Reclaim The Net: How to stop your Roku smart TV from tracking you](https://reclaimthenet.org/stop-roku-smart-tv-tracking/)
- [Consumer World: Stop your TV from spying on you (PDF)](https://consumerworld.org/pubs/stop%20your%20tv%20from%20spying%20on%20you.pdf)
- [Tom's Guide forum: ACR keeps turning back on on a Hisense Roku TV](https://forums.tomsguide.com/threads/turn-off-the-acr-on-a-hisense-tv.584074/post-2094699)
- [PCWorld: 4 simple steps to improve your Roku's home screen](https://www.pcworld.com/article/2357968/4-simple-steps-to-improve-roku-home-screen.html)
- [PCWorld: Roku's new home screen and how to use it](https://www.pcworld.com/article/3149985/rokus-new-home-screen-is-a-big-change-heres-how-to-use-it.html)
- [MakeUseOf: Roku's home screen customization](https://www.makeuseof.com/rokus-home-screen-customization-solves-problem-everyone-complains/)
- [TCL support: Remove streaming channels from the Live TV guide](https://support.tcl.com/en_US/rokutv-common-questions/01-how-to-remove-the-streaming-channels-from-the-live-tv-channel-guide) (same Roku OS menus as Hisense)
- [Roku community: Power on → input setting / missing in Store mode](https://community.roku.com/t5/Roku-setup/Setting-the-Home-Screen-as-a-default/m-p/963452)

## The hardcoded-DNS problem

- [Pi-hole forum: Forcing hard-coded-DNS devices like Roku to use Pi-hole](https://discourse.pi-hole.net/t/how-do-i-force-dns-hard-coded-devices-like-the-roku-to-use-pi-hole-while-allowing-my-pcs-to-bypass-pi-hole/12186)
- [Pi-hole forum: 8.8.8.8 redirect to Pi-hole](https://discourse.pi-hole.net/t/8-8-8-8-redirect-to-pihole/41702)
- [Derek Seaman: Redirect hard-coded DNS to Pi-hole on a Ubiquiti EdgeRouter](https://www.derekseaman.com/2019/10/redirect-hard-coded-dns-to-pi-hole-using-ubiquiti-edgerouter.html)
- [Pi-hole forum: Blocking Roku logging broke the TV schedule](https://discourse.pi-hole.net/t/what-domain-to-whitelist-to-unblock-roku-tv-schedule/86284)
