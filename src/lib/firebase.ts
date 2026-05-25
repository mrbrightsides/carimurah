import { initializeApp } from 'firebase/app';
import { getAuth, GoogleAuthProvider, signInWithPopup, onAuthStateChanged, signOut, User } from 'firebase/auth';
import { getFirestore, doc, getDoc, setDoc, collection, addDoc, query, orderBy, getDocs, limit, deleteDoc } from 'firebase/firestore';
import firebaseConfig from '../../firebase-applet-config.json';
import { UserProfile, HistoryItem } from '../types';

const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);
export const db = getFirestore(app, firebaseConfig.firestoreDatabaseId);

const googleProvider = new GoogleAuthProvider();

enum OperationType {
  CREATE = 'create',
  UPDATE = 'update',
  DELETE = 'delete',
  LIST = 'list',
  GET = 'get',
  WRITE = 'write',
}

interface FirestoreErrorInfo {
  error: string;
  operationType: OperationType;
  path: string | null;
  authInfo: {
    userId?: string | null;
    email?: string | null;
    emailVerified?: boolean | null;
    isAnonymous?: boolean | null;
    providerInfo?: {
      providerId?: string | null;
      email?: string | null;
    }[];
  }
}

function handleFirestoreError(error: unknown, operationType: OperationType, path: string | null) {
  const errInfo: FirestoreErrorInfo = {
    error: error instanceof Error ? error.message : String(error),
    authInfo: {
      userId: auth.currentUser?.uid,
      email: auth.currentUser?.email,
      emailVerified: auth.currentUser?.emailVerified,
      isAnonymous: auth.currentUser?.isAnonymous,
      providerInfo: auth.currentUser?.providerData?.map(provider => ({
        providerId: provider.providerId,
        email: provider.email,
      })) || []
    },
    operationType,
    path
  };
  console.error('Firestore Error: ', JSON.stringify(errInfo));
  throw new Error(JSON.stringify(errInfo));
}

export const loginWithGoogle = async () => {
  try {
    const result = await signInWithPopup(auth, googleProvider);
    const user = result.user;
    
    // Sync profile
    const userRef = doc(db, 'users', user.uid);
    const userSnap = await getDoc(userRef);
    
    const isNewUser = !userSnap.exists();
    if (isNewUser) {
      const profile: UserProfile = {
        uid: user.uid,
        displayName: user.displayName,
        email: user.email,
        photoURL: user.photoURL,
        subscription: {
          tier: "FREE"
        },
        preferences: {
          currency: 'IDR',
          language: 'id',
          notifyOnBetterPrices: true,
          b2bFocus: 'price',
          showTrendChartsByDefault: true
        }
      };
      await setDoc(userRef, profile);
    }

    if (typeof window !== "undefined" && window.pendo) {
      window.pendo.track("user_login_completed", {
        auth_provider: "google",
        is_new_user: isNewUser,
        default_tier: "FREE",
        default_currency: "IDR",
        default_language: "id"
      });
    }

    return user;
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, 'users');
    throw error;
  }
};

export const logout = () => signOut(auth);

export const updateProfile = async (userId: string, data: Partial<UserProfile>) => {
  try {
    const userRef = doc(db, 'users', userId);
    await setDoc(userRef, data, { merge: true });
  } catch (error) {
    handleFirestoreError(error, OperationType.UPDATE, `users/${userId}`);
  }
};

export const getUserProfile = async (userId: string) => {
  try {
    const userRef = doc(db, 'users', userId);
    const snap = await getDoc(userRef);
    return snap.data() as UserProfile | null;
  } catch (error) {
    handleFirestoreError(error, OperationType.GET, `users/${userId}`);
    return null;
  }
};

export const saveHistory = async (userId: string, item: Omit<HistoryItem, 'id'>) => {
  try {
    const historyRef = collection(db, 'users', userId, 'history');
    await addDoc(historyRef, item);
  } catch (error) {
    handleFirestoreError(error, OperationType.CREATE, `users/${userId}/history`);
  }
};

export const getHistory = async (userId: string) => {
  try {
    const historyRef = collection(db, 'users', userId, 'history');
    const q = query(historyRef, orderBy('date', 'desc'), limit(20));
    const snap = await getDocs(q);
    return snap.docs.map(doc => ({ id: doc.id, ...doc.data() } as HistoryItem));
  } catch (error) {
    handleFirestoreError(error, OperationType.LIST, `users/${userId}/history`);
    return [];
  }
};

export const deleteHistoryItems = async (userId: string, ids: string[]) => {
  try {
    const promises = ids.map(id => {
      const docRef = doc(db, 'users', userId, 'history', id);
      return deleteDoc(docRef);
    });
    await Promise.all(promises);
  } catch (error) {
    handleFirestoreError(error, OperationType.DELETE, `users/${userId}/history`);
  }
};

export const updateHistoryItem = async (userId: string, historyId: string, data: Partial<HistoryItem>) => {
  try {
    const docRef = doc(db, 'users', userId, 'history', historyId);
    await setDoc(docRef, data, { merge: true });
  } catch (error) {
    handleFirestoreError(error, OperationType.UPDATE, `users/${userId}/history/${historyId}`);
  }
};
