import hre from "hardhat";

async function main() {
  console.log("Iniciando inyección de datos de prueba en Ethereum Sepolia...");

  // ===== CONFIGURACIÓN (Introduce tus direcciones reales generadas por Ignition) =====
  const IDENTITY_REGISTRY_ADDRESS = "0x4505eC3CB09e66a34511Ca780FC5b0157b49cC38";
  const VOTING_APP_ADDRESS = "0x24D8D92c45dB112aE5aC4cC035ddb32Df3196999";
  // =================================================================================

  const [admin] = await hre.ethers.getSigners();
  const adminAddress = await admin.getAddress();
  console.log(`👤 Operando con la cuenta Administradora: ${adminAddress}`);

  // Instanciar contratos conectados a la red real
  const identityRegistry = await hre.ethers.getContractAt("IdentityRegistry", IDENTITY_REGISTRY_ADDRESS, admin);
  const votingApp = await hre.ethers.getContractAt("VotingApp", VOTING_APP_ADDRESS, admin);

  // 1. Carga de Candidatos
  console.log("\nPaso 1: Configurando opciones de votación...");
  const candidatos = ["Opción A: Juan Antonio Ruiz", "Opción B: Innovación ERC-3643", "Voto en Blanco"];
  
  for (const nombre of candidatos) {
    console.log(`  --> Registrando candidato: "${nombre}"`);
    const tx = await votingApp.addCandidate(nombre);
    await tx.wait(1); // Espera obligatoria a que se mine en Sepolia
  }
  console.log("Candidatos grabados inmutablemente.");

  // 2. Autorización de tu propia billetera en el Registro de Identidad
  console.log("\nPaso 2: Otorgando credenciales de cumplimiento (Topic 50)...");
  console.log(`  --> Verificando billetera del Administrador: ${adminAddress}`);
  
  const txIdentity = await identityRegistry.addVoterCredential(adminAddress, 50n, "0x00");
  await txIdentity.wait(1);
  
  console.log("Tu MetaMask tiene ahora el derecho a voto activo en la blockchain de Sepolia.");
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
