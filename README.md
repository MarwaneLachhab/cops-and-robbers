# 🚔 Cops & Robbers 💰

A fast-paced 2-player local multiplayer game built with React and HTML5 Canvas. One player is the **Criminal** trying to collect coins and escape, while the other is the **Cop** trying to catch them!

![Game Preview](https://img.shields.io/badge/Made%20with-React-61DAFB?style=for-the-badge&logo=react)
![Vite](https://img.shields.io/badge/Built%20with-Vite-646CFF?style=for-the-badge&logo=vite)
![License](https://img.shields.io/badge/License-MIT-green?style=for-the-badge)

---

## 🎮 Gameplay

### Objective
- **Criminal (🔴)**: Collect all coins and reach the EXIT zone before time runs out!
- **Cop (🔵)**: Catch the criminal before they escape!

### Controls

| Player | Movement | Description |
|--------|----------|-------------|
| 🔴 Criminal | `Z` `Q` `S` `D` | Z=Up, S=Down, Q=Left, D=Right |
| 🔵 Cop | `↑` `←` `↓` `→` | Arrow keys |
| Both | `ESC` | Pause/Resume game |
| Both | `H` | Toggle items legend |

---

## ✨ Features

### 🗺️ Multiple Maps
| Map | Difficulty | Time Limit | Description |
|-----|------------|------------|-------------|
| Training Ground | ⭐ | 90s | Small map, perfect for beginners |
| City Streets | ⭐⭐ | 120s | Medium complexity with more obstacles |
| Maximum Security | ⭐⭐⭐ | 150s | Complex maze, experts only! |

### ⚡ Power-ups

#### 🔴 Criminal Power-ups (⬡ Hexagon shape)
| Icon | Name | Duration | Effect |
|------|------|----------|--------|
| ⚡ | Speed Boost | 5s | +60% movement speed |
| 👻 | Invisibility | 3s | Become invisible to the cop |
| ❄️ | Freeze | 2s | Freeze the cop in place |

#### 🔵 Cop Power-ups (◇ Diamond shape)
| Icon | Name | Duration | Effect |
|------|------|----------|--------|
| ⚡ | Taser Mode | 3s | Can catch invisible criminals |
| 🏃 | Speed Boost | 4s | +50% movement speed |

### 🌀 Teleporters
Step on a teleporter to instantly travel to its linked destination! Great for quick escapes or cutting off the criminal.

### 🔊 Sound Effects
- 💰 Coin collection chimes
- ⚡ Power-up activation sounds
- 🌀 Teleport whoosh
- ❄️ Freeze ice crystal sound
- 🏆 Victory fanfare
- ⏱️ Timer warning ticks (last 10 seconds)

### 🎨 Visual Effects
- ✨ Particle effects on coin/power-up collection
- 🌀 Teleporter burst animations
- ❄️ Frozen cop indicator overlay
- ⚠️ Low time warning animation
- 🎉 Winner-specific victory screens

---

## 🚀 Quick Start

### Prerequisites
- [Node.js](https://nodejs.org/) (v18 or higher recommended)
- npm or yarn

### Installation

```bash
# Clone the repository
git clone https://github.com/MarwaneLachhab/cops-and-robbers.git

# Navigate to the project
cd cops-and-robbers

# Install dependencies
npm install

# Start the development server
npm run dev
```

Then open **http://localhost:5173** in your browser!

### Build for Production

```bash
npm run build
```

The built files will be in the `dist/` folder, ready to deploy.

---

## 🎯 How to Win

### 🔴 As Criminal:
1. **Collect ALL coins** on the map 💰
2. **Reach the EXIT zone** (turns green when unlocked) 🚪
3. **Avoid the cop!** Use power-ups strategically
4. **Use teleporters** to escape tight situations

### 🔵 As Cop:
1. **Chase and catch** the criminal by touching them 🏃
2. **Collect cop power-ups** to gain advantages
3. **Use teleporters** to cut off escape routes
4. **Wait out the timer** if the criminal can't collect all coins ⏱️

---

## 🛠️ Tech Stack

| Technology | Purpose |
|------------|---------|
| **React 18** | UI Framework & Component Architecture |
| **Vite** | Lightning-fast build tool & dev server |
| **HTML5 Canvas** | 2D game rendering |
| **Web Audio API** | Dynamic sound effects |
| **CSS3** | Styling, animations & effects |

---

## 📁 Project Structure

```
cops-and-robbers/
├── 📂 public/
│   └── vite.svg
├── 📂 src/
│   ├── 📂 assets/
│   │   └── react.svg
│   ├── App.jsx          # Main app component
│   ├── App.css          # App styles
│   ├── Game.jsx         # 🎮 Game logic & Canvas rendering
│   ├── Game.css         # Game UI styles
│   ├── main.jsx         # React entry point
│   └── index.css        # Global styles
├── index.html           # HTML template
├── package.json         # Dependencies & scripts
├── vite.config.js       # Vite configuration
├── eslint.config.js     # ESLint rules
└── README.md            # You are here!
```

---

## 🎮 Pro Tips

### For Criminals 🔴
- 💡 Save **Invisibility** for when the cop is close
- 💡 Use **Freeze** to create distance when cornered
- 💡 Learn teleporter locations for quick escapes
- 💡 Prioritize coins near the exit last

### For Cops 🔵
- 💡 Grab the **Taser** power-up to counter invisibility
- 💡 Predict where the criminal is heading
- 💡 Use teleporters to cut off escape routes
- 💡 If time is running out, play defensively near the exit

---

## 🖼️ Screenshots

### Map Selection
Choose from 3 difficulty levels, each with unique layouts and challenges!

### In-Game
- Real-time coin counter and timer
- Active power-up indicators
- Items legend panel (press H)
- Pause menu with restart/menu options

### Victory Screen
- Different colors for cop/criminal wins
- Final stats display (coins collected, time taken)

---

## 🤝 Contributing

Contributions are welcome! Here's how:

1. **Fork** the repository
2. **Create** a feature branch
   ```bash
   git checkout -b feature/amazing-feature
   ```
3. **Commit** your changes
   ```bash
   git commit -m 'Add amazing feature'
   ```
4. **Push** to the branch
   ```bash
   git push origin feature/amazing-feature
   ```
5. **Open** a Pull Request

### Ideas for Contributions
- 🗺️ New maps
- ⚡ New power-ups
- 🎨 Visual improvements
- 🔊 More sound effects
- 📱 Mobile touch controls
- 🌐 Online multiplayer

---

## 📄 License

This project is open source and available under the [MIT License](LICENSE).

---

## 👨‍💻 Author

**MarwaneLachhab**

[![GitHub](https://img.shields.io/badge/GitHub-MarwaneLachhab-181717?style=for-the-badge&logo=github)](https://github.com/MarwaneLachhab)

---

<div align="center">

### Made with ❤️ and React

**⭐ Star this repo if you enjoyed the game! ⭐**

[🎮 Play Now](https://github.com/MarwaneLachhab/cops-and-robbers) • [🐛 Report Bug](https://github.com/MarwaneLachhab/cops-and-robbers/issues) • [💡 Request Feature](https://github.com/MarwaneLachhab/cops-and-robbers/issues)

</div>
