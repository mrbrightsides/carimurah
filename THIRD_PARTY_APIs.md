# 🌐 Third Party APIs & Keys Integration Setup

CariMurah.ai is engineered with a secure, production-grade architecture that proxies all sensitive cognitive workloads to prevent API key exposure in client browsers. 

This document details the configuration for all external identity, storage, and AI providers.

---

## 🔒 Security Architecture Model
```
┌──────────────────────────────────────┐
│  Client View (React App in WebView)  │
└──────────────────┬───────────────────┘
                   │ HTTPS Proxy Request (with Firebase JWT Token)
                   ▼
┌──────────────────────────────────────┐
│       Node.js Express Backend        │
│       (Resolves Env Variables)       │
└──────────────────┬───────────────────┘
         ┌─────────┴─────────┐
         ▼                   ▼
┌─────────────────┐ ┌──────────────────┐
│ Google Gemini  │ │  MongoDB Atlas   │
│ AI Processing   │ │ Persistent Cloud │
└─────────────────┘ └──────────────────┘
```

---

## 🔑 1. Google Gemini AI API

We use the modern `@google/genai` TypeScript SDK on our Node.js gateway server. It provides OCR vision reading, Indonesia market price synthesis, and professional RFQ formulation.

*   **Vendor**: Google AI Studio / Google Cloud Platform
*   **API Variable**: `GEMINI_API_KEY` (MUST be kept strictly server-side in `.env`)
*   **SDK Usage Reference**:
    ```typescript
    import { GoogleGenAI } from "@google/genai";

    let aiClient: GoogleGenAI | null = null;

    export function getGeminiClient(): GoogleGenAI {
      if (!aiClient) {
        const key = process.env.GEMINI_API_KEY;
        if (!key) {
          throw new Error("Missing GEMINI_API_KEY environment variable.");
        }
        aiClient = new GoogleGenAI({ apiKey: key });
      }
      return aiClient;
    }
    ```
*   **Documentation link**: [https://ai.google.dev/gemini-api/docs](https://ai.google.dev/gemini-api/docs)

---

## 🗄️ 2. MongoDB Atlas Cloud Database

We store persistent analytical scans, history profiles, customer preferences, and RFQ logs.

*   **Vendor**: MongoDB Inc. (Atlas Dedicated/Shared Instance)
*   **Variable**: `MONGODB_URI`
*   **Security Configuration**: Ensure your Atlas cluster has **0.0.0.0/0** whitelist permissions enabled or restrict it to static Cloud Container ingress IPs on production servers.

---

## 🛡️ 3. Firebase Authentication IP

Handles modern social single-sign-on (Google Sign-In) and basic credential validation.

*   **Vendor**: Google Firebase
*   **Local Configuration**: Stored inside `firebase-applet-config.json` at root.
*   **Features**: Bridges Firestore/Firebase rule access with local React standard hooks.
*   **Local Storage Fallback**: If internet permissions or auth blocks are encountered, the app operates anonymously and persists details to `localStorage` safely.

---

## ⚡ 4. Google Cloud Agent Builder
We use the official Google Cloud Agent Builder client SDKs for real-time datastore searches and conversational flow management during purchase cycles:

*   **Discovery Engine Search Client**: `@google-cloud/discoveryengine` (`SearchServiceClient`). Used to index and query retail catalogs.
*   **Dialogflow CX Client**: `@google-cloud/dialogflow-cx` (`SessionsClient`). Used to parse and structure negotiation dialogue flows.
*   **Environmental Variables**:
    *   `GCP_PROJECT_ID`: Google Cloud Project ID.
    *   `GCP_DATASTORE_ID`: Target Merchant/Product data store.
    *   `GCP_LOCATION`: "global" or regional coordinates (e.g., "us-central1").
    *   `GCP_AGENT_ID`: Dialogflow CX playbooks identifier.

---

## 🎙️ 5. Native Device & Bowser SDK Web APIs (No Keys Required)

The following local native resources are utilized directly via standard client frameworks:

*   **Web Speech API** (`window.SpeechRecognition` / `window.webkitSpeechRecognition`): For processing real-time Indonesian vocal commands and translating physical shopping items to text blocks.
*   **WhatsApp Web URI Router**: Custom localized links formulated dynamically to bridge direct communication to wholesalers or dealers with tailored copy. (e.g., `https://api.whatsapp.com/send?phone=...&text=...`).
*   **Web Share API**: Native sheet calling when sharing RFQ logs or price reports with team directors.
