import { db } from "./firebase.js";
import { currentUser, profile } from "./auth.js";
import { uploadPBMPhoto } from "./storage.js";
import { 
  collection, 
  addDoc, 
  updateDoc, 
  deleteDoc, 
  doc, 
  query, 
  where, 
  onSnapshot 
} from "https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js";

export let journalEntries = [];
let unsubscribeJournals = null;

// Inisialisasi Realtime Listener Jurnal milik Guru yang sedang login
export function initJournalListener(onUpdateCallback) {
  if (!currentUser) return;
  
  if (unsubscribeJournals) unsubscribeJournals();

  const q = query(
    collection(db, "journals"), 
    where("teacherId", "==", currentUser.uid)
  );

  unsubscribeJournals = onSnapshot(q, (snapshot) => {
    journalEntries = snapshot.docs.map(docSnap => ({
      id: docSnap.id,
      ...docSnap.data()
    }));
    
    // Urutkan berdasarkan tanggal / createdAt desc
    journalEntries.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));

    if (typeof onUpdateCallback === 'function') {
      onUpdateCallback(journalEntries);
    }
  }, (error) => {
    console.error("Error mendengarkan data jurnal realtime:", error);
  });
}

// Simpan atau Perbarui Jurnal ke Firestore
export async function saveJournalEntry(entryData, filePhoto, editingId = null) {
  if (!currentUser) throw new Error("Pengguna belum login.");

  let photoUrl = entryData.photo || "";
  if (filePhoto) {
    photoUrl = await uploadPBMPhoto(filePhoto, currentUser.uid);
  }

  const payload = {
    teacherId: currentUser.uid,
    tanggal: entryData.date || new Date().toISOString().slice(0, 10),
    dayName: entryData.dayName || "SENIN",
    kelas: entryData.className || "",
    mataPelajaran: entryData.topic || "",
    kehadiran: {
      hadir: Number(entryData.present) || 0,
      sakit: Number(entryData.sick) || 0,
      izin: Number(entryData.permission) || 0,
      alpa: Number(entryData.absent) || 0
    },
    subMateri: entryData.submateri || "",
    metode: entryData.methods || [],
    kondisi: entryData.condition || "",
    catatan: entryData.notes || "",
    foto: photoUrl,
    createdAt: new Date().toISOString()
  };

  if (editingId) {
    // Update data yang sudah ada
    const docRef = doc(db, "journals", editingId);
    await updateDoc(docRef, payload);
  } else {
    // Tambah data baru
    await addDoc(collection(db, "journals"), payload);
  }
}

// Hapus Jurnal
export async function deleteJournalEntry(id) {
  try {
    await deleteDoc(doc(db, "journals", id));
  } catch (error) {
    console.error("Gagal menghapus jurnal:", error);
    throw error;
  }
}

// ==========================================
// INTEGRASI GOOGLE DRIVE & PDF GENERATION
// ==========================================

let gapiInited = false;
let gisInited = false;
let tokenClient = null;
const CLIENT_ID = 'ISI_GOOGLE_CLIENT_ID_ANDA.apps.googleusercontent.com'; // Masukkan Client ID Google Cloud Anda
const API_KEY = 'ISI_GOOGLE_API_KEY_ANDA'; // Masukkan Google API Key Anda
const DISCOVERY_DOC = 'https://www.googleapis.com/discovery/v1/apis/drive/v3/rest';
const SCOPES = 'https://www.googleapis.com/auth/drive.file';

export function initGoogleDriveAPI() {
  // Load GAPI script dynamically jika belum ada
  if (!window.gapi) {
    const script = document.createElement('script');
    script.src = 'https://apis.google.com/js/api.js';
    script.onload = () => gapiLoaded();
    document.body.appendChild(script);
  } else {
    gapiLoaded();
  }

  if (!window.google) {
    const scriptGIS = document.createElement('script');
    scriptGIS.src = 'https://accounts.google.com/gsi/client';
    scriptGIS.onload = () => gisLoaded();
    document.body.appendChild(scriptGIS);
  } else {
    gisLoaded();
  }
}

