require("dotenv").config();

const {initializeApp} = require("firebase-admin/app");
const {getAuth} = require("firebase-admin/auth");
const {getFirestore} = require("firebase-admin/firestore");
const {GoogleGenAI} = require("@google/genai");
const {setGlobalOptions} = require("firebase-functions");
const {defineSecret} = require("firebase-functions/params");
const {onRequest} = require("firebase-functions/https");
const logger = require("firebase-functions/logger");

initializeApp();
setGlobalOptions({maxInstances: 10});

const geminiApiKey = defineSecret("GEMINI_API_KEY");
const allowedOrigins = [
  "https://cadenceaofficial.github.io",
  "https://cadence-ai-37cdf.web.app",
  "https://cadence-ai-37cdf.firebaseapp.com",
];
const MAX_PROMPT_LENGTH = 12_000;
const MAX_REQUEST_BYTES = 64 * 1024;
const DAILY_LIMIT = 50;

exports.askGemini = onRequest(
    {
      cors: allowedOrigins,
      secrets: [geminiApiKey],
    },
    async (request, response) => {
      if (request.method !== "POST") {
        response
            .set("Allow", "POST")
            .status(405)
            .json({error: "Method not allowed"});
        return;
      }

      const contentType = request.get("Content-Type") || "";
      if (!contentType.toLowerCase().includes("application/json")) {
        response.status(415).json({
          error: "Content-Type must be application/json",
        });
        return;
      }

      const contentLength = Number(request.get("Content-Length"));
      if (Number.isFinite(contentLength) && contentLength > MAX_REQUEST_BYTES) {
        response.status(413).json({error: "Request is too large"});
        return;
      }

      const authorization = request.get("Authorization") || "";
      const token = authorization.match(/^Bearer\s+(.+)$/i)?.[1];
      if (!token) {
        response.status(401).json({error: "Sign in is required"});
        return;
      }

      let decodedToken;
      try {
        decodedToken = await getAuth().verifyIdToken(token, true);
      } catch (error) {
        logger.warn(
            "Firebase token verification failed",
            error?.code || error?.name || "unknown error",
        );
        response
            .status(401)
            .json({error: "Sign-in token is invalid or expired"});
        return;
      }

      const requestBody = request.body;
      let bodyBytes = Number.POSITIVE_INFINITY;
      try {
        bodyBytes = Buffer.byteLength(JSON.stringify(requestBody), "utf8");
      } catch {
      // Invalid or cyclic request bodies are rejected below.
      }
      const prompt = requestBody?.prompt;
      if (
        !requestBody ||
      typeof requestBody !== "object" ||
      Array.isArray(requestBody) ||
      bodyBytes > MAX_REQUEST_BYTES ||
        typeof prompt !== "string" ||
      !prompt.trim() ||
      prompt.length > MAX_PROMPT_LENGTH
      ) {
        response
            .status(400)
            .json({error: "Prompt must be between 1 and 12000 characters"});
        return;
      }

      const apiKey = geminiApiKey.value();
      if (!apiKey) {
        logger.error("GEMINI_API_KEY is not configured");
        response.status(503).json({error: "AI service is not configured"});
        return;
      }

      const day = new Date().toISOString().slice(0, 10);
      const usageRef = getFirestore()
          .collection("Users")
          .doc(decodedToken.uid)
          .collection("Usage")
          .doc(day);
      let limitReached = false;

      try {
        await getFirestore().runTransaction(async (transaction) => {
          const usageSnapshot = await transaction.get(usageRef);
          const savedCount = Number(usageSnapshot.get("count") || 0);
          const count = Number.isSafeInteger(savedCount) && savedCount >= 0 ?
          savedCount :
          0;

          limitReached = count >= DAILY_LIMIT;
          if (!limitReached) {
            transaction.set(
                usageRef,
                {count: count + 1, updatedAt: new Date().toISOString()},
                {merge: true},
            );
          }
        });
      } catch (error) {
        logger.error(
            "Daily usage reservation failed",
            error?.code || error?.name || "unknown error",
        );
        response.status(503).json({error: "Usage tracking is unavailable"});
        return;
      }

      if (limitReached) {
        response.status(429).json({error: "Daily message limit reached"});
        return;
      }

      try {
        const ai = new GoogleGenAI({apiKey});
        const result = await ai.models.generateContent({
          model: "gemini-3.8-flash",
          contents: [
            {
              role: "user",
              parts: [{text: prompt.trim()}],
            },
          ],
        });

        if (typeof result.text !== "string" || !result.text.trim()) {
          logger.warn("Gemini returned an empty response");
          response
              .status(502)
              .json({error: "AI provider returned no response"});
          return;
        }

        response.status(200).json({reply: result.text});
      } catch (error) {
        logger.error("Gemini request failed", error?.name || "unknown error");
        response.status(502).json({
          error: "AI provider is unavailable. Please try again later.",
        });
      }
    },
);
