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
    signInWithPopup
} from "https://www.gstatic.com/firebasejs/11.0.2/firebase-auth.js";

import {
    collection,
    addDoc,
    doc,
    setDoc,
    serverTimestamp,
    getDocs,
    query,
    orderBy
} from "https://www.gstatic.com/firebasejs/11.0.2/firebase-firestore.js";


// =======================================
// CONFIGURATION
// =======================================

const BACKEND_URL =
    "https://cadence-ai-backend.cadenceaofficial-ai.workers.dev";


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


// =======================================
// MARKDOWN + MATH
// =======================================

function renderMarkdown(text) {

    const wrapper = document.createElement("div");

    wrapper.className = "message-content";

    wrapper.innerHTML = marked.parse(text || "");

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
// TYPING ANIMATION
// =======================================

async function typeMessage(message, text) {

    const content = message.querySelector(".message-content");

    content.innerHTML = "";

    let current = "";

    for (const letter of text) {

        current += letter;

        content.innerHTML = marked.parse(current);

        chat.scrollTop = chat.scrollHeight;

        await new Promise(resolve =>
            setTimeout(resolve, 8)
        );

    }

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

}


// =======================================
// FIREBASE: SAVE MESSAGE
// =======================================

async function saveMessage(text, sender) {

    if (!currentUserId || !text) return false;

    try {

        await addDoc(

            collection(
                db,
                "Users",
                currentUserId,
                "Chats"
            ),

            {
                text: text,
                sender: sender,
                time: serverTimestamp()
            }

        );

        console.log("Firebase: Message saved.");

        return true;

    } catch (error) {

        console.error("Firebase Save Error:", error);

        // IMPORTANT:
        // Firebase failure must not stop AI communication.

        return false;

    }

}


// =======================================
// FIREBASE: LOAD OLD CHATS
// =======================================

async function loadOldChats() {

    if (!currentUserId) return;

    try {

        chat.innerHTML = "";

        const chatsRef = collection(
            db,
            "Users",
            currentUserId,
            "Chats"
        );

        const q = query(
            chatsRef,
            orderBy("time")
        );

        const snapshot = await getDocs(q);

        snapshot.forEach(docSnap => {

            const data = docSnap.data();

            addMessage(
                data.text,
                data.sender
            );

        });

        console.log("Firebase: Chat history loaded.");

    } catch (error) {

        console.error("Firebase Load Error:", error);

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

            const photo = document.getElementById("userPhoto");

            if (photo) {

                photo.src = user.photoURL || "";

            }

            await setDoc(

                doc(db, "Users", user.uid),

                {
                    name: user.displayName || "User",
                    email: user.email || "",
                    photo: user.photoURL || "",
                    createdAt: serverTimestamp()
                },

                {
                    merge: true
                }

            );

            if (welcome) {
                welcome.style.display = "none";
            }

            await loadOldChats();

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

        currentUserId = null;

        if (welcome) {
            welcome.style.display = "flex";
        }

        return;

    }

    currentUserId = user.uid;

    const photo = document.getElementById("userPhoto");

    if (photo) {

        photo.src = user.photoURL || "";

    }

    if (welcome) {
        welcome.style.display = "none";
    }

    await loadOldChats();

});


// =======================================
// AI REPLY
// =======================================

