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
let selectedImage = null;
let isSending = false;
let activeRequestController = null;
let activeChatId = null;
let chatSessions = [];
const messagesByChatId = new Map();
const MAX_PROMPT_LENGTH = 12_000;
const LEGACY_CHAT_ID = "legacy";
const CHAT_MESSAGE_MARKER = "--message--";

function updateSidebarAccount(user) {
    const displayName = user?.displayName || "Your account";
    const photoUrl = user?.photoURL || "";

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


// =======================================
// MARKDOWN + MATH
// =======================================

function renderMarkdown(text) {

    const wrapper = document.createElement("div");

    wrapper.className = "message-content";

    wrapper.innerHTML = safeMarkdownHtml(text);

    if (window.renderMathInElement) {

        renderMathInElement(wrapper, {

            delimiters: [
                {
                    left: "$$",
                    right: "$$",
                    display: true
                },
                {
                    left: "$",
                    right: "$",
                    display: false
                }
            ]

        });

    }

    return wrapper;
}

function safeMarkdownHtml(text) {

    const source = String(text || "");

    if (!window.marked?.parse) {
        const escaped = document.createElement("span");
        escaped.textContent = source;
        return escaped.innerHTML.replace(/\n/g, "<br>");
    }

    const rendered = window.marked.parse(source);

    if (window.DOMPurify) {
        return window.DOMPurify.sanitize(rendered);
    }

    const escaped = document.createElement("span");
    escaped.textContent = source;
    return escaped.innerHTML.replace(/\n/g, "<br>");
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

    if (window.renderMathInElement) {

        renderMathInElement(content, {

            delimiters: [
                {
                    left: "$$",
                    right: "$$",
                    display: true
                },
                {
                    left: "$",
                    right: "$",
                    display: false
                }
            ]

        });

    }

    chat.scrollTop = chat.scrollHeight;

    return text;

}


// =======================================
// FIREBASE: SAVE MESSAGE
// =======================================

function chatIdFromMessageDocId(docId) {
    const markerIndex = docId.indexOf(CHAT_MESSAGE_MARKER);

    return docId.startsWith("chat-") && markerIndex > 0
        ? docId.slice(0, markerIndex)
        : LEGACY_CHAT_ID;
}

function timestampMillis(value) {
    if (typeof value?.toMillis === "function") return value.toMillis();
    if (value instanceof Date) return value.getTime();
    if (typeof value === "number") return value;
    if (Number.isFinite(value?.seconds)) return value.seconds * 1000;
    return 0;
}

function titleForChat(chatId, messages) {
    const firstUserMessage = messages.find(message =>
        message.sender === "user" && message.text && message.text !== "[Image]"
    );

    if (!firstUserMessage) {
        return chatId === LEGACY_CHAT_ID ? "Previous chat" : "New chat";
    }

    const title = firstUserMessage.text.replace(/\s+/g, " ").trim();
    return title.length > 38 ? `${title.slice(0, 37)}…` : title;
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
    if (!messagesByChatId.has(chatId)) messagesByChatId.set(chatId, []);

    chat.replaceChildren();
    const messages = messagesByChatId.get(chatId) || [];

    if (!messages.length) {
        const emptyState = document.createElement("div");
        emptyState.className = "empty-chat-state";

        const heading = document.createElement("strong");
        heading.textContent = "A clear page for a new idea.";
        emptyState.appendChild(heading);

        const copy = document.createElement("p");
        copy.textContent = "Ask Cadence AI anything to get started.";
        emptyState.appendChild(copy);

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

function previousChatMemory(chatId) {
    const activeIndex = chatSessions.findIndex(session => session.id === chatId);
    const previousSession = activeIndex >= 0
        ? chatSessions[activeIndex + 1]
        : chatSessions[0];

    if (!previousSession) return null;

    const messages = previousSession.messages;
    const selectedIndexes = new Set([
        ...Array.from({ length: Math.min(4, messages.length) }, (_, index) => index),
        ...Array.from(
            { length: Math.min(6, messages.length) },
            (_, index) => messages.length - Math.min(6, messages.length) + index
        )
    ]);

    const excerpt = [...selectedIndexes]
        .sort((left, right) => left - right)
        .map(index => messages[index])
        .filter(Boolean)
        .map(message => {
            const speaker = message.sender === "ai" ? "Cadence AI" : "User";
            const compactText = message.text.replace(/\s+/g, " ").trim();
            const text = compactText.length > 650
                ? `${compactText.slice(0, 500)}… ${compactText.slice(-140)}`
                : compactText;
            return `${speaker}: ${text}`;
        })
        .join("\n");

    if (!excerpt) return null;

    return `Reference notes from the user's immediately previous chat, “${previousSession.title}”. These excerpts include its opening and recent messages:\n${excerpt}`;
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

async function loadOldChats() {
    if (!currentUserId) return;

    try {
        const chatsRef = collection(db, "Users", currentUserId, "Chats");
        const snapshot = await getDocs(chatsRef);
        messagesByChatId.clear();

        snapshot.docs.forEach(docSnap => {
            const data = docSnap.data();
            if (typeof data.text !== "string" || !["user", "ai"].includes(data.sender)) return;

            const chatId = chatIdFromMessageDocId(docSnap.id);
            const messages = messagesByChatId.get(chatId) || [];
            messages.push({
                id: docSnap.id,
                text: data.text,
                sender: data.sender,
                time: data.time || 0
            });
            messagesByChatId.set(chatId, messages);
        });

        messagesByChatId.forEach(messages => {
            messages.sort((left, right) => timestampMillis(left.time) - timestampMillis(right.time));
        });

        refreshChatSessions();

        if (chatSessions.length) {
            openChat(chatSessions[0].id);
        } else {
            startNewChat();
        }

        console.log("Firebase: Chat sessions loaded.");
    } catch (error) {
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

            if (welcome) {
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

    if (welcome) {
        welcome.style.display = "none";
    }

    await loadOldChats();

});

if (sidebarToggle) {
    sidebarToggle.addEventListener("click", toggleSidebar);
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

        const previousMemory = previousChatMemory(chatId);
        const recentHistory = currentHistory.slice(-15);

        if (previousMemory) {
            const latestUserMessage = [...recentHistory]
                .reverse()
                .find(message => message.role === "user");

            if (latestUserMessage) {
                const currentPrompt = latestUserMessage.content;
                const memoryBudget = Math.max(0, 11_950 - currentPrompt.length);
                const memoryContext = previousMemory.slice(0, memoryBudget);

                if (memoryContext) {
                    latestUserMessage.content = `${memoryContext}\n\nCurrent message: ${currentPrompt}`;
                }
            }
        }

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

        await saveMessage(reply, "ai", chatId);

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

async function sendMessage() {

    if (isSending) return;

    if (!currentUserId || !auth.currentUser) {
        addMessage("Please sign in before sending a message.", "ai");
        return;
    }

    if (!activeChatId) startNewChat();
    const requestChatId = activeChatId;

    const text = input.value.trim();

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

            message.appendChild(content);

        }

        chat.appendChild(message);

        chat.scrollTop = chat.scrollHeight;

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

    send.addEventListener("click", sendMessage);

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
