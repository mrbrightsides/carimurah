# 🏛️ CariMurah.ai Architecture & System Topology

This document details the high-fidelity multi-agent system, data streaming pipelines, user journey, database models, and cloud topology powering **CariMurah.ai**.

---

## 1. System Topology (System Architecture)

CariMurah.ai utilizes a hybrid architecture of a lightweight mobile **Capacitor WebView / Web App** frontend communicating with a secure, centralized server-side **Node.js Gateway API**, which encapsulates secure integrations with **Google Gemini**, **MongoDB Atlas**, and **Firebase Authentication**.

```mermaid
graph TB
    subgraph Mobile_And_Browser_Clients ["📱 Client Layer (Capacitor WebView / Browser)"]
        cap[("Capacitor Mobile App<br/>(Android AAB / APK)")]
        spa[("Responsive React 18 SPA<br/>(carimurah.elpeef.com)")]
    end

    subgraph CDN_Gateway ["🛡️ Network & Ingress"]
        dns["Web Traffic Router (SSL/CORS)"]
    end

    subgraph Application_Server ["⚙️ Application Layer (Full-Stack Express App)"]
        express["Node.js / Express Server<br/>(Port 3000)"]
        vite_dev["Vite HMR Dev Engine <br/>(Development Only)"]
        mcp["Model Context Protocol (MCP) Gateway<br/>(Database Broker Engine)"]
    end

    subgraph External_Services ["🌐 Cloud & Cognitive Services"]
        fire_auth["Firebase Auth<br/>(Identity Provider)"]
        gemini["Google Gemini 3.5 Flash<br/>(Agentic Reasoning & Vision)"]
        atlas[("MongoDB Atlas Cloud Database<br/>(User & History State)")]
    end

    %% Routing Flow
    cap --> dns
    spa --> dns
    dns --> express
    express --> |Serves Assets / Dev| vite_dev
    express --> |AuthenticatesToken| fire_auth
    express --> |Runs Agent Tools| mcp
    mcp --> |NoSQL Read/Write| atlas
    express --> |Secure Server-Side API Call| gemini
```

---

## 2. Dynamic Data Flow

This chart shows the exact real-time pipeline when a shopper uploads a photo or scans a grocery receipt. The API key is fully hidden on the server, ensuring production security.

```mermaid
sequenceDiagram
    autonumber
    actor User as 👤 B2C/B2B User
    participant Client as 📱 React App (Capacitor)
    participant Server as ⚙️ Express Server (Proxy)
    participant Gem as 🧠 Google Gemini AI
    participant DB as 🗄️ MongoDB Atlas (MCP)

    User->>Client: Uploads Receipt/Invoice (Camera/Image)
    Client->>Client: Compress to Base64 (Safe Storage size)
    Client->>Server: POST /api/analyze-receipt (Base64 + User JWT Token)
    
    rect rgb(15, 23, 42)
        Note over Server: Secure Proxy Checks JWT Token
        Server->>Server: Validate authorization with Firebase Admin
        Server->>Gem: Multi-Modal call with prompt (Indonesian localized)
    end

    Gem-->>Server: Multi-Agent JSON: Product Name, Brand, Price, Savings
    
    rect rgb(30, 41, 59)
        Note over Server: Match historical pricing or search web
        Server->>DB: Query historical price records for B2B supplier contract benchmark
        DB-->>Server: Return benchmark data
    end

    Server->>DB: Save Scan Result to history collection via MCP
    DB-->>Server: OK (Record persistent)
    Server-->>Client: Clean HTTP response (Payload: Scan results + Saving recommendations)
    Client-->>User: Renders high-contrast dashboard with Recharts trends
```

---

## 3. User Journey Map

CariMurah.ai features a highly streamlined Indonesian procurement funnel spanning both mobile WebView (B2C Smart savers) and B2B large-scale wholesale procurement teams.

