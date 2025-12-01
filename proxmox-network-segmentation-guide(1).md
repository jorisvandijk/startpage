# Proxmox Network Segmentation Implementation Guide

## Project Overview

**Objective:** Separate Proxmox containers onto an internal subnet (10.10.10.0/24) while maintaining connectivity to the physical LAN (192.168.1.0/24) through NAT and port forwarding.

**Goals:**
1. Containers/services on `10.10.10.x`
2. Physical hardware devices on `192.168.1.x`
3. All devices use Pi-hole for DNS (network-wide ad-blocking)
4. Easy DHCP failover between Pi-hole and BBOX3 router

**Environment:**
- Proxmox host: 192.168.1.5
- Router (BBOX3): 192.168.1.1
- Pi-hole: 192.168.1.2 (LAN) + 10.10.10.2 (internal)
- Internal subnet: 10.10.10.0/24

---

## Network Architecture

```
Internet
    │
┌───┴───┐
│ BBOX3 │ 192.168.1.1 (Gateway)
└───┬───┘
    │
    ├─── Physical devices (192.168.1.x)
    │
┌───┴────────┐
│  Proxmox   │ 192.168.1.5 (vmbr0)
│            │ 10.10.10.1  (vmbr1) ← internal bridge
└─────┬──────┘
      │
      ├─── Pi-hole    (192.168.1.2 + 10.10.10.2) ← dual-homed
      ├─── Frigate    (10.10.10.101)
      ├─── Wireguard  (10.10.10.102)
      ├─── Container  (10.10.10.xxx)
      └─── ...
```

---

## IP Addressing Scheme

### Static Infrastructure (outside DHCP range)

| IP | Device | Role |
|----|--------|------|
| 192.168.1.1 | BBOX3 | Gateway/Router |
| 192.168.1.2 | Pi-hole | DNS + DHCP |
| 192.168.1.5 | Proxmox | Hypervisor |
| 192.168.1.6–.99 | (available) | Future static assignments |
| 192.168.1.100–.199 | DHCP range | Dynamic clients |

### Internal Container Network

| CT | Service | IP | Ports |
|----|---------|-----|-------|
| 101 | Frigate | 10.10.10.101 | 5000, 8554 |
| 102 | Wireguard | 10.10.10.102 | 51820/udp |
| 103 | Nextcloudpi | 10.10.10.103 | 80, 443 |
| 104 | Sabnzbd | 10.10.10.104 | 7777 |
| 105 | Radarr | 10.10.10.105 | 7878 |
| 106 | Sonarr | 10.10.10.106 | 8989 |
| 107 | Bazarr | 10.10.10.107 | 6767 |
| 108 | Jellyfin | 10.10.10.108 | 8096 |
| 109 | MQTT | 10.10.10.109 | 1883 |
| 110 | NPM | 10.10.10.110 | 80, 81, 443 |
| 111 | Zabbix | (deferred) | — |
| 112 | Lidarr | 10.10.10.112 | 8686 |
| 113 | PhotoPrism | 10.10.10.113 | 2342 |
| 114 | Pi-hole | 10.10.10.2 | 53, 80 |

---

## Phase 1: Create Internal Bridge on Proxmox

### Step 1.1: Connect to Proxmox

```bash
ssh root@192.168.1.5
```

### Step 1.2: Backup network configuration

```bash
cp /etc/network/interfaces /etc/network/interfaces.backup.$(date +%Y%m%d)
```

Verify backup exists:

```bash
ls -la /etc/network/interfaces*
```

### Step 1.3: Edit network configuration

```bash
nano /etc/network/interfaces
```

Add the following block after the existing vmbr0 section, before the `source` line:

```
auto vmbr1
iface vmbr1 inet static
        address 10.10.10.1/24
        bridge-ports none
        bridge-stp off
        bridge-fd 0
        post-up   echo 1 > /proc/sys/net/ipv4/ip_forward
        post-up   iptables -t nat -A POSTROUTING -s 10.10.10.0/24 -o vmbr0 -j MASQUERADE
        post-down iptables -t nat -D POSTROUTING -s 10.10.10.0/24 -o vmbr0 -j MASQUERADE
```

### Step 1.4: Make IP forwarding persistent

