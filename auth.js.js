import { auth, db } from "./firebase.js";
import { 
  signInWithEmailAndPassword, 
  createUserWithEmailAndPassword, 
  signOut, 
  onAuthStateChanged 
} from "https://www.gstatic.com/firebasejs/10.8.0/firebase-auth.js";
import { 
  doc, 
  setDoc, 
  getDoc, 
  updateDoc 
} from "https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js";

export let currentUser = null;
export let profile = {
  name: "",
  nip: "",
  school: "",
  email: "",
  signature: ""
};

// Inisialisasi Auth State Listener
export function initAuthListener(onLoginCallback, onLogoutCallback) {
  onAuthStateChanged(auth, async (user) => {
    if (user) {
      currentUser = user;
      await loadTeacherProfile(user.uid);
      if (typeof onLoginCallback === 'function') onLoginCallback(user);
    } else {
      currentUser = null;
      if (typeof onLogoutCallback === 'function') onLogoutCallback();
    }
  });
}

// Fungsi Login
export async function handleLogin(email, password) {
  try {
    const userCredential = await signInWithEmailAndPassword(auth, email, password);
    return userCredential.user;
  } catch (error) {
    throw new Error(getFriendlyAuthError(error.code));
  }
}

// Fungsi Register
export async function handleRegister(email, password, additionalData) {
  try {
    const userCredential = await createUserWithEmailAndPassword(auth, email, password);
    const user = userCredential.user;

    // Buat document baru pada collection 'teachers'
    await setDoc(doc(db, "teachers", user.uid), {
      uid: user.uid,
      nama: additionalData.name || "",
      nip: additionalData.nip || "",
      email: email,
      sekolah: additionalData.school || "",
      role: additionalData.role || "Guru",
      createdAt: new Date().toISOString()
    });

    return user;
  } catch (error) {
    throw new Error(getFriendlyAuthError(error.code));
  }
}

// Fungsi Logout
export async function handleLogout() {
  try {
    await signOut(auth);
  } catch (error) {
    console.error("Gagal logout:", error);
  }
}

// Ambil profil guru dari Firestore
async function loadTeacherProfile(uid) {
  try {
    const docRef = doc(db, "teachers", uid);
    const docSnap = await getDoc(docRef);
    if (docSnap.exists()) {
      const data = docSnap.data();
      profile.name = data.nama || "";
      profile.nip = data.nip || "";
      profile.school = data.sekolah || "";
      profile.email = data.email || "";
      profile.signature = data.signature || "";
    }
  } catch (error) {
    console.error("Gagal memuat profil:", error);
  }
}

// Simpan/Perbarui Pengaturan Profil Guru
export async function saveProfileSettings(newProfileData) {
  if (!currentUser) return;
  try {
    const docRef = doc(db, "teachers", currentUser.uid);
    await updateDoc(docRef, {
      nama: newProfileData.name,
      nip: newProfileData.nip,
      sekolah: newProfileData.school,
      signature: newProfileData.signature || ""
    });
    profile = { ...profile, ...newProfileData };
  } catch (error) {
    console.error("Gagal menyimpan profil:", error);
    throw error;
  }
}

// Terjemahan Pesan Error Firebase Auth
function getFriendlyAuthError(code) {
  switch (code) {
    case 'auth/invalid-email':
      return 'Format email tidak valid.';
    case 'auth/user-not-found':
    case 'auth/wrong-password':
    case 'auth/invalid-credential':
      return 'Email atau password salah.';
    case 'auth/email-already-in-use':
      return 'Email sudah terdaftar.';
    case 'auth/weak-password':
      return 'Password terlalu lemah (minimal 6 karakter).';
    default:
      return 'Terjadi kesalahan autentikasi. Silakan coba lagi.';
  }
}