// إعدادات Firebase - برنامج أسامة الحداد
const firebaseConfig = {
  apiKey: "AIzaSyBW3AYK9gOd39ExA3ZRFXQdg1cRN1DEClE",
  authDomain: "osama-university.firebaseapp.com",
  projectId: "osama-university",
  storageBucket: "osama-university.firebasestorage.app",
  messagingSenderId: "469713882154",
  appId: "1:469713882154:web:fb2fce4eb455c599270753"
};

if (!firebase.apps.length) {
  firebase.initializeApp(firebaseConfig);
}

window.firebaseAuth = firebase.auth();
window.firebaseDb = firebase.firestore();
window.firebaseStorage = firebase.storage();
window.ADMIN_EMAIL = "alhadadasamt79@gmail.com";
window.googleProvider = new firebase.auth.GoogleAuthProvider();

// تسجيل الدخول يستمر بعد إغلاق التطبيق على الجهاز.
window.firebaseAuth.setPersistence(firebase.auth.Auth.Persistence.LOCAL)
  .catch(error => console.error("Firebase persistence:", error));
