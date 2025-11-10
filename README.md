# Server Services Landing Page

A responsive landing page for quick access to server services with Catppuccin Mocha theme.

## Features

- Responsive card grid layout (adapts to mobile)
- Real-time search filtering
- Catppuccin Mocha color scheme
- Font Awesome icons
- Smooth animations and transitions
- Keyboard navigation support

## Usage

Open `index.html` in a web browser.

## Adding/Editing Services

Edit the `services` array in `script.js`:

```javascript
{
    name: "Service Name",
    description: "Brief description",
    url: "http://localhost:port",
    icon: "fas fa-icon-name",
    color: "#hexcolor"
}
```

### Icon Reference

Find icons at: https://fontawesome.com/search?o=r&m=free

Common service icons:
- Docker: `fab fa-docker`
- Server: `fas fa-server`
- Database: `fas fa-database`
- Cloud: `fas fa-cloud`
- Network: `fas fa-network-wired`
- Chart: `fas fa-chart-line`

### Color Palette

Catppuccin Mocha colors available in CSS variables:
- Blue: `#89b4fa`
- Mauve: `#cba6f7`
- Green: `#a6e3a1`
- Peach: `#fab387`
- Red: `#f38ba8`
- Yellow: `#f9e2af`
- Teal: `#94e2d5`
- Sky: `#89dceb`

## Keyboard Shortcuts

- `/` or click search: Focus search
- `Escape`: Clear search and unfocus

## Browser Support

Modern browsers with CSS Grid support (Chrome, Firefox, Safari, Edge).
