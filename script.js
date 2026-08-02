// ===============================
// Cadencea AI
// Rebuilt from scratch
// Part 1 / 4
// ===============================


// Firebase
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


// ===============================
// Elements
// ===============================

const welcome = document.getElementById("welcome");
const chat = document.getElementById("chat");
const input = document.getElementById("prompt");
const send = document.getElementById("send");
const googleLogin = document.getElementById("googleLogin");
const themeToggle = document.getElementById("themeToggle");
const attach = document.getElementById("attach");
const imageUpload = document.getElementById("imageUpload");
const imagePreview = document.getElementById("imagePreview");


let selectedImage = null;

let currentUserId = null;

// ===============================
// Image Upload
// ===============================

attach.addEventListener(
    "click",
    () => {

        imageUpload.click();

    }
);



imageUpload.addEventListener(
    "change",
    async (e) => {

        const file =
            e.target.files[0];


        if (!file) return;


        selectedImage =
            await convertImage(file);


        if (imagePreview) {

            imagePreview.innerHTML = `

                <img 
                    src="${selectedImage}"
                    class="preview-image"
                    alt="Selected Image"
                >

            `;

        }


    }
);



function convertImage(file) {

    return new Promise(
        (resolve, reject) => {

            const reader =
                new FileReader();


            reader.onload =
                () => resolve(reader.result);


            reader.onerror =
                reject;


            reader.readAsDataURL(file);

        }
    );

}
// ===============================
// Markdown + KaTeX
// ===============================

function renderMarkdown(text) {

    const wrapper = document.createElement("div");

    wrapper.className = "message-content";

    wrapper.innerHTML = marked.parse(text || "");

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

    return wrapper;

}


// ===============================
// Copy Button
// ===============================

function createCopyButton(text) {

    const btn = document.createElement("button");

    btn.className = "copy-btn";

    // Default icon
    btn.innerHTML = `
        <img src="icons8-copy-96.png" class="copy-icon" alt="Copy">
    `;

    btn.onclick = async () => {

        try {

            await navigator.clipboard.writeText(text);

            // Show checkmark
            btn.innerHTML = "✓";

            setTimeout(() => {

                btn.innerHTML = `
                    <img src="icons/icons8-copy-96.png" class="copy-icon" alt="Copy">
                `;

            }, 1500);

        }

        catch (err) {

            console.error("Copy failed:", err);

        }

    };

    return btn;

}

// ===============================
// Add Message
// ===============================

function addMessage(text, type) {

    const message = document.createElement("div");

    message.className = `message ${type}`;

    message.appendChild(
        renderMarkdown(text)
    );

    if (type === "ai") {

        message.appendChild(
            createCopyButton(text)
        );

    }

    chat.appendChild(message);

    chat.scrollTop = chat.scrollHeight;

    return message;

}


// ===============================
// Typing Animation
// ===============================

