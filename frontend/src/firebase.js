import { initializeApp } from "firebase/app"
import { getAuth, GoogleAuthProvider, signInWithPopup, signOut } from "firebase/auth"

const firebaseConfig = {
  apiKey: "AIzaSyCyRuu02SjnW-A3em2P6O_9zUV0WFyqe1I",
  authDomain: "rags-ai-5b9d7.firebaseapp.com",
  projectId: "rags-ai-5b9d7",
  storageBucket: "rags-ai-5b9d7.firebasestorage.app",
  messagingSenderId: "772855870173",
  appId: "1:772855870173:web:ff1e9d5ed5df3065d46134"
}

const app = initializeApp(firebaseConfig)
export const auth = getAuth(app)
export const googleProvider = new GoogleAuthProvider()

export const signInWithGoogle = () => signInWithPopup(auth, googleProvider)
export const logOut = () => signOut(auth)
