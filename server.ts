import express from "express";
import cors from "cors";
import path from "path";
import { createServer as createViteServer } from "vite";
import { GoogleGenAI, Type, Modality } from "@google/genai";
import dotenv from "dotenv";
import { connectToDatabase } from "./mongodb";
import { ObjectId } from "mongodb";
import { v4 as uuidv4 } from "uuid";

dotenv.config();

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json({ limit: "150mb" }));

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

// --- MCP SSE Protocol Implementation ---
const mcpSessions = new Map<string, express.Response>();

app.post("/mcp/message", async (req, res) => {
  const sessionId = req.query.sessionId as string;
  const message = req.body;
  if (!sessionId || !mcpSessions.has(sessionId)) return res.status(404).json({ error: "Session not found" });

  try {
    if (message.method === "initialize") {
      return res.json({
        jsonrpc: "2.0", id: message.id,
        result: {
          protocolVersion: "2024-11-05",
          capabilities: { tools: {} },
          serverInfo: { name: "carimurah-mongodb-mcp", version: "1.0.0" }
        }
      });
    }
    if (message.method === "tools/list") {
      return res.json({
        jsonrpc: "2.0", id: message.id,
        result: {
          tools: [
            {
              name: "get_user_profile",
              description: "Mengambil preferensi belanja user (B2B/B2C, fokus harga/rating) dan status langganan dari MongoDB Atlas.",
              inputSchema: {
                type: "object",
                properties: { uid: { type: "string", description: "ID unik Firebase User" } },
                required: ["uid"]
              },
              annotations: {
                title: "Get User Profile",
                readOnlyHint: true,
                destructiveHint: false,
                idempotentHint: true,
                openWorldHint: true
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
              },
              annotations: {
                title: "Update User Profile",
                readOnlyHint: false,
                destructiveHint: true,
                idempotentHint: false,
                openWorldHint: true
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
              },
              annotations: {
                title: "Process Shopping Analysis",
                readOnlyHint: true,
                destructiveHint: false,
                idempotentHint: true,
                openWorldHint: true
              }
            },
            {
              name: "get_user_history",
              description: "Mengambil daftar riwayat hasil analisis belanja yang pernah disimpan user di MongoDB Atlas.",
              inputSchema: {
                type: "object",
                properties: { uid: { type: "string" } },
                required: ["uid"]
              },
              annotations: {
                title: "Get User History",
                readOnlyHint: true,
                destructiveHint: false,
                idempotentHint: true,
                openWorldHint: true
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
              },
              annotations: {
                title: "Save Finding to History",
                readOnlyHint: false,
                destructiveHint: true,
                idempotentHint: false,
                openWorldHint: true
              }
            }
          ]
        }
      });
    }
    if (message.method === "tools/call") {
      const { name, arguments: args } = message.params;
      const { db } = await connectToDatabase();
      let result;
      
      if (name === "get_user_profile") {
        result = await db.collection("users").findOne({ uid: args.uid });
      } else if (name === "update_user_profile") {
        await db.collection("users").updateOne(
          { uid: args.uid },
          { $set: { ...args.preferences, updatedAt: new Date().toISOString() } },
          { upsert: true }
        );
        result = { success: true };
      } else if (name === "get_user_history") {
        const history = await db.collection("history").find({ userId: args.uid }).sort({ date: -1 }).limit(20).toArray();
        result = history.map(h => ({ ...h, id: h._id.toString() }));
      } else if (name === "save_to_history") {
        const r = await db.collection("history").insertOne({
          ...args.product_data,
          userId: args.uid,
          createdAt: new Date().toISOString()
        });
        result = { success: true, id: r.insertedId.toString() };
      } else if (name === "process_analysis") {
        // Mocking the call to internal logic
        result = { status: "processing", message: "Gunakan API endpoint utama untuk analisis mendalam dengan Gemini." };
      }

      return res.json({
        jsonrpc: "2.0", 
        id: message.id, 
        result: { 
          content: [{ type: "text", text: JSON.stringify(result || { status: "not_found" }) }] 
        } 
      });
    }
    res.json({ jsonrpc: "2.0", id: message.id, result: {} });
  } catch (error: any) {
    res.status(500).json({ jsonrpc: "2.0", id: message.id, error: { code: -32603, message: error.message } });
  }
});

app.get("/mcp/sse", (req, res) => {
  const sessionId = uuidv4();
  
  // Set headers for SSE with explicit CORS and no-cache
  res.setHeader("Content-Type", "text/event-stream");
  res.setHeader("Cache-Control", "no-cache, no-transform");
  res.setHeader("Connection", "keep-alive");
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("X-Accel-Buffering", "no");

  res.flushHeaders();

  // Keep-alive comment sent every 15 seconds to prevent timeout
  const keepAlive = setInterval(() => {
    if (res.writableEnded) {
      clearInterval(keepAlive);
      return;
    }
    res.write(": keep-alive\n\n");
  }, 15000);

  const host = req.headers.host || "localhost:3000";
  const protocol = host.includes("localhost") ? "http" : "https";
  const baseUrl = `${protocol}://${host}`;
  const endpointUrl = `${baseUrl}/mcp/message?sessionId=${sessionId}`;
  
  // Initial endpoint event - MUST be exactly this format for discovery
  res.write(`event: endpoint\ndata: ${endpointUrl}\n\n`);
  
  console.log(`[MCP] New SSE session created: ${sessionId} for ${host}`);
  mcpSessions.set(sessionId, res);

  req.on("close", () => {
    console.log(`[MCP] SSE session closed: ${sessionId}`);
    clearInterval(keepAlive);
    mcpSessions.delete(sessionId);
  });
});

// Helper for toolspec.json to paste in GCP
app.get("/mcp/toolspec.json", (req, res) => {
  res.json({
    tools: [
      {
        name: "get_user_profile",
        description: "Mengambil preferensi belanja user (B2B/B2C, fokus harga/rating) dan status langganan dari MongoDB Atlas.",
        inputSchema: { type: "object", properties: { uid: { type: "string" } }, required: ["uid"] },
        annotations: { title: "Get User Profile", readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: true }
      },
      {
        name: "update_user_profile",
        description: "Menyimpan atau memperbarui preferensi profil belanja user (B2B focus, preference) ke database MongoDB.",
        inputSchema: {
          type: "object",
          properties: {
            uid: { type: "string" },
            preferences: { type: "object", properties: { b2b_focus: { type: "string" }, is_b2b: { type: "boolean" } } }
          },
          required: ["uid"]
        },
        annotations: { title: "Update User Profile", readOnlyHint: false, destructiveHint: true, idempotentHint: false, openWorldHint: true }
      },
      {
        name: "process_analysis",
        description: "Menganalisis produk untuk mencari harga termurah di marketplace Indonesia.",
        inputSchema: { type: "object", properties: { text: { type: "string" }, image: { type: "string" } }, required: ["text"] },
        annotations: { title: "Process Shopping Analysis", readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: true }
      },
      {
        name: "get_user_history",
        description: "Mengambil riwayat belanja user dari MongoDB Atlas.",
        inputSchema: { type: "object", properties: { uid: { type: "string" } }, required: ["uid"] },
        annotations: { title: "Get User History", readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: true }
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
                recommended_price: { type: "number" } 
              } 
            }
          },
          required: ["uid", "product_data"]
        },
        annotations: { title: "Save Finding to History", readOnlyHint: false, destructiveHint: true, idempotentHint: false, openWorldHint: true }
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