async function aiReply(text, image) {

    const typing = document.createElement("div");

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

        let history = [];

        if (currentUserId) {

            try {

                const chatsRef = collection(
                    db,
                    "Users",
                    currentUserId,
                    "Chats"
                );

                const q = query(
                    chatsRef,
                    orderBy("time")
                );

                const snapshot = await getDocs(q);

                snapshot.forEach(docSnap => {

                    const data = docSnap.data();

                    if (!data.text) return;

                    history.push({

                        role: data.sender === "ai"
                            ? "model"
                            : "user",

                        content: data.text

                    });

                });

            } catch (firebaseError) {

                console.error(
                    "History Error (Continuing without history):",
                    firebaseError
                );

            }

        }

        // -----------------------------
        // KEEP LAST 15 MESSAGES
        // -----------------------------

        const recentHistory = history.slice(-15);

        recentHistory.push({

            role: "user",

            content: text || "[Image]"

        });

        // -----------------------------
        // BACKEND REQUEST
        // -----------------------------

        console.log("Connecting to Cadence AI Backend...");

        console.log("User ID:", currentUserId);

        console.log("Image:", image ? "YES" : "NO");

        const response = await fetch(

            BACKEND_URL,

            {

                method: "POST",

                headers: {

                    "Content-Type": "application/json"

                },

                body: JSON.stringify({

                    history: recentHistory,

                    image: image,

                    userId: currentUserId

                })

            }

        );

        // -----------------------------
        // READ RESPONSE
        // -----------------------------

        const responseText = await response.text();

        console.log("Backend Status:", response.status);

        console.log("Backend Raw Response:", responseText);

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

        const message = document.createElement("div");

        message.className = "message ai";

        const content = document.createElement("div");

        content.className = "message-content";

        message.appendChild(content);

        message.appendChild(createCopyButton(reply));

        chat.appendChild(message);

        // -----------------------------
        // TYPE ANIMATION
        // -----------------------------

        await typeMessage(message, reply);

        // -----------------------------
        // SAVE AI RESPONSE
        // -----------------------------

        await saveMessage(reply, "ai");

        console.log("Cadence AI: Reply delivered.");

    } catch (error) {

        typing.remove();

        console.error("AI Communication Error:", error);

        addMessage(
            `Sorry, I couldn't connect to my AI brain.\n\nError: ${error.message}`,
            "ai"
        );

    } finally {

        // Clear image after processing

        selectedImage = null;

        if (imageUpload) {
            imageUpload.value = "";
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

    const text = input.value.trim();

    const imageToSend = selectedImage;

    if (!text && !imageToSend) return;

    isSending = true;

    if (send) {
        send.disabled = true;
    }

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

            content.innerHTML = marked.parse(text);

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

        await saveMessage(
            text || "[Image]",
            "user"
        );

        // -----------------------------
        // CONTACT AI
        // -----------------------------

        await aiReply(
            text,
            imageToSend
        );

    } catch (error) {

        console.error("Send Message Error:", error);

        addMessage(
            "Something went wrong while sending your message.",
            "ai"
        );

    } finally {

        isSending = false;

        if (send) {
            send.disabled = false;
        }

        input.focus();

    }

}


// =======================================
// SEND BUTTON
// =======================================

if (send) {

    send.addEventListener("click", sendMessage);

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

        imageUpload.click();

    });

}

if (pickCamera && cameraUpload) {

    pickCamera.addEventListener("click", (e) => {

        e.preventDefault();

        cameraUpload.click();

    });

}

if (pickDocument && documentUpload) {

    pickDocument.addEventListener("click", (e) => {

        e.preventDefault();

        documentUpload.click();

    });

}


// =======================================
// IMAGE PREVIEW
// =======================================

if (imageUpload) {

    imageUpload.addEventListener("change", (e) => {

        const file = e.target.files[0];

        if (!file) return;

        if (!file.type.startsWith("image/")) {

            alert("Please select an image.");

            return;

        }

        const reader = new FileReader();

        reader.onload = () => {

            selectedImage = reader.result;

            imagePreview.style.display = "block";

            imagePreview.innerHTML = `
                <img
                    src="${selectedImage}"
                    class="preview-image"
                >
            `;

        };

        reader.readAsDataURL(file);

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

if (themeToggle) {

    document.body.classList.add("dark");

    themeToggle.innerText = "☀️";

    themeToggle.addEventListener("click", () => {

        document.body.classList.toggle("dark");

        themeToggle.innerText =
            document.body.classList.contains("dark")
                ? "☀️"
                : "🌙";

    });

}


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