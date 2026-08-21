#!/usr/bin/env python3
"""
Discover C3 panels on the LAN (UDP broadcast) and optionally set a static IP.

    python discover.py                 # list panels found on the subnet
    python discover.py --set-ip 192.168.1.201 --mask 255.255.255.0 \
                       --gw 192.168.1.1 --mac <panel-mac>

Discovery uses the zkaccess-c3 library's broadcast if available; the panel must
be on the same L2 segment as this host. If nothing is found, check the panel is
powered, the network LED is up, and no VLAN/firewall blocks UDP broadcast.
"""
from __future__ import annotations

import argparse
import sys

try:
    from c3 import C3  # type: ignore
except Exception:
    C3 = None


def discover() -> list[dict]:
    if C3 is None:
        print("zkaccess-c3 not installed — `pip install -r requirements.txt`", file=sys.stderr)
        return []
    # NOTE: verify the exact discovery call for your library version.
    # Common forms: C3.discover()  /  C3.search_device()
    fn = getattr(C3, "discover", None) or getattr(C3, "search_device", None)
    if fn is None:
        print("This zkaccess-c3 build has no discovery helper; set the IP manually "
              "with the ZKAccess/SearchTool utility, then put it in .env", file=sys.stderr)
        return []
    devices = fn() or []
    return [d if isinstance(d, dict) else getattr(d, "__dict__", {"repr": str(d)}) for d in devices]


def set_ip(mac: str, ip: str, mask: str, gw: str) -> None:
    if C3 is None:
        raise SystemExit("zkaccess-c3 not installed")
    # Set network params by MAC via broadcast (device need not be reachable yet).
    fn = getattr(C3, "set_device_ip", None)
    if fn is None:
        raise SystemExit("This library build cannot set IP over broadcast; use ZKAccess SearchTool.")
    fn(mac=mac, ip=ip, netmask=mask, gateway=gw)
    print(f"Requested {mac} → {ip}/{mask} gw {gw}. Power-cycle if it doesn't take.")


def main() -> None:
    ap = argparse.ArgumentParser()
    ap.add_argument("--set-ip")
    ap.add_argument("--mask", default="255.255.255.0")
    ap.add_argument("--gw", default="")
    ap.add_argument("--mac")
    args = ap.parse_args()

    if args.set_ip:
        if not args.mac:
            raise SystemExit("--mac is required with --set-ip")
        set_ip(args.mac, args.set_ip, args.mask, args.gw)
        return

    found = discover()
    if not found:
        print("No panels found.")
        return
    for d in found:
        print(d)


if __name__ == "__main__":
    main()
