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
const themeToggle = document.getElementById("themeToggle");


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
                name: user.displayName || "User",
                email: user.email,
                photo: user.photoURL || "",
                createdAt: serverTimestamp()
            },
            {
                merge: true
            }
        );


        currentUserId = user.uid;

        welcome.style.display = "none";


        addMessage(
            `Welcome ${user.displayName || "User"}! 👋 How can I help you?`,
            "ai"
        );


        loadOldChats();


    }

    catch (error) {

        console.error(
            "Google login error:",
            error
        );

    }

});


async function typeMessage(element, text) {

    element.innerHTML = "";

    let index = 0;

    while (index < text.length) {

        element.innerHTML = marked.parse(
            text.substring(0, index)
        );

        index++;

        chat.scrollTop = chat.scrollHeight;

        await new Promise(resolve =>
            setTimeout(resolve, 10)
        );

    }


    renderMathInElement(element, {

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

// Add message

function addMessage(text, type) {

    if (!text) return;


    const message =
        document.createElement("div");


    message.classList.add(
        "message",
        type
    );


    const content =
        document.createElement("div");


    content.classList.add("message-content");


    content.innerHTML =
        marked.parse(text);


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


    message.appendChild(content);



    // Copy button only for AI messages
    {

        const copyBtn =
            document.createElement("button");


        copyBtn.classList.add("copy-btn");

        copyBtn.innerText = "📋 Copy";


        copyBtn.onclick = async () => {

            await navigator.clipboard.writeText(reply);

            copyBtn.innerText = "✅ Copied";


            setTimeout(() => {

                copyBtn.innerText = "📋 Copy";

            }, 1500);

        };


        message.appendChild(copyBtn);

    }



    chat.appendChild(message);


    chat.scrollTop =
        chat.scrollHeight;

}



// Save chat

async function saveMessage(text, sender) {


    if (!currentUserId) return;


    if (!text) {

        console.error(
            "Blocked empty message:",
            text
        );

        return;

    }


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





// AI Response

async function aiReply(userPrompt) {


    const typing =
        document.createElement("div");


    typing.classList.add(
        "message",
        "ai"
    );


    typing.innerHTML = `
    <div class="typing">
        <span></span>
        <span></span>
        <span></span>
    </div>`;


    chat.appendChild(typing);


    try {


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


        const history = [];

        snapshot.forEach((doc) => {

            const data = doc.data();

            if (data.text) {

                history.push({

                    role:
                        data.sender === "ai"
                            ?
                            "model"
                            :
                            "user",

                    content: data.text

                });

            }

        });


        // Only send recent conversation to AI
        const recentHistory = history.slice(-15);


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

                        prompt: userPrompt,

                        history: recentHistory

                    })

                });



        const data =
            await response.json();



        console.log(
            "Backend response:",
            data
        );



        typing.remove();



        if (!data.reply) {


            console.error(
                "Backend did not return reply:",
                data
            );


            addMessage(
                "AI server error. Check backend console.",
                "ai"
            );


            return;

        }



        let reply = data.reply;



        // Handle accidental JSON response

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



        const message = document.createElement("div");

        message.classList.add(
            "message",
            "ai"
        );
        // Add copy button for AI messages
        if (type === "ai") {

            const copyBtn = document.createElement("button");

            copyBtn.className = "copy-btn";

            copyBtn.innerHTML = `
        <svg viewBox="0 0 24 24">
            <path d="M9 9h10v10H9z"/>
            <path d="M5 15H4a1 1 0 0 1-1-1V4a1 1 0 0 1 1-1h10a1 1 0 0 1 1 1v1"/>
        </svg>
    `;

            copyBtn.onclick = () => {

                navigator.clipboard.writeText(text);

                copyBtn.innerHTML = "✓";

                setTimeout(() => {
                    copyBtn.innerHTML = `
            <svg viewBox="0 0 24 24">
                <path d="M9 9h10v10H9z"/>
                <path d="M5 15H4a1 1 0 0 1-1-1V4a1 1 0 0 1 1-1h10a1 1 0 0 1 1 1v1"/>
            </svg>`;
                }, 1500);

            };

            message.appendChild(copyBtn);

        }


        chat.appendChild(message);


        await typeMessage(
            message,
            reply
        );


        await saveMessage(
            reply,
            "ai"
        );


    }


    catch (error) {


        typing.remove();


        console.error(
            "AI ERROR:",
            error
        );


        addMessage(
            "Sorry, I couldn't connect to my AI brain.",
            "ai"
        );

    }


}





// Send message

async function sendMessage() {


    const text =
        input.value.trim();


    if (!text) return;


    addMessage(
        text,
        "user"
    );


    input.value = "";


    await saveMessage(
        text,
        "user"
    );


    await aiReply(text);


}





// Load chats

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



    chat.innerHTML = "";


    snapshot.forEach((doc) => {


        const data =
            doc.data();



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


    });






// Auth state

onAuthStateChanged(
    auth,
    (user) => {


        if (user) {


            console.log(
                "Logged in:",
                user.email
            );


            currentUserId = user.uid;


            const userPhoto =
                document.getElementById("userPhoto");


            if (userPhoto && user.photoURL) {

                userPhoto.src =
                    user.photoURL;

            }


            welcome.style.display = "none";


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

if (themeToggle) {

    themeToggle.addEventListener(
        "click",
        () => {


            document.body.classList.toggle(
                "dark"
            );


            themeToggle.innerText =
                document.body.classList.contains("dark")
                    ?
                    "☀️"
                    :
                    "🌙";


        });

}




// Auto focus

window.addEventListener(
    "load",
    () => {

        setTimeout(
            () => {

                input.focus();

            }, 500);

    });