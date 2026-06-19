// ===== CONFIGURACIÓN CENTRAL DE DIRECCIONES =====
const votingAppAddress = "0x1CEF18874De432A735Bd1aB7d716afC2d12d6dDc";
const identityRegistryAddress = "0xc3Bf3125412a927D0F800a75c4C651AC42b54fbe";

const votingAppABI = [
"function openVote(uint256) external view returns (bool)",
"function totalCandidates(uint256) external view returns (uint256)",
"function getCandidate(uint256 _claimTopic, uint256 _candidateId) external view returns (string memory name, uint256 votes)",
"function addVote(uint256 _claimTopic, uint256 _candidateId) external",
"function addCandidate(uint256 _claimTopic, string memory _name) external",
"function changeVotingStatus(uint256 _claimTopic, bool _status) external",
"function pauseVoting() external",
"function unpauseVoting() external"
];

const identityRegistryABI = [
"function getAllowedClaimTopics() external view returns (uint256[] memory)",
"function getClaimTopicDescription(uint256 _claimTopic) external view returns (string memory)",
"function owner() external view returns (address)", // Para validar el rol admin de forma segura
"function addClaimTopic(uint256 _claimTopic, string memory _description) external",
"function addVoter(address _user, uint256 _claimTopic, bytes memory _signature) external",
"function revokeVoter(address _user, uint256 _claimTopic) external"
];

let provider;
let signer;
let votingContract;
let identityRegistryContract;
let currentTopic;
let allowedTopics = [];

// Elementos de la interfaz de usuario
const btnConnect = document.getElementById("btnConnect");
const lblAccount = document.getElementById("lblAccount");
const selectElection = document.getElementById("selectElection");
const btnLoadElection = document.getElementById("btnLoadElection");
const electionStatus = document.getElementById("electionStatus");
const panelVoting = document.getElementById("panelVoting");
const selectCandidates = document.getElementById("selectCandidates");
const btnVote = document.getElementById("btnVote");

// Elementos de la barra de pestañas y contenedores de administración
const adminNavbar = document.getElementById("adminNavbar");
const tabVoterView = document.getElementById("tabVoterView");
const tabAdminView = document.getElementById("tabAdminView");
const panelVoterContainer = document.getElementById("panelVoterContainer");
const panelAdminContainer = document.getElementById("panelAdminContainer");

// 1. Conexión de MetaMask a Ethers.js v6
btnConnect.addEventListener("click", async () => {
if (window.ethereum) {
try {
provider = new ethers.BrowserProvider(window.ethereum);
signer = await provider.getSigner();
const address = await signer.getAddress();
lblAccount.innerText = `Billetera Activa: ${address}`;
btnConnect.style.backgroundColor = "#1cc88a";
btnConnect.innerText = "Billetera Conectada ✓";

// Instanciar los contratos inteligentes
votingContract = new ethers.Contract(votingAppAddress, votingAppABI, signer);
identityRegistryContract = new ethers.Contract(identityRegistryAddress, identityRegistryABI, signer);

// Cargar las elecciones disponibles
await loadAvailableElections();

// Verificar el rol de administrador on-chain de forma dinámica
await verifyAdminRole(address);

} catch (error) {
console.error("Acceso denegado por el usuario:", error);
alert("Error al intentar enlazar MetaMask.");
}
} else {
alert("MetaMask no detectado. Instala la extensión para operar.");
}
});

// Función para comprobar si la wallet conectada es el Owner del sistema
async function verifyAdminRole(userAddress) {
    try {
        const contractOwner = await identityRegistryContract.owner();
        // Si las direcciones coinciden, desplegamos la barra de navegación exclusiva
        if (userAddress.toLowerCase() === contractOwner.toLowerCase()) {
            adminNavbar.style.display = "flex";
        } else {
            adminNavbar.style.display = "none";
            switchView(true); // Fuerza la vista del votante si no es admin
        }
    } catch (err) {
        console.error("Error verificando permisos de administrador:", err);
    }
}

