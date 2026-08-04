// =======================================
// Cadence AI
// Script.js
// Part 1
// =======================================

const greetings = [
    "Hello! Buddy",
    "Welcome Hero!",
    "Wanna know something? Just type",
    "Breakup? I'm here for you",
    "Let's create something!",
    "What are we building today?",
    "You are great!!",
    "Bored? Let's Chit-Chat",
    "Coding?",
    "Want a joke? just ask",
    "Let's make something awesome!",
    "Hey there! How can I assist you today?",
    "Greetings! Ready to explore?",
    "Hi! Let's get started.",
    "Welcome back! What can I do for you?",
    "Hello! Let's create something amazing.",
    "Hey! Need any help?",
    "Hi there! Let's dive in.",
    "Welcome! Let's make magic happen.",
    "Hello! Ready to innovate?",
    "Tips for one-sided love? Just ask"

];

const randomGreeting =
    greetings[Math.floor(Math.random() * greetings.length)];

document.getElementById("greeting").innerText = randomGreeting;

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
const attachBtn = document.getElementById("attach");
const voiceBtn = document.getElementById("voice");


let currentUserId = null;

let selectedImage = null;

// ===============================
// Voice Input
// ===============================

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

            recognition.start();

            voiceBtn.style.transform = "scale(1.1)";

        });



        recognition.onresult = (event) => {

            const speechText =
                event.results[0][0].transcript;


            input.value += speechText;

        };



        recognition.onend = () => {

            voiceBtn.style.transform = "scale(1)";

        };



        recognition.onerror = (event) => {

            console.error(
                "Voice error:",
                event.error
            );

        };


    }

    else {

        voiceBtn.style.display = "none";

        console.log(
            "Speech recognition not supported"
        );

    }

}
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


        } catch (err) {

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


    chat.scrollTo({

        top: chat.scrollHeight,

        behavior: "smooth"

    });


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


if (attachBtn && imageUpload) {

    const attachMenu = document.getElementById("attachMenu");

    attachBtn.addEventListener("click", () => {

        attachMenu.classList.toggle("show");

    });

}
const attachMenu = document.getElementById("attachMenu");

const pickImage = document.getElementById("pickImage");
const pickCamera = document.getElementById("pickCamera");
const pickDocument = document.getElementById("pickDocument");

const cameraUpload = document.getElementById("cameraUpload");
const documentUpload = document.getElementById("documentUpload");


pickImage.addEventListener("click", function (e) {
    e.preventDefault();
    imageUpload.click();
});

pickCamera.addEventListener("click", function (e) {
    e.preventDefault();
    cameraUpload.click();
});

pickDocument.addEventListener("click", function (e) {
    e.preventDefault();
    documentUpload.click();
});


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
// Cadence AI
// Script.js
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



            const photo =

                document.getElementById("userPhoto");



            if (photo) {


                photo.src =

                    user.photoURL || "";


            }



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
// Cadence AI
// Script.js
// Part 3
// AI Communication
// =======================================


async function aiReply(text, image) {

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

    chat.scrollTo({
        top: chat.scrollHeight,
        behavior: "smooth"
    });


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
        // Keep Last 15 Messages
        // -----------------------------

        const recentHistory = history.slice(-15);



        // Add current user message

        recentHistory.push({

            role: "user",

            content: text || "[Image]"

        });



        // -----------------------------
        // Backend Request
        // -----------------------------

        console.log(
            "Sending image:",
            image ? "YES" : "NO"
        );


        const response = await fetch(

            "https://cadence-ai-backend.cadenceaofficial-ai.workers.dev",

            {

                method: "POST",

                headers: {

                    "Content-Type": "application/json"

                },


                body: JSON.stringify({

                    history: recentHistory,

                    image: image

                })


            }

        );



        const data = await response.json();


        console.log(
            "Backend Response:",
            data
        );



        typing.remove();



        if (!response.ok) {


            addMessage(

                data.error ||
                "Backend Error",

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
        // Handle JSON Replies
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

            catch {

                // Normal text reply

            }


        }





        // -----------------------------
        // Create AI Message Bubble
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
        // Clear Image
        // -----------------------------

        selectedImage = null;


        imageUpload.value = "";


        imagePreview.innerHTML = "";


        imagePreview.style.display = "none";



    }



    catch (err) {


        typing.remove();



        console.error(

            "AI Error:",
            err

        );



        addMessage(

            "Sorry, I couldn't connect to my AI brain.",

            "ai"

        );


    }


}
// =======================================
// Cadence AI
// Script.js
// Part 4
// Send Button + Theme + Startup
// =======================================


// -------------------------------
// Send Message
// -------------------------------

async function sendMessage() {


    const text = input.value.trim();


    const imageToSend = selectedImage;



    // Don't send empty message

    if (!text && !imageToSend) return;




    // -------------------------------
    // Show User Message
    // -------------------------------

    const message = document.createElement("div");


    message.className = "message user";



    // Show Image

    if (imageToSend) {


        const img = document.createElement("img");


        img.src = imageToSend;


        img.className = "chat-image";



        if (text) {

            img.style.marginBottom = "10px";

        }



        message.appendChild(img);


    }




    // Show Text

    if (text) {


        const content = document.createElement("div");


        content.className = "message-content";


        content.innerHTML = marked.parse(text);



        message.appendChild(content);


    }




    chat.appendChild(message);



    chat.scrollTo({

        top: chat.scrollHeight,

        behavior: "smooth"

    });





    await saveMessage(

        text || "[Image]",

        "user"

    );





    // -------------------------------
    // Clear Input + Preview
    // -------------------------------


    selectedImage = null;


    imageUpload.value = "";


    imagePreview.innerHTML = "";


    imagePreview.style.display = "none";



    input.value = "";





    // Send to AI

    await aiReply(

        text,

        imageToSend

    );


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


        setTimeout(

            () => {


                input.focus();



            },

            300

        );


    }

);




// =======================================
// End
// =======================================