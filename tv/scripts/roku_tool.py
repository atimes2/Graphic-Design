#!/usr/bin/env python3
"""Small helper for a Roku TV on your home network (Hisense Roku TV, TCL Roku TV, any Roku).

Uses Roku's External Control Protocol (ECP) on port 8060. Standard library only, no installs.
Run it from a computer on the same Wi-Fi as the TV.

  python3 roku_tool.py discover              find the TV's IP address
  python3 roku_tool.py info  192.168.1.50    model, software version, privacy-relevant flags
  python3 roku_tool.py apps  192.168.1.50    every installed channel, with what's removable
  python3 roku_tool.py remove 192.168.1.50 "Channel Name"
                                             opens that channel's page so you can remove it
  python3 roku_tool.py check-dns             tests whether your blocklists are actually working

Before it works: on the TV go to Settings > System > Advanced system settings >
Control by mobile apps > Network access and pick "Default" or "Permissive".
"""

import argparse
import os
import socket
import sys
import time
import urllib.error
import urllib.parse
import urllib.request
import xml.etree.ElementTree as ET

PORT = 8060
HERE = os.path.dirname(os.path.abspath(__file__))
BLOCKLISTS = os.path.join(HERE, "..", "blocklists")

# Built into Roku OS; there is no "Remove channel" option for these.
SYSTEM_APP_IDS = {
    "151908": "The Roku Channel",
    "tvinput.dtv": "Live TV (antenna)",
}


def ecp(ip, path, method="GET"):
    req = urllib.request.Request(f"http://{ip}:{PORT}/{path}", method=method, data=b"" if method == "POST" else None)
    try:
        with urllib.request.urlopen(req, timeout=5) as resp:
            return resp.read()
    except urllib.error.HTTPError as e:
        if e.code == 403:
            sys.exit("The TV refused the request (403). Turn on Settings > System > Advanced system settings > "
                     "Control by mobile apps > Network access: Default or Permissive.")
        raise
    except (urllib.error.URLError, socket.timeout) as e:
        sys.exit(f"Could not reach {ip}:{PORT} ({e}). Check the IP and that this computer is on the same network.")


def discover(_args):
    msg = ("M-SEARCH * HTTP/1.1\r\nHost: 239.255.255.250:1900\r\n"
           'Man: "ssdp:discover"\r\nST: roku:ecp\r\nMX: 3\r\n\r\n').encode()
    sock = socket.socket(socket.AF_INET, socket.SOCK_DGRAM, socket.IPPROTO_UDP)
    sock.settimeout(1)
    sock.sendto(msg, ("239.255.255.250", 1900))
    found, deadline = set(), time.time() + 4
    while time.time() < deadline:
        try:
            data, _ = sock.recvfrom(2048)
        except socket.timeout:
            continue
        for line in data.decode(errors="replace").splitlines():
            if line.lower().startswith("location:"):
                found.add(line.split(":", 1)[1].strip())
    if not found:
        print("No Roku found. Check the TV is on, on the same Wi-Fi, and 'Control by mobile apps' is not Disabled.\n"
              "You can also read the IP on the TV: Settings > Network > About.")
    for loc in sorted(found):
        print(f"Found Roku at {urllib.parse.urlparse(loc).hostname}  ({loc})")


def info(args):
    root = ET.fromstring(ecp(args.ip, "query/device-info"))
    fields = [
        ("vendor-name", "Brand"),
        ("friendly-model-name", "Model"),
        ("model-number", "Model number"),
        ("software-version", "Roku OS version"),
        ("is-tv", "Is a TV"),
        ("network-type", "Network"),
        ("supports-private-listening", "Private listening"),
        ("developer-enabled", "Developer mode"),
        ("search-enabled", "Search enabled"),
        ("voice-search-enabled", "Voice search"),
        ("notifications-enabled", "Notifications"),
        ("time-zone-name", "Time zone"),
    ]
    for tag, label in fields:
        el = root.find(tag)
        if el is not None and el.text:
            print(f"{label:20} {el.text}")


def apps(args):
    root = ET.fromstring(ecp(args.ip, "query/apps"))
    rows = []
    for app in root.findall("app"):
        app_id = app.get("id", "")
        name = (app.text or "").strip()
        if app_id.startswith("tvinput.") and app_id != "tvinput.dtv":
            kind = "TV input (hide under Settings > TV inputs)"
        elif app_id in SYSTEM_APP_IDS:
            kind = "built in, can't remove"
        else:
            kind = "removable"
        rows.append((kind != "removable", name.lower(), app_id, name, kind))
    rows.sort()
    width = max((len(r[3]) for r in rows), default=10)
    print(f"{'Channel':{width}}  {'ID':>12}  Status")
    for _, _, app_id, name, kind in rows:
        print(f"{name:{width}}  {app_id:>12}  {kind}")
    removable = sum(1 for r in rows if not r[0])
    print(f"\n{len(rows)} entries, {removable} removable. To remove one: highlight it on the Home screen, "
          "press * on the remote, choose Remove channel.")


def remove(args):
    # ECP has no uninstall command. The best it can do is open the channel's page in Roku Search,
    # where "Remove channel" is one or two presses away. Finishing on the remote keeps a human in
    # the loop, so a menu-layout change can never make the script click the wrong thing.
    query = urllib.parse.urlencode({"title": args.name, "type": "channel", "launch": "false"})
    ecp(args.ip, "keypress/Home", "POST")
    time.sleep(2)
    ecp(args.ip, f"search/browse?{query}", "POST")
    print(f'Opened "{args.name}" on the TV. On the remote: choose "Remove channel" (or press * then '
          "Remove channel), then confirm.")


def check_dns(_args):
    domains = []
    for fname in ("roku-starter.txt", "roku-aggressive.txt"):
        path = os.path.join(BLOCKLISTS, fname)
        if not os.path.exists(path):
            continue
        with open(path) as f:
            for line in f:
                line = line.strip()
                if line and not line.startswith("#"):
                    domains.append((fname, line))
    blocked = 0
    for fname, d in domains:
        try:
            addrs = {ai[4][0] for ai in socket.getaddrinfo(d, 443)}
        except socket.gaierror:
            addrs = set()
        is_blocked = not addrs or addrs <= {"0.0.0.0", "::", "127.0.0.1", "::1"}
        blocked += is_blocked
        print(f"{'BLOCKED' if is_blocked else 'open   '}  {d:45} ({fname})")
    print(f"\n{blocked}/{len(domains)} blocked from this computer's DNS.")
    print("A few domains don't exist any more and show BLOCKED even with no blocker; compare against a run "
          "before you set one up.")
    if blocked < len(domains) / 2:
        print("Most domains still resolve: this computer isn't using your Pi-hole / AdGuard / NextDNS yet.")


def main():
    p = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    sub = p.add_subparsers(dest="cmd", required=True)
    sub.add_parser("discover").set_defaults(fn=discover)
    for name, fn in (("info", info), ("apps", apps)):
        sp = sub.add_parser(name)
        sp.add_argument("ip")
        sp.set_defaults(fn=fn)
    sp = sub.add_parser("remove")
    sp.add_argument("ip")
    sp.add_argument("name", help="channel name exactly as it appears in the 'apps' list")
    sp.set_defaults(fn=remove)
    sub.add_parser("check-dns").set_defaults(fn=check_dns)
    args = p.parse_args()
    args.fn(args)


if __name__ == "__main__":
    main()
