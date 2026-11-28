// =======================================
// CADENCE AI
// Complete Script.js
// Firebase + Gemini + Chat + Images
// =======================================

import {
    db,
    auth,
    googleProvider
} from "./firebase.js";

import {
    onAuthStateChanged,
    signInWithPopup,
    signOut
} from "https://www.gstatic.com/firebasejs/11.0.2/firebase-auth.js";

import {
    collection,
    doc,
    setDoc,
    updateDoc,
    serverTimestamp,
    getDocs
} from "https://www.gstatic.com/firebasejs/11.0.2/firebase-firestore.js";


// =======================================
// CONFIGURATION
// =======================================

const USE_LOCAL_BACKEND = new URLSearchParams(window.location.search)
    .get("backend") === "local";
const BACKEND_URL = USE_LOCAL_BACKEND
    ? "http://127.0.0.1:8787"
    : "https://cadence-ai-backend.cadenceaofficial-ai.workers.dev";


// =======================================
// GREETINGS
// =======================================

const greetings = [
    "Hello! How can I help?",
    "Welcome Hero!",
    "Wanna know something? Just ask!",
    "Let's create something!",
    "What are we building today?",
    "You are great!",
    "Bored? Let's Chit-Chat!",
    "Coding?",
    "Want a joke? Just ask!",
    "Let's make something awesome!",
    "Ready to explore?",
    "Welcome back!",
    "Hey! Need any help?",
    "Ready to innovate?"
];

const greeting = document.getElementById("greeting");

if (greeting) {
    greeting.innerText =
        greetings[Math.floor(Math.random() * greetings.length)];
}


// =======================================
// HTML ELEMENTS
// =======================================

const welcome = document.getElementById("welcome");
const chat = document.getElementById("chat");
const input = document.getElementById("prompt");
const send = document.getElementById("send");
const stopResponseButton = document.getElementById("stopResponse");
const sidebar = document.getElementById("sidebar");
const sidebarToggle = document.getElementById("sidebarToggle");
const sidebarAvatar = document.getElementById("sidebarAvatar");
const sidebarAvatarFallback = document.getElementById("sidebarAvatarFallback");
const sidebarUserName = document.getElementById("sidebarUserName");
const sidebarUserEmail = document.getElementById("sidebarUserEmail");
const newChatButton = document.getElementById("newChatButton");
const chatList = document.getElementById("chatList");
const settingsButton = document.getElementById("settingsButton");
const settingsPanel = document.getElementById("settingsPanel");
const sidebarThemeToggle = document.getElementById("sidebarThemeToggle");
const logoutButton = document.getElementById("logoutButton");

const googleLogin = document.getElementById("googleLogin");
const themeToggle = document.getElementById("themeToggle");

const imageUpload = document.getElementById("imageUpload");
const imagePreview = document.getElementById("imagePreview");

const attachBtn = document.getElementById("attach");
const voiceBtn = document.getElementById("voice");

const attachMenu = document.getElementById("attachMenu");

const pickImage = document.getElementById("pickImage");
const pickCamera = document.getElementById("pickCamera");
const pickDocument = document.getElementById("pickDocument");

const cameraUpload = document.getElementById("cameraUpload");
const documentUpload = document.getElementById("documentUpload");


// =======================================
// GLOBAL VARIABLES
// =======================================

let currentUserId = null;
let currentUserName = "You";
let selectedImage = null;
let isSending = false;
let activeRequestController = null;
let activeChatId = null;
let chatSessions = [];
let chatHistoryReady = false;
let loadedChatHistoryFor = null;
let chatHistoryLoadPromise = null;
let chatHistoryLoadUserId = null;
const messagesByChatId = new Map();
const MAX_PROMPT_LENGTH = 12_000;
const MAX_CHAT_MEMORY_CHARS = 16_000;
const LEGACY_CHAT_ID = "legacy";
const CHAT_MESSAGE_MARKER = "--message--";
const CHAT_TAB_STATE_KEY = "cadencea.active-chat-tab.v1";
const CLOSED_CHAT_TAB_KEY = "cadencea.closed-chat-tab.v1";
const CHAT_TAB_FEATURE_KEY = "cadencea.chat-tab-feature.v1";
const CHAT_REOPEN_GRACE_MS = 60_000;
const pageNavigationType = window.performance?.getEntriesByType?.("navigation")?.[0]?.type || "navigate";
const SIDEBAR_CORNER_KEY = "cadencea.sidebar-mobile-corner.v1";
const MOBILE_TABLET_MEDIA_QUERY = "(max-width: 1024px), (hover: none) and (pointer: coarse)";
const SIDEBAR_CORNERS = new Set(["top-left", "top-right", "bottom-left", "bottom-right"]);

function readStoredChatTabState(storageName, key) {
    try {
        const value = JSON.parse(window[storageName].getItem(key) || "null");
        return value && typeof value === "object" ? value : null;
    } catch (error) {
        return null;
    }
}

function writeStoredChatTabState(storageName, key, value) {
    try {
        window[storageName].setItem(key, JSON.stringify(value));
    } catch (error) {
        console.warn("Chat tab state could not be saved.", error);
    }
}

function removeStoredChatTabState(storageName, key) {
    try {
        window[storageName].removeItem(key);
    } catch (error) {
        console.warn("Chat tab state could not be cleared.", error);
    }
}

function restoreChatIdForTab(userId) {
    const now = Date.now();
    const tabState = readStoredChatTabState("sessionStorage", CHAT_TAB_STATE_KEY);
    const closedTab = readStoredChatTabState("localStorage", CLOSED_CHAT_TAB_KEY);
    const closedAt = Number(closedTab?.closedAt);
    const closedTabIsRecent = Number.isFinite(closedAt)
        && now >= closedAt
        && now - closedAt <= CHAT_REOPEN_GRACE_MS;
    const matchingClosedTab = closedTab?.userId === userId
        && closedTab?.chatId === tabState?.chatId
        && closedTab?.sessionId === tabState?.sessionId;

    if (tabState?.userId === userId && typeof tabState.chatId === "string") {
        const lastActiveAt = Number(tabState.lastActiveAt);
        const tabStateIsRecent = Number.isFinite(lastActiveAt)
            && now >= lastActiveAt
            && now - lastActiveAt <= CHAT_REOPEN_GRACE_MS;
        const isReload = pageNavigationType === "reload";
        const reloadWasActuallyRecent = !matchingClosedTab || closedTabIsRecent;

        if ((isReload && reloadWasActuallyRecent) || (!isReload && tabStateIsRecent)) {
            writeStoredChatTabState("sessionStorage", CHAT_TAB_STATE_KEY, {
                ...tabState,
                lastActiveAt: now
            });
            if (matchingClosedTab) removeStoredChatTabState("localStorage", CLOSED_CHAT_TAB_KEY);
            return tabState.chatId;
        }
    }

    if (closedTab?.userId === userId && closedTabIsRecent && typeof closedTab.chatId === "string") {
        writeStoredChatTabState("sessionStorage", CHAT_TAB_STATE_KEY, {
            userId,
            chatId: closedTab.chatId,
            sessionId: crypto.randomUUID(),
            lastActiveAt: now
        });
        removeStoredChatTabState("localStorage", CLOSED_CHAT_TAB_KEY);
        return closedTab.chatId;
    }

    if (tabState?.userId === userId) removeStoredChatTabState("sessionStorage", CHAT_TAB_STATE_KEY);
    if (closedTab?.userId === userId || !closedTabIsRecent) {
        removeStoredChatTabState("localStorage", CLOSED_CHAT_TAB_KEY);
    }
    return null;
}

