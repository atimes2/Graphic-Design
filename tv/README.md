# TV: de-bloating the 70" Hisense Roku TV

Everything for cleaning up the living-room TV lives in this folder, apart from the design work.

## The honest version first

A Hisense Roku TV runs **Roku OS**, which is locked down. Unlike an Android or Google TV, there's
no way to root it or sideload a launcher, and there are no ADB commands for uninstalling system
apps. Every GitHub repo or video promising to "root" a Roku TV either is out of date or only
enables Roku's **Developer mode**. Developer mode lets you test your own channels; it doesn't
remove anything.

You can't uninstall the bloat itself. You can still get rid of nearly all of what you *see* and
most of what it *sends*, in three layers:

| Layer | What it fixes | Effort | File |
|---|---|---|---|
| 1. TV settings | Ad tracking, ACR ("what's on screen" reporting), home-screen clutter, booting into ads, unused channels | 20 min, remote only | [01-settings-checklist.md](01-settings-checklist.md) |
| 2. Network blocking | Ad and telemetry traffic leaving the TV, some home-screen ads | 30–60 min, needs a Pi-hole, AdGuard Home or NextDNS | [02-network-blocking.md](02-network-blocking.md) |
| 3. Script helper | Lists every installed channel, shows which can be removed, checks that blocking works | 5 min, needs a computer on the same Wi-Fi | [scripts/roku_tool.py](scripts/roku_tool.py) |

If you only do one thing, do **01**. The single biggest quality-of-life change is
*Settings > System > Power > Power on → Last used TV input*, so the TV turns on straight to your
HDMI input and skips the ad-filled home screen.

### The nuclear options

- **Make it a dumb TV.** Factory reset (*Settings > System > Advanced system settings > Factory reset*),
  and in setup choose to use the TV **without connecting to the internet**. No ads and no tracking,
  but no apps either. Plug in a streamer you like better (Apple TV is the cleanest; an Nvidia
  Shield or a Google TV with a custom launcher also works). You keep the Hisense panel and
  never see Roku OS.
- **Keep it online but never use Roku's home screen.** Do layers 1 and 2 and use an external
  streamer on HDMI with Power on → that input. This is the best balance for most people.

## What's in here

```
tv/
├── README.md                    this file
├── 01-settings-checklist.md     every on-TV setting, menu path by menu path
├── 02-network-blocking.md       Pi-hole / AdGuard Home / NextDNS setup and the Roku DNS gotcha
├── 03-repos-and-sources.md      every repo and article this was built from
├── blocklists/
│   ├── roku-starter.txt         low-risk ads + ACR domains (start here)
│   └── roku-aggressive.txt      logging + telemetry (add later, may break the antenna guide)
└── scripts/
    └── roku_tool.py             discover the TV, list channels, open one for removal, test DNS blocking
```

## Quick start for the script

```bash
# On the TV first: Settings > System > Advanced system settings > Control by mobile apps
#                  > Network access → Default (or Permissive)
cd tv/scripts
python3 roku_tool.py discover          # prints the TV's IP
python3 roku_tool.py info 192.168.1.50
python3 roku_tool.py apps 192.168.1.50
python3 roku_tool.py remove 192.168.1.50 "Some Channel"
python3 roku_tool.py check-dns         # after setting up Pi-hole etc.
```

It's standard-library Python 3 with nothing to install. It talks to the TV over Roku's own
External Control Protocol (the same one the Roku phone app uses) on port 8060.
