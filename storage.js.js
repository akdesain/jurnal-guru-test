import { storage } from "./firebase.js";
import { ref, uploadBytes, getDownloadURL } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-storage.js";

// Upload Foto PBM ke Firebase Storage dan kembalikan URL publiknya
export async function uploadPBMPhoto(file, userId) {
  if (!file) return "";
  try {
    const timestamp = Date.now();
    const filePath = `pbm_photos/${userId}/${timestamp}_${file.name}`;
    const storageRef = ref(storage, filePath);
    
    // Upload file
    const snapshot = await uploadBytes(storageRef, file);
    // Ambil Download URL
    const downloadURL = await getDownloadURL(snapshot.ref);
    return downloadURL;
  } catch (error) {
    console.error("Gagal mengunggah foto PBM:", error);
    throw new Error("Gagal mengunggah foto PBM ke server.");
  }
}