function rememberClosedChatTab() {
    if (!currentUserId || !activeChatId) return;

    const tabState = readStoredChatTabState("sessionStorage", CHAT_TAB_STATE_KEY);
    if (tabState?.userId !== currentUserId || tabState?.chatId !== activeChatId) return;

    const closedAt = Date.now();
    writeStoredChatTabState("sessionStorage", CHAT_TAB_STATE_KEY, {
        ...tabState,
        lastActiveAt: closedAt
    });
    writeStoredChatTabState("localStorage", CLOSED_CHAT_TAB_KEY, {
        ...tabState,
        closedAt
    });
}

window.addEventListener("pagehide", rememberClosedChatTab);

function saveActiveChatTabState() {
    if (!currentUserId || !activeChatId) return;

    const previousState = readStoredChatTabState("sessionStorage", CHAT_TAB_STATE_KEY);
    const sessionId = previousState?.userId === currentUserId
        ? previousState.sessionId
        : crypto.randomUUID();

    writeStoredChatTabState("sessionStorage", CHAT_TAB_STATE_KEY, {
        userId: currentUserId,
        chatId: activeChatId,
        sessionId,
        lastActiveAt: Date.now()
    });
}

function updateSidebarAccount(user) {
    const displayName = user?.displayName || "Your account";
    const photoUrl = user?.photoURL || "";
    const accountLabel = user?.displayName?.trim() || user?.email?.split("@")[0] || "You";
    currentUserName = accountLabel.split(/\s+/)[0] || "You";

    if (sidebarUserName) sidebarUserName.textContent = displayName;
    if (sidebarUserEmail) sidebarUserEmail.textContent = user?.email || "Sign in to sync your chats";

    if (sidebarAvatar) {
        sidebarAvatar.src = photoUrl;
        sidebarAvatar.hidden = !photoUrl;
    }

    if (sidebarAvatarFallback) {
        sidebarAvatarFallback.textContent = displayName.trim().charAt(0).toUpperCase() || "U";
        sidebarAvatarFallback.hidden = Boolean(photoUrl);
    }
}

function closeSidebar() {
    sidebar?.classList.remove("is-open");
    sidebarToggle?.setAttribute("aria-expanded", "false");
    sidebarToggle?.setAttribute("aria-label", "Open navigation");
}

function toggleSidebar() {
    const isOpen = sidebar?.classList.toggle("is-open") || false;
    sidebarToggle?.setAttribute("aria-expanded", String(isOpen));
    sidebarToggle?.setAttribute("aria-label", isOpen ? "Close navigation" : "Open navigation");
}

function initializeMovableSidebar() {
    if (!sidebar || !sidebarToggle || !window.matchMedia) return;

    const mobileTabletMode = window.matchMedia(MOBILE_TABLET_MEDIA_QUERY);
    let pointerDrag = null;
    let suppressNextClick = false;
    let suppressClickTimer = null;

    const clearInlinePosition = () => {
        ["top", "right", "bottom", "left", "transform"].forEach(property => {
            sidebar.style.removeProperty(property);
        });
    };

    const applySavedCorner = () => {
        const savedCorner = readStoredChatTabState("localStorage", SIDEBAR_CORNER_KEY)?.corner;
        if (SIDEBAR_CORNERS.has(savedCorner)) {
            sidebar.dataset.mobileCorner = savedCorner;
        } else {
            delete sidebar.dataset.mobileCorner;
        }
        clearInlinePosition();
    };

    const resetDesktopPosition = () => {
        delete sidebar.dataset.mobileCorner;
        delete sidebar.dataset.dragging;
        clearInlinePosition();
    };

    const suppressDragClick = event => {
        if (!suppressNextClick) return;
        suppressNextClick = false;
        window.clearTimeout(suppressClickTimer);
        event.preventDefault();
        event.stopImmediatePropagation();
    };

    const suppressGeneratedClick = () => {
        suppressNextClick = true;
        window.clearTimeout(suppressClickTimer);
        suppressClickTimer = window.setTimeout(() => {
            suppressNextClick = false;
        }, 500);
    };

    const finishPointerDrag = event => {
        if (!pointerDrag || event.pointerId !== pointerDrag.pointerId) return;

        const didMove = pointerDrag.didMove;
        pointerDrag = null;

        if (!didMove) return;

        const bounds = sidebar.getBoundingClientRect();
        const horizontalSide = bounds.left + bounds.width / 2 < window.innerWidth / 2
            ? "left"
            : "right";
        const verticalSide = bounds.top + bounds.height / 2 < window.innerHeight / 2
            ? "top"
            : "bottom";
        const corner = `${verticalSide}-${horizontalSide}`;

        sidebar.dataset.mobileCorner = corner;
        delete sidebar.dataset.dragging;
        clearInlinePosition();
        writeStoredChatTabState("localStorage", SIDEBAR_CORNER_KEY, { corner });
        suppressGeneratedClick();
    };

    sidebarToggle.addEventListener("pointerdown", event => {
        if (!mobileTabletMode.matches || sidebar.classList.contains("is-open")) return;
        if (!event.isPrimary || (event.pointerType === "mouse" && event.button !== 0)) return;

        const bounds = sidebar.getBoundingClientRect();
        pointerDrag = {
            pointerId: event.pointerId,
            startX: event.clientX,
            startY: event.clientY,
            offsetX: event.clientX - bounds.left,
            offsetY: event.clientY - bounds.top,
            bounds,
            didMove: false
        };

        try {
            sidebarToggle.setPointerCapture(event.pointerId);
        } catch (error) {
            // Pointer capture can be unavailable in older mobile browsers.
        }
    });

    sidebarToggle.addEventListener("pointermove", event => {
        if (!pointerDrag || event.pointerId !== pointerDrag.pointerId) return;

        const deltaX = event.clientX - pointerDrag.startX;
        const deltaY = event.clientY - pointerDrag.startY;
        if (!pointerDrag.didMove && Math.hypot(deltaX, deltaY) < 7) return;

        if (!pointerDrag.didMove) {
            pointerDrag.didMove = true;
            sidebar.dataset.dragging = "true";
            sidebar.style.transform = "none";
            sidebar.style.right = "auto";
            sidebar.style.bottom = "auto";
        }

        const maxLeft = Math.max(0, window.innerWidth - pointerDrag.bounds.width);
        const maxTop = Math.max(0, window.innerHeight - pointerDrag.bounds.height);
        const left = Math.min(maxLeft, Math.max(0, event.clientX - pointerDrag.offsetX));
        const top = Math.min(maxTop, Math.max(0, event.clientY - pointerDrag.offsetY));

        sidebar.style.left = `${left}px`;
        sidebar.style.top = `${top}px`;
        event.preventDefault();
    });

    sidebarToggle.addEventListener("pointerup", finishPointerDrag);
    sidebarToggle.addEventListener("pointercancel", finishPointerDrag);
    sidebarToggle.addEventListener("click", suppressDragClick, true);

    const updateSidebarMode = event => {
        if (event.matches) applySavedCorner();
        else {
            pointerDrag = null;
            resetDesktopPosition();
        }
    };

    if (mobileTabletMode.addEventListener) {
        mobileTabletMode.addEventListener("change", updateSidebarMode);
    } else {
        mobileTabletMode.addListener(updateSidebarMode);
    }

    if (mobileTabletMode.matches) applySavedCorner();
    else resetDesktopPosition();
}


