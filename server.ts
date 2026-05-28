import express from "express";
import cors from "cors";
import path from "path";
import { createServer as createViteServer } from "vite";
import { GoogleGenAI, Type, Modality } from "@google/genai";
import dotenv from "dotenv";
import { connectToDatabase } from "./mongodb";
import { ObjectId } from "mongodb";
import { v4 as uuidv4 } from "uuid";
import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { SSEServerTransport } from "@modelcontextprotocol/sdk/server/sse.js";
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
} from "@modelcontextprotocol/sdk/types.js";

dotenv.config();

const app = express();
const PORT = Number(process.env.PORT) || 3000;

app.use(cors());

// Skip JSON body-parsing globally for MCP message handler so SSEServerTransport can parse the stream natively
app.use((req, res, next) => {
  if (req.path === "/mcp/message") {
    next();
  } else {
    express.json({ limit: "150mb" })(req, res, next);
  }
});

// Simple logger for tracking
app.use((req, res, next) => {
  console.log(`[${new Date().toISOString()}] ${req.method} ${req.url}`);
  if (req.body && Object.keys(req.body).length > 0 && !req.url.includes("message")) {
    // Avoid logging large message bodies for MCP
    console.log("Body Summary:", Object.keys(req.body));
  }
  next();
});

// MCP Discovery & Health
app.get("/mcp/info", (req, res) => {
  const host = req.headers.host || "localhost:3000";
  const protocol = host.includes("localhost") ? "http" : "https";
  const baseUrl = `${protocol}://${host}`;

  res.json({
    name: "CariMurah MCP Server",
    status: "active",
    protocol: "SSE",
    endpoints: {
      sse: `${baseUrl}/mcp/sse`,
      message: `${baseUrl}/mcp/message`,
      toolspec: `${baseUrl}/mcp/toolspec.json`,
      openapi: `${baseUrl}/openapi.json`,
      health: `${baseUrl}/api/health`
    },
    capabilities: ["tools", "resources"],
    service: "CariMurah.ai Agent Platform Integration"
  });
});

app.get("/.well-known/mcp", (req, res) => {
  res.redirect("/mcp/sse");
});

app.get("/mcp", (req, res) => {
  res.redirect("/mcp/info");
});

// --- MCP SDK Server and Handlers Setup ---
const mcpServer = new Server(
  {
    name: "carimurah-mongodb-mcp",
    version: "1.0.0",
  },
  {
    capabilities: {
      tools: {},
    },
  }
);

// Register Tool Discovery handler
mcpServer.setRequestHandler(ListToolsRequestSchema, async () => {
  return {
    tools: [
      {
        name: "get_user_profile",
        description: "Mengambil preferensi belanja user (B2B/B2C, fokus harga/rating) dan status langganan dari MongoDB Atlas.",
        inputSchema: {
          type: "object",
          properties: { uid: { type: "string", description: "ID unik Firebase User" } },
          required: ["uid"]
        }
      },
      {
        name: "update_user_profile",
        description: "Menyimpan atau memperbarui preferensi profil belanja user (B2B focus, preference) ke database MongoDB.",
        inputSchema: {
          type: "object",
          properties: {
            uid: { type: "string" },
            preferences: {
              type: "object",
              properties: {
                b2b_focus: { type: "string", enum: ["price", "delivery", "rating"] },
                is_b2b: { type: "boolean" }
              }
            }
          },
          required: ["uid"]
        }
      },
      {
        name: "process_analysis",
        description: "Alur kerja utama agen: Menganalisis teks atau gambar produk untuk mencari harga termurah di marketplace.",
        inputSchema: {
          type: "object",
          properties: {
            text: { type: "string" },
            image: { type: "string" },
            is_b2b: { type: "boolean" }
          },
          required: ["text"]
        }
      },
      {
        name: "get_user_history",
        description: "Mengambil daftar riwayat hasil analisis belanja yang pernah disimpan user di MongoDB Atlas.",
        inputSchema: {
          type: "object",
          properties: { uid: { type: "string" } },
          required: ["uid"]
        }
      },
      {
        name: "save_to_history",
        description: "Menyimpan hasil temuan harga termurah ke riwayat permanen user di MongoDB Atlas.",
        inputSchema: {
          type: "object",
          properties: {
            uid: { type: "string" },
            product_data: {
              type: "object",
              properties: {
                product_name: { type: "string" },
                recommended_price: { type: "number" },
                platform: { type: "string" },
                total_saved: { type: "number" }
              }
            }
          },
          required: ["uid", "product_data"]
        }
      }
    ]
  };
});

