import {
  collection,
  doc,
  getDocs,
  orderBy,
  query,
  setDoc,
  deleteDoc,
} from "firebase/firestore";
import type { User } from "firebase/auth";
import { db } from "./firebase";
import { handleFirestoreError, OperationType } from "./firestore-errors";
import type { ConversationDto, UiMessage } from "./types";

/**
 * Salva o aggiorna il profilo utente su Firestore
 */
export async function syncUserProfile(user: User): Promise<void> {
  const path = `users/${user.uid}`;
  try {
    const userRef = doc(db, "users", user.uid);
    await setDoc(
      userRef,
      {
        uid: user.uid,
        email: user.email ?? "",
        displayName: user.displayName ?? "",
        createdAt: new Date().toISOString(),
      },
      { merge: true },
    );
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, path);
  }
}

/**
 * Salva una conversazione su Firestore
 */
export async function syncConversation(
  userId: string,
  conv: ConversationDto,
): Promise<void> {
  const path = `users/${userId}/conversations/${conv.id}`;
  try {
    const convRef = doc(db, "users", userId, "conversations", conv.id);
    await setDoc(
      convRef,
      {
        id: conv.id,
        userId,
        title: conv.title,
        createdAt: new Date(conv.createdAt).toISOString(),
        updatedAt: new Date(conv.updatedAt).toISOString(),
      },
      { merge: true },
    );
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, path);
  }
}

/**
 * Elimina una conversazione da Firestore
 */
export async function deleteConversationFromFirestore(
  userId: string,
  convId: string,
): Promise<void> {
  const path = `users/${userId}/conversations/${convId}`;
  try {
    const convRef = doc(db, "users", userId, "conversations", convId);
    await deleteDoc(convRef);
  } catch (error) {
    handleFirestoreError(error, OperationType.DELETE, path);
  }
}

/**
 * Salva un messaggio su Firestore
 */
export async function syncMessage(
  userId: string,
  convId: string,
  msg: UiMessage,
): Promise<void> {
  const path = `users/${userId}/conversations/${convId}/messages/${msg.id}`;
  try {
    const msgRef = doc(db, "users", userId, "conversations", convId, "messages", msg.id);
    await setDoc(
      msgRef,
      {
        id: msg.id,
        conversationId: convId,
        userId,
        role: msg.role,
        content: msg.content,
        status: msg.status ?? "complete",
        createdAt: new Date(msg.createdAt).toISOString(),
      },
      { merge: true },
    );
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, path);
  }
}

/**
 * Carica tutte le conversazioni dell'utente da Firestore
 */
export async function fetchUserConversations(
  userId: string,
): Promise<ConversationDto[]> {
  const path = `users/${userId}/conversations`;
  try {
    const convsCol = collection(db, "users", userId, "conversations");
    const q = query(convsCol, orderBy("updatedAt", "desc"));
    const snapshot = await getDocs(q);
    return snapshot.docs.map((d) => {
      const data = d.data();
      return {
        id: data.id as string,
        title: data.title as string,
        createdAt: new Date(data.createdAt as string).getTime(),
        updatedAt: new Date(data.updatedAt as string).getTime(),
      };
    });
  } catch (error) {
    handleFirestoreError(error, OperationType.GET, path);
  }
}
