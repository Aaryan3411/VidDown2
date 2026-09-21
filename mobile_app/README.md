# VidDown Mobile - Android Video & Audio Downloader

This is the native Android mobile app codebase for **VidDown**. It runs directly on your Android phone, bypassing browser security walls (CORS) to extract streams and save MP4 videos and audio files directly to your phone's storage.

---

## How to Get the APK File on Your Phone

You do **not** need to install Flutter or Android Studio on your PC. An automated **GitHub Actions Workflow** (`.github/workflows/build-apk.yml`) is already set up in this repository.

### Step 1: Push This Code to Your GitHub Repository
Ensure your repository on GitHub contains this code.

### Step 2: Build the APK using GitHub Actions (Cloud Builder)
1. Go to your GitHub repository in your browser: `https://github.com/aaryan3411/VidDown`
2. Click on the **Actions** tab at the top.
3. In the left sidebar, click **Build Android APK**.
4. Click the **Run workflow** dropdown on the right side and select **Run workflow**.

GitHub's cloud servers (Ubuntu with Java & Flutter pre-installed) will build your APK for free in ~2–3 minutes.

### Step 3: Download the APK
1. When the workflow finishes with a green checkmark, click on the workflow run.
2. Scroll down to the **Artifacts** section at the bottom of the page.
3. Click on **viddown-mobile-release-apk** to download the zip file.
4. Extract the `.apk` file and transfer it to your phone (or download it directly from your phone's browser).

---

## Features Built in the Mobile App
- **Universal In-App Browser Video Sniffer:** Browse any website (Google, video streaming sites, direct web players). The app intercepts media network requests and DOM `<video>` tags in real-time.
- **Floating Download Button:** As soon as a video or stream is detected playing on the webpage, a floating **Download** button appears right on the screen.
- **Native YouTube Stream Extraction:** Dedicated high-speed parser using `youtube_explode_dart` on YouTube links.
- **Multiple Formats:** Supports `.mp4`, `.webm`, `.mov`, `.m3u8`, and `.mp3` audio.
- **Direct Save to Phone Downloads:** Files are written directly to `/storage/emulated/0/Download` on your phone so they appear in your Gallery and Files app.
- **Background Multi-threaded Downloads:** Uses Dio segmented downloads with real-time percentage progress indicators.
