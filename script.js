// Firebase imports
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


// Elements
const welcome = document.getElementById("welcome");
const chat = document.getElementById("chat");
const input = document.getElementById("prompt");
const send = document.getElementById("send");
const googleLogin = document.getElementById("googleLogin");


let currentUserId = null;



// Google Login

googleLogin.addEventListener("click", async () => {

    try {

        const result = await signInWithPopup(
            auth,
            googleProvider
        );

        const user = result.user;
        const userPhoto = document.getElementById("userPhoto");

        if (userPhoto && user.photoURL) {

            userPhoto.src = user.photoURL;

        }


        await setDoc(
            doc(db, "Users", user.uid),
            {
                name: user.displayName,
                email: user.email,
                photo: user.photoURL,
                createdAt: serverTimestamp()
            },
            {
                merge: true
            }
        );


        currentUserId = user.uid;


        welcome.style.display = "none";


        addMessage(
            `Welcome ${user.displayName}! 👋 How can I help you?`,
            "ai"
        );


    }

    catch (error) {

        console.error(
            "Google login error:",
            error
        );

    }

});




// Add message

function addMessage(text, type) {

    const message = document.createElement("div");


    message.classList.add(
        "message",
        type
    );


    message.innerText = text;


    chat.appendChild(message);


    chat.scrollTop = chat.scrollHeight;

}




// Save chat

async function saveMessage(text, sender) {

    if (!currentUserId) return;


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





// REAL AI RESPONSE

async function aiReply(userPrompt) {


    const typing = document.createElement("div");


    typing.classList.add(
        "message",
        "ai"
    );


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


        const response = await fetch(

            "https://cadence-ai-backend.cadenceaofficial-ai.workers.dev",

            {

                method: "POST",

                headers: {
                    "Content-Type": "application/json"
                },

                body: JSON.stringify({
                    prompt: userPrompt
                })

            }

        );



        const data = await response.json();



        typing.remove();



        let reply = data.reply;



        // If Gemini returns JSON accidentally
        try {

            const parsed = JSON.parse(reply);

            reply =
                parsed.candidates?.[0]
                    ?.content
                    ?.parts?.[0]
                    ?.text || reply;

        }

        catch (e) { }




        addMessage(
            reply,
            "ai"
        );


        saveMessage(
            reply,
            "ai"
        );


    }


    catch (error) {


        typing.remove();


        addMessage(
            "Sorry, I couldn't connect to my AI brain.",
            "ai"
        );


        console.error(error);

    }


}





// Send message

function sendMessage() {


    const text = input.value.trim();


    if (text === "") return;



    addMessage(
        text,
        "user"
    );


    saveMessage(
        text,
        "user"
    );



    input.value = "";


    aiReply(text);


}





// Load old chats

async function loadOldChats() {


    if (!currentUserId) return;



    const chatsRef =
        collection(
            db,
            "Users",
            currentUserId,
            "Chats"
        );



    const q =
        query(
            chatsRef,
            orderBy("time")
        );



    const snapshot =
        await getDocs(q);



    snapshot.forEach((doc) => {


        const data = doc.data();


        addMessage(
            data.text,
            data.sender
        );


    });


}





// Buttons

send.addEventListener(
    "click",
    sendMessage
);



input.addEventListener(
    "keydown",
    (e) => {


        if (
            e.key === "Enter"
            &&
            !e.shiftKey
        ) {

            e.preventDefault();

            sendMessage();

        }


    }
);






// Auth state

onAuthStateChanged(
    auth,
    (user) => {


        if (user) {


            console.log(
                "Logged in:",
                user.email
            );


            const userPhoto = document.getElementById("userPhoto");

if (userPhoto && user.photoURL) {

    userPhoto.src = user.photoURL;

}


welcome.style.display = "none";


currentUserId = user.uid;


loadOldChats();


        }


        else {


            console.log(
                "No user logged in"
            );


            welcome.style.display = "flex";


        }


    });
// Theme Toggle

const themeToggle = document.getElementById("themeToggle");

themeToggle.addEventListener("click", () => {

    document.body.classList.toggle("dark");

    // Change icon
    if (document.body.classList.contains("dark")) {
        themeToggle.innerText = "☀️";
    } else {
        themeToggle.innerText = "🌙";
    }

});
// Auto focus message box when app opens
window.addEventListener("load", () => {

    setTimeout(() => {
        input.focus();
    }, 500);

});