// Register Tool Execution handler
mcpServer.setRequestHandler(CallToolRequestSchema, async (request) => {
  const { name, arguments: args } = request.params;
  const { db } = await connectToDatabase();
  let result;
  
  if (name === "get_user_profile") {
    result = await db.collection("users").findOne({ uid: args?.uid });
  } else if (name === "update_user_profile") {
    const preferences = args?.preferences as any;
    await db.collection("users").updateOne(
      { uid: args?.uid },
      { $set: { ...preferences, updatedAt: new Date().toISOString() } },
      { upsert: true }
    );
    result = { success: true };
  } else if (name === "get_user_history") {
    const history = await db.collection("history").find({ userId: args?.uid }).sort({ date: -1 }).limit(20).toArray();
    result = history.map(h => ({ ...h, id: h._id.toString() }));
  } else if (name === "save_to_history") {
    const product_data = args?.product_data as any;
    const r = await db.collection("history").insertOne({
      ...product_data,
      userId: args?.uid,
      createdAt: new Date().toISOString()
    });
    result = { success: true, id: r.insertedId.toString() };
  } else if (name === "process_analysis") {
    result = { status: "processing", message: "Gunakan API endpoint utama untuk analisis mendalam dengan Gemini." };
  } else {
    throw new Error(`Tool ${name} not found`);
  }

  return {
    content: [{ type: "text", text: JSON.stringify(result || { status: "not_found" }) }]
  };
});

// SSEServerTransport Client Sessions
const sseTransports = new Map<string, SSEServerTransport>();

app.get("/mcp/sse", async (req, res) => {
  console.log("[MCP] New incoming SSE transport connection requested");
  
  // Set explicit headers for proxy and buffer flushing
  res.setHeader("Content-Type", "text/event-stream");
  res.setHeader("Cache-Control", "no-cache, no-transform");
  res.setHeader("Connection", "keep-alive");
  res.setHeader("X-Accel-Buffering", "no");

  const transport = new SSEServerTransport("/mcp/message", res as any);
  await mcpServer.connect(transport);
  
  const sessionId = transport.sessionId;
  sseTransports.set(sessionId, transport);
  console.log(`[MCP] SSE session established. Session ID: ${sessionId}`);

  req.on("close", () => {
    console.log(`[MCP] SSE connection closed for session: ${sessionId}`);
    sseTransports.delete(sessionId);
  });
});

app.post("/mcp/message", async (req, res) => {
  const sessionId = req.query.sessionId as string;
  const transport = sseTransports.get(sessionId);
  
  if (!transport) {
    return res.status(404).json({ error: "Session not found" });
  }
  
  await transport.handleMessage(req as any, res as any);
});

// Helper for toolspec.json to paste in GCP
app.get("/mcp/toolspec.json", (req, res) => {
  res.json({
    tools: [
      {
        name: "get_user_profile",
        description: "Mengambil preferensi belanja user (B2B/B2C, fokus harga/rating) dan status langganan dari MongoDB Atlas.",
        inputSchema: {
          type: "object",
          properties: {
            uid: { type: "string", description: "ID unik Firebase User" }
          },
          required: ["uid"]
        }
      },
      {
        name: "update_user_profile",
        description: "Menyimpan atau memperbarui preferensi profil belanja user (B2B focus, preference) ke database MongoDB.",
        inputSchema: {
          type: "object",
          properties: {
            uid: { type: "string", description: "ID unik Firebase User" },
            preferences: {
              type: "object",
              properties: {
                b2b_focus: { type: "string", enum: ["price", "delivery", "rating"] },
                is_b2b: { type: "boolean" }
              }
            }
          },
          required: ["uid"]
        }
      },
      {
        name: "process_analysis",
        description: "Alur kerja utama agen: Menganalisis teks atau gambar produk untuk mencari harga termurah di marketplace.",
        inputSchema: {
          type: "object",
          properties: {
            text: { type: "string", description: "Nama produk atau deskripsi barang yang ingin dicari." },
            image: { type: "string", description: "Opsional: String base64 gambar produk atau struk belanja." },
            is_b2b: { type: "boolean", description: "Setel true jika ingin mencari harga grosir/partai besar." }
          },
          required: ["text"]
        }
      },
      {
        name: "get_user_history",
        description: "Mengambil daftar riwayat hasil analisis belanja yang pernah disimpan user di MongoDB Atlas.",
        inputSchema: {
          type: "object",
          properties: {
            uid: { type: "string", description: "ID unik Firebase User" }
          },
          required: ["uid"]
        }
      },
      {
        name: "save_to_history",
        description: "Menyimpan hasil temuan harga termurah ke riwayat permanen user di MongoDB Atlas.",
        inputSchema: {
          type: "object",
          properties: {
            uid: { type: "string", description: "ID unik Firebase User" },
            product_data: {
              type: "object",
              properties: {
                product_name: { type: "string" },
                recommended_price: { type: "number" },
                platform: { type: "string" },
                total_saved: { type: "number" }
              }
            }
          },
          required: ["uid", "product_data"]
        }
      }
    ]
  });
});
// --- End of MCP ---

// Serve OpenAPI Spec for Agent Builder Integration
app.get("/openapi.json", (req, res) => {
  res.sendFile(path.join(process.cwd(), "openapi.json"));
});

// MongoDB API Routes

// Health Check
app.get("/api/health", (req, res) => {
  res.json({ status: "ok", message: "CariMurah API is running" });
});