async function typeMessage(messageElement, text) {

    const content = messageElement.querySelector(".message-content");

    content.innerHTML = "";

    let current = "";

    for (const ch of text) {

        current += ch;

        content.innerHTML = marked.parse(current);

        chat.scrollTop = chat.scrollHeight;

        await new Promise(resolve =>
            setTimeout(resolve, 8)
        );

    }

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
// ===============================
// Part 2 / 4
// Firebase Login + Firestore
// ===============================


// Save message
async function saveMessage(text, sender) {

    if (!currentUserId) return;

    if (!text) return;

    await addDoc(

        collection(
            db,
            "Users",
            currentUserId,
            "Chats"
        ),

        {

            text,

            sender,

            time: serverTimestamp()

        }

    );

}



// Load old chats
async function loadOldChats() {

    if (!currentUserId) return;

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

}



// Google Login
googleLogin.addEventListener(

    "click",

    async () => {

        try {

            const result = await signInWithPopup(

                auth,

                googleProvider

            );

            const user = result.user;

            currentUserId = user.uid;

            document.getElementById("userPhoto").src =
                user.photoURL || "";

            await setDoc(

                doc(db, "Users", user.uid),

                {

                    name: user.displayName || "User",

                    email: user.email,

                    photo: user.photoURL || "",

                    createdAt: serverTimestamp()

                },

                {

                    merge: true

                }

            );

            welcome.style.display = "none";

            if (chat.children.length === 0) {

                addMessage(
                    `Welcome ${user.displayName}! 👋`,
                    "ai"
                );

            }

        }

        catch (err) {

            console.error(

                "Google Login Error",

                err

            );

        }

    }

);



// Auth State
onAuthStateChanged(

    auth,

    async (user) => {

        if (!user) {

            welcome.style.display = "flex";

            return;

        }

        currentUserId = user.uid;

        document.getElementById("userPhoto").src =
            user.photoURL || "";

        welcome.style.display = "none";

        await loadOldChats();

    }

);
// ===============================
// Part 3 / 4
// AI Communication
// ===============================

async function aiReply(userPrompt) {

    // Typing animation
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

        // Read previous chats
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

        const history = [];

        snapshot.forEach(doc => {

            const data = doc.data();

            if (!data.text) return;

            history.push({

                role:
                    data.sender === "ai"
                        ? "model"
                        : "user",

                content: data.text

            });

        });

        // Only send recent conversation
        const recentHistory =
            history.slice(-15);

        // Current message
        recentHistory.push({

            role: "user",

            content: userPrompt

        });

        // Backend request
        const response =
            await fetch(

                "https://cadence-ai-backend.cadenceaofficial-ai.workers.dev",

                {

                    method: "POST",

                    headers: {

                        "Content-Type":
                            "application/json"

                    },

                    body: JSON.stringify({

                        history: recentHistory

                    })

                }

            );

        const data =
            await response.json();

        console.log(
            "Backend response:",
            data
        );

        typing.remove();

        if (!response.ok) {

            addMessage(

                "Server Error: " +
                (data.error || "Unknown"),

                "ai"

            );

            return;

        }

        if (!data.reply) {

            addMessage(

                "Backend returned no reply.",

                "ai"

            );

            return;

        }

        let reply = data.reply;

        // If backend accidentally returns JSON string
        if (typeof reply === "string") {

            try {

                const parsed =
                    JSON.parse(reply);

                reply =
                    parsed.candidates?.[0]
                        ?.content
                        ?.parts?.[0]
                        ?.text
                    ||
                    reply;

            }

            catch (e) { }

        }

        // Create AI message
        const message =
            document.createElement("div");

        message.className =
            "message ai";

        const content =
            document.createElement("div");

        content.className =
            "message-content";

        message.appendChild(content);

        // Copy button
        message.appendChild(

            createCopyButton(reply)

        );

        chat.appendChild(message);

        // Type animation
        await typeMessage(

            message,

            reply

        );

        // Save AI reply
        await saveMessage(

            reply,

            "ai"

        );

    }

    catch (err) {

        typing.remove();

        console.error(err);

        addMessage(

            "Sorry, I couldn't connect to my AI brain.",

            "ai"

        );

    }

}
// ===============================
// Part 4 / 4
// Send Button + Theme + Startup
// ===============================


// Send Message
async function sendMessage() {

    const text = input.value.trim();

    if (!text) return;

    // Show user message immediately
    addMessage(
        text,
        "user"
    );

    input.value = "";

    // Save user message
    await saveMessage(
        text,
        "user"
    );

    // Ask AI
    await aiReply(text);

}



// Send button
send.addEventListener(
    "click",
    sendMessage
);


// Enter key
input.addEventListener(
    "keydown",
    (e) => {

        if (
            e.key === "Enter" &&
            !e.shiftKey
        ) {

            e.preventDefault();

            sendMessage();

        }

    }
);



// Default Dark Theme
document.body.classList.add("dark");

if (themeToggle) {

    themeToggle.innerText = "☀️";

    themeToggle.addEventListener(
        "click",
        () => {

            document.body.classList.toggle("dark");

            themeToggle.innerText =
                document.body.classList.contains("dark")
                    ? "☀️"
                    : "🌙";

        }
    );

}



// Auto Focus
window.addEventListener(
    "load",
    () => {

        setTimeout(
            () => {

                input.focus();

            },
            300
        );

    }
);



// ===============================
// End of Script
// ===============================