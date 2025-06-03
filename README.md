# Korean Omnisearch

An advanced Korean search engine for Obsidian with **초성** (initial consonant), **중성** (medial vowel), and **종성** (final consonant) search capabilities, plus powerful content indexing and fuzzy matching.

## ✨ Key Features

### 🔍 **Advanced Korean Search**
- **초성 검색**: `ㅎㄱ` → finds "한글", "항공", "학교", etc.
- **Partial syllables**: `한ㄱ` → finds "한국", "한글", etc.  
- **Mixed patterns**: `ㅎㄱㄹ교` → finds "한글학교", etc.
- **Content search**: Search inside file content, not just titles
- **Real-time indexing**: Automatically updates as you create/modify files

### 🚀 **Omnisearch Enhancement**
- **Enhanced Quick Switcher**: Replaces default search with Korean-aware version
- **Content indexing**: Search through all your note content
- **Smart scoring**: Relevance-based results with recency and size bonuses
- **Multiple search strategies**: Direct, decomposed, initial consonant, and partial syllable matching

### 🔗 **Smart Link Suggestions**
- `[[` typing triggers Korean-aware file suggestions
- Real-time 초성/중성/종성 search as you type
- Works seamlessly with existing English file names

### ⚙️ **Production Features**
- **Auto-indexing**: Real-time vault monitoring and updates
- **Configurable thresholds**: Adjust search sensitivity
- **Performance optimized**: Fast search even with large vaults
- **Professional UI**: Clean, modern interface

## 📦 Installation

### Method 1: BRAT Installation (Recommended)

1. Install and enable the [BRAT plugin](https://github.com/TfTHacker/obsidian42-brat)
2. In BRAT settings, click **"Add Beta plugin"**
3. Enter this GitHub URL:
   ```
   https://github.com/BrianJChoi/korean-omnisearch
   ```
4. Click **"Add Plugin"** to install
5. Go to Settings → Community Plugins and enable **"Korean Omnisearch"**

### Method 2: Manual Installation (Development)

1. Clone or download this repository:
```bash
git clone https://github.com/BrianJChoi/korean-omnisearch.git
```

2. Build the plugin:
```bash
cd korean-omnisearch
npm install
npm run build
```

3. Copy to your Obsidian plugins folder:
```
[Your Vault]/.obsidian/plugins/korean-omnisearch/
├── main.js
├── manifest.json
├── styles.css
└── data.json (auto-generated)
```

4. Enable the plugin:
   - Settings → Community Plugins → Enable **"Korean Omnisearch"**

## 🎯 Usage

### Korean Search
- **Cmd/Ctrl + Shift + O**: Open Korean Search
- **Command Palette**: "Open Korean Search"
- **With Examples**: "Korean Search with Examples" (shows pattern hints)

#### Search Patterns:
- `ㅁㅊ` → finds "미치", "맞춤", "마침", etc.
- `프로젝트` → finds "프로젝트 관리", "프로젝트 계획", etc.
- `ㅎㄱㄹ` → finds files starting with 한글-related terms
- `Mixed English + 한글` → works with both languages

#### Navigation:
- **↑↓**: Navigate results
- **Enter**: Open file
- **Ctrl+Enter**: Open in new tab  
- **Shift+Enter**: Open in new pane

### Link Autocompletion
1. Type `[[` in any note
2. Start typing Korean file names
3. Select from Korean-aware suggestions

### Commands Available
- **"Open Korean Search"**: Main search interface
- **"Korean Search with Examples"**: Shows search pattern examples
- **"Rebuild Korean Search Index"**: Manually rebuild search index
- **"Korean Search Guide"**: Display help and shortcuts

## ⚙️ Settings

Settings → Community Plugins → Korean Omnisearch

- **Fuzzy Threshold**: Adjust search accuracy (0: strict, 1: loose)
- **Enable Auto-indexing**: Real-time vault monitoring
- **Search Limit**: Maximum number of results to display

## 🛠 Development Setup

### Requirements
- Node.js 16+ 
- npm or yarn
- TypeScript knowledge

### Getting Started

1. Clone the repository:
```bash
git clone https://github.com/BrianJChoi/korean-omnisearch.git
cd korean-omnisearch
```

2. Install dependencies:
```bash
npm install
```

3. Development mode:
```bash
npm run dev
```

4. Build for production:
```bash
npm run build
```

### Project Structure
```
├── src/
│   ├── main.ts              # Main plugin entry
│   ├── hangulIndex.ts       # Korean search engine
│   ├── hangulSwitcher.ts    # Search UI component
│   ├── hangulLinkSuggest.ts # Link suggestions
│   ├── settings.ts          # Plugin settings
│   └── commands.ts          # Command definitions
├── main.ts                  # Plugin main file
├── manifest.json            # Plugin metadata
├── package.json             # Project configuration
├── tsconfig.json            # TypeScript config
├── esbuild.config.mjs       # Build configuration
├── styles.css               # Plugin styles
└── README.md               # This file
```

## 🔧 Technology Stack

- **TypeScript**: Type safety and modern JavaScript
- **Fuse.js**: Powerful fuzzy search engine  
- **hangul-js**: Korean character decomposition/composition
- **ESBuild**: Fast compilation and bundling
- **Obsidian API**: Native integration with Obsidian

## 📝 License

MIT License - Feel free to use, modify, and distribute.

## 🤝 Contributing

1. Fork this repository
2. Create your feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add some amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

## 🐛 Bug Reports & Feature Requests

Please report bugs and request features on the [Issues](https://github.com/BrianJChoi/korean-omnisearch/issues) page.

## 📊 Version History

### v0.2.0 (Current)
- **Omnisearch replacement**: Complete search engine overhaul
- **Content indexing**: Search through note content, not just titles
- **Enhanced Korean support**: Multiple search strategies for Korean text
- **Production polish**: Professional UI and error handling
- **Real-time indexing**: Auto-updates as vault changes
- **Smart scoring**: Relevance-based results with multiple factors

### v0.1.1
- **BRAT compatibility**: Fixed installation issues
- **Template restructure**: Standardized plugin architecture
- **Build improvements**: Switched from Rollup to ESBuild

### v0.1.0
- **Initial release**: Basic Korean fuzzy search
- **Quick Switcher**: Korean-aware file switching
- **Link suggestions**: Korean autocompletion support

---

**Created by**: [Brian Choi](https://github.com/BrianJChoi)  
**Contact**: [GitHub Issues](https://github.com/BrianJChoi/korean-omnisearch/issues)  
**Support**: [GitHub Sponsors](https://github.com/sponsors/BrianJChoi)