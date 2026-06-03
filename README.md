# 🚀 CariMurah.ai: Smart Shopping & B2B Procurement Suite

CariMurah.ai is a high-sophistication, multi-agent AI engine designed to disrupt the e-commerce and wholesale landscape in Indonesia. From retail hunters (B2C Smart Savers) to enterprise procurement squads (B2B Procurement Pro), we turn raw visual, voice, and text data into autonomous profit engines.

[![Live App](https://img.shields.io/badge/Live-carimurah.elpeef.com-emerald.svg?style=flat-square)](https://carimurah.elpeef.com)
[![Google Play](https://img.shields.io/badge/Google_Play-Download-darkgreen.svg?style=flat-square&logo=google-play)](https://play.google.com/store/apps/details?id=com.carimurah.app)
[![Capacitor Native](https://img.shields.io/badge/Capacitor-Android-blue.svg?style=flat-square)](./SETUP.md)
[![License](https://img.shields.io/badge/License-MIT-black.svg?style=flat-square)](./LICENSE)

---

## 🌍 Quick Access Links & Live Deployment

*   **Live Application**: [https://carimurah.elpeef.com](https://carimurah.elpeef.com)
*   **Google Play Store**: [Download on Google Play](https://play.google.com/store/apps/details?id=com.carimurah.app)
*   **Source Code Repository**: [https://github.com/mrbrightsides/carimurah](https://github.com/mrbrightsides/carimurah)
*   **Official Support Email**: [support@elpeef.com](mailto:support@elpeef.com)

---

## 💎 Monetization Strategy & Tiering (v2.2)

### 🥉 Free Tier (B2C Massal)
*   **Target**: General Indonesian consumers.
*   **Features**: Scan AI (Foto/Voice), instant retail price comparison, and secure affiliate routing.
*   **Revenue Source**: 100% automated Affiliate Commissions (Shopee, Tokopedia, Bukalapak).

### ⚡ Paket Sachet & Eceran (Bebas Langganan Bulanan)
Beli kuota sekali bayar (*pay-as-you-go*) tanpa pusing biaya bulanan berulang. Pilihan terbaik untuk kebutuhan yang fleksibel:
*   **1. Paket Sachet Lite (Rp5.000)**:
    *   **Kuota**: 5 Token Scan instan.
    *   **Optimasi**: Paling hemat untuk kebutuhan belanja mingguan personal atau uji coba fitur.
*   **2. Paket Terpopuler (Rp12.000)**:
    *   **Kuota**: 15 Token Scan instan (Hemat 20% dibandingkan tarif eceran dasar).
    *   **Optimasi**: Ideal untuk perbandingan harga belanja bulanan rumah tangga secara komprehensif.
*   **3. Weekly Saver Pass (Rp9.900)**:
    *   **Kuota**: 100 Token Scan melimpah aktif selama 7 hari (*Super Irit*).
    *   **Optimasi**: Sangat pas untuk reseller, pedagang eceran, atau dropshipper yang melakukan survei pasokan mingguan secara intensif.

### 🥈 Pro Tier: Smart Saver (Rp49.000 / mo.)
*   **Target**: Resellers, drop-shippers, & heavy personal shoppers.
*   **Features**: 
    *   **Predictive AI Forecasting**: Analyzes historical cycles (e.g., Payday, 6.6, 12.12) to suggest "Wait" or "Buy".
    *   **Persistent Smart Watchlist**: 24/7 Agent Monitoring that blasts alerts when price thresholds drop.
    *   **Interactive Price Cycle Simulator**: Simulate Payday, Double Date, or Midnight Flash Sale discount drops with dynamic Recharts trendlines.
    *   **Deep-Link Checkout**: Autonomous cart filling on destination marketplaces.

### 🥇 Enterprise Tier: Procurement Pro (Rp1.490.000 / mo.)
*   **Target**: UMKM & Corporate Procurement managers.
*   **Features**:
    *   **B2B QR Catalog Scanner & Ledger**: Instant barcode and QR catalog translation for wholesalers. Includes a slide-out history drawer tracking the last 5 scanned records, detected item logs, and potential corporate savings.
    *   **Autonomous RFQ Workflow**: Generates print/PDF-ready official Request for Quotation documents for bulk vendor distribution.
    *   **AI Bargain & Negotiation Script Helper**: Generate highly tailored negotiation scripts based on posture (Collaborative, Aggressive, Tactical) to connect with WhatsApp suppliers.
    *   **Landed Cost & Logistics**: Calculates true "Apple-to-Apple" costs including bulk cargo shipping, processing, and handling fees.
    *   **Historical OCR Audit**: Scan piles of old paper invoices to identify multi-million rupiah "cash leaks" and better historical pricing options.

---

## 🛠️ Unified Core Capabilities

*   **Integrated B2B QR Scanner & Ledger Suite**: Uses an optimized stacked trigger layout for single-handed mobile usage. Features an overlay-based Interactive Guide (*Panduan*), a sliding scan ledger showing the last 5 successful matches (saving/items audit), and a context-aware feedback/reporting FAB directly embedded within the viewfinder.
*   **Predictive AI Cycle Engine**: Simulates discount patterns during Payday (8% off), Double Date (15% off), or Midnight Flash Sales (20% off) dynamically.
*   **AI Bargain Generator**: Creates customized negotiation transcripts in professional, friendly, or agressive Indonesian tones for direct Wholesaler WhatsApp chats.
*   **Autonomous Progress Tracker**: Gives physical progress and steps (e.g., *Auditing Shopee indexes*, *Analyzing Cargo freight rates*) for AI scans.
*   **Frictionless LocalStorage Cache**: Operates instantly as an anonymous offline guest, syncing to cloud database profiles upon simple Google Authentication.

---

## 🍃 MongoDB Atlas Cloud Integration (Verified Production-Ready)

CariMurah.ai is fully integrated with MongoDB Atlas to deliver an enterprise-grade database suite. Every capability has been successfully implemented, tested, and verified on the Atlas cluster dashboard:

*   **✅ MongoDB Atlas Authentication**: Full OAuth single-sign-on integration that maps Google users (using email as enterprise credential fields) instantly to standard cloud database user structures inside the `users` collection.
*   *🚀 Atlas Search (Lucene)*: Enabled via the `default` search index under the `carimurah.products` collection. Powers high-speed fuzzy, auto-correcting search queries over multi-merchant products.
*   *🧠 MongoDB Vector Search*: Configured via the `vector_index` on `carimurah.products`. Automatically indexes high-dimensional AI embeddings for conceptual, high-fidelity Indonesian cargo and supply matching.
*   *📊 MongoDB Aggregation Pipelines*: Multi-stage pipelines are designed to aggregate enterprise savings trends, warehouse stock logistics, audit histories, and cache telemetry.
*   *⚡ MongoDB Product Cache*: Temporary caches stored securely inside the `product_cache` collection, bypassing duplicate merchant API queries to improve app performance and slash cost overhead.
*   *🎯 MongoDB User Preference Engine*: Real-time state binding of watchlist limits, UI mode preferences, and history logs directly mapped into nested JSON sub-documents under the `users` database partition.

### 🍃 Why MongoDB Atlas is the Backbone of CariMurah.ai

CariMurah.ai eliminates database bottlenecks by leveraging MongoDB Atlas as a fully integrated multi-model data platform, rather than just a passive operational datastore:

1. High-Speed Discovery via Atlas Search (Lucene): Traditional indexing fails with fragmented Indonesian marketplace titles. We implemented the 'default' Lucene search index over `carimurah.products` to enable high-speed fuzzy matching and automated typo-correction for non-technical MSME users.
2. Conceptual Matching via Atlas Vector Search: Utilizing the 'vector_index', our AI models convert raw supplier catalogs and unstructured cargo data into high-dimensional embeddings. MongoDB Atlas Vector Search handles semantic retrieval natively, connecting users with the best wholesale alternatives based on conceptual intent rather than exact keyword matches.
3. Multi-Stage Aggregation Pipelines: To drive our B2B Procurement Ledger and Dashboard, we engineered multi-stage aggregation pipelines that dynamically compute cumulative corporate savings, log audit histories, and calculate landed logistics costs on the fly.
4. Performance Caching: By storing temporary product data structures inside the `product_cache` collection with strict TTL indexes, we slashed duplicate API overhead and maximized system performance for production deployment.

---

## 📂 Sub-Documentation Hub

To make onboarding and contribution seamless, please review our specialized technical directories:

*   **[ARCHITECTURE.md](./ARCHITECTURE.md)**: Explore the System Topology diagrams, dynamic sequence flows, and database entity relationships rendered with standard Mermaid blocks.
*   **[SETUP.md](./SETUP.md)**: Step-by-step developer guide on local compilation, setup of `.env` assets, and building your signed mobile `.aab` bundles inside Android Studio with Capacitor.
*   **[THIRD_PARTY_APIs.md](./THIRD_PARTY_APIs.md)**: Configuration details for Google Gemini 3.5 (@google/genai SDK), MongoDB connection URIs, and Firebase authentications.
*   **[CONTRIBUTING.md](./CONTRIBUTING.md)**: Forking guide, repository constraints, and community branching strategies.

---

## 🤝 Community & Direct Support

Stay connected and communicate with developers and directors:
*   **Lead Maintainer**: Akhmad Khudri
*   **Personal Email**: [khudri@binadarma.ac.id](mailto:khudri@binadarma.ac.id)
*   **Telegram Support**: [@khudriakhmad](https://t.me/khudriakhmad)
*   **Discord Server**: [CariMurah Channels](https://discord.com/channels/@khudri_61362)

*Crafted for the future of Indonesian supply chain excellence and digital economy acceleration.*
