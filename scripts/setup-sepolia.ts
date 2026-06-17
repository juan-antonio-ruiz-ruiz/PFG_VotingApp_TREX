import hre from "hardhat";

async function main() {
  console.log("🚀 Iniciando inyección automatizada adaptada a la arquitectura Multi-Elección...");

  // ===== CONFIGURACIÓN (Introduce las direcciones generadas por tu último reset) =====
  const IDENTITY_REGISTRY_ADDRESS = "0xbB63C614da59070b09C6811E447F5a50b29610dD";
  const VOTING_APP_ADDRESS = "0x5aa68027Be07A6077932C0326E95E60E3730Ab13";
  // =================================================================================

  const [admin] = await hre.ethers.getSigners();
  const adminAddress = await admin.getAddress();

  const identityRegistry = await hre.ethers.getContractAt("IdentityRegistry", IDENTITY_REGISTRY_ADDRESS, admin);
  const votingApp = await hre.ethers.getContractAt("VotingApp", VOTING_APP_ADDRESS, admin);

  const TOPIC_ACTUAL = 50n; // Elección por defecto inicializada en tu constructor

  // 1. Abrir la ventana temporal de votación para este topic específico
  console.log(`\n⏳ Abriendo periodo electoral para el Claim Topic: ${TOPIC_ACTUAL}...`);
  const txStatus = await votingApp.changeVotingStatus(TOPIC_ACTUAL, true);
  await txStatus.wait(1);

  // 2. Dar de alta candidatos asociados a este topic específico
  console.log("🗳️ Registrando candidatos para la votación activa...");
  const candidatos = ["Opción 1: Sistema Totalmente Descentralizado", "Opción 2: Modelo Híbrido Regulado", "Voto en Blanco"];
  
  for (const nombre of candidatos) {
    console.log(`  --> Añadiendo: "${nombre}"`);
    const tx = await votingApp.addCandidate(TOPIC_ACTUAL, nombre);
    await tx.wait(1);
  }

  // 3. Autorizar tu propia wallet en el registro de identidad bajo este mismo topic
  console.log(`\n🆔 Validando credencial de cumplimiento (Topic ${TOPIC_ACTUAL}) para el administrador...`);
  const txVoter = await identityRegistry.addVoter(adminAddress, TOPIC_ACTUAL, "0x00");
  await txVoter.wait(1);

  console.log("\n🎉 Entorno Sepolia configurado con éxito bajo el nuevo esquema Multi-Elección.");
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
