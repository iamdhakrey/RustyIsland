# RustyIsland - Rust-Based Dynamic Island

A macOS Dynamic Island-inspired system monitor built with Rust (Tauri) and React. This application creates a floating, always-on-top widget that displays real-time system information in an elegant, iPhone 14 Pro-inspired interface.

## Features

🔋 **System Monitoring**
- Real-time CPU usage monitoring
- Memory usage tracking with visual indicators
- Active process monitoring (top CPU consumers)
- Live clock display

🎨 **Dynamic Interface**
- **Compact Mode**: Minimal pill-shaped display showing time and basic system stats
- **Expanded Mode**: Detailed view with CPU/memory bars and process list
- Smooth animations and transitions
- Glass morphism design with backdrop blur
- Light/dark mode support

🖥️ **System Integration**
- Always stays on top of other windows
- Transparent background for seamless desktop integration
- Positioned at the top center of the screen (like iPhone Dynamic Island)
- Click to expand/collapse interface
- Hover effects for interactive feedback

## Technology Stack

- **Backend**: Rust with Tauri framework
- **Frontend**: React with TypeScript
- **Styling**: CSS with modern effects (backdrop-filter, glass morphism)
- **System Info**: `sysinfo` crate for cross-platform system monitoring
- **Build Tool**: Bun for fast JavaScript bundling

## Getting Started

### Prerequisites

- Rust (latest stable version)
- Bun or Node.js
- Operating System: Linux, macOS, or Windows

### Installation

1. Clone the repository:
   ```bash
   git clone https://github.com/iamdhakrey/rustyisland.git
   cd rustyisland
   ```

2. Install dependencies:
   ```bash
   bun install
   ```

3. Run in development mode:
   ```bash
   bun run tauri dev
   ```

4. Build for production:
   ```bash
   bun run tauri build
   ```

## Usage

1. **Launch the application** - The dynamic island will appear at the top center of your screen
2. **Compact Mode** - View time and basic system stats at a glance
3. **Click to Expand** - Get detailed system information including:
   - CPU usage with animated progress bar
   - Memory usage visualization
   - Top active processes by CPU usage
4. **Click again or press the X** to return to compact mode

## Project Structure

```
rustyisland/
├── src/                    # React frontend
│   ├── DynamicIsland.tsx   # Main dynamic island component
│   ├── DynamicIsland.css   # Styling for the island
│   ├── App.tsx             # Root application component
│   └── App.css             # Global application styles
├── src-tauri/              # Rust backend
│   ├── src/
│   │   └── lib.rs          # Main Tauri application logic
│   ├── Cargo.toml          # Rust dependencies
│   └── tauri.conf.json     # Tauri configuration
└── package.json            # JavaScript dependencies
```

## Platform Support

- **Linux**: Full support with X11/Wayland
- **macOS**: Full support (similar to native Dynamic Island)
- **Windows**: Full support

## Contributing

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add some amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

## License

This project is open source and available under the [MIT License](LICENSE).

## Acknowledgments

- Inspired by Apple's Dynamic Island on iPhone 14 Pro
- Built with the amazing Tauri framework
- Uses the sysinfo crate for cross-platform system monitoring
