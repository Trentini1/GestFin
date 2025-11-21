import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js";
import { getAuth } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";
import { getFirestore } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";

const firebaseConfig = {
    apiKey: "AIzaSyAHq-utRHf-rDVJ9YtNdD8PCIRvboGqLuI", // Substitua se necessário
    authDomain: "gestor-pro-51706.firebaseapp.com",
    projectId: "gestor-pro-51706",
    storageBucket: "gestor-pro-51706.appspot.com",
    messagingSenderId: "519113320151",
    appId: "1:519113320151:web:d22638842180572b9338fd"
};

const app = initializeApp(firebaseConfig);

export const auth = getAuth(app);
export const db = getFirestore(app);
