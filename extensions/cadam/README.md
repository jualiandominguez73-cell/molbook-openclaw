# CADAM Plugin for OpenClaw

Text-to-CAD generation plugin using OpenSCAD. Generate 3D printable models from natural language descriptions.

> **Note**: This plugin is adapted from [CADAM](https://github.com/Adam-CAD/CADAM) by Adam-CAD, reimplemented as an OpenClaw plugin.

## Features

- 🎨 **AI-Powered Generation**: Create 3D CAD models from text descriptions
- 🔧 **Parametric Models**: All generated models include adjustable parameters
- 📦 **Multiple Export Formats**: Export to STL, 3MF, or SCAD formats
- ⚡ **Parameter Modification**: Quickly adjust dimensions without regeneration
- 🖥️ **OpenSCAD Integration**: Uses OpenSCAD CLI for rendering (optional)

## Installation

### Prerequisites

1. **Node.js** ≥22 (required by OpenClaw)
2. **OpenSCAD** (optional, for STL/3MF export)
   - macOS: `brew install openscad`
   - Ubuntu/Debian: `sudo apt install openscad`
   - Windows: Download from [openscad.org](https://openscad.org/)

### Install Plugin

The plugin is bundled with OpenClaw in the `extensions/cadam/` directory. To enable it:

```bash
# Enable the plugin
openclaw plugins enable cadam

# Restart the gateway
openclaw gateway restart
```

## Configuration

Add to your `~/.openclaw/openclaw.json`:

```json5
{
  plugins: {
    entries: {
      cadam: {
        enabled: true,
        config: {
          outputDir: "~/.openclaw/cadam-models",
          renderer: "cli",
          openscadPath: "/usr/bin/openscad",
          defaultExportFormat: "stl",
          maxCodeTokens: 16000,
          cacheModels: true
        }
      }
    }
  }
}
```

## Usage

Simply ask OpenClaw to create 3D models:

- "Create a coffee mug with a handle"
- "Generate a parametric gear with 20 teeth"
- "Make a phone stand with adjustable angle"

## Tools

- `cad_generate` - Generate new CAD models
- `cad_modify` - Modify existing model parameters
- `cad_export` - Export models to different formats

## Troubleshooting

### OpenSCAD Not Found

If you get "OpenSCAD not available" warnings:

```bash
# macOS
brew install openscad

# Ubuntu/Debian
sudo apt install openscad

# Or disable rendering
# Set renderer: "none" in config
```

### Model Generation Fails

- Ensure you have a valid Anthropic API key configured
- Check `maxCodeTokens` is sufficient (default: 16000)
- Review logs: `openclaw logs`

## Credits

This plugin adapts the text-to-CAD generation approach from [CADAM](https://github.com/Adam-CAD/CADAM) by Adam-CAD.

## License

MIT License - See LICENSE file for details
