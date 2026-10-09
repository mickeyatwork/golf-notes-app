# ⛳ Golf Notes

A mobile-first **Progressive Web App (PWA)** built for golfers to log scores, track club yardages shot-by-shot, analyze swing performance, and manage custom club cues on and off the course.

---

## 🌟 Key Features

### 🏌️‍♂️ Live Round & Shot Tracking
- **Hole-by-Hole GPS & Yardages**: Clean scorecard interface showing distance to center, par, and hole handicap index.
- **Shot-by-Shot Logger**: Record each club selection and distance on the fly.
- **Shot History & Correction**: Edit or remove recorded shots in real-time.
- **Multi-Player Support**: Track scores for yourself and up to 3 guest players simultaneously.
- **Pause & Resume**: Automatically preserves in-progress rounds with a prominent banner on the dashboard.

### 🎒 "My Bag" & Swing Cues
- **Custom Club Setup**: Configure your personal clubs with stock carry yardages.
- **Stance & Swing Notes**: Store quick reminders (e.g., ball position, tempo, setup cues) accessible directly from your bag or during play.
- **Club Management**: Add, update, or remove clubs anytime from the Settings screen.

### 📊 Performance Analysis & Insights
- **Actual vs. Stock Carry**: Compares your real-world shot averages against your configured club carry distances.
- **Shot Breakdown**: Review every shot by club, distance, and hole.
- **Scorecard Review & Editing**: Edit round dates, course names, and overall scores, or delete outdated rounds.

### 📍 Course Directory
- **Searchable Courses**: Search local golf clubs with distance and location info.
- **Facility Badges**: Quick filtering by amenities such as Buggy Hire (🛒) and Driving Range (🎯).

### 🔐 User Profiles & Authentication
- **Supabase Authentication**: Secure email/password login, registration, and password recovery workflows.
- **Player Profiles**: Custom profile fields including first name, last name, username, and official handicap index.
- **Guest Mode**: Explore all core app features immediately without needing an active account.

### 📱 Offline-First & PWA
- **Progressive Web App (PWA)**: Installable to your mobile home screen via `vite-plugin-pwa`.
- **Local Persistence**: Round progress and bag details persist offline via `localStorage` and sync hooks.

---

## 🛠️ Tech Stack

- **Framework**: [React 19](https://react.dev/) + [Vite 8](https://vitejs.dev/)
- **Routing**: [React Router DOM 7](https://reactrouter.com/)
- **Styling**: [Tailwind CSS 3](https://tailwindcss.com/) with PostCSS & Autoprefixer
- **Backend & Auth**: [Supabase](https://supabase.com/) (`@supabase/supabase-js`)
- **PWA Integration**: [vite-plugin-pwa](https://vite-pwa-org.netlify.app/)
- **Linter**: [Oxlint](https://oxc.rs/)

---

## 📁 Project Structure

```text
golf-notes-app/
├── public/                 # Favicons, icons, and static assets
├── src/
│   ├── assets/             # Static UI media & logos
│   ├── components/         # Shared components (e.g., Icons)
│   ├── data/               # Default mock courses, users, and bag fixtures
│   ├── hooks/              # Custom hooks (e.g. useOfflineScore)
│   ├── lib/                # db client initialization (Supabase)
│   ├── services/           # External API & persistence (courseService.js)
│   ├── utils/              # Geodesic math & GPS helpers (geo.js)
│   ├── views/              # Main app views:
│   │   ├── ActiveHole.jsx  # Live scoring, GPS green distance & 2-tap shot tracking
│   │   ├── Analysis.jsx    # Round recap, hole breakdown & single-round insights
│   │   ├── AnalyticsDashboard.jsx # Global gameplay stats, par leaks & bag averages
│   │   ├── AuthView.jsx    # Sign in, registration, and password recovery
│   │   ├── Dashboard.jsx   # Welcome screen, active round alert, past rounds
│   │   ├── SettingsView.jsx# Bag editor, user profile, password & email changes
│   │   └── StartRound.jsx  # My Courses vs Discover, GPS nearby search & custom courses
│   ├── App.css             # Supplementary styling
│   ├── App.jsx             # Main router state, auth listener, global state
│   ├── index.css           # Tailwind base directives
│   └── main.jsx            # Application entry point
├── tailwind.config.js      # Tailwind CSS configuration
├── vite.config.js          # Vite config with PWA setup
├── package.json            # Scripts and dependencies
```

---

## 📱 Running as a PWA

Golf Notes is pre-configured with service worker registration via `vite-plugin-pwa`. When deployed over HTTPS:
1. Open the web app on your mobile browser (Safari on iOS or Chrome on Android).
2. Tap **Share** or browser options.
3. Select **"Add to Home Screen"** to launch Golf Notes with an app-like fullscreen experience and offline readiness.