function gapiLoaded() {
  gapi.load('client', initializeGapiClient);
}

async function initializeGapiClient() {
  await gapi.client.init({
    apiKey: API_KEY,
    discoveryDocs: [DISCOVERY_DOC],
  });
  gapiInited = true;
}

function gisLoaded() {
  tokenClient = google.accounts.oauth2.initTokenClient({
    client_id: CLIENT_ID,
    scope: SCOPES,
    callback: '', // didefinisikan saat permintaan token
  });
  gisInited = true;
}

// Buat PDF dan Otomatis Upload ke Google Drive
export async function generatePDFAndUploadToDrive(type, onProgress, onSuccess, onError) {
  try {
    if (typeof onProgress === 'function') onProgress("Membuat dokumen PDF...");
    
    const { jsPDF } = window.jspdf;
    const docPdf = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4' });

    docPdf.setFontSize(16);
    docPdf.setFont('helvetica', 'bold');
    docPdf.text(`REKAP JURNAL MENGAJAR (${type.toUpperCase()})`, 14, 15);

    docPdf.setFontSize(10);
    docPdf.setFont('helvetica', 'normal');
    docPdf.text(`Guru Pengajar: ${profile.name} | NIP: ${profile.nip}`, 14, 22);
    docPdf.text(`Sekolah: ${profile.school}`, 14, 27);

    const tableRows = journalEntries.map((item) => {
      const hadir = item.kehadiran?.hadir || item.present || 0;
      const sakit = item.kehadiran?.sakit || item.sick || 0;
      const izin = item.kehadiran?.izin || item.permission || 0;
      const alpa = item.kehadiran?.alpa || item.absent || 0;
      const totalSiswa = hadir + sakit + izin + alpa;

      return [
        item.dayName || 'SENIN',
        item.tanggal || item.date,
        item.kelas || item.className,
        totalSiswa || 36,
        hadir,
        sakit,
        izin,
        alpa,
        item.mataPelajaran || item.topic || '-',
        item.kondisi || item.condition || '-',
        "", 
        ""  
      ];
    });

    docPdf.autoTable({
      startY: 32,
      head: [
        [
          { content: 'HARI', rowSpan: 2 },
          { content: 'TANGGAL', rowSpan: 2 },
          { content: 'KELAS', rowSpan: 2 },
          { content: 'JML SISWA', rowSpan: 2 },
          { content: 'KEHADIRAN', colSpan: 4 },
          { content: 'SUB MATERI', rowSpan: 2 },
          { content: 'KONDISI PBM', rowSpan: 2 },
          { content: 'PARAF GURU', rowSpan: 2 },
          { content: 'FOTO PBM', rowSpan: 2 }
        ],
        ['HADIR', 'SAKIT', 'IZIN', 'ALPA']
      ],
      body: tableRows,
      theme: 'grid',
      headStyles: { fillColor: [255, 255, 255], textColor: [0, 0, 0], fontStyle: 'bold', halign: 'center', lineWidth: 0.1, lineColor: [0, 0, 0] },
      bodyStyles: { textColor: [0, 0, 0], lineWidth: 0.1, lineColor: [0, 0, 0], fontSize: 8 },
      styles: { cellPadding: 2, valign: 'middle', halign: 'center' },
      columnStyles: {
        0: { cellWidth: 20 },
        1: { cellWidth: 22 },
        2: { cellWidth: 22 },
        3: { cellWidth: 18 },
        4: { cellWidth: 15 },
        5: { cellWidth: 15 },
        6: { cellWidth: 15 },
        7: { cellWidth: 15 },
        8: { cellWidth: 65, halign: 'left' },
        9: { cellWidth: 25 },
        10: { cellWidth: 25 },
        11: { cellWidth: 25 }
      },
      didDrawCell: function (data) {
        if (data.section === 'body') {
          const entry = journalEntries[data.row.index];
          if (data.column.index === 10 && profile.signature) {
            try {
              docPdf.addImage(profile.signature, 'PNG', data.cell.x + 2, data.cell.y + 2, data.cell.width - 4, data.cell.height - 4);
            } catch (e) {}
          }
          if (data.column.index === 11 && entry && entry.foto) {
            try {
              docPdf.addImage(entry.foto, 'JPEG', data.cell.x + 2, data.cell.y + 2, data.cell.width - 4, data.cell.height - 4);
            } catch (err) {}
          }
        }
      }
    });

    // Simpan file lokal otomatis
    const fileName = `Jurnal_${new Date().toISOString().slice(0,10)}.pdf`;
    docPdf.save(fileName);
    const pdfBlob = docPdf.output('blob');

    if (typeof onProgress === 'function') onProgress("Meminta otorisasi Google Drive...");

    // Proses Autentikasi Google Identity Services & Upload ke Drive
    if (!gapiInited || !gisInited) {
      throw new Error("Layanan Google API belum siap. Coba beberapa saat lagi.");
    }

    tokenClient.callback = async (resp) => {
      if (resp.error !== undefined) {
        throw (resp);
      }
      if (typeof onProgress === 'function') onProgress("Mengunggah ke Google Drive...");
      await uploadPDFToDriveFolder(pdfBlob, fileName, onSuccess, onError);
    };

    if (gapi.client.getToken() === null) {
      tokenClient.requestAccessToken({ prompt: 'consent' });
    } else {
      tokenClient.requestAccessToken({ prompt: '' });
    }

  } catch (err) {
    console.error(err);
    if (typeof onError === 'function') onError(err.message || "Gagal mengunggah ke Google Drive.");
  }
}

