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


// Your Start Chatting button code below
const welcome = document.getElementById("welcome");
const chat = document.getElementById("chat");
const input = document.getElementById("prompt");
const send = document.getElementById("send");
let currentUserId = null;
const googleLogin = document.getElementById("googleLogin");


googleLogin.addEventListener(
    "click",
    async () => {

        try {

            const result = await signInWithPopup(
                auth,
                googleProvider
            );


            const user = result.user;


            console.log("Logged in user:", user);



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


            saveMessage(
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
// Add message to chat
function addMessage(text, type) {

    const message = document.createElement("div");

    message.classList.add(
        "message",
        type
    );

    message.innerText = text;

    chat.appendChild(message);


    // Auto scroll
    chat.scrollTop = chat.scrollHeight;

}
// Save chat message to Firestore
async function saveMessage(text, sender) {

    if (!currentUserId) return;


    await addDoc(
        collection(db, "Users", currentUserId, "Chats"),
        {
            text: text,
            sender: sender,
            time: serverTimestamp()
        }
    );

}



// Fake AI response (temporary)

function aiReply() {

    const replies = [

        "Hello! I am Cadence AI. How can I assist you today?",

        "I'm still learning, but my intelligence module is improving.",

        "That's an interesting question. Let me think about it.",

        "I can help you with coding, ideas, research, and daily tasks.",

        "Soon I will be connected to a real AI model."
    ];


    const random =
        replies[Math.floor(Math.random() * replies.length)];


    // Thinking animation

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



    setTimeout(() => {

        typing.remove();

        addMessage(
            random,
            "ai"
        );

        saveMessage(random, "ai");
    }, 1200);


}



// Send message

function sendMessage() {

    const text = input.value.trim();


    if (text === "") return;


    addMessage(
        text,
        "user"
    );
    saveMessage(text, "user");


    input.value = "";


    aiReply();

}
async function loadOldChats() {

    console.log("Loading chats for:", currentUserId);

    if (!currentUserId) return;


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


    snapshot.forEach((doc) => {

        const data = doc.data();


        addMessage(
            data.text,
            data.sender
        );

    });

}



// Button click

send.addEventListener(
    "click",
    sendMessage
);



// Enter key

input.addEventListener(
    "keydown",
    function (e) {

        if (e.key === "Enter" && !e.shiftKey) {

            e.preventDefault();

            sendMessage();

        }

    }
);
onAuthStateChanged(auth, (user) => {


    if (user) {

        console.log("User already logged in:", user.email);


        welcome.style.display = "none";


        currentUserId = user.uid;


        loadOldChats();

    }

    else {

        console.log("No user logged in");

        welcome.style.display = "flex";

    }


});