// =======================================
// MARKDOWN + MATH
// =======================================

function renderMarkdown(text) {

    const wrapper = document.createElement("div");

    wrapper.className = "message-content";

    wrapper.innerHTML = safeMarkdownHtml(text);
    renderMathExpressions(wrapper);

    return wrapper;
}

function renderMathExpressions(element) {
    if (!window.renderMathInElement) return;

    renderMathInElement(element, {
        delimiters: [
            { left: "$$", right: "$$", display: true },
            { left: "$", right: "$", display: false }
        ],
        throwOnError: false,
        strict: "ignore"
    });
}

function normalizeAssistantMarkup(source) {
    const codeSegments = [];
    let normalized = source.replace(
        /(?:\x60{3,}[\s\S]*?\x60{3,}|~{3,}[\s\S]*?~{3,}|\x60[^\n]*?\x60)/g,
        code => {
            const placeholder = "CADENCEACODESEGMENT" + codeSegments.length + "END";
            codeSegments.push({ placeholder, code });
            return placeholder;
        }
    );

    normalized = normalized
        .replace(/\\{1,2}\[([\s\S]*?)\\{1,2}\]/g, (_match, expression) => "$$" + expression + "$$")
        .replace(/\\{1,2}\(([\s\S]*?)\\{1,2}\)/g, (_match, expression) => "$" + expression + "$")
        .replace(/^[ \t]*\\[ \t]*$/gm, "");

    const mathExpressions = [];
    normalized = normalized.replace(/\$\$[\s\S]+?\$\$|\$(?!\$)[^\n$]+\$/g, expression => {
        const placeholder = "CADENCEAMATHEXPRESSION" + mathExpressions.length + "END";
        const normalizedExpression = expression
            .replace(/\\{4}(?=\[(?:\d+(?:\.\d+)?(?:pt|em|ex))\])/g, "\\\\")
            .replace(/\\{4}(?=\r?\n)/g, "\\\\")
            .replace(/\\{2}(?=[,;:!])/g, "\\")
            .replace(/\\{1,2}_(?=\s*\{)/g, "_")
            .replace(
                /\\\\(?=(?:frac|binom|sum|prod|qquad|quad|displaystyle|textstyle|text|phantom|mathrm|operatorname|mathbb|mathcal|times|cdot|sqrt|left|right|begin|end|alpha|beta|theta|pi|le|ge|neq|infty|partial|cdots|ldots|rightarrow|sin|cos|tan|log|lim)\b)/g,
                "\\"
            );
        mathExpressions.push({ placeholder, expression: normalizedExpression });
        return placeholder;
    });

    normalized = normalized.replace(/\\([\\\x60*_{}\[\]()#+.!>|~-])/g, "$1");
    normalized = mathExpressions.reduce(
        (text, { placeholder, expression }) => text.replaceAll(placeholder, expression),
        normalized
    );
    return codeSegments.reduce(
        (text, { placeholder, code }) => text.replaceAll(placeholder, code),
        normalized
    );
}

function safeMarkdownHtml(text) {

    const source = normalizeAssistantMarkup(String(text || ""));

    if (!window.marked?.parse) {
        const escaped = document.createElement("span");
        escaped.textContent = source;
        return escaped.innerHTML.replace(/\n/g, "<br>");
    }

    const mathExpressions = [];
    const protectedSource = source.replace(/\$\$[\s\S]+?\$\$|\$(?!\$)[^\n$]+\$/g, expression => {
        const placeholder = `CADENCEAMATHEXPRESSION${mathExpressions.length}END`;
        mathExpressions.push({ placeholder, expression });
        return placeholder;
    });

    const rendered = window.marked.parse(protectedSource);
    let safeRendered;

    if (window.DOMPurify) {
        safeRendered = window.DOMPurify.sanitize(rendered);
    } else {
        const escaped = document.createElement("span");
        escaped.textContent = rendered;
        safeRendered = escaped.innerHTML;
    }

    return mathExpressions.reduce((html, { placeholder, expression }) => {
        const escapedExpression = expression
            .replace(/&/g, "&amp;")
            .replace(/</g, "&lt;")
            .replace(/>/g, "&gt;");
        return html.replaceAll(placeholder, escapedExpression);
    }, safeRendered);
}


// =======================================
// COPY BUTTON
// =======================================

function createCopyButton(text) {

    const button = document.createElement("button");

    button.className = "copy-btn";

    button.innerHTML = `
        <img
            src="icons8-copy-96.png"
            class="copy-icon"
            alt="Copy"
        >
    `;

    button.onclick = async () => {

        try {

            await navigator.clipboard.writeText(text);

            button.innerText = "✓";

            setTimeout(() => {

                button.innerHTML = `
                    <img
                        src="icons8-copy-96.png"
                        class="copy-icon"
                        alt="Copy"
                    >
                `;

            }, 1500);

        } catch (error) {

            console.error("Copy Error:", error);

        }

    };

    return button;
}


// =======================================
// ADD MESSAGE
// =======================================

function addMessage(text, type) {

    const message = document.createElement("div");

    message.className = `message ${type}`;

    message.appendChild(renderMarkdown(text));

    if (type === "ai") {

        message.appendChild(createCopyButton(text));

    }

    chat.appendChild(message);

    chat.scrollTo({
        top: chat.scrollHeight,
        behavior: "smooth"
    });

    return message;
}


// =======================================
// RENDER COMPLETE RESPONSE
// =======================================

function typeMessage(message, text) {

    const content = message.querySelector(".message-content");

    content.innerHTML = safeMarkdownHtml(text);
    renderMathExpressions(content);

    chat.scrollTop = chat.scrollHeight;

    return text;

}


// =======================================
// FIREBASE: SAVE MESSAGE
// =======================================

function chatIdFromMessageDocId(docId, data = {}) {
    if (typeof data.chatId === "string" && data.chatId.trim()) {
        return data.chatId.trim();
    }

    const markerIndex = docId.indexOf(CHAT_MESSAGE_MARKER);

    return docId.startsWith("chat-") && markerIndex > 0
        ? docId.slice(0, markerIndex)
        : LEGACY_CHAT_ID;
}

function normalizeStoredChatMessage(data) {
    const text = data.text ?? data.content ?? data.message;
    const senderValue = String(data.sender ?? data.role ?? "").trim().toLowerCase();
    const sender = ["ai", "assistant", "model", "bot", "cadence"].includes(senderValue)
        ? "ai"
        : ["user", "human"].includes(senderValue)
            ? "user"
            : null;

    if (typeof text !== "string" || !sender) return null;

    return {
        text,
        sender,
        time: data.time ?? data.timestamp ?? data.createdAt ?? 0,
        chatTitle: typeof data.chatTitle === "string" ? data.chatTitle : null
    };
}

function timestampMillis(value) {
    if (typeof value?.toMillis === "function") return value.toMillis();
    if (value instanceof Date) return value.getTime();
    if (typeof value === "number") return value;
    if (typeof value === "string") {
        const parsed = Date.parse(value);
        return Number.isFinite(parsed) ? parsed : 0;
    }
    if (Number.isFinite(value?.seconds)) return value.seconds * 1000;
    return 0;
}

function titleForChat(chatId, messages) {
    const generatedTitle = messages.find(message => typeof message.chatTitle === "string")?.chatTitle;
    if (generatedTitle) return generatedTitle;

    const firstUserMessage = messages.find(message =>
        message.sender === "user" && message.text && message.text !== "[Image]"
    );

    if (!firstUserMessage) {
        return chatId === LEGACY_CHAT_ID ? "Previous chat" : "New chat";
    }

    const title = firstUserMessage.text.replace(/\s+/g, " ").trim();
    return title.length > 38 ? `${title.slice(0, 37)}…` : title;
}

function normalizeChatTitle(value) {
    return String(value || "")
        .split(/\r?\n/, 1)[0]
        .replace(/^\s*(?:chat\s+title|title)\s*[:\-]\s*/i, "")
        .replace(/^[\s"'`*_#]+|[\s"'`*_#]+$/g, "")
        .replace(/\s+/g, " ")
        .trim()
        .slice(0, 44);
}

async function requestChatTitle(userMessage, assistantMessage, chatId) {
    const idToken = await auth.currentUser?.getIdToken();
    if (!idToken) return null;

    const response = await fetch(BACKEND_URL, {
        method: "POST",
        headers: {
            "Content-Type": "application/json",
            "Authorization": `Bearer ${idToken}`
        },
        body: JSON.stringify({
            action: "title",
            chatId,
            titleContext: {
                user: userMessage.slice(0, 1_600),
                assistant: assistantMessage.slice(0, 1_600)
            }
        })
    });

    if (!response.ok) return null;
    const result = await response.json().catch(() => null);
    return normalizeChatTitle(result?.title);
}

async function persistGeneratedChatTitle(chatId, messageId, title, userId) {
    const normalizedTitle = normalizeChatTitle(title);
    if (!normalizedTitle || currentUserId !== userId) return;

    const messages = messagesByChatId.get(chatId) || [];
    const titleMessage = messages.find(message => message.id === messageId);
    if (!titleMessage) return;

    titleMessage.chatTitle = normalizedTitle;
    refreshChatSessions();
    renderChatList();

    try {
        await updateDoc(
            doc(db, "Users", userId, "Chats", messageId),
            { chatTitle: normalizedTitle }
        );
    } catch (error) {
        console.warn("AI chat title could not be saved.", error);
    }
}

function refreshChatSessions() {
    chatSessions = [...messagesByChatId.entries()]
        .filter(([, messages]) => messages.length > 0)
        .map(([id, messages]) => {
            const orderedMessages = [...messages].sort(
                (left, right) => timestampMillis(left.time) - timestampMillis(right.time)
            );
            const latestMessage = orderedMessages[orderedMessages.length - 1];

            return {
                id,
                title: titleForChat(id, orderedMessages),
                updatedAt: timestampMillis(latestMessage?.time),
                messages: orderedMessages
            };
        })
        .sort((left, right) => right.updatedAt - left.updatedAt);
}

function renderChatList() {
    if (!chatList) return;

    chatList.replaceChildren();

    const sessions = [...chatSessions];
    if (activeChatId && !sessions.some(session => session.id === activeChatId)) {
        sessions.unshift({ id: activeChatId, title: "New chat", messages: [] });
    }

    sessions.forEach(session => {
        const button = document.createElement("button");
        button.type = "button";
        button.className = "chat-list-item";
        button.classList.toggle("active", session.id === activeChatId);
        button.disabled = isSending;
        button.setAttribute("aria-current", session.id === activeChatId ? "page" : "false");

        const title = document.createElement("span");
        title.className = "chat-list-title";
        title.textContent = session.title;
        button.appendChild(title);

        const preview = document.createElement("span");
        preview.className = "chat-list-preview";
        const latestMessage = session.messages[session.messages.length - 1];
        preview.textContent = latestMessage?.text || "Start a conversation";
        button.appendChild(preview);

        button.addEventListener("click", () => {
            openChat(session.id);
            closeSidebar();
        });

        chatList.appendChild(button);
    });

    if (newChatButton) newChatButton.disabled = isSending;
}

function appendHistoryMessage(messageData) {
    const message = document.createElement("div");
    message.className = `message ${messageData.sender === "ai" ? "ai" : "user"}`;
    message.appendChild(renderMarkdown(messageData.text));

    if (messageData.sender === "ai") {
        message.appendChild(createCopyButton(messageData.text));
    }

    chat.appendChild(message);
}

function openChat(chatId) {
    if (!chatId || isSending) return;

    activeChatId = chatId;
    saveActiveChatTabState();
    if (!messagesByChatId.has(chatId)) messagesByChatId.set(chatId, []);

    chat.replaceChildren();
    const messages = messagesByChatId.get(chatId) || [];

    if (!messages.length) {
        const emptyState = document.createElement("div");
        emptyState.className = "empty-chat-state";

        const heading = document.createElement("strong");
        heading.textContent = `Ready to Give a Kick Start, ${currentUserName}?`;
        emptyState.appendChild(heading);

        chat.appendChild(emptyState);
    } else {
        messages.slice(-200).forEach(appendHistoryMessage);
        chat.scrollTop = chat.scrollHeight;
    }

    renderChatList();
}

function startNewChat() {
    if (isSending) return;

    const chatId = `chat-${crypto.randomUUID()}`;
    messagesByChatId.set(chatId, []);
    openChat(chatId);
    input?.focus();
}

function chatMemoryFor(chatId, currentPrompt = "") {
    const previousSessions = chatSessions
        .filter(session => session.id !== chatId && session.messages.length)
        .sort((left, right) => right.updatedAt - left.updatedAt);
    const activeSession = chatSessions.find(session => session.id === chatId);
    const activeArchive = activeSession?.messages.slice(0, -12) || [];

    const stopWords = new Set([
        "about", "after", "again", "before", "chat", "chats", "could", "did",
        "discuss", "discussed", "discussion", "earlier", "from", "have", "help",
        "last", "like", "more", "our", "please", "previous", "remember", "talk",
        "talked", "tell", "that", "them", "this", "what", "when", "where", "which",
        "while", "with", "would", "your"
    ]);
    const queryTerms = [...new Set((currentPrompt.toLowerCase().match(/[a-z0-9]{3,}/g) || []))]
        .filter(term => !stopWords.has(term))
        .slice(0, 40);

    const scoreMessage = message => {
        if (!queryTerms.length) return 0;
        const words = new Set(message.text.toLowerCase().match(/[a-z0-9]{3,}/g) || []);
        return queryTerms.reduce((total, term) => total + Number(words.has(term)), 0);
    };

    if (queryTerms.length > 0 && previousSessions.length > 1) {
        const [mostRecent, ...olderSessions] = previousSessions;
        olderSessions.sort((left, right) => {
            const score = session => {
                const titleWords = new Set(session.title.toLowerCase().match(/[a-z0-9]{3,}/g) || []);
                return session.messages.reduce(
                    (total, message) => total + scoreMessage(message),
                    queryTerms.reduce((total, term) => total + Number(titleWords.has(term)) * 2, 0)
                );
            };
            return score(right) - score(left) || right.updatedAt - left.updatedAt;
        });
        previousSessions.splice(0, previousSessions.length, mostRecent, ...olderSessions);
    }

    const memorySections = [];
    const memoryHeader = "Saved conversation context. Prior chats are listed newest first; earlier turns from the active chat and other saved chats may also be included:";
    let remaining = MAX_CHAT_MEMORY_CHARS - memoryHeader.length;

    const addMemorySection = (label, title, messages, options) => {
        if (!messages.length || remaining <= 0) return;

        const { firstCount, lastCount, extraCount, maxMessageLength } = options;
        const selectedIndexes = new Set([
            ...Array.from({ length: Math.min(firstCount, messages.length) }, (_, index) => index),
            ...Array.from(
                { length: Math.min(lastCount, messages.length) },
                (_, index) => messages.length - Math.min(lastCount, messages.length) + index
            )
        ]);

        if (queryTerms.length && extraCount > 0) {
            messages
                .map((message, index) => ({ index, score: scoreMessage(message) }))
                .filter(item => item.score > 0 && !selectedIndexes.has(item.index))
                .sort((left, right) => right.score - left.score)
                .slice(0, extraCount)
                .forEach(item => selectedIndexes.add(item.index));
        }

        const lines = [...selectedIndexes]
            .sort((left, right) => left - right)
            .map(index => messages[index])
            .filter(Boolean)
            .map(message => {
                const speaker = message.sender === "ai" ? "Cadence AI" : "User";
                const compactText = message.text.replace(/\s+/g, " ").trim();
                const text = compactText.length > maxMessageLength
                    ? `${compactText.slice(0, maxMessageLength - 100)}… ${compactText.slice(-99)}`
                    : compactText;
                return `${speaker}: ${text}`;
            });

        const section = `${label}${title ? ` — ${title}` : ""}\n${lines.join("\n")}`;
        const boundedSection = section.length > remaining
            ? section.slice(0, remaining)
            : section;
        memorySections.push(boundedSection);
        remaining -= boundedSection.length + 2;
    };

    if (previousSessions.length) {
        const [mostRecent, ...olderSessions] = previousSessions;
        addMemorySection(
            "MOST RECENT PRIOR CHAT",
            mostRecent.title,
            mostRecent.messages,
            { firstCount: 4, lastCount: 6, extraCount: 4, maxMessageLength: 500 }
        );

        if (activeArchive.length) {
            addMemorySection(
                "EARLIER TURNS FROM THE ACTIVE CHAT",
                "",
                activeArchive,
                { firstCount: 2, lastCount: 4, extraCount: 4, maxMessageLength: 300 }
            );
        }

        olderSessions.forEach((session, index) => {
            if (remaining <= 0) return;
            addMemorySection(
                `OLDER CHAT ${index + 2}`,
                session.title,
                session.messages,
                { firstCount: 2, lastCount: 2, extraCount: 2, maxMessageLength: 250 }
            );
        });
    }

    if (!previousSessions.length && activeArchive.length) {
        addMemorySection(
            "EARLIER TURNS FROM THE ACTIVE CHAT",
            "",
            activeArchive,
            { firstCount: 2, lastCount: 4, extraCount: 4, maxMessageLength: 300 }
        );
    }

    if (!memorySections.length) return "";
    return `${memoryHeader}\n\n${memorySections.join("\n\n")}`.slice(0, MAX_CHAT_MEMORY_CHARS);
}

async function saveMessage(text, sender, chatId = activeChatId) {
    if (!currentUserId || !text || !chatId) return null;

    try {
        const messageId = `${chatId}${CHAT_MESSAGE_MARKER}${crypto.randomUUID()}`;
        const messageRef = doc(
            db,
            "Users",
            currentUserId,
            "Chats",
            messageId
        );
        const savedAt = Date.now();

        await setDoc(messageRef, {
            text,
            sender,
            time: serverTimestamp()
        });

        const messages = messagesByChatId.get(chatId) || [];
        messages.push({ id: messageRef.id, text, sender, time: savedAt });
        messagesByChatId.set(chatId, messages);
        refreshChatSessions();
        renderChatList();

        console.log("Firebase: Message saved.");
        return messageRef.id;
    } catch (error) {
        console.error("Firebase Save Error:", error);
        return null;
    }
}


// =======================================
// FIREBASE: LOAD CHAT SESSIONS
// =======================================

async function loadOldChats(userId = currentUserId) {
    if (!userId) return;

    try {
        const chatsRef = collection(db, "Users", userId, "Chats");
        const snapshot = await getDocs(chatsRef);
        if (currentUserId !== userId) return;

        messagesByChatId.clear();

        snapshot.docs.forEach(docSnap => {
            const data = docSnap.data();
            const message = normalizeStoredChatMessage(data);
            if (!message) return;

            const chatId = chatIdFromMessageDocId(docSnap.id, data);
            const messages = messagesByChatId.get(chatId) || [];
            messages.push({
                id: docSnap.id,
                ...message
            });
            messagesByChatId.set(chatId, messages);
        });

        messagesByChatId.forEach(messages => {
            messages.sort((left, right) => timestampMillis(left.time) - timestampMillis(right.time));
        });

        refreshChatSessions();

        const tabFeatureWasInitialized = readStoredChatTabState(
            "localStorage",
            CHAT_TAB_FEATURE_KEY
        )?.initialized === true;
        const chatIdToRestore = restoreChatIdForTab(userId);
        if (chatIdToRestore) {
            openChat(chatIdToRestore);
        } else if (!tabFeatureWasInitialized && pageNavigationType === "reload" && chatSessions.length) {
            openChat(chatSessions[0].id);
        } else {
            startNewChat();
        }
        writeStoredChatTabState("localStorage", CHAT_TAB_FEATURE_KEY, { initialized: true });

        console.log(`Firebase: Loaded ${chatSessions.length} chat sessions.`);
    } catch (error) {
        if (currentUserId !== userId) return;

        console.error("Firebase Load Error:", error);
        messagesByChatId.clear();
        chatSessions = [];
        startNewChat();
        addMessage(
            "I couldn't load your previous chats, but you can still start a new conversation.",
            "ai"
        );
    }
}

async function ensureChatHistoryLoaded(userId = currentUserId) {
    if (!userId) return;
    if (chatHistoryReady && loadedChatHistoryFor === userId) return;
    if (chatHistoryLoadPromise && chatHistoryLoadUserId === userId) {
        return chatHistoryLoadPromise;
    }

    chatHistoryReady = false;
    chatHistoryLoadUserId = userId;
    const loadPromise = loadOldChats(userId);
    chatHistoryLoadPromise = loadPromise;

    try {
        await loadPromise;
        if (currentUserId === userId) {
            loadedChatHistoryFor = userId;
            chatHistoryReady = true;
        }
    } finally {
        if (chatHistoryLoadPromise === loadPromise) {
            chatHistoryLoadPromise = null;
            chatHistoryLoadUserId = null;
        }
    }
}


// =======================================
// GOOGLE LOGIN
// =======================================

if (googleLogin) {

    googleLogin.addEventListener("click", async () => {

        try {

            const result = await signInWithPopup(
                auth,
                googleProvider
            );

            const user = result.user;

            currentUserId = user.uid;
            updateSidebarAccount(user);

            const photo = document.getElementById("userPhoto");

            if (photo) {

                photo.src = user.photoURL || "";

            }

            try {
                await setDoc(
                    doc(db, "Users", user.uid),
                    {
                        name: user.displayName || "User",
                        email: user.email || "",
                        photo: user.photoURL || "",
                        lastSeenAt: serverTimestamp()
                    },
                    { merge: true }
                );
            } catch (profileError) {
                console.error("Firebase Profile Save Error:", profileError);
            }

            await ensureChatHistoryLoaded(user.uid);
            if (auth.currentUser?.uid === user.uid && welcome) {
                welcome.style.display = "none";
            }

            console.log("Google Login Successful.");

        } catch (error) {

            console.error("Google Login Error:", error);

            addMessage(
                "Google login failed. Please try again.",
                "ai"
            );

        }

    });

}


// =======================================
// AUTO LOGIN
// =======================================

onAuthStateChanged(auth, async (user) => {

    if (!user) {

        activeRequestController?.abort();
        currentUserId = null;
        chatHistoryReady = false;
        loadedChatHistoryFor = null;
        chatHistoryLoadPromise = null;
        chatHistoryLoadUserId = null;
        activeChatId = null;
        chatSessions = [];
        messagesByChatId.clear();

        if (chat) chat.replaceChildren();
        updateSidebarAccount(null);
        renderChatList();
        closeSidebar();

        if (welcome) {
            welcome.style.display = "flex";
        }

        return;

    }

    currentUserId = user.uid;
    updateSidebarAccount(user);

    const photo = document.getElementById("userPhoto");

    if (photo) {

        photo.src = user.photoURL || "";

    }

    await ensureChatHistoryLoaded(user.uid);

    if (auth.currentUser?.uid === user.uid && welcome) {
        welcome.style.display = "none";
    }

});

if (sidebarToggle) {
    sidebarToggle.addEventListener("click", toggleSidebar);
    initializeMovableSidebar();
}

if (newChatButton) {
    newChatButton.addEventListener("click", () => {
        startNewChat();
        closeSidebar();
    });
}

if (settingsButton && settingsPanel) {
    settingsButton.addEventListener("click", () => {
        settingsPanel.hidden = !settingsPanel.hidden;
        settingsButton.setAttribute("aria-expanded", String(!settingsPanel.hidden));
    });
}

if (logoutButton) {
    logoutButton.addEventListener("click", async () => {
        activeRequestController?.abort();
        try {
            await signOut(auth);
        } catch (error) {
            console.error("Sign out failed:", error);
            addMessage("I couldn't log you out. Please try again.", "ai");
        }
    });
}

sidebar?.addEventListener("keydown", event => {
    if (event.key === "Escape") closeSidebar();
});

document.addEventListener("click", event => {
    if (sidebar && !sidebar.contains(event.target)) closeSidebar();
});


// =======================================
// AI REPLY
// =======================================

async function aiReply(text, image, savedMessageId, signal, chatId) {

    if (signal.aborted) {
        addMessage("Response stopped.", "ai");
        return;
    }

    const typing = document.createElement("div");
    let responseMessage = null;
    let displayedReply = "";

    typing.className = "message ai";

    typing.innerHTML = `
        <div class="typing">
            <span></span>
            <span></span>
            <span></span>
        </div>
    `;

    chat.appendChild(typing);

    chat.scrollTop = chat.scrollHeight;

    try {

        // -----------------------------
        // GET CHAT HISTORY
        // -----------------------------

        const currentMessages = [...(messagesByChatId.get(chatId) || [])]
            .sort((left, right) => timestampMillis(left.time) - timestampMillis(right.time));
        const currentMessageWasSaved = Boolean(
            savedMessageId && currentMessages.some(message => message.id === savedMessageId)
        );
        const firstUserTurns = currentMessages.filter(message => message.sender === "user").length;
        const hasAssistantReply = currentMessages.some(message => message.sender === "ai");
        const shouldGenerateChatTitle = chatId !== LEGACY_CHAT_ID
            && firstUserTurns === 1
            && !hasAssistantReply;

        const currentHistory = currentMessages.slice(-12).map(message => {
            const isCurrentPrompt = message.id === savedMessageId;
            const maxLength = isCurrentPrompt ? MAX_PROMPT_LENGTH : 3_000;
            const content = message.text.length > maxLength
                ? `${message.text.slice(0, maxLength - 1)}…`
                : message.text;

            return {
                role: message.sender === "ai" ? "model" : "user",
                content
            };
        });

        if (!currentMessageWasSaved) {
            currentHistory.push({
                role: "user",
                content: text || "[Image]"
            });
        }

        const conversationMemory = chatMemoryFor(chatId, text);
        const recentHistory = currentHistory.slice(-15);
        console.log(
            "Saved chat context:",
            conversationMemory ? `${conversationMemory.length} characters attached` : "no earlier chats found"
        );

        // -----------------------------
        // BACKEND REQUEST
        // -----------------------------

        console.log("Connecting to Cadence AI Backend...");

        console.log("Image:", image ? "YES" : "NO");

        const currentUser = auth.currentUser;
        const idToken = await currentUser?.getIdToken();

        if (!idToken) {
            throw new Error("Please sign in again to continue.");
        }

        const response = await fetch(

            BACKEND_URL,

            {

                method: "POST",

                headers: {

                    "Content-Type": "application/json",
                    "Authorization": `Bearer ${idToken}`

                },

                body: JSON.stringify({

                    history: recentHistory,

                    memory: conversationMemory,

                    image: image || null,

                    // Keep compatibility with the currently deployed Worker.
                    // The updated Worker ignores this and derives the UID from the token.
                    userId: currentUserId

                }),

                signal

            }

        );

        // -----------------------------
        // READ RESPONSE
        // -----------------------------

        const responseText = await response.text();

        if (signal.aborted) {
            throw new DOMException("Response stopped.", "AbortError");
        }

        console.log("Backend Status:", response.status);

        let data;

        try {

            data = JSON.parse(responseText);

        } catch {

            throw new Error(
                "Backend returned an invalid response."
            );

        }

        if (!response.ok) {

            throw new Error(
                data.error || `Backend Error: ${response.status}`
            );

        }

        // -----------------------------
        // CHECK AI REPLY
        // -----------------------------

        let reply = data.reply;

        if (!reply) {

            throw new Error(
                "Backend returned no AI reply."
            );

        }

        // Handle JSON formatted Gemini replies

        if (typeof reply === "string") {

            try {

                const parsed = JSON.parse(reply);

                reply =
                    parsed.candidates?.[0]
                        ?.content?.parts?.[0]?.text
                    || reply;

            } catch {

                // Normal text response.

            }

        }

        if (typeof reply !== "string") {

            reply = String(reply);

        }

        // -----------------------------
        // REMOVE TYPING INDICATOR
        // -----------------------------

        typing.remove();

        // -----------------------------
        // DISPLAY AI MESSAGE
        // -----------------------------

        responseMessage = document.createElement("div");

        responseMessage.className = "message ai";

        const content = document.createElement("div");

        content.className = "message-content";

        responseMessage.appendChild(content);

        chat.appendChild(responseMessage);

        // -----------------------------
        // RENDER THE COMPLETE RESPONSE AT ONCE
        // -----------------------------

        displayedReply = typeMessage(responseMessage, reply);
        responseMessage.appendChild(createCopyButton(displayedReply));

        // -----------------------------
        // SAVE AI RESPONSE
        // -----------------------------

        const assistantMessageId = await saveMessage(reply, "ai", chatId);

        if (shouldGenerateChatTitle && assistantMessageId) {
            const titleUserId = currentUserId;
            requestChatTitle(text, reply, chatId)
                .then(title => {
                    if (title) {
                        return persistGeneratedChatTitle(
                            chatId,
                            assistantMessageId,
                            title,
                            titleUserId
                        );
                    }
                    return null;
                })
                .catch(error => console.warn("AI chat title generation failed.", error));
        }

        console.log("Cadence AI: Reply delivered.");

    } catch (error) {

        typing.remove();

        if (signal.aborted || error?.name === "AbortError") {
            if (responseMessage) responseMessage.remove();
            addMessage("Response stopped.", "ai");
            return;
        }

        console.error("AI Communication Error:", error);

        addMessage(
            `Sorry, I couldn't connect to my AI brain.\n\nError: ${error.message}`,
            "ai"
        );

    } finally {

        typing.remove();

        // Clear image after processing

        selectedImage = null;

        if (imageUpload) {
            imageUpload.value = "";
        }

        if (cameraUpload) {
            cameraUpload.value = "";
        }

        if (imagePreview) {

            imagePreview.innerHTML = "";

            imagePreview.style.display = "none";

        }

    }

}


// =======================================
// SEND MESSAGE
// =======================================

function animatePromptToMessage(sourceRect, message, text) {
    const reduceMotion = window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
    if (!sourceRect || !message || !text || reduceMotion || !Element.prototype.animate) return;

    const targetRect = message.getBoundingClientRect();
    if (!targetRect.width || !targetRect.height) return;

    const flight = document.createElement("div");
    const flightText = text.replace(/\s+/g, " ").trim();
    flight.className = "sent-message-flight";
    flight.textContent = flightText.length > 180
        ? `${flightText.slice(0, 177)}…`
        : flightText;

    const flightWidth = Math.min(Math.max(sourceRect.width, 220), 440);
    flight.style.left = `${sourceRect.left}px`;
    flight.style.top = `${sourceRect.top}px`;
    flight.style.width = `${flightWidth}px`;
    document.body.appendChild(flight);

    const scale = Math.min(1, targetRect.width / flightWidth);
    const offsetX = targetRect.left - sourceRect.left;
    const offsetY = targetRect.top - sourceRect.top;
    message.classList.add("message-flight-pending");

    const animation = flight.animate(
        [
            { transform: "translate(0, 0) scale(1)", opacity: 0.96 },
            {
                transform: `translate(${offsetX}px, ${offsetY}px) scale(${scale})`,
                opacity: 0.15
            }
        ],
        {
            duration: 560,
            easing: "cubic-bezier(.2, .78, .25, 1)",
            fill: "forwards"
        }
    );

    const finishAnimation = () => {
        flight.remove();
        message.classList.remove("message-flight-pending");
        message.classList.add("message-flight-arrived");
        window.setTimeout(() => message.classList.remove("message-flight-arrived"), 240);
    };

    animation.finished.then(finishAnimation, finishAnimation);
}

async function sendMessage({ animateFromComposer = false } = {}) {

    if (isSending) return;

    if (currentUserId && !chatHistoryReady) {
        await ensureChatHistoryLoaded(currentUserId);
    }

    if (!currentUserId || !auth.currentUser) {
        addMessage("Please sign in before sending a message.", "ai");
        return;
    }

    if (!activeChatId) startNewChat();
    const requestChatId = activeChatId;

    const text = input.value.trim();
    const composerRect = animateFromComposer && input
        ? input.getBoundingClientRect()
        : null;

    const imageToSend = selectedImage;

    if (!text && !imageToSend) return;

    if (text.length > MAX_PROMPT_LENGTH) {
        addMessage("Messages are limited to 12,000 characters.", "ai");
        return;
    }

    const requestController = new AbortController();
    activeRequestController = requestController;
    isSending = true;

    if (send) {
        send.disabled = true;
        send.hidden = true;
    }

    if (stopResponseButton) {
        stopResponseButton.disabled = false;
        stopResponseButton.hidden = false;
    }
    renderChatList();

    try {

        // -----------------------------
        // DISPLAY USER MESSAGE
        // -----------------------------

        const message = document.createElement("div");

        message.className = "message user";

        if (imageToSend) {

            const img = document.createElement("img");

            img.src = imageToSend;

            img.className = "chat-image";

            const wrapper = document.createElement("div");

            wrapper.className = "message-content";

            wrapper.appendChild(img);

            message.appendChild(wrapper);

        }

        if (text) {

            const content = document.createElement("div");

            content.className = "message-content";

            content.innerHTML = safeMarkdownHtml(text);
            renderMathExpressions(content);

            message.appendChild(content);

        }

        chat.querySelector(".empty-chat-state")?.remove();
        chat.appendChild(message);

        chat.scrollTop = chat.scrollHeight;

        if (text && composerRect) {
            animatePromptToMessage(composerRect, message, text);
        }

        // -----------------------------
        // CLEAR INPUT
        // -----------------------------

        input.value = "";

        // -----------------------------
        // SAVE USER MESSAGE
        // -----------------------------

        const savedMessageId = await saveMessage(
            text || "[Image]",
            "user",
            requestChatId
        );

        // -----------------------------
        // CONTACT AI
        // -----------------------------

        await aiReply(
            text,
            imageToSend,
            savedMessageId,
            requestController.signal,
            requestChatId
        );

    } catch (error) {

        console.error("Send Message Error:", error);

        addMessage(
            "Something went wrong while sending your message.",
            "ai"
        );

    } finally {

        isSending = false;
        activeRequestController = null;

        if (send) {
            send.disabled = false;
            send.hidden = false;
        }

        if (stopResponseButton) {
            stopResponseButton.disabled = false;
            stopResponseButton.hidden = true;
        }

        renderChatList();

        input.focus();

    }

}


// =======================================
// SEND BUTTON
// =======================================

if (send) {

    send.addEventListener("click", () => sendMessage({ animateFromComposer: true }));

}

if (stopResponseButton) {
    stopResponseButton.addEventListener("click", () => {
        if (!isSending || !activeRequestController) return;

        stopResponseButton.disabled = true;
        activeRequestController.abort();
    });
}


// =======================================
// ENTER KEY
// =======================================

if (input) {

    input.addEventListener("keydown", (e) => {

        if (
            e.key === "Enter" &&
            !e.shiftKey
        ) {

            e.preventDefault();

            sendMessage();

        }

    });

}


// =======================================
// IMAGE ATTACHMENT MENU
// =======================================

if (attachBtn && attachMenu) {

    attachBtn.addEventListener("click", (e) => {

        e.preventDefault();

        e.stopPropagation();

        attachMenu.classList.toggle("show");

    });

}

if (pickImage && imageUpload) {
    pickImage.addEventListener("click", (e) => {
        e.preventDefault();
        attachMenu?.classList.remove("show");
        imageUpload.click();
    });
}



if (pickCamera && cameraUpload) {

    pickCamera.addEventListener("click", (e) => {

        e.preventDefault();

        attachMenu?.classList.remove("show");

        cameraUpload.click();

    });

}

if (pickDocument && documentUpload) {

    pickDocument.addEventListener("click", (e) => {

        e.preventDefault();

        attachMenu?.classList.remove("show");

        documentUpload.click();

    });

}


// =======================================
// IMAGE AND DOCUMENT ATTACHMENTS
// =======================================

const MAX_IMAGE_BYTES = 4 * 1024 * 1024;
const allowedImageTypes = new Set([
    "image/jpeg",
    "image/png",
    "image/webp"
]);

function handleImageSelection(event) {

    const imageInput = event.currentTarget;
    const file = imageInput.files?.[0];

    if (!file) return;

    selectedImage = null;
    imagePreview?.replaceChildren();
    if (imagePreview) imagePreview.style.display = "none";

    if (!allowedImageTypes.has(file.type.toLowerCase())) {

        alert("Choose a PNG, JPEG, or WebP image.");
        imageInput.value = "";
        return;

    }

    if (file.size > MAX_IMAGE_BYTES) {
        alert("Images must be 4 MB or smaller.");
        imageInput.value = "";
        return;
    }

    const reader = new FileReader();

    reader.onload = () => {

        if (typeof reader.result !== "string" || !imagePreview) {
            alert("That image could not be loaded. Please choose another.");
            imageInput.value = "";
            return;
        }

        selectedImage = reader.result;

        const preview = document.createElement("img");
        preview.src = selectedImage;
        preview.className = "preview-image";
        preview.alt = "Image attachment preview";

        imagePreview.replaceChildren(preview);
        imagePreview.style.display = "block";
    };

    reader.onerror = () => {
        alert("That image could not be read. Please choose another.");
        imageInput.value = "";
    };

    reader.readAsDataURL(file);
}

for (const imageInput of [imageUpload, cameraUpload]) {
    imageInput?.addEventListener("change", handleImageSelection);
}

if (documentUpload) {
    documentUpload.addEventListener("change", async (event) => {
        const documentInput = event.currentTarget;
        const file = documentInput.files?.[0];
        if (!file) return;

        if (!file.name.toLowerCase().endsWith(".txt")) {
            alert("Only plain text (.txt) documents are supported right now.");
            documentInput.value = "";
            return;
        }

        try {
            const fileText = await file.text();
            if (!fileText.trim() || fileText.length > 9_000) {
                alert("Choose a non-empty text file with 9,000 characters or fewer.");
                return;
            }

            const attachment = `Text from ${file.name}:\n\n${fileText}`;
            input.value = input.value.trim()
                ? `${input.value.trim()}\n\n${attachment}`
                : attachment;
            input.focus();
        } catch (error) {
            console.error("Document Read Error:", error);
            alert("That text file could not be read.");
        } finally {
            documentInput.value = "";
        }
    });
}


// =======================================
// VOICE INPUT
// =======================================

if (voiceBtn) {

    const SpeechRecognition =
        window.SpeechRecognition ||
        window.webkitSpeechRecognition;

    if (SpeechRecognition) {

        const recognition = new SpeechRecognition();

        recognition.continuous = false;

        recognition.lang = "en-US";

        recognition.interimResults = false;

        voiceBtn.addEventListener("click", () => {

            try {

                recognition.start();

                voiceBtn.style.transform = "scale(1.1)";

            } catch (error) {

                console.error("Voice Start Error:", error);

            }

        });

        recognition.onresult = (event) => {

            input.value +=
                event.results[0][0].transcript;

        };

        recognition.onend = () => {

            voiceBtn.style.transform = "scale(1)";

        };

        recognition.onerror = (event) => {

            console.error("Voice Error:", event.error);

            voiceBtn.style.transform = "scale(1)";

        };

    } else {

        voiceBtn.style.display = "none";

        console.log("Speech recognition not supported.");

    }

}


// =======================================
// THEME TOGGLE
// =======================================

function applyTheme(isDark) {
    document.body.classList.toggle("dark", isDark);

    if (themeToggle) {
        themeToggle.innerText = isDark ? "☀️" : "🌙";
        themeToggle.setAttribute("aria-label", isDark ? "Switch to light theme" : "Switch to dark theme");
    }

    if (sidebarThemeToggle) {
        sidebarThemeToggle.textContent = isDark ? "Switch to light mode" : "Switch to dark mode";
        sidebarThemeToggle.setAttribute("aria-pressed", String(isDark));
    }
}

function toggleTheme() {
    const isDark = !document.body.classList.contains("dark");
    applyTheme(isDark);

    try {
        localStorage.setItem("cadence-theme", isDark ? "dark" : "light");
    } catch (error) {
        console.warn("Theme preference could not be saved.");
    }
}

let prefersDarkTheme = true;
try {
    prefersDarkTheme = localStorage.getItem("cadence-theme") !== "light";
} catch (error) {
    // The default theme remains dark when local storage is unavailable.
}
applyTheme(prefersDarkTheme);

themeToggle?.addEventListener("click", toggleTheme);
sidebarThemeToggle?.addEventListener("click", toggleTheme);


// =======================================
// AUTO FOCUS
// =======================================

window.addEventListener("load", () => {

    setTimeout(() => {

        if (input) {
            input.focus();
        }

    }, 300);

});


// =======================================
// CADENCE AI INITIALIZED
// =======================================

console.log("Cadence AI initialized successfully.");