async function getOrCreateFolder(folderName, parentId = null) {
  let query = `mimeType='application/vnd.google-apps.folder' and name='${folderName}' and trashed=false`;
  if (parentId) {
    query += ` and '${parentId}' in parents`;
  }

  const response = await gapi.client.drive.files.list({
    q: query,
    fields: 'files(id, name)',
  });

  const files = response.result.files;
  if (files && files.length > 0) {
    return files[0].id;
  } else {
    const fileMetadata = {
      name: folderName,
      mimeType: 'application/vnd.google-apps.folder',
    };
    if (parentId) {
      fileMetadata.parents = [parentId];
    }
    const folder = await gapi.client.drive.files.create({
      resource: fileMetadata,
      fields: 'id',
    });
    return folder.result.id;
  }
}

async function uploadPDFToDriveFolder(pdfBlob, fileName, onSuccess, onError) {
  try {
    const currentYear = new Date().getFullYear().toString();
    const teacherName = profile.name || "Guru";

    // Struktur Folder: Jurnal Guru Digital -> Tahun -> Nama Guru
    const rootFolderId = await getOrCreateFolder("Jurnal Guru Digital");
    const yearFolderId = await getOrCreateFolder(currentYear, rootFolderId);
    const teacherFolderId = await getOrCreateFolder(teacherName, yearFolderId);

    const metadata = {
      name: fileName,
      mimeType: 'application/pdf',
      parents: [teacherFolderId]
    };

    const accessToken = gapi.client.getToken().access_token;
    const form = new FormData();
    form.append('metadata', new Blob([JSON.stringify(metadata)], { type: 'application/json' }));
    form.append('file', pdfBlob);

    const response = await fetch('https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart&fields=id,webViewLink,parents', {
      method: 'POST',
      headers: new Headers({ 'Authorization': 'Bearer ' + accessToken }),
      body: form,
    });
    
    const fileData = await response.json();
    if (fileData.id) {
      const driveInfo = {
        driveFileId: fileData.id,
        driveLink: fileData.webViewLink,
        driveFolder: `Jurnal Guru Digital/${currentYear}/${teacherName}`,
        uploadTime: new Date().toISOString()
      };

      // Simpan jejak upload ke Firestore pada collection teachers atau metadata khusus
      await updateDoc(doc(db, "teachers", currentUser.uid), { lastDriveUpload: driveInfo });

      if (typeof onSuccess === 'function') onSuccess(fileData.webViewLink);
    } else {
      throw new Error("Gagal mengunggah file ke Google Drive.");
    }
  } catch (error) {
    console.error("Drive upload error:", error);
    if (typeof onError === 'function') onError("Gagal mengunggah ke Google Drive.");
  }
}