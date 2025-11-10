const services = [
    {
        name: "Bazarr",
        description: "Subtitle manager",
        url: "http://192.168.1.44:6767",
        icon: "fas fa-closed-captioning",
        color: "#cba6f7"
    },
    {
        name: "Door Cam",
        description: "HIKVision camera",
        url: "http://192.168.1.30",
        icon: "fas fa-camera",
        color: "#f38ba8"
    },
    {
        name: "Frigate",
        description: "NVR camera system",
        url: "http://192.168.1.36:5000",
        icon: "fas fa-video",
        color: "#94e2d5"
    },
    {
        name: "Home Assistant",
        description: "Home automation",
        url: "http://192.168.1.35:8123",
        icon: "fas fa-home",
        color: "#a6e3a1"
    },
    {
        name: "Jellyfin",
        description: "Media server",
        url: "http://192.168.1.45:8096",
        icon: "fas fa-play-circle",
        color: "#cba6f7"
    },
    {
        name: "Lidarr",
        description: "Music manager",
        url: "http://192.168.1.62:8686",
        icon: "fas fa-music",
        color: "#a6e3a1"
    },
    {
        name: "NetGear Switch",
        description: "Network switch",
        url: "http://192.168.1.10",
        icon: "fas fa-ethernet",
        color: "#89b4fa"
    },
    {
        name: "NGINX Proxy Manager",
        description: "Reverse proxy",
        url: "http://192.168.1.55:81",
        icon: "fas fa-network-wired",
        color: "#94e2d5"
    },
    {
        name: "Nvidia SHIELD",
        description: "Media player",
        url: "http://192.168.1.18",
        icon: "fas fa-tv",
        color: "#a6e3a1"
    },
    {
        name: "Proxmox VE",
        description: "Virtualization platform",
        url: "http://192.168.1.34:8006",
        icon: "fas fa-cube",
        color: "#fab387"
    },
    {
        name: "Radarr",
        description: "Movie manager",
        url: "http://192.168.1.42:7878",
        icon: "fas fa-film",
        color: "#f9e2af"
    },
    {
        name: "Router",
        description: "Network gateway",
        url: "http://192.168.1.1",
        icon: "fas fa-wifi",
        color: "#89dceb"
    },
    {
        name: "SABnzbd",
        description: "Usenet downloader",
        url: "http://192.168.1.40:7777",
        icon: "fas fa-download",
        color: "#89b4fa"
    },
    {
        name: "SLZB-06",
        description: "Zigbee coordinator",
        url: "http://192.168.1.24",
        icon: "fas fa-broadcast-tower",
        color: "#f9e2af"
    },
    {
        name: "Sonarr",
        description: "TV show manager",
        url: "http://192.168.1.43:8989",
        icon: "fas fa-tv",
        color: "#89b4fa"
    },
    {
        name: "UniFi Controller",
        description: "Network management",
        url: "http://192.168.1.11",
        icon: "fas fa-cloud",
        color: "#89dceb"
    },
    {
        name: "WGDashboard",
        description: "WireGuard VPN",
        url: "http://192.168.1.53:10086",
        icon: "fas fa-shield-alt",
        color: "#89dceb"
    },
    {
        name: "Zabbix",
        description: "Monitoring & alerting",
        url: "http://192.168.1.23/zabbix",
        icon: "fas fa-heartbeat",
        color: "#f38ba8"
    }
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
