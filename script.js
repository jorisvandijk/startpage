const services = [
    {
        name: "Bazarr",
        description: "Subtitle manager",
        url: "http://10.10.10.107:6767",
        icon: "fas fa-closed-captioning",
        color: "#f38ba8"
    },
    {
        name: "Frigate",
        description: "NVR camera system",
        url: "http://10.10.10.101:5000",
        icon: "fas fa-video",
        color: "#fab387"
    },
    {
        name: "Home Assistant",
        description: "Home automation",
        url: "http://10.10.10.100:8123",
        icon: "fas fa-home",
        color: "#fab387"
    },
    {
        name: "Immich",
        description: "Photo backup & management",
        url: "http://10.10.10.117:2283/",
        icon: "fas fa-images",
        color: "#a6e3a1"
    },
    {
        name: "Jellyfin",
        description: "Media server",
        url: "http://10.10.10.108:8096",
        icon: "fas fa-play-circle",
        color: "#a6e3a1"
    },
    {
        name: "Lidarr",
        description: "Music manager",
        url: "http://10.10.10.112:8686",
        icon: "fas fa-music",
        color: "#f38ba8"
    },
    {
        name: "NGINX Proxy Manager",
        description: "Reverse proxy",
        url: "http://10.10.10.110:81",
        icon: "fas fa-network-wired",
        color: "#89b4fa"
    },
    {
        name: "PiHole",
        description: "DNS and adblocking",
        url: "http://192.168.1.2/admin/",
        icon: "fab fa-raspberry-pi",
        color: "#94e2d5"
    },
    {
        name: "Proxmox Backup Server (PBS)",
        description: "Backup server",
        url: "https://10.10.10.115:8007",
        icon: "fas fa-database",
        color: "#89b4fa"
    },
    {
        name: "Proxmox VE",
        description: "Virtualization platform",
        url: "http://192.168.1.5:8006",
        icon: "fas fa-cube",
        color: "#89b4fa"
    },
    {
        name: "qBittorrent",
        description: "Torrent client",
        url: "http://10.10.10.111:8090/",
        icon: "fas fa-cloud-download-alt",
        color: "#cba6f7"
    },
    {
        name: "Radarr",
        description: "Movie manager",
        url: "http://10.10.10.105:7878",
        icon: "fas fa-film",
        color: "#f38ba8"
    },
    {
        name: "RomM",
        description: "Games ROM manager",
        url: "http://10.10.10.118",
        icon: "fas fa-gamepad",
        color: "#a6e3a1"
    },
    {
        name: "Router",
        description: "Network gateway",
        url: "http://192.168.1.1",
        icon: "fas fa-wifi",
        color: "#94e2d5"
    },
    {
        name: "SABnzbd",
        description: "Usenet downloader",
        url: "http://10.10.10.104:7777",
        icon: "fas fa-download",
        color: "#cba6f7"
    },
    {
        name: "SLZB-06",
        description: "Zigbee coordinator",
        url: "http://192.168.1.15",
        icon: "fas fa-broadcast-tower",
        color: "#94e2d5"
    },
    {
        name: "Sonarr",
        description: "TV show manager",
        url: "http://10.10.10.106:8989",
        icon: "fas fa-tv",
        color: "#f38ba8"
    },
    {
        name: "Tidarr",
        description: "Tidal music downloader",
        url: "http://10.10.10.103:8484/",
        icon: "fas fa-music",
        color: "#f38ba8"
    },
    {
        name: "UniFi Controller",
        description: "Network management",
        url: "http://192.168.1.11",
        icon: "fas fa-cloud",
        color: "#94e2d5"
    },
    {
        name: "WGDashboard",
        description: "WireGuard VPN",
        url: "http://10.10.10.102:10086",
        icon: "fas fa-shield-alt",
        color: "#94e2d5"
    },
    // {
    //     name: "Zabbix",
    //     description: "Monitoring & alerting",
    //     url: "http://192.168.1.23/zabbix",
    //     icon: "fas fa-heartbeat",
    //     color: "#f38ba8"
    // }
];

function createServiceCard(service) {
    const card = document.createElement('a');
    card.href = service.url;
    card.className = 'service-card';
    card.dataset.name = service.name.toLowerCase();
    card.dataset.description = service.description.toLowerCase();

    const icon = document.createElement('div');
    icon.className = 'service-icon';
    icon.innerHTML = `<i class="${service.icon}" style="color: ${service.color}"></i>`;

    const info = document.createElement('div');
    info.className = 'service-info';

    const name = document.createElement('div');
    name.className = 'service-name';
    name.textContent = service.name;

    const description = document.createElement('div');
    description.className = 'service-description';
    description.textContent = service.description;

    info.appendChild(name);
    info.appendChild(description);
    card.appendChild(icon);
    card.appendChild(info);

    return card;
}

function renderServices() {
    const grid = document.getElementById('servicesGrid');
    services.forEach(service => {
        grid.appendChild(createServiceCard(service));
    });
}

function filterServices(searchTerm) {
    const cards = document.querySelectorAll('.service-card');
    const term = searchTerm.toLowerCase().trim();
    let visibleCount = 0;

    cards.forEach(card => {
        const name = card.dataset.name;
        const description = card.dataset.description;
        const matches = name.includes(term) || description.includes(term);

        if (matches) {
            card.classList.remove('hidden');
            visibleCount++;
        } else {
            card.classList.add('hidden');
        }
    });

    const existingNoResults = document.querySelector('.no-results');
    if (existingNoResults) {
        existingNoResults.remove();
    }

    if (visibleCount === 0 && term !== '') {
        const noResults = document.createElement('div');
        noResults.className = 'no-results';
        noResults.textContent = 'No services found';
        document.getElementById('servicesGrid').appendChild(noResults);
    }
}

function initSearch() {
    const searchInput = document.getElementById('searchInput');
    searchInput.addEventListener('input', (e) => {
        filterServices(e.target.value);
    });

    searchInput.addEventListener('keydown', (e) => {
        if (e.key === 'Escape') {
            searchInput.value = '';
            filterServices('');
            searchInput.blur();
        } else if (e.key === 'Enter') {
            const visibleCards = document.querySelectorAll('.service-card:not(.hidden)');
            if (visibleCards.length > 0) {
                window.location.href = visibleCards[0].href;
            }
        }
    });

    document.addEventListener('keydown', (e) => {
        if (e.key === '/' && document.activeElement !== searchInput) {
            e.preventDefault();
            searchInput.focus();
        }
    });
}

function init() {
    renderServices();
    initSearch();
}

document.addEventListener('DOMContentLoaded', init);