// Controladores para la navegación entre pestañas
tabVoterView.addEventListener("click", () => switchView(true));
tabAdminView.addEventListener("click", () => switchView(false));

function switchView(isVoterView) {
    if (isVoterView) {
        tabVoterView.classList.add("active");
        tabAdminView.classList.remove("active");
        panelVoterContainer.classList.add("active");
        panelAdminContainer.classList.remove("active");
    } else {
        tabAdminView.classList.add("active");
        tabVoterView.classList.remove("active");
        panelAdminContainer.classList.add("active");
        panelVoterContainer.classList.remove("active");
    }
}

// Función para cargar las elecciones disponibles
async function loadAvailableElections() {
try {
allowedTopics = await identityRegistryContract.getAllowedClaimTopics();
selectElection.innerHTML = "";
for (const topic of allowedTopics) {
try {
const description = await identityRegistryContract.getClaimTopicDescription(topic);
const option = document.createElement("option");
option.value = topic.toString();
option.innerText = `${description} (ID: ${topic})`;
selectElection.appendChild(option);
} catch (err) {
console.log(`No se pudo obtener descripción para topic ${topic}:`, err);
}
}
if (allowedTopics.length > 0) {
selectElection.value = allowedTopics[0].toString();
}
} catch (error) {
console.error("Error al cargar elecciones:", error);
alert("Error al cargar las elecciones disponibles.");
}
}

// 2. Consulta dinámica según el Claim Topic
btnLoadElection.addEventListener("click", async () => {
if (!votingContract) {
alert("Primero debes conectar tu billetera MetaMask.");
return;
}
currentTopic = BigInt(selectElection.value);
selectCandidates.innerHTML = ""; 
try {
const isOpened = await votingContract.openVote(currentTopic);
const totalCand = await votingContract.totalCandidates(currentTopic);
if (totalCand === 0n) {
alert(` Error: La elección con Id ${currentTopic} no existe. Por favor, verifica el número de elección.`);
selectCandidates.innerHTML = "";
panelVoting.style.display = "none";
return;
}
electionStatus.style.display = "block";
if (isOpened) {
electionStatus.innerText = " Periodo de Votación Abierto";
electionStatus.className = "status open";
btnVote.disabled = false;
} else {
electionStatus.innerText = " Periodo de Votación Cerrado";
electionStatus.className = "status closed";
btnVote.disabled = true;
alert(` Aviso: La elección existe pero el período de votación está cerrado. Candidatos: ${totalCand}`);
}
for (let i = 0n; i < totalCand; i++) {
const [name, votes] = await votingContract.getCandidate(currentTopic, i);
const option = document.createElement("option");
option.value = i.toString();
option.innerText = `${name} (${votes.toString()} votos)`;
selectCandidates.appendChild(option);
}
panelVoting.style.display = "block";
} catch (err) {
console.error("Error al consultar la elección:", err);
alert(" Error al consultar la elección. Verifica la conexión o intenta nuevamente.");
}
});

// 3. Ejecución de la transacción de Voto (Mutación con Gas)
btnVote.addEventListener("click", async () => {
const selectedId = BigInt(selectCandidates.value);
try {
btnVote.disabled = true;
electionStatus.innerText = " Confirmando transacción en MetaMask y procesando bloque...";
const tx = await votingContract.addVote(currentTopic, selectedId);
await tx.wait(); 
alert(" ¡Tu voto se ha procesado y grabado de forma inmutable en la blockchain!");
btnLoadElection.click(); 
} catch (error) {
console.error("Transacción fallida:", error);
btnVote.disabled = false;
if (error.reason) {
alert(`Filtro Modular Compliance: ${error.reason}`);
} else if (error.message && error.message.includes("user rejected")) {
alert("Operación cancelada en MetaMask.");
} else {
alert("Transacción rechazada. Requisitos incumplidos (Identidad ausente o doble voto detectado).");
}
btnLoadElection.click();
}
});