```bash
echo "net.ipv4.ip_forward=1" >> /etc/sysctl.conf
```

### Step 1.5: Apply changes

```bash
ifreload -a
```

### Step 1.6: Verify bridge is active

```bash
ip addr show vmbr1
```

Expected output:

```
vmbr1: <BROADCAST,MULTICAST,UP,LOWER_UP> mtu 1500 ...
    inet 10.10.10.1/24 scope global vmbr1
```

---

## Phase 2: Configure Pi-hole with Dual Network Interfaces

Pi-hole needs access to both networks: LAN for physical devices, internal for containers.

**Pi-hole container ID: 114**

### Step 2.1: Stop Pi-hole

```bash
pct stop 114
pct status 114
```

### Step 2.2: Check current network configuration

```bash
pct config 114 | grep net
```

Original config:

```
net0: name=eth0,bridge=vmbr0,gw=192.168.1.1,hwaddr=BC:24:11:DA:4A:EF,ip=192.168.1.2/24,ip6=auto,type=veth
```

### Step 2.3: Add second network interface

```bash
pct set 114 -net1 name=eth1,bridge=vmbr1,ip=10.10.10.2/24
```

> **Note:** No gateway specified on net1. Pi-hole's default route stays via 192.168.1.1.

### Step 2.4: Verify configuration

```bash
pct config 114 | grep net
```

Expected:

```
net0: name=eth0,bridge=vmbr0,gw=192.168.1.1,hwaddr=BC:24:11:DA:4A:EF,ip=192.168.1.2/24,ip6=auto,type=veth
net1: name=eth1,bridge=vmbr1,hwaddr=BC:24:11:AC:0A:A6,ip=10.10.10.2/24,type=veth
```

### Step 2.5: Start Pi-hole and verify interfaces

```bash
pct start 114
pct enter 114
ip addr
```

Should show:
- eth0 with 192.168.1.2
- eth1 with 10.10.10.2

### Step 2.6: Configure Pi-hole to listen on all interfaces

```bash
echo "PIHOLE_INTERFACE=" >> /etc/pihole/pihole-FTL.conf
```

### Step 2.7: Restart Pi-hole DNS service

```bash
systemctl restart pihole-FTL
```

> **Note:** The `pihole` command may not be in PATH. Use systemctl directly.

### Step 2.8: Verify DNS works on all interfaces

```bash
dig @127.0.0.1 google.com +short
dig @10.10.10.2 google.com +short
dig @192.168.1.2 google.com +short
```

All three should return IP addresses.

### Step 2.9: Exit container

```bash
exit
```

---

## Phase 3: Migrate Containers to Internal Network

### General Migration Procedure

For each container:

```bash
# Stop container
pct stop <CT_ID>

# Reconfigure network
pct set <CT_ID> -net0 name=eth0,bridge=vmbr1,ip=10.10.10.<CT_ID>/24,gw=10.10.10.1

# Set DNS to Pi-hole
pct set <CT_ID> -nameserver 10.10.10.2

# Start and verify
pct start <CT_ID>
pct enter <CT_ID>
ping -c 2 10.10.10.1      # Gateway
ping -c 2 10.10.10.2      # Pi-hole
ping -c 2 google.com      # Internet
exit
```

---

### Container: Frigate (CT 101) ✅ COMPLETED

#### Step 3.1: Stop container

```bash
pct stop 101
pct status 101
```

#### Step 3.2: Check current configuration

```bash
pct config 101 | grep net
```

Original (DHCP on LAN):

```
net0: name=eth0,bridge=vmbr0,hwaddr=BC:24:11:49:9B:A7,ip=dhcp,type=veth
```

#### Step 3.3: Reconfigure to internal network

```bash
pct set 101 -net0 name=eth0,bridge=vmbr1,ip=10.10.10.101/24,gw=10.10.10.1
```

#### Step 3.4: Set DNS server

```bash
pct set 101 -nameserver 10.10.10.2
```

#### Step 3.5: Start and test

```bash
pct start 101
pct enter 101
ping -c 2 10.10.10.1      # Gateway - OK
ping -c 2 10.10.10.2      # Pi-hole - OK
ping -c 2 google.com      # Internet - OK
exit
```

---

