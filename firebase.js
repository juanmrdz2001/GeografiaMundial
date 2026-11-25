import { initializeApp } from 'https://www.gstatic.com/firebasejs/12.4.0/firebase-app.js';
import { getAuth, signInAnonymously } from 'https://www.gstatic.com/firebasejs/12.4.0/firebase-auth.js';
import { getFirestore, doc, collection, query, orderBy, limit, getDocs, runTransaction, serverTimestamp } from 'https://www.gstatic.com/firebasejs/12.4.0/firebase-firestore.js';

const firebaseConfig = {
  apiKey: "AIzaSyAQiMmIFtpdRMfDq9OeMlkNJmCWgj0WT14",
  authDomain: "imperio-hotelero.firebaseapp.com",
  projectId: "imperio-hotelero",
  storageBucket: "imperio-hotelero.firebasestorage.app",
  messagingSenderId: "568661038168",
  appId: "1:568661038168:web:1b7de1d03017ebcff1262d",
  measurementId: "G-G4M6NY4GVC",
};
const app = initializeApp(firebaseConfig);
const db = getFirestore(app);
const auth = getAuth(app);
let acceso;
async function identificar() {
    await auth.authStateReady();
    if (auth.currentUser) return auth.currentUser.uid;
    if (!acceso) acceso = signInAnonymously(auth).finally(() => { acceso = null; });
    return (await acceso).user.uid;
}
export async function guardarResultado(nombre, resultado) {
    const uid = await identificar();
    const perfil = doc(db, 'jugadoresGeografia', uid);
    const historico = doc(db, 'rankingHistoricoGeografia', uid);
    const mensual = doc(db, 'rankingMensualGeografia', resultado.mes, 'jugadores', uid);
    const datos = { nombre, puntos: resultado.puntos, etapa: resultado.etapa,
        aciertos: resultado.aciertos, fecha: serverTimestamp() };
    await runTransaction(db, async tx => {
        const h = await tx.get(historico);
        const m = await tx.get(mensual);
        tx.set(perfil, { nombre, fecha: serverTimestamp() }, { merge: true });
        if (!h.exists() || h.data().puntos < datos.puntos) tx.set(historico, datos);
        if (!m.exists() || m.data().puntos < datos.puntos) tx.set(mensual, datos);
    });
}
export async function consultarRanking(historico) {
    const mes = new Date().toISOString().slice(0, 7);
    const ref = historico ? collection(db, 'rankingHistoricoGeografia')
        : collection(db, 'rankingMensualGeografia', mes, 'jugadores');
    const snap = await getDocs(query(ref, orderBy('puntos', 'desc'), limit(50)));
    return snap.docs.map(d => d.data());
}
