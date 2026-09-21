# VidDown - Video & Audio Downloader (Web & Mobile)

A fast, versatile video inspection and downloader suite featuring a modern web application and an automated native Android APK builder.

---

## 🚀 Key Features

### 🌐 Web Application (`/src`, `/server.ts`)
- **Direct Video Stream Inspection:** Probe any video URL to view content type, exact file size, byte range support, and direct download links.
- **In-App Video Previewer:** HTML5 custom-styled video player with live stream proxy and seek support.
- **YouTube Support:** Fetches metadata, channel name, high-resolution thumbnail, and embed player.
- **Webpage Media Sniffer:** Discovers `<video>`, `<source>`, and OpenGraph video tags inside webpage HTML.
- **Batch Downloader:** Queue multiple video URLs for sequential or concurrent downloads.
- **Download History:** Client-side local storage persistence for downloaded media items.
- **Zero-CORS Fallback:** Works seamlessly both with full-stack Node.js stream proxying or direct browser downloads on static hosts.

### 📱 Native Android App (`/mobile_app`)
- **Built-in Mobile Sniffer:** In-app browser intercepts media network streams and DOM video elements while you browse.
- **Floating Download Button:** One-tap floating action button automatically appears when media is detected.
- **Phone Storage Integration:** Saves downloads directly to your device's `/Download` directory for instant access in your Gallery and Files app.
- **Automated Cloud Builds:** GitHub Actions workflow automatically compiles the release APK with zero local Flutter/Android setup needed.

---

## 🛠️ Project Structure

```
├── assets/                 # Pre-compiled static assets for GitHub Pages root hosting
│   ├── app.css
│   ├── app.js
│   └── app.svg
├── .github/workflows/
│   └── build-apk.yml       # Automated GitHub Actions workflow to build release APK
├── mobile_app/             # Flutter native Android app source
│   ├── lib/main.dart       # In-app browser sniffer & download manager
│   ├── pubspec.yaml
│   └── README.md           # Mobile app documentation
├── src/                    # React frontend application
│   ├── App.tsx             # Main application orchestrator
│   ├── components/         # Modular UI components
│   ├── types.ts            # TypeScript interfaces
│   └── utils.ts            # Stream detection & helpers
├── scripts/
│   └── sync-pages.js       # Syncs production build to root assets for GitHub Pages
├── server.ts               # Express backend with stream proxy & probe endpoints
├── vite.config.ts          # Vite build & asset configuration
└── package.json
```

---

## 📦 Building & Local Development

### 1. Install Dependencies
```bash
npm install
```

### 2. Development Mode
```bash
npm run dev
```
Open `http://localhost:3000` in your browser.

### 3. Production Build & Static Asset Sync
```bash
npm run build
```
This runs Vite compilation, regenerates the production bundle in `dist/`, synchronizes static assets into `/assets` for GitHub Pages, and bundles `server.ts` with `esbuild`.

---

## 📲 Building the Android APK (Free via GitHub)

1. Push this repository to GitHub.
2. Navigate to the **Actions** tab on your GitHub repository.
3. Select **Build Android APK** in the left sidebar.
4. Click **Run workflow**.
5. Once the build completes (~2 minutes), download the **viddown-mobile-release-apk** artifact or check the Releases section.

---

## 🚢 Pushing to GitHub

To push your renewed and built code to your GitHub repository:

```bash
git init
git add .
git commit -m "Renew all files and sync production assets"
git branch -M main
git remote add origin https://github.com/aaryan3411/VidDown.git
git push -u origin main --force
```
*(If your remote already exists, simply run `git add . && git commit -m "Update" && git push`)*
