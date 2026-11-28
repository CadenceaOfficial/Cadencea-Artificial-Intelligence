const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const { after, before, beforeEach, test } = require("node:test");
const {
  assertFails,
  assertSucceeds,
  initializeTestEnvironment,
} = require("@firebase/rules-unit-testing");
const { doc, getDoc, serverTimestamp, setDoc, updateDoc } = require("firebase/firestore");

const projectId = "demo-cadence-security";
let testEnv;

before(async () => {
  testEnv = await initializeTestEnvironment({
    projectId,
    firestore: {
      rules: fs.readFileSync(path.join(__dirname, "..", "firestore.rules"), "utf8"),
    },
  });
});

beforeEach(async () => {
  await testEnv.clearFirestore();
});

after(async () => {
  await testEnv?.cleanup();
});

function profileData(extraFields = {}) {
  return {
    name: "Alice",
    email: "alice@example.com",
    photo: "https://example.com/alice.png",
    lastSeenAt: serverTimestamp(),
    ...extraFields,
  };
}

test("users can create and update only their own validated profile", async () => {
  const alice = testEnv.authenticatedContext("alice").firestore();
  const bob = testEnv.authenticatedContext("bob").firestore();
  const aliceRef = doc(alice, "Users", "alice");

  await assertSucceeds(setDoc(aliceRef, profileData()));
  await assertSucceeds(updateDoc(aliceRef, profileData()));
  await assertFails(getDoc(doc(bob, "Users", "alice")));
  await assertFails(setDoc(doc(alice, "Users", "bob"), profileData()));
  await assertFails(updateDoc(aliceRef, { isAdmin: true }));
  await assertFails(setDoc(doc(alice, "Users", "alice"), profileData({ role: "admin" })));
});

test("chat messages are owner-only, size-limited, and immutable except for a short title", async () => {
  const alice = testEnv.authenticatedContext("alice").firestore();
  const bob = testEnv.authenticatedContext("bob").firestore();
  const messageRef = doc(alice, "Users", "alice", "Chats", "chat-a--message--1");

  await assertSucceeds(setDoc(messageRef, {
    text: "Hello",
    sender: "user",
    time: serverTimestamp(),
  }));
  await assertSucceeds(updateDoc(messageRef, { chatTitle: "A short chat title" }));
  await assertFails(updateDoc(messageRef, { text: "Tampered message" }));
  await assertFails(updateDoc(messageRef, { chatTitle: "x".repeat(45) }));
  await assertFails(setDoc(doc(alice, "Users", "bob", "Chats", "chat-a--message--2"), {
    text: "Cross-user write",
    sender: "user",
    time: serverTimestamp(),
  }));
  await assertFails(getDoc(doc(bob, "Users", "alice", "Chats", "chat-a--message--1")));
  await assertFails(setDoc(doc(alice, "Users", "alice", "Chats", "chat-a--message--large"), {
    text: "x".repeat(24_001),
    sender: "user",
    time: serverTimestamp(),
  }));
});

test("unauthenticated clients cannot read or write user data", async () => {
  const unauthenticated = testEnv.unauthenticatedContext().firestore();

  await assertFails(getDoc(doc(unauthenticated, "Users", "alice")));
  await assertFails(setDoc(doc(unauthenticated, "Users", "alice"), profileData()));
});