### Container: Wireguard (CT 102) ✅ COMPLETED

Migrated manually using same procedure as Frigate.

---

### Batch Migration Script (CT 103-113)

Remaining containers were migrated via script:

```bash
#!/bin/bash

# Containers to migrate (excluding 110 NPM, 111 Zabbix)
CONTAINERS=(103 104 105 106 107 108 109 112 113)

for CT in "${CONTAINERS[@]}"; do
    echo "=== Migrating CT $CT ==="
    
    # Stop
    pct stop $CT 2>/dev/null
    sleep 2
    
    # Reconfigure
    pct set $CT -net0 name=eth0,bridge=vmbr1,ip=10.10.10.$CT/24,gw=10.10.10.1
    pct set $CT -nameserver 10.10.10.2
    
    # Start
    pct start $CT
    sleep 3
    
    # Test
    echo "Testing connectivity..."
    pct exec $CT -- ping -c 1 10.10.10.1 > /dev/null && echo "  Gateway: OK" || echo "  Gateway: FAILED"
    pct exec $CT -- ping -c 1 google.com > /dev/null && echo "  Internet: OK" || echo "  Internet: FAILED"
    echo ""
done

echo "=== Migration complete ==="
```

Save as `/root/migrate-containers.sh` and run with `chmod +x` then execute.

**Result:** All containers migrated successfully with Gateway: OK and Internet: OK

---

## Phase 4: Port Forwarding for LAN Access

Containers on 10.10.10.x are not directly reachable from the LAN. Port forwarding on Proxmox exposes services via 192.168.1.5.

### Port Forwarding Script

Save as `/root/setup-portforward.sh`:

```bash
#!/bin/bash

# Port forwarding rules: "container_ip:port:protocol"
RULES=(
    "10.10.10.101:5000:tcp"    # Frigate web
    "10.10.10.101:8554:tcp"    # Frigate RTSP
    "10.10.10.102:51820:udp"   # Wireguard
    "10.10.10.103:80:tcp"      # Nextcloud HTTP
    "10.10.10.103:443:tcp"     # Nextcloud HTTPS
    "10.10.10.104:7777:tcp"    # Sabnzbd (non-standard port)
    "10.10.10.105:7878:tcp"    # Radarr
    "10.10.10.106:8989:tcp"    # Sonarr
    "10.10.10.107:6767:tcp"    # Bazarr
    "10.10.10.108:8096:tcp"    # Jellyfin
    "10.10.10.109:1883:tcp"    # MQTT
    "10.10.10.112:8686:tcp"    # Lidarr
    "10.10.10.113:2342:tcp"    # PhotoPrism
)

for RULE in "${RULES[@]}"; do
    IP=$(echo $RULE | cut -d: -f1)
    PORT=$(echo $RULE | cut -d: -f2)
    PROTO=$(echo $RULE | cut -d: -f3)
    
    echo "Forwarding $PROTO/$PORT -> $IP"
    iptables -t nat -A PREROUTING -i vmbr0 -p $PROTO --dport $PORT -j DNAT --to $IP:$PORT
    iptables -A FORWARD -p $PROTO -d $IP --dport $PORT -j ACCEPT
done

echo "Done. Test access via 192.168.1.5:<port>"
```

Run with: `chmod +x /root/setup-portforward.sh && /root/setup-portforward.sh`

### Making Rules Persistent

Add port forwarding rules to `/etc/network/interfaces` under the vmbr0 section to survive reboots.

### Current Port Forwarding Rules

#### Frigate (5000, 8554)

```bash
# Temporary (for testing)
iptables -t nat -A PREROUTING -i vmbr0 -p tcp --dport 5000 -j DNAT --to 10.10.10.101:5000
iptables -A FORWARD -p tcp -d 10.10.10.101 --dport 5000 -j ACCEPT

iptables -t nat -A PREROUTING -i vmbr0 -p tcp --dport 8554 -j DNAT --to 10.10.10.101:8554
iptables -A FORWARD -p tcp -d 10.10.10.101 --dport 8554 -j ACCEPT
```

Access via: `http://192.168.1.5:5000`

---

### Persistent Port Forwarding Configuration

Add to `/etc/network/interfaces` under vmbr0:

```
# Frigate
post-up   iptables -t nat -A PREROUTING -i vmbr0 -p tcp --dport 5000 -j DNAT --to 10.10.10.101:5000
post-up   iptables -A FORWARD -p tcp -d 10.10.10.101 --dport 5000 -j ACCEPT
post-down iptables -t nat -D PREROUTING -i vmbr0 -p tcp --dport 5000 -j DNAT --to 10.10.10.101:5000
post-down iptables -D FORWARD -p tcp -d 10.10.10.101 --dport 5000 -j ACCEPT

post-up   iptables -t nat -A PREROUTING -i vmbr0 -p tcp --dport 8554 -j DNAT --to 10.10.10.101:8554
post-up   iptables -A FORWARD -p tcp -d 10.10.10.101 --dport 8554 -j ACCEPT
post-down iptables -t nat -D PREROUTING -i vmbr0 -p tcp --dport 8554 -j DNAT --to 10.10.10.101:8554
post-down iptables -D FORWARD -p tcp -d 10.10.10.101 --dport 8554 -j ACCEPT
```

---

## Phase 5: DHCP Failover Configuration

### Safety Procedure (Before Disabling Router DHCP)

Before disabling BBOX3 DHCP, set a static IP alias on your Mac as a fallback:

```bash
sudo ifconfig en0 alias 192.168.1.50 255.255.255.0
```

Verify:
```bash
ifconfig en0 | grep inet
```

This ensures you can always reach:
- BBOX3 at 192.168.1.1 (to re-enable DHCP)
- Proxmox at 192.168.1.5
- Pi-hole at 192.168.1.2

**Note:** Alias doesn't survive Mac reboot — re-add if needed.

### Step 5.1: Configure Pi-hole DHCP ✅ COMPLETED

Inside Pi-hole container (CT 114):

```bash
cat << 'EOF' > /etc/dnsmasq.d/02-pihole-dhcp.conf
# DHCP Range
dhcp-range=192.168.1.100,192.168.1.199,24h

# Gateway
dhcp-option=option:router,192.168.1.1

# DNS (Pi-hole)
dhcp-option=option:dns-server,192.168.1.2

# Domain
dhcp-option=option:domain-name,lan

# Static route - raw format
# 121 = option number
# 24,10,10,10 = /24 prefix + network (10.10.10)
# 192,168,1,5 = gateway
# 0,192,168,1,1 = default route /0 via 192.168.1.1
dhcp-option=121,24,10,10,10,192,168,1,5,0,192,168,1,1
dhcp-option=249,24,10,10,10,192,168,1,5,0,192,168,1,1

# Static reservations for infrastructure
dhcp-host=BC:24:11:DA:4A:EF,192.168.1.2,pihole
EOF
```

Enable DHCP:
```bash
echo "DHCP_ACTIVE=true" >> /etc/pihole/setupVars.conf
systemctl restart pihole-FTL
```

Verify listening:
```bash
ss -ulnp | grep 67
```

### Step 5.2: Disable BBOX3 DHCP ✅ COMPLETED

DHCP disabled on BBOX3 router. Pi-hole is now serving DHCP leases.

### Step 5.3: Static Route Option 121 ✅ COMPLETED

**Issue:** Pi-hole DHCP was working (clients get IPs, DNS, gateway) but option 121 (classless static route) was not being sent to clients.

**Root cause:** Pi-hole v6 has `misc.etc_dnsmasq_d = false` by default, so FTL ignores `/etc/dnsmasq.d/` entirely.

**Solution:**

1. Enable dnsmasq.d reading in FTL:

```bash
pihole-FTL --config misc.etc_dnsmasq_d true
```