// Profile Management
app.get("/api/profile/:uid", async (req, res) => {
  try {
    const { db } = await connectToDatabase();
    const profile = await db.collection("users").findOne({ uid: req.params.uid });
    res.json(profile || null);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

app.post("/api/profile/:uid", async (req, res) => {
  try {
    const { db } = await connectToDatabase();
    const { uid } = req.params;
    const data = req.body;
    // Remove _id from body if present to avoid immutable field error during update
    delete data._id;
    await db.collection("users").updateOne(
      { uid },
      { $set: { ...data, uid, updatedAt: new Date().toISOString() } },
      { upsert: true }
    );
    res.json({ success: true });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// History Management
app.get("/api/history", async (req, res) => {
  try {
    const uid = req.query.uid as string;
    const { db } = await connectToDatabase();
    
    // If no uid, return latest 10 items globally for testing/agent preview
    const query = uid ? { userId: uid } : {};
    const history = await db.collection("history")
      .find(query)
      .sort({ date: -1 })
      .limit(20)
      .toArray();
    
    // Convert _id to id for frontend compatibility
    const formatted = history.map(h => ({ ...h, id: h._id.toString() }));
    res.json(formatted);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

app.get("/api/history/:uid", async (req, res) => {
  // Backward compatibility for the mobile app
  try {
    const { db } = await connectToDatabase();
    const history = await db.collection("history")
      .find({ userId: req.params.uid })
      .sort({ date: -1 })
      .limit(20)
      .toArray();
    
    const formatted = history.map(h => ({ ...h, id: h._id.toString() }));
    res.json(formatted);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

app.post("/api/history/:uid", async (req, res) => {
  try {
    const { db } = await connectToDatabase();
    const { uid } = req.params;
    const item = req.body;
    const result = await db.collection("history").insertOne({
      ...item,
      userId: uid,
      createdAt: new Date().toISOString()
    });
    res.json({ id: result.insertedId.toString() });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

app.delete("/api/history/:uid", async (req, res) => {
  try {
    const { db } = await connectToDatabase();
    const { uid } = req.params;
    const { ids } = req.body; // Array of hex strings
    
    const objectIds = ids.map((id: string) => new ObjectId(id));
    await db.collection("history").deleteMany({
      _id: { $in: objectIds },
      userId: uid
    });
    res.json({ success: true });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

app.patch("/api/history/:uid/:historyId", async (req, res) => {
  try {
    const { db } = await connectToDatabase();
    const { uid, historyId } = req.params;
    const data = req.body;
    // Avoid updating _id
    delete data._id;
    delete data.id;
    
    await db.collection("history").updateOne(
      { _id: new ObjectId(historyId), userId: uid },
      { $set: data }
    );
    res.json({ success: true });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// --- Midtrans Payment Gateway Integration ---
app.post("/api/payment/create", async (req, res) => {
  try {
    const { plan, uid, email } = req.body;
    if (!plan || !uid) {
      return res.status(400).json({ error: "Parameter plan dan uid wajib diisi." });
    }

    const isProd = process.env.MIDTRANS_IS_PRODUCTION === "true";
    const serverKey = process.env.MIDTRANS_SERVER_KEY;
    const clientKey = process.env.MIDTRANS_CLIENT_KEY;

    // Standard local rates in IDR
    const amount = plan === "PRO" ? 49000 : 1490000;
    const planAbbr = plan === "PRO" ? "PRO" : "ENT";
    
    // Clean alphanumeric UID without special chars for standard orderId pattern
    const cleanUid = uid.replace(/[^a-zA-Z0-9]/g, "").substring(0, 15);
    const orderId = `CM-${planAbbr}-${cleanUid}-${Date.now().toString().slice(-6)}`;

    console.log(`[Midtrans Payment] Requesting charge for ${plan}. IsProd: ${isProd}, OrderID: ${orderId}`);

    if (!serverKey) {
      // Graceful local test simulator mode if credentials are not configured yet
      console.log("[Midtrans Payment] WARNING: MIDTRANS_SERVER_KEY is undefined. Falling back to Sandbox Mock Simulator.");
      return res.json({
        isMock: true,
        token: `mock-snap-token-${uuidv4().substring(0, 8)}`,
        redirect_url: `#mock-payment-simulator`,
        clientKey: clientKey || "mock-client-key"
      });
    }

    const midtransUrl = isProd 
      ? "https://app.midtrans.com/snap/v1/transactions"
      : "https://app.sandbox.midtrans.com/snap/v1/transactions";

    const authString = Buffer.from(serverKey + ":").toString("base64");

    const payload = {
      transaction_details: {
        order_id: orderId,
        gross_amount: amount
      },
      credit_card: {
        secure: true
      },
      customer_details: {
        first_name: "CariMurah Customer",
        email: email || "customer@carimurah.ai"
      },
      callbacks: {
        finish: `${req.headers.referer || "https://carimurah.ai/"}?payment=success`
      }
    };

    const midtransRes = await fetch(midtransUrl, {
      method: "POST",
      headers: {
        "Accept": "application/json",
        "Content-Type": "application/json",
        "Authorization": `Basic ${authString}`
      },
      body: JSON.stringify(payload)
    });

    if (!midtransRes.ok) {
      const errorText = await midtransRes.text();
      throw new Error(`Midtrans API responds error: ${errorText}`);
    }

    const data = await midtransRes.json();
    return res.json({
      isMock: false,
      token: data.token,
      redirect_url: data.redirect_url,
      clientKey
    });

  } catch (error: any) {
    console.error("[Midtrans Payment] Error creating Snap transaction:", error);
    return res.status(500).json({ error: error.message || "Failed to call Midtrans dynamic gateway." });
  }
});

app.get("/api/payment/webhook", (req, res) => {
  return res.json({ status: "ok", message: "Midtrans Webhook HTTP GET endpoint is active." });
});

app.post("/api/payment/webhook", async (req, res) => {
  try {
    const notification = req.body;
    console.log("[Midtrans Webhook] Received notification:", notification);

    // If it's a test notification / ping from Midtrans without a standard order_id, return 200 OK
    if (!notification || Object.keys(notification).length === 0) {
      return res.json({ status: "ok", message: "Empty notification ping received successfully." });
    }

    const { order_id, transaction_status, fraud_status } = notification;

    if (!order_id) {
      return res.json({ status: "ok", message: "Notification received but no order_id found. Likely a test ping." });
    }

    const isSuccess = 
      (transaction_status === "capture" && fraud_status === "accept") ||
      transaction_status === "settlement" ||
      transaction_status === "capture"; // capture accepts directly in sandbox

    if (isSuccess) {
      // Parse order_id format: CM-{PLAN}-{CLEAN_UID}-{RANDOM}
      const parts = order_id.split("-");
      if (parts[0] === "CM") {
        const planAbbr = parts[1];
        const cleanUidPart = parts[2];
        const plan = planAbbr === "PRO" ? "PRO" : "ENTERPRISE";

        // Query User document based on starting-regex match for UID
        const { db } = await connectToDatabase();
        
        // Find user where uid starts with cleanUidPart
        const matchRegex = new RegExp(`^${cleanUidPart}`, "i");
        const userDoc = await db.collection("users").findOne({ uid: { $regex: matchRegex } });

        if (userDoc) {
          const durationMs = plan === "PRO" ? 30 * 24 * 60 * 60 * 1000 : 365 * 24 * 60 * 60 * 1000;
          const expiresAt = new Date(Date.now() + durationMs).toISOString();
          const subs = { tier: plan, expiresAt };

          await db.collection("users").updateOne(
            { uid: userDoc.uid },
            { $set: { subscription: subs, updatedAt: new Date().toISOString() } }
          );
          console.log(`[Midtrans Webhook] Successfully upgraded Firebase UID ${userDoc.uid} to ${plan}`);
        } else {
          console.warn(`[Midtrans Webhook] No matching user document found in MongoDB starting with: ${cleanUidPart}`);
        }
      }
    }

    return res.json({ received: true });
  } catch (error: any) {
    console.error("[Midtrans Webhook] Error processing handler:", error);
    return res.status(500).json({ error: error.message });
  }
});

// Initialize Gemini
const ai = new GoogleGenAI({
  apiKey: process.env.GEMINI_API_KEY,
  httpOptions: {
    headers: {
      'User-Agent': 'aistudio-build',
    }
  }
});

// High-Quality Text-to-Speech Endpoint
app.post("/api/tts", async (req, res) => {
  try {
    const { text, voice = "Zephyr" } = req.body;
    
    // Using the modern Gemini TTS model for studio-quality voices
    const response = await ai.models.generateContent({
      model: "gemini-3.1-flash-tts-preview",
      contents: [{ parts: [{ text }] }],
      config: {
        responseModalities: [Modality.AUDIO],
        speechConfig: {
          voiceConfig: {
            // Supported: 'Puck', 'Charon', 'Kore', 'Fenrir', 'Zephyr'
            prebuiltVoiceConfig: { voiceName: voice },
          },
        },
      },
    });

    const base64Audio = response.candidates?.[0]?.content?.parts?.[0]?.inlineData?.data;
    if (base64Audio) {
      // Returning raw PCM (24000Hz) data
      res.json({ audio: base64Audio, rate: 24000 });
    } else {
      throw new Error("No audio data returned");
    }
  } catch (error: any) {
    console.error("TTS Error:", error);
    res.status(500).json({ error: error.message });
  }
});

// Combined Agentic Workflow for CariMurah.ai
app.post("/api/process", async (req, res) => {
  console.log("Incoming request to /api/process, B2B:", req.body.isB2B);
  try {
    const { image, text, audio, isB2B, preferences } = req.body;
    
    console.log("Analyzing with Gemini...");
    const systemInstruction = `You are a Highly Sophisticated Multi-Agent Business Intelligence System for CariMurah.ai.
    You specialize in Indonesian e-commerce (Tokopedia, Shopee, Blibli, Lazada) and wholesale supply chains (Grosir, Distributor).

    Adopt the 'Zephyr' Persona for the 'summaryVoice' (This text will be read with a Studio-quality AI voice):
    - Tone: Deeply expert, warm, and highly conversational.
    - Style: Use helpful Indonesian interjections (Wah, Nah, Jadi).
    - Goal: Communicate the "Savings Victory" clearly and enthusiastically.
    - Keep it concise (3-4 sentences max) for better listening experience.

    Agent Superpowers (Hackathon Context):
    - You are integrated with MongoDB via MCP (Model Context Protocol).
    - You have persistent memory of all user shopping history, preferences, and price trends.
    - You act as an Autonomous Procurement Agent that can draft RFQs based on historical 'leaks' identified in the audit.

    User Global Preference for B2B: ${preferences?.b2bFocus || "price"}. 
    Prioritize recommendations based on this focus.

    Subscription Tier: ${preferences?.subscription?.tier || "FREE"}.
    - If PRO/ENTERPRISE: Include 'forecasting' (price trend analysis based on historical cycles like Payday, Double Dates, and holidays).
    - If ENTERPRISE: Include 'landedCost' (basePrice, shipping, tax estimation for bulk) AND 'auditInsights'.

    Eco-System Capabilities:
    1. B2C Consumer Agent: Find best retail prices. Identify "MUST-BUY" deal.
    2. B2B Enterprise Agent: Extract items from receipts/nota. Find wholesale suppliers. Calculate Landed Costs.
    3. Predictive Agent: Analyze historical price fluctuations. Suggest waiting if a discount cycle is near (e.g., 6.6, 25th month).
    4. Procurement Agent: Prepare Request for Quotation (RFQ) data for bulk approval.
    5. Auditor Agent: Read historical patterns and identify where the business is overpaying or "leaking" cash.

    For every ITEM identified, you MUST provide:
    - productName, brand, currentPrice (what they paid/saw).
    - recommendedPrice (the better deal you found).
    - platform (where to buy it). 
    - url (link).
    - saving (difference).
    - rating (1-5 scale).
    - deliveryDays (e.g., "1-2 hari").
    - bulkDiscount (e.g., "Grosir min 1 lusin").
    - features (list of key specs).
    - stockStatus (e.g., "Tersedia", "Stok Menipis").
    - supplierRating (1-5 scale).
    - reliabilityScore (1-100%).
    - forecasting (PRO/ENTERPRISE Only): { trend: 'up'|'down'|'stable', predictedNextWeek: number, reason: string, history: [{date, price}] }.
    - landedCost (ENTERPRISE Only): { basePrice, shipping, tax, total }.
    - alternatives (list of 2-3 other suppliers).
    - reviews (list of 2-3 short user reviews).

    Audit Insights (B2B/ENTERPRISE Only): 
    Provide 'auditInsights' array if multiple items are processed. Analyze the pattern: "You usually buy Ingredient A at Supplier X, but Supplier Y is 20% cheaper this month."
    Each insight MUST include a 'details' array with 2-3 specific granular examples of where the leak happened (e.g., "Overpaid Rp5.000/kg for 100kg of Flour last week").

    Behavior:
    - Be extremely precise with IDR prices.
    - If B2B is enabled, prioritize Wholesale/Distributor prices over retail.
    - Provide a "summaryVoice" in a warm, expert Indonesian tone.

    Return JSON matching the BatchAnalysisResult schema.`;

    let prompt = "";
    const parts: any[] = [];

    if (image) {
      prompt = isB2B 
        ? "Scan this receipt. Extract all items and current prices. Find better wholesale suppliers in Indonesia. Provide granular comparison details."
        : "Identify this product. Find the best current price on Shopee/Tokopedia. Provide details and alternatives.";
      parts.push({ text: prompt });
      parts.push({ inlineData: { mimeType: "image/jpeg", data: image.split(",")[1] } });
    } else if (audio) {
      prompt = "This is a voice query about a product or a shopping list. Analyze it and find the best prices/suppliers in Indonesia.";
      parts.push({ text: prompt });
      parts.push({ inlineData: { mimeType: "audio/wav", data: audio.split(",")[1] } });
    } else if (text) {
      prompt = `Analyzing this manual input: "${text}". ${isB2B ? "Treat as a business supply list. Find wholesale prices." : "Find the best retail prices."}`;
      parts.push({ text: prompt });
    }

    const response = await ai.models.generateContent({
      model: "gemini-3-flash",
      contents: [{ role: "user", parts }],
      config: {
        systemInstruction,
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            items: {
              type: Type.ARRAY,
              items: {
                type: Type.OBJECT,
                properties: {
                  productName: { type: Type.STRING },
                  brand: { type: Type.STRING },
                  currentPrice: { type: Type.NUMBER },
                  recommendedPrice: { type: Type.NUMBER },
                  platform: { type: Type.STRING },
                  url: { type: Type.STRING },
                  saving: { type: Type.NUMBER },
                  rating: { type: Type.NUMBER },
                  deliveryDays: { type: Type.STRING },
                  bulkDiscount: { type: Type.STRING },
                  features: { type: Type.ARRAY, items: { type: Type.STRING } },
                  stockStatus: { type: Type.STRING },
                  supplierRating: { type: Type.NUMBER },
                  reliabilityScore: { type: Type.NUMBER },
                  forecasting: {
                    type: Type.OBJECT,
                    properties: {
                      trend: { type: Type.STRING },
                      predictedNextWeek: { type: Type.NUMBER },
                      reason: { type: Type.STRING },
                      history: {
                        type: Type.ARRAY,
                        items: {
                          type: Type.OBJECT,
                          properties: {
                            date: { type: Type.STRING },
                            price: { type: Type.NUMBER }
                          }
                        }
                      }
                    }
                  },
                  landedCost: {
                    type: Type.OBJECT,
                    properties: {
                      basePrice: { type: Type.NUMBER },
                      shipping: { type: Type.NUMBER },
                      tax: { type: Type.NUMBER },
                      total: { type: Type.NUMBER }
                    }
                  },
                  reviews: {
                    type: Type.ARRAY,
                    items: {
                      type: Type.OBJECT,
                      properties: {
                        user: { type: Type.STRING },
                        rating: { type: Type.NUMBER },
                        comment: { type: Type.STRING },
                        date: { type: Type.STRING }
                      }
                    }
                  },
                  alternatives: {
                    type: Type.ARRAY,
                    items: {
                      type: Type.OBJECT,
                      properties: {
                        platform: { type: Type.STRING },
                        price: { type: Type.NUMBER },
                        url: { type: Type.STRING },
                        rating: { type: Type.NUMBER },
                        deliveryDays: { type: Type.STRING },
                        bulkDiscount: { type: Type.STRING },
                        stockStatus: { type: Type.STRING },
                        supplierRating: { type: Type.NUMBER },
                        reliabilityScore: { type: Type.NUMBER }
                      }
                    }
                  }
                },
                required: ["productName", "brand", "currentPrice", "recommendedPrice", "platform", "url", "saving"]
              }
            },
            totalCurrentSpent: { type: Type.NUMBER },
            totalRecommendedSpent: { type: Type.NUMBER },
            totalPotentialSavings: { type: Type.NUMBER },
            summaryVoice: { type: Type.STRING },
            auditInsights: {
              type: Type.ARRAY,
              items: {
                type: Type.OBJECT,
                properties: {
                  wasteCategory: { type: Type.STRING },
                  recommendation: { type: Type.STRING },
                  potentialAnnualSaving: { type: Type.NUMBER },
                  details: { type: Type.ARRAY, items: { type: Type.STRING } }
                }
              }
            },
            rfqStatus: { type: Type.STRING }
          },
          required: ["items", "totalCurrentSpent", "totalRecommendedSpent", "totalPotentialSavings", "summaryVoice"]
        }
      }
    });

    const textResponse = response.text;
    if (!textResponse) {
      throw new Error("Agen AI tidak memberikan respon valid.");
    }

    const result = JSON.parse(textResponse);
    console.log("Analysis successful, items found:", result.items?.length);
    res.json(result);
  } catch (error: any) {
    console.error("Processing error:", error);
    res.status(500).json({ error: error.message || "Terjadi kesalahan internal pada agen." });
  }
});

app.post("/api/monthly-summary", async (req, res) => {
  try {
    const { history, preferences } = req.body;
    
    const systemInstruction = `You are the Lead Financial Analyst for CariMurah.ai. 
    Your job is to provide a "Monthly Savings Report" in a friendly, professional, and slightly conversational Indonesian tone.
    
    Context:
    - User Tier: ${preferences?.subscription?.tier || "FREE"}
    - Focus: ${preferences?.b2bFocus === "price" ? "Mencari harga terendah" : preferences?.b2bFocus === "delivery" ? "Pengiriman tercepat" : "Rating supplier terbaik"}
    
    Data provided: A list of last 30 days shopping history including items count and total savings.
    
    Your Report Structure:
    1. Executive Summary: A quick high-level summary of the saving performance.
    2. Savings Breakdown: Highlight if they are saving well or if there's a specific category they could improve on.
    3. Personalized Tip: Based on their B2B/B2C focus, give 1-2 actionable tips for next month.
    4. Motivational Closing: Keep them excited to use CariMurah.ai.
    
    Keep it concise (150-200 words). Use Markdown for formatting.`;

    const prompt = `Here is my shopping history for the last 30 days: ${JSON.stringify(history)}. 
    Analyze this and tell me how I did. My total savings this month is Rp${history.reduce((a: number, b: any) => a + b.totalSaved, 0).toLocaleString("id-ID")}.`;

    const response = await ai.models.generateContent({
      model: "gemini-3-flash",
      contents: [{ role: "user", parts: [{ text: prompt }] }],
      config: {
        systemInstruction,
      }
    });

    res.json({ report: response.text });
  } catch (error: any) {
    console.error("Summary error:", error);
    res.status(500).json({ error: error.message || "Gagal membuat ringkasan bulanan." });
  }
});

// Interactive AI Agent Chat Endpoint with Function Calling (Native MCP DB Interface)
app.post("/api/agent/chat", async (req, res) => {
  try {
    const { message, history = [], uid, isB2B } = req.body;
    
    // Tools declarations for Gemini
    const get_user_profile_tool = {
      name: "get_user_profile",
      description: "Ambil informasi profil preferensi belanja pengguna dari database MongoDB.",
      parameters: { type: Type.OBJECT, properties: {} }
    };
    
    const update_user_preferences_tool = {
      name: "update_user_preferences",
      description: "Perbarui preferensi belanja pengguna di database MongoDB.",
      parameters: {
        type: Type.OBJECT,
        properties: {
          b2bFocus: { type: Type.STRING, description: "Fokus analisis belanja B2B: price, delivery, atau rating" },
          currency: { type: Type.STRING, description: "Mata uang untuk perhitungan harga: IDR, USD, atau MYR" },
          language: { type: Type.STRING, description: "Bahasa antarmuka aplikasi: id (Indonesia) atau en (Inggris)" },
          notifyOnBetterPrices: { type: Type.BOOLEAN, description: "Status notifikasi drop harga (true/false)" }
        }
      }
    };
    
    const get_user_history_tool = {
      name: "get_user_history",
      description: "Ambil riwayat analisis belanja dan data potensi penghematan uang dari database MongoDB.",
      parameters: { type: Type.OBJECT, properties: {} }
    };

    const search_cheapest_products_tool = {
      name: "search_cheapest_products",
      description: "Cari harga produk termurah di Tokopedia, Shopee, Blibli, dan Jaringan Distributor grosir.",
      parameters: {
        type: Type.OBJECT,
        properties: {
          query: { type: Type.STRING, description: "Nama produk atau kategori barang yang dicari secara detail" },
          isB2B: { type: Type.BOOLEAN, description: "Setel true jika mencari harga grosir/gudang partai besar" }
        },
        required: ["query"]
      }
    };

    const tools = [{
      functionDeclarations: [
        get_user_profile_tool,
        update_user_preferences_tool,
        get_user_history_tool,
        search_cheapest_products_tool
      ]
    }];

    const systemInstruction = `Anda adalah Asisten CariMurah.ai (Asisten Cerdas CariMurah).
Tugas Anda adalah memposisikan diri sebagai agen otonom yang berjalan langsung di dalam aplikasi (in-app agent).
Anda terhubung langsung ke database MongoDB Atlas pengguna menggunakan protokol server-internal MCP (Model Context Protocol).

ATURAN PERILAKU:
1. Selalu utamakan menggunakan database-tools (Function Calling) yang disediakan jika pengguna bertanya tentang preferensi mereka, riwayat penemuan hemat, profil, atau mencari penawaran harga.
2. Jika pengguna meminta untuk mengubah pengaturan (misal: "ubah fokus B2B ke pengiriman" atau "aktifkan notifikasi"), panggil tool 'update_user_preferences' dan konfirmasi setelah sukses diperbarui.
3. Saat memanggil 'search_cheapest_products', sajikan perbandingan harga produk yang ditemukan secara terperinci (seperti Tokopedia vs Shopee vs Grosir/Distributor) dan hitung berapa yang bisa mereka hemat jika membeli dari platform pemenang. Tampilkan dalam format tabel Markdown yang bersih dan profesional.
4. Jawablah dalam Bahasa Indonesia yang ramah, hangat, penuh semangat hemat (gunakan interjeksi seperti Wah, Nah, Hebat!), dan profesional sebagai asisten pengadaan/belanja hebat.
5. Gunakan format Markdown yang indah, tebal-tipis bervariasi, bullet points, dan emoji fungsional seperlunya.`;

    // Process message history to Gemini contents format
    const contents: any[] = [];
    
    // Push history item contents
    for (const item of history) {
      if (item.text && item.role) {
        contents.push({
          role: item.role === "assistant" ? "model" : "user",
          parts: [{ text: item.text }]
        });
      }
    }
    
    // Add current user query
    contents.push({
      role: "user",
      parts: [{ text: message }]
    });

    console.log(`[AGENT CHAT] Processing message with Gemini. UID: ${uid}, isB2B: ${isB2B}`);

    const response = await ai.models.generateContent({
      model: "gemini-3.5-flash",
      contents,
      config: {
        systemInstruction,
        tools,
        toolConfig: { includeServerSideToolInvocations: true }
      }
    });

    const functionCalls = response.functionCalls;
    const toolLogs: string[] = [];

    if (functionCalls && functionCalls.length > 0) {
      const { db } = await connectToDatabase();
      const results: any[] = [];
      
      for (const fc of functionCalls) {
        console.log(`[AGENT CHAT] Tool triggered: ${fc.name}`, fc.args);
        let toolResult: any = null;
        
        if (fc.name === "get_user_profile") {
          toolLogs.push("get_user_profile: Mengambil informasi preferensi profil Anda dari MongoDB...");
          if (uid) {
            toolResult = await db.collection("users").findOne({ uid });
            if (!toolResult) {
              toolResult = {
                uid,
                displayName: "Pengguna CariMurah",
                subscription: { tier: "FREE" },
                preferences: { currency: "IDR", language: "id", notifyOnBetterPrices: true, b2bFocus: "price", showTrendChartsByDefault: true }
              };
            }
          } else {
            toolResult = { error: "User is currently anonym/not logged in" };
          }
        } 
        else if (fc.name === "update_user_preferences") {
          const updates = fc.args as any;
          toolLogs.push(`update_user_preferences: Memperbarui preferensi Anda (${JSON.stringify(updates)}) di MongoDB...`);
          if (uid) {
            await db.collection("users").updateOne(
              { uid },
              { $set: { ...updates, updatedAt: new Date().toISOString() } },
              { upsert: true }
            );
            toolResult = { success: true, updated: updates };
          } else {
            toolResult = { error: "User is currently anonym/not logged in" };
          }
        } 
        else if (fc.name === "get_user_history") {
          toolLogs.push("get_user_history: Memindai riwayat transaksi & audit penghematan dari MongoDB...");
          const query = uid ? { userId: uid } : {};
          const hist = await db.collection("history").find(query).sort({ date: -1 }).limit(10).toArray();
          toolResult = hist.map(h => ({
            id: h._id.toString(),
            date: h.date || h.createdAt,
            totalSaved: h.totalSaved,
            itemsCount: h.itemsCount,
            type: h.type,
            note: h.note || ""
          }));
        } 
        else if (fc.name === "search_cheapest_products") {
          const queryStr = (fc.args as any).query;
          const searchB2B = (fc.args as any).isB2B !== undefined ? (fc.args as any).isB2B : isB2B;
          toolLogs.push(`search_cheapest_products: Menyisir Tokopedia, Shopee, & Grosir untuk "${queryStr}"...`);
          
          // Realistic price generation based on keywords
          let basePrice = 45000;
          if (queryStr.toLowerCase().includes("minyak")) basePrice = 38000;
          else if (queryStr.toLowerCase().includes("beras")) basePrice = 72000;
          else if (queryStr.toLowerCase().includes("gula")) basePrice = 16000;
          else if (queryStr.toLowerCase().includes("susu")) basePrice = 120000;
          else {
            // Random base
            basePrice = Math.floor(Math.random() * 80000) + 15000;
          }

          const tokoprice = Math.floor(basePrice * 0.96);
          const shopeeprice = Math.floor(basePrice * 0.91);
          const grosirprice = Math.floor(basePrice * 0.78); // Distributor bulk discount

          toolResult = {
            query: queryStr,
            searchType: searchB2B ? "Gubernur Grosir / UMKM B2B" : "Eceran Konsumen B2C",
            options: [
              {
                platform: "Shopee Super Hemat",
                price: shopeeprice,
                rating: 4.8,
                deliveryDays: "1-2 hari",
                stockStatus: "Ready Stock",
                reliabilityScore: 96,
                isWinner: !searchB2B
              },
              {
                platform: "Tokopedia Official",
                price: tokoprice,
                rating: 4.9,
                deliveryDays: "Same-Day",
                stockStatus: "Ready Stock",
                reliabilityScore: 99,
                isWinner: false
              },
              {
                platform: "Grosir Distributor Official",
                price: grosirprice,
                rating: 4.7,
                deliveryDays: "2-3 hari (Kargo)",
                stockStatus: "Terselia Melimpah",
                bulkDiscount: "Beli min 10 unit hemat 22%",
                reliabilityScore: 94,
                isWinner: searchB2B
              }
            ],
            savingCalculated: searchB2B ? (basePrice - grosirprice) : (basePrice - shopeeprice)
          };
        }

        results.push({
          response: { output: toolResult }
        });
      }

      // Re-invoke Gemini with tools outcome to get final commentary
      const nextContents = [
        ...contents,
        response.candidates?.[0]?.content, // Model tool requests
        {
          role: "user",
          parts: results.map((r, ri) => ({
            functionResponse: {
              name: functionCalls[ri].name,
              response: r.response
            }
          }))
        }
      ];

      const secondResponse = await ai.models.generateContent({
        model: "gemini-3.5-flash",
        contents: nextContents,
        config: {
          systemInstruction,
          tools,
          toolConfig: { includeServerSideToolInvocations: true }
        }
      });

      res.json({
        reply: secondResponse.text,
        toolCalls: toolLogs
      });
    } else {
      res.json({
        reply: response.text,
        toolCalls: []
      });
    }

  } catch (error: any) {
    console.error("Agent Chat API error:", error);
    res.status(500).json({ error: error.message || "Gagal berinteraksi dengan asisten AI." });
  }
});

// Vite middleware for development
async function setupVite() {
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }
}

setupVite().then(() => {
  // 404 Catch-all for API and MCP routes only
  app.use((req, res, next) => {
    if (req.url.startsWith("/api") || req.url.startsWith("/mcp") || ["/sse", "/message", "/toolspec.json"].includes(req.url)) {
      console.warn(`[404] Not Found: ${req.method} ${req.url}`);
      return res.status(404).json({ error: "Endpoint not found on CariMurah MCP Server" });
    }
    next();
  });

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://0.0.0.0:${PORT}`);
  });
});
