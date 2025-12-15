// Firebase configuration
const firebaseConfig = {
    apiKey: "AIzaSyBnoRKM4O3cOJZ1h00lswW_Tlwx2-dK2Cs",
    authDomain: "my-purchases-management-sys.firebaseapp.com",
    databaseURL: "https://my-purchases-management-sys-default-rtdb.firebaseio.com",
    projectId: "my-purchases-management-sys",
    storageBucket: "my-purchases-management-sys.firebasestorage.app",
    messagingSenderId: "600436658804",
    appId: "1:600436658804:web:930c5699d0f5bdcb95b721"
  };
  
// Initialize Firebase
firebase.initializeApp(firebaseConfig);

// Initialize services
const auth = firebase.auth();
const database = firebase.database();

// Set persistence to local so user stays logged in
auth.setPersistence(firebase.auth.Auth.Persistence.LOCAL)
    .catch(error => {
        console.error("Error setting auth persistence:", error);
    });