2. Use CIDR notation in the config (raw numeric format doesn't work):

```bash
cat > /etc/dnsmasq.d/02-pihole-dhcp.conf << 'EOF'
# DHCP Range
dhcp-range=192.168.1.100,192.168.1.199,24h

# Gateway
dhcp-option=option:router,192.168.1.1

# DNS (Pi-hole)
dhcp-option=option:dns-server,192.168.1.2

# Domain
dhcp-option=option:domain-name,lan

# Static route to internal network via Proxmox
dhcp-option=121,10.10.10.0/24,192.168.1.5,0.0.0.0/0,192.168.1.1
dhcp-option=249,10.10.10.0/24,192.168.1.5,0.0.0.0/0,192.168.1.1

# Static reservations for infrastructure
dhcp-host=BC:24:11:DA:4A:EF,192.168.1.2,pihole
EOF
```

3. Restart FTL:

```bash
systemctl restart pihole-FTL
```

4. Renew DHCP lease on client (macOS):

```bash
sudo ipconfig set en0 BOOTP && sudo ipconfig set en0 DHCP
```

5. Verify route received:

```bash
ipconfig getpacket en0 | grep -i route
# Should show: classless_static_route (classless_route): {10.10.10.0/24, 192.168.1.5; 0.0.0.0/0, 192.168.1.1}

netstat -rn | grep 10.10.10
# Should show: 10.10.10/24        192.168.1.5        UGSc                  en0
```

**Result:** LAN clients can now reach containers directly at 10.10.10.x without port forwarding.

**Workaround:** Clients can still access internal services via port forwarding on 192.168.1.5.

---

## Phase 6: Nginx Proxy Manager and Custom Domain ⏸️ DEFERRED

### Step 6.1: Migrate NPM to Internal Network ✅

```bash
# Stop container
pct stop 110

# Reconfigure to internal network
pct set 110 -net0 name=eth0,bridge=vmbr1,ip=10.10.10.110/24,gw=10.10.10.1

# Set DNS to Pi-hole
pct set 110 -nameserver 10.10.10.2

# Start it
pct start 110

# Test connectivity
pct exec 110 -- ping -c 2 10.10.10.1
pct exec 110 -- ping -c 2 google.com
```

### Step 6.2: Add Port Forward for NPM Admin ✅

Add to `/etc/network/interfaces` in the vmbr0 section:

```
post-up   iptables -t nat -A PREROUTING -i vmbr0 -p tcp --dport 81 -j DNAT --to 10.10.10.110:81
post-down iptables -t nat -D PREROUTING -i vmbr0 -p tcp --dport 81 -j DNAT --to 10.10.10.110:81
```

Apply for current session (post-up only runs on interface up):

```bash
iptables -t nat -A PREROUTING -i vmbr0 -p tcp --dport 81 -j DNAT --to 10.10.10.110:81
```

Access NPM admin at: `http://192.168.1.5:81`

Default credentials:
- Email: `admin@example.com`
- Password: `changeme`

### Step 6.3: Configure Proxy Hosts ⏸️ DEFERRED

**Issue:** NPM returns 403 Forbidden when proxying requests. Proxy hosts were added in UI but not functioning correctly.

**Attempted:**
- Added wildcard DNS in Pi-hole: `address=/.home/10.10.10.110`
- Removed conflicting `/etc/hosts` entry on Pi-hole
- Added proxy host for pihole.home → 10.10.10.2:80

**Status:** Deferred for future investigation. Services remain accessible via direct IP:port or port forwarding through 192.168.1.5.

---

## Session Handoff (For New Claude Session)

### Current State Summary

**What's working:**
- Proxmox internal bridge (vmbr1) at 10.10.10.1/24
- NAT/masquerade for container internet access
- Pi-hole dual-homed: 192.168.1.2 (LAN) + 10.10.10.2 (internal)
- All containers migrated to 10.10.10.x with DNS pointing to Pi-hole
- Port forwarding from 192.168.1.5 to internal containers (persistent in /etc/network/interfaces)
- Pi-hole DHCP serving leases (BBOX3 DHCP disabled)
- DHCP option 121 sending static route to clients (LAN clients can reach 10.10.10.x directly)

**What's not working:**
- Nothing major — core functionality complete

**Key files:**
- `/etc/network/interfaces` on Proxmox - contains bridge config and all port forwarding rules
- `/etc/dnsmasq.d/02-pihole-dhcp.conf` in CT 114 - DHCP config with option 121 (not working)
- `/etc/pihole/setupVars.conf` in CT 114 - has DHCP_ACTIVE=true
- `/etc/pihole/pihole-FTL.conf` in CT 114 - FTL config

**Container IDs:**
| CT | Service | IP |
|----|---------|-----|
| 101 | Frigate | 10.10.10.101 |
| 102 | Wireguard | 10.10.10.102 |
| 103 | Nextcloudpi | 10.10.10.103 |
| 104 | Sabnzbd | 10.10.10.104 |
| 105 | Radarr | 10.10.10.105 |
| 106 | Sonarr | 10.10.10.106 |
| 107 | Bazarr | 10.10.10.107 |
| 108 | Jellyfin | 10.10.10.108 |
| 109 | MQTT | 10.10.10.109 |
| 110 | NPM | (not migrated) |
| 111 | Zabbix | (not migrated) |
| 112 | Lidarr | 10.10.10.112 |
| 113 | PhotoPrism | 10.10.10.113 |
| 114 | Pi-hole | 192.168.1.2 + 10.10.10.2 |

**Next steps:**
1. Configure BBOX3 DHCP (fallback) with same settings
2. Set BBOX3 upstream DNS to Pi-hole
3. Test DHCP failover
4. Set custom domain
5. Back up Proxmox server

---

## Troubleshooting

### Issue: ZeroTier Subnet Conflict

**Symptoms:**
- Containers could reach Pi-hole (10.10.10.2)
- Proxmox could not reach containers
- Error messages referenced 10.10.10.10 (unknown IP)

**Diagnosis:**

```bash
ip neigh show | grep 10.10.10
ip route | grep 10.10.10
```

Output revealed conflicting routes:

```
10.10.10.0/24 dev zt2lr67wui proto kernel scope link src 10.10.10.10
10.10.10.0/24 dev vmbr1 proto kernel scope link src 10.10.10.1
```

**Root cause:** ZeroTier was using the same 10.10.10.0/24 subnet.

**Resolution:**

```bash
systemctl stop zerotier-one
systemctl disable zerotier-one
apt remove zerotier-one -y
```

**Verification:**

```bash
ip link | grep zt              # Should return nothing
ip route | grep 10.10.10       # Should show only vmbr1 route
ping -c 2 10.10.10.2           # Should work
ping -c 2 10.10.10.101         # Should work
```

---

### Issue: pihole command not in PATH

**Symptoms:**
- `pihole` command not found inside container

**Diagnosis:**

```bash
echo $PATH
# Shows: /sbin:/bin:/usr/sbin:/usr/bin (missing /usr/local/bin)
```

**Resolution:**

```bash
# Temporary (current session)
export PATH=$PATH:/usr/local/bin

# Permanent
echo 'export PATH=$PATH:/usr/local/bin' >> ~/.bashrc
```

---

### Issue: Container DNS not persisting after reboot

**Solution:** Set DNS via Proxmox container config instead of editing /etc/resolv.conf:

```bash
pct set <CT_ID> -nameserver 10.10.10.2
```

---

### Issue: Sabnzbd listening on non-standard port

**Symptoms:**
- Port 8080 unreachable after migration
- Service running but not accessible

**Diagnosis:**

```bash
pct exec 104 -- ss -tlnp | grep 8080   # Returns nothing
pct exec 104 -- ss -tlnp               # Shows port 7777 instead
```

**Resolution:** Sabnzbd was configured to use port 7777. Update port forwarding:

```bash
iptables -t nat -A PREROUTING -i vmbr0 -p tcp --dport 7777 -j DNAT --to 10.10.10.104:7777
iptables -A FORWARD -p tcp -d 10.10.10.104 --dport 7777 -j ACCEPT
```

Access via: `http://192.168.1.5:7777`

---

### Issue: Jellyfin failing to start - insufficient disk space

**Symptoms:**
- Jellyfin service in failed state
- SIGABRT in systemd status

**Diagnosis:**

```bash
pct exec 108 -- journalctl -u jellyfin --no-pager -n 50
```

Output:
```
System.InvalidOperationException: The path `/var/lib/jellyfin/data` has insufficient free space. Available: 1.3GiB, Required: 2GiB.
```

**Resolution:** Resize the container rootfs:

```bash
pct resize 108 rootfs +4G
pct exec 108 -- systemctl start jellyfin
```

Access via: `http://192.168.1.5:8096`

---

## Progress Tracker

| Phase | Status |
|-------|--------|
| 1. Create vmbr1 bridge | ✅ Complete |
| 2. Dual-home Pi-hole | ✅ Complete |
| 3. Migrate containers | ✅ Complete (11/11) |
| 4. Port forwarding | ✅ Complete (persistent) |
| 5. DHCP failover | ✅ Complete (DHCP + option 121 working) |

## TODO

1. ~~Make port forwarding persistent~~ ✅
2. ~~Add static route for 10.10.10.x access from LAN~~ ✅ Option 121 working (misc.etc_dnsmasq_d = true)
3. ~~Configure Pi-hole DHCP (primary)~~ ✅
4. Configure BBOX3 DHCP (fallback, same range) — currently disabled
5. Set BBOX3 upstream DNS to Pi-hole (so even BBOX3 DHCP clients use Pi-hole for DNS)
6. Test DHCP failover — flip switch on BBOX3, everything still works
7. Set custom domain
8. **Back up Proxmox server** (snapshots, configs, container backups)
9. NPM and Zabbix (deferred)

### Container Migration Status

| CT | Service | Status | IP |
|----|---------|--------|-----|
| 101 | Frigate | ✅ Done | 10.10.10.101 |
| 102 | Wireguard | ✅ Done | 10.10.10.102 |
| 103 | Nextcloudpi | ✅ Done | 10.10.10.103 |
| 104 | Sabnzbd | ✅ Done | 10.10.10.104 |
| 105 | Radarr | ✅ Done | 10.10.10.105 |
| 106 | Sonarr | ✅ Done | 10.10.10.106 |
| 107 | Bazarr | ✅ Done | 10.10.10.107 |
| 108 | Jellyfin | ✅ Done | 10.10.10.108 |
| 109 | MQTT | ✅ Done | 10.10.10.109 |
| 110 | NPM | ⏸️ Deferred | 10.10.10.110 |
| 111 | Zabbix | ⏸️ Deferred | — |
| 112 | Lidarr | ✅ Done | 10.10.10.112 |
| 113 | PhotoPrism | ✅ Done | 10.10.10.113 |
| 114 | Pi-hole | ✅ Dual-homed | 192.168.1.2 + 10.10.10.2 |

### Service Access URLs

| CT | Service | Access URL |
|----|---------|------------|
| 101 | Frigate | http://192.168.1.5:5000 |
| 101 | Frigate RTSP | rtsp://192.168.1.5:8554 |
| 102 | Wireguard | 192.168.1.5:51820/udp |
| 103 | Nextcloud | http://192.168.1.5:80 |
| 103 | Nextcloud SSL | https://192.168.1.5:443 |
| 104 | Sabnzbd | http://192.168.1.5:7777 |
| 105 | Radarr | http://192.168.1.5:7878 |
| 106 | Sonarr | http://192.168.1.5:8989 |
| 107 | Bazarr | http://192.168.1.5:6767 |
| 108 | Jellyfin | http://192.168.1.5:8096 |
| 109 | MQTT | 192.168.1.5:1883 |
| 112 | Lidarr | http://192.168.1.5:8686 |
| 113 | PhotoPrism | http://192.168.1.5:2342 |
| 110 | NPM Admin | http://192.168.1.5:81 |

---

## Reference: Final /etc/network/interfaces

```
auto lo
iface lo inet loopback
iface enp4s0 inet manual
auto vmbr0
iface vmbr0 inet static
        address 192.168.1.5/24
        gateway 192.168.1.1
        bridge-ports enp4s0
        bridge-stp off
        bridge-fd 0
        # Port forwarding to internal containers
        post-up   iptables -t nat -A PREROUTING -i vmbr0 -p tcp --dport 5000 -j DNAT --to 10.10.10.101:5000
        post-up   iptables -t nat -A PREROUTING -i vmbr0 -p tcp --dport 8554 -j DNAT --to 10.10.10.101:8554
        post-up   iptables -t nat -A PREROUTING -i vmbr0 -p udp --dport 51820 -j DNAT --to 10.10.10.102:51820
        post-up   iptables -t nat -A PREROUTING -i vmbr0 -p tcp --dport 80 -j DNAT --to 10.10.10.103:80
        post-up   iptables -t nat -A PREROUTING -i vmbr0 -p tcp --dport 443 -j DNAT --to 10.10.10.103:443
        post-up   iptables -t nat -A PREROUTING -i vmbr0 -p tcp --dport 7777 -j DNAT --to 10.10.10.104:7777
        post-up   iptables -t nat -A PREROUTING -i vmbr0 -p tcp --dport 7878 -j DNAT --to 10.10.10.105:7878
        post-up   iptables -t nat -A PREROUTING -i vmbr0 -p tcp --dport 8989 -j DNAT --to 10.10.10.106:8989
        post-up   iptables -t nat -A PREROUTING -i vmbr0 -p tcp --dport 6767 -j DNAT --to 10.10.10.107:6767
        post-up   iptables -t nat -A PREROUTING -i vmbr0 -p tcp --dport 8096 -j DNAT --to 10.10.10.108:8096
        post-up   iptables -t nat -A PREROUTING -i vmbr0 -p tcp --dport 1883 -j DNAT --to 10.10.10.109:1883
        post-up   iptables -t nat -A PREROUTING -i vmbr0 -p tcp --dport 8686 -j DNAT --to 10.10.10.112:8686
        post-up   iptables -t nat -A PREROUTING -i vmbr0 -p tcp --dport 2342 -j DNAT --to 10.10.10.113:2342
        post-up   iptables -t nat -A PREROUTING -i vmbr0 -p tcp --dport 81 -j DNAT --to 10.10.10.110:81
        post-down iptables -t nat -D PREROUTING -i vmbr0 -p tcp --dport 5000 -j DNAT --to 10.10.10.101:5000
        post-down iptables -t nat -D PREROUTING -i vmbr0 -p tcp --dport 8554 -j DNAT --to 10.10.10.101:8554
        post-down iptables -t nat -D PREROUTING -i vmbr0 -p udp --dport 51820 -j DNAT --to 10.10.10.102:51820
        post-down iptables -t nat -D PREROUTING -i vmbr0 -p tcp --dport 80 -j DNAT --to 10.10.10.103:80
        post-down iptables -t nat -D PREROUTING -i vmbr0 -p tcp --dport 443 -j DNAT --to 10.10.10.103:443
        post-down iptables -t nat -D PREROUTING -i vmbr0 -p tcp --dport 7777 -j DNAT --to 10.10.10.104:7777
        post-down iptables -t nat -D PREROUTING -i vmbr0 -p tcp --dport 7878 -j DNAT --to 10.10.10.105:7878
        post-down iptables -t nat -D PREROUTING -i vmbr0 -p tcp --dport 8989 -j DNAT --to 10.10.10.106:8989
        post-down iptables -t nat -D PREROUTING -i vmbr0 -p tcp --dport 6767 -j DNAT --to 10.10.10.107:6767
        post-down iptables -t nat -D PREROUTING -i vmbr0 -p tcp --dport 8096 -j DNAT --to 10.10.10.108:8096
        post-down iptables -t nat -D PREROUTING -i vmbr0 -p tcp --dport 1883 -j DNAT --to 10.10.10.109:1883
        post-down iptables -t nat -D PREROUTING -i vmbr0 -p tcp --dport 8686 -j DNAT --to 10.10.10.112:8686
        post-down iptables -t nat -D PREROUTING -i vmbr0 -p tcp --dport 2342 -j DNAT --to 10.10.10.113:2342
        post-down iptables -t nat -D PREROUTING -i vmbr0 -p tcp --dport 81 -j DNAT --to 10.10.10.110:81
iface enp5s0 inet manual
iface enp6s0 inet manual
iface enp7s0 inet manual
auto vmbr1
iface vmbr1 inet static
        address 10.10.10.1/24
        bridge-ports none
        bridge-stp off
        bridge-fd 0
        post-up   echo 1 > /proc/sys/net/ipv4/ip_forward
        post-up   iptables -t nat -A POSTROUTING -s 10.10.10.0/24 -o vmbr0 -j MASQUERADE
        post-down iptables -t nat -D POSTROUTING -s 10.10.10.0/24 -o vmbr0 -j MASQUERADE
source /etc/network/interfaces.d/*
```

---

## Notes

- Containers on 10.10.10.x can reach devices on 192.168.1.x (outbound NAT works)
- Physical devices access container services via 192.168.1.5:<port>
- DNS for all containers points to Pi-hole at 10.10.10.2
