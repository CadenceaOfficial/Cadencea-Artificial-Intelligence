// =======================================
// Cadence AI
// Script.js
// Part 1
// =======================================


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



// =======================================
// Elements
// =======================================

const welcome = document.getElementById("welcome");
const chat = document.getElementById("chat");
const input = document.getElementById("prompt");
const send = document.getElementById("send");
const googleLogin = document.getElementById("googleLogin");
const themeToggle = document.getElementById("themeToggle");

const imageUpload = document.getElementById("imageUpload");
const imagePreview = document.getElementById("imagePreview");



let currentUserId = null;

let selectedImage = null;



// =======================================
// Markdown + Math
// =======================================

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



// =======================================
// Copy Button
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

            button.innerHTML = "✓";

            setTimeout(() => {

                button.innerHTML = `
                    <img
                        src="icons8-copy-96.png"
                        class="copy-icon"
                        alt="Copy"
                    >
                `;

            }, 1500);

        }

        catch (err) {

            console.error(err);

        }

    };

    return button;

}



// =======================================
// Add Message
// =======================================

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



// =======================================
// Typing Animation
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



// =======================================
// Image Preview
// =======================================

const attachBtn = document.getElementById("attach");

if (attachBtn && imageUpload) {

    attachBtn.addEventListener("click", () => {

        imageUpload.click();

    });

}


imageUpload.addEventListener("change", e => {

    const file = e.target.files[0];

    if (!file) return;

    const reader = new FileReader();

    reader.onload = function () {

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
// =======================================
// Part 2
// Firebase + Authentication + Firestore
// =======================================


// -------------------------------
// Save Message
// -------------------------------

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
            text: text,
            sender: sender,
            time: serverTimestamp()
        }

    );

}



// -------------------------------
// Load Previous Chats
// -------------------------------

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

    snapshot.forEach((docSnap) => {

        const data = docSnap.data();

        addMessage(

            data.text,
            data.sender

        );

    });

}



// -------------------------------
// Google Login
// -------------------------------

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

            // Profile Photo
            const photo =
                document.getElementById("userPhoto");

            if (photo) {

                photo.src =
                    user.photoURL || "";

            }

            // Save user profile
            await setDoc(

                doc(
                    db,
                    "Users",
                    user.uid
                ),

                {

                    name:
                        user.displayName || "User",

                    email:
                        user.email || "",

                    photo:
                        user.photoURL || "",

                    createdAt:
                        serverTimestamp()

                },

                {
                    merge: true
                }

            );

            welcome.style.display = "none";

            await loadOldChats();

            // Welcome only if new chat
            if (chat.children.length === 0) {

                addMessage(

                    `Welcome ${user.displayName || "User"}! 👋`,

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



// -------------------------------
// Auto Login
// -------------------------------

onAuthStateChanged(

    auth,

    async (user) => {

        if (!user) {

            welcome.style.display = "flex";

            return;

        }

        currentUserId = user.uid;

        const photo =
            document.getElementById("userPhoto");

        if (photo) {

            photo.src =
                user.photoURL || "";

        }

        welcome.style.display = "none";

        await loadOldChats();

    }

);
// =======================================
// Part 3
// AI Communication
// =======================================

async function aiReply(userPrompt) {

    // -----------------------------
    // Typing Indicator
    // -----------------------------

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
        // Read Previous Chats
        // -----------------------------

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

        snapshot.forEach(docSnap => {

            const data = docSnap.data();

            if (!data.text) return;

            history.push({

                role:
                    data.sender === "ai"
                        ? "model"
                        : "user",

                content: data.text

            });

        });


        // -----------------------------
        // Last 15 messages only
        // -----------------------------

        const recentHistory =
            history.slice(-15);


        // Current user message

        recentHistory.push({

            role: "user",

            content: userPrompt

        });


        // -----------------------------
        // Backend Request
        // -----------------------------

        const response = await fetch(

            "https://cadence-ai-backend.cadenceaofficial-ai.workers.dev",

            {

                method: "POST",

                headers: {

                    "Content-Type": "application/json"

                },

                body: JSON.stringify({

                    history: recentHistory,

                    image: selectedImage

                })

            }

        );


        const data = await response.json();

        console.log("Backend Response:", data);

        typing.remove();


        if (!response.ok) {

            addMessage(

                data.error || "Backend Error",

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


        // --------------------------------
        // Sometimes Gemini sends JSON
        // --------------------------------

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


        // -----------------------------
        // Create Empty AI Bubble
        // -----------------------------

        const message = document.createElement("div");

        message.className = "message ai";


        const content = document.createElement("div");

        content.className = "message-content";

        message.appendChild(content);


        message.appendChild(

            createCopyButton(reply)

        );


        chat.appendChild(message);


        // -----------------------------
        // Type Animation
        // -----------------------------

        await typeMessage(

            message,

            reply

        );


        // -----------------------------
        // Save AI Reply
        // -----------------------------

        await saveMessage(

            reply,

            "ai"

        );


        // -----------------------------
        // Reset Image
        // -----------------------------

        selectedImage = null;

        imageUpload.value = "";

        imagePreview.innerHTML = "";

        imagePreview.style.display = "none";

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
// =======================================
// Part 4
// Send Button + Theme + Startup
// =======================================


// -------------------------------
// Send Message
// -------------------------------

async function sendMessage() {

    const text = input.value.trim();

    // Don't send if both text and image are empty
    if (!text && !selectedImage) return;

    // Show user's message
    if (text || selectedImage) {

        const message = document.createElement("div");
        message.className = "message user";

        // If image exists, show it immediately
        if (selectedImage) {

            const img = document.createElement("img");

            img.src = selectedImage;
            img.className = "chat-image";

            img.style.marginBottom = text ? "10px" : "0";

            message.appendChild(img);

        }

        // If text exists, show text below image
        if (text) {

            const content = document.createElement("div");

            content.className = "message-content";
            content.innerHTML = marked.parse(text);

            message.appendChild(content);

        }

        chat.appendChild(message);
        chat.scrollTop = chat.scrollHeight;

        await saveMessage(
            text || "[Image]",
            "user"
        );

    }
    // Remove preview after moving image into chat
    selectedImage = null;

    imageUpload.value = "";

    imagePreview.innerHTML = "";

    imagePreview.style.display = "none";

  

    input.value = "";

    await aiReply(text);

}



// -------------------------------
// Send Button
// -------------------------------

send.addEventListener(

    "click",

    sendMessage

);



// -------------------------------
// Enter Key
// -------------------------------

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



// -------------------------------
// Theme Toggle
// -------------------------------

if (themeToggle) {

    document.body.classList.add("dark");

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



// -------------------------------
// Auto Focus
// -------------------------------

window.addEventListener(

    "load",

    () => {

        setTimeout(() => {

            input.focus();

        }, 300);

    }

);




// =======================================
// End
// =======================================