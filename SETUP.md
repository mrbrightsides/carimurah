# 🛠️ CariMurah.ai Setup & Capacitor Mobile Deployment Guide

This guide describes how to run and configure both the development backend-frontend suite and build a certified production-ready Android App (.aab/.apk) using **Capacitor**.

---

## 💻 1. Local Development Setup (Quickstart)

### Prerequisites
*   **Node.js**: v18 or v20 (LTS recommended)
*   **NPM**: v9+ (comes with Node)

### Step-by-Step Installation
1.  **Clone the Repository**:
    ```bash
    git clone https://github.com/mrbrightsides/carimurah.git
    cd carimurah
    ```

2.  **Install Base Dependencies**:
    ```bash
    npm install
    ```

3.  **Environment Variables Configuration**:
    Create a `.env` file at the root base based on the `.env.example`:
    ```env
    PORT=3000
    NODE_ENV=development
    GEMINI_API_KEY=your_gemini_api_key_here
    MONGODB_URI=your_mongodb_connection_string_here
    ```

4.  **Launch Dev Server**:
    We use a unified server setup where the Node server handles API routes and proxies client bundles:
    ```bash
    npm run dev
    ```
    Open your browser at [http://localhost:3000](http://localhost:3000) to see the app.

---

## 📱 2. Capacitor Android App Guide (For Play Store .aab Release)

Capacitor bridges the React web build with native mobile code. Follow this workflow to build your mobile bundle safely.

### Step 1: Perform client-side build
Capacitor requires a static `dist` directory. Running `npx cap sync` on an empty directory will fail. Always build the app first:
```bash
# Build the production React bundle
npm run build
```
This command outputs static assets to `dist/`, compiling the frontend bundle.

### Step 2: Initialize & Sync platforms
Ensure Capacitor dependencies are installed on your system:
```bash
# Install Android platform runtime
npm install @capacitor/android

# Add native Android configuration foldering
npx cap add android

# Sync newly built files into the native folder structure
npx cap sync
```

---

## ⚠️ 3. Common Troubleshooting & Gradle Fixes

During physical local exports or Gradle imports, developers sometimes face Android Gradle Plugin (AGP) mismatches or offline connection lags.

### Issue A: Android Gradle Plugin (AGP) Version Incompatibility
**Error Message**: `The project is using an incompatible version (AGP 8.13.0) of the Android Gradle plugin. Latest supported version is AGP 8.11.1`

#### 💡 Solution
1. Open the project root or the build files inside **Android Studio**.
2. Open `android/build.gradle` (the top-level Gradle build configuration).
3. Find the `buildscript` dependency block and align the classpath package to matched constraints, for example:
   ```groovy
   buildscript {
       dependencies {
           classpath 'com.android.tools.build:gradle:8.11.1' // <- Set to stable certified version
           classpath 'com.google.gms:google-services:4.4.1'
       }
   }
   ```
4. Re-run standard Sync in Android Studio toolbar on target modification.

### Issue B: Internet Downtime/Timeout Errors in Gradle
**Error Message**: `Unknown host 'No such host is known (dl.google.com)'. You may need to adjust the proxy settings in Gradle.`

#### 💡 Solution
If you experience a momentary internet drop or proxy conflict:
1. Open Android Studio Settings/Preferences.
2. Search for **"Gradle"** -> **"Offline Mode"**.
3. Toggle the **Enable Offline Mode** checkbox to resolve background build dependencies from cache.
4. Ensure your local wifi/router is stable and turn off heavy corporate VPNs.

---

## 🔑 4. Generating Signed Key Store (Keystore) for Play Console

Google Play requires all `.aab` bundles to be signed with a digital private key.

### Filling the "New Key Store" Dialog in Android Studio
When inside Android Studio click on **Build** -> **Generate Signed Bundle / APK...** -> Choose **Android App Bundle** -> click **Create New** under keystore path.

#### 📝 Guidelines for the Fields:
1.  **Key store path**: Click the folder icon at the right. Choose a permanent directory on your local machine and set the file name (e.g., `carimurah-release-key.jks`). **Keep this file backed up securely!** If lost, you cannot update your Play Store app!
2.  **Keystore Password**: Create a strong, distinct password. Write it down.
3.  **Key Alias**: Keep the default `key0` or change it to `carimurah_alias`.
4.  **Key Password**: Create another strong password (or use the same keystore password, though separate is safer).
5.  **Validity (years)**: Use the default **25** years to make sure the certificate stays active through long product cycles.
6.  **Certificate Details**:
    *   **First and Last Name**: Your name or your organization representative.
    *   **Organizational Unit**: E.g., `Mobile Division`.
    *   **Organization**: E.g., `PT CariMurah Digital`.
    *   **City or Locality**: E.g., `Palembang`.
    *   **State or Province**: E.g., `Sumatera Selatan`.
    *   **Country Code**: `ID` (for Indonesia).

Click **OK**, choose the **release** active build variant, check **V4 (resin-signing)** if applicable, and click **Finish** to build your signed mobile bundle!