// =========================================================================
//  CONTROLADORES EXCLUSIVOS PARA INTERACCIONES DE ADMINISTRADOR
// =========================================================================

// Función genérica para despachar transacciones asíncronas de escritura
async function sendAdminTx(contractMethodPromise, logMessage) {
    try {
        electionStatus.style.display = "block";
        electionStatus.innerText = " Enviando transacción al nodo local...";
        const tx = await contractMethodPromise;
        electionStatus.innerText = " Minando operación en el bloque local...";
        await tx.wait();
        alert(`Operación confirmada: ${logMessage}`);
        await loadAvailableElections();
    } catch (error) {
        console.error("Fallo en la operación:", error);
        alert(error.reason ? `Error de Seguridad: ${error.reason}` : "La transacción fue revertida. Comprueba los permisos de tu rol.");
    }
}

// A. Parada de Emergencia (Pausable)
document.getElementById("btnPause").addEventListener("click", () => sendAdminTx(votingContract.pauseVoting(), "Votaciones pausadas globalmente."));
document.getElementById("btnUnpause").addEventListener("click", () => sendAdminTx(votingContract.unpauseVoting(), "Votaciones reactivadas globalmente."));

// B. Registrar Nueva Elección (addClaimTopic)
document.getElementById("btnCreateElection").addEventListener("click", () => {
    const topicId = BigInt(document.getElementById("inputTopicId").value);
    const topicDesc = document.getElementById("inputTopicDesc").value;
    sendAdminTx(identityRegistryContract.addClaimTopic(topicId, topicDesc), `Votación "${topicDesc}" creada.`);
});

// C. Abrir/Cerrar Ventana Temporal de Elección
document.getElementById("btnOpenStatus").addEventListener("click", () => {
    const topicId = BigInt(document.getElementById("inputTargetTopic").value);
    sendAdminTx(votingContract.changeVotingStatus(topicId, true), `Elección ${topicId} ABIERTA.`);
});
document.getElementById("btnCloseStatus").addEventListener("click", () => {
    const topicId = BigInt(document.getElementById("inputTargetTopic").value);
    sendAdminTx(votingContract.changeVotingStatus(topicId, false), `Elección ${topicId} CERRADA.`);
});

// D. Registrar Candidato de forma Interactiva
document.getElementById("btnCreateCandidate").addEventListener("click", () => {
    const topicElem = document.getElementById("inputTargetTopic");
    const nameElem = document.getElementById("inputCandidateName");
    const topicVal = topicElem.value;
    const candidateName = nameElem.value ? nameElem.value.trim() : "";
    if (!topicVal) {
        alert("Introduce el ID del Topic a gestionar.");
        return;
    }
    if (!candidateName) {
        alert("Introduce el nombre del candidato.");
        return;
    }
    const topicId = BigInt(topicVal);
    sendAdminTx(votingContract.addCandidate(topicId, candidateName), `Candidato "${candidateName}" inscrito.`);
});

// E. Validar y Revocar Billeteras (Compliance Layer)
document.getElementById("btnAddVoter").addEventListener("click", () => {
    const userAddress = document.getElementById("inputUserAddress").value;
    const topicId = BigInt(document.getElementById("inputUserTopic").value);
    sendAdminTx(identityRegistryContract.addVoter(userAddress, topicId, "0x00"), `Wallet ${userAddress} AUTORIZADA para votar.`);
});
document.getElementById("btnRevokeVoter").addEventListener("click", () => {
    const userAddress = document.getElementById("inputUserAddress").value;
    const topicId = BigInt(document.getElementById("inputUserTopic").value);
    sendAdminTx(identityRegistryContract.revokeVoter(userAddress, topicId), `Wallet ${userAddress} REVOCADA.`);
});