```mermaid
journey
    title CariMurah.ai Indonesian User Funnel
    section Onboarding & Landing
      First-time Visit: 5: User discovers carimurah.elpeef.com, scans high-contrast features
      Onboarding walkthrough: 4: Onboarding modal highlights B2B Bargain and AI Pricing Cycle
      Select Persona/Mode: 4: Toggles between Emerald B2C (Smart Saver) and Indigo B2B (Procurement Pro)
    section Scan & Analyze
      AI Camera Scan: 5: Shoots wholesale receipt invoice image, uploads
      Interactive wait log: 4: System displays real-time tracking (Log: Scouring Tokopedia/Shopee channels...)
      View AI Forecast: 5: Explores Cycle Simulator for Midnight Sales/Payday discounts
    section Negotiation & Action
      Generate B2B Bargain: 5: Generates WhatsApp negotiation script (options: Agresif, Kolaboratif)
      Generate RFQ File: 4: Creates a PDF / print-friendly RFQ sheet for supplier distribution
      Clear Scan History: 3: Performs a selective batch delete to keep data space tidy
    section Cloud Auth Sync
      Upgrade Account / Log in: 4: Authenticates with Google Firebase, migrates LocalStorage to cloud MongoDB Atlas
```

---

## 4. Feature Brain Map (Mindmap)

```mermaid
mindmap
  root((CariMurah.ai))
    User Personas
      B2C General Consumer
        - Retail Comparison
        - Affiliate Deep-Linking
        - Price Alerts
      B2B Procurement Squads
        - Bulk RFQ Generator
        - Landed Delivery Costs
        - Invoice OCR Audits
    Core Features
      Scan Engines
        - Multi-Modal Image OCR
        - Voice Search Input
        - Automated Auditing
      Negotiation Assistant
        - WhatsApp Chat Generator
        - Tone Adjuster (Agresif, Kolaboratif, Taktis)
      Predictive forecasting
        - Interactive Price Cycle Simulator
        - Double Date and Payday promo algorithms
    Technology Stack
      Frontend
        - React 18, Vite, Tailwind CSS
        - Framer Motion / Motion
        - Capacitor (Native Android)
      Backend
        - Node.js, Express
        - Model Context Protocol (MCP)
        - Firebase Admin SDK
      Storage
        - MongoDB Atlas
        - LocalStorage fallback
```

---

## 5. Logical Class & Schema Design

Unified data model representations supporting seamless B2C `localStorage` guest caching and full-stack enterprise B2B MongoDB persistence.

```mermaid
classDiagram
    class UserProfile {
        +String uid
        +String displayName
        +String email
        +String photoURL
        +String selectedPersona ("B2C" | "B2B")
        +DateTime createdAt
        +DateTime lastActive
    }

    class HistoryItem {
        +String id
        +String uid
        +String productName
        +String brand
        +Double priceInput
        +Double estimatedSavings
        +String sourceChannel / Supplier
        +String thumbnailBase64
        +DateTime parsedAt
        +Boolean isB2B
    }

    class RFQDetails {
        +String rfqId
        +String uid
        +String templateType ("Standard" | "Firm" | "Urgent")
        +List~String~ itemIds
        +Double targetWholesalePrice
        +String deliveryTerms
        +String notes
    }

    class BargainParameters {
        +String negotiationId
        +String posture ("Collaborative" | "Aggressive" | "Tactical")
        +Double priceBenchmark
        +String generatedIndonesianScript
        +DateTime generatedAt
    }

    UserProfile "1" *-- "many" HistoryItem : owns
    UserProfile "1" *-- "many" RFQDetails : generates
    HistoryItem "1" <-- "1" BargainParameters : benchmarks
```

---

## 🛠️ Performance & Scalability Design
*   **Lazy Loading**: Components and heavy panels are dynamically loaded to minimize physical footprint in mobile Capicitor WebViews.
*   **State Decoupling**: Large static data objects are moved out of the hot React lifecycle loop into dedicated `/src/data.ts`.
*   **Compression Offloading**: Complex image matrices are formatted in client memory before shipment to `/api/*` pipelines to lower Node server I/O stress.
*   **Fallback Reliability**: The backend seamlessly handles failures of third-party API routes without affecting local client usage.
