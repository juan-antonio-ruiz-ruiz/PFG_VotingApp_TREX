import hre from "hardhat";

async function main() {
  console.log(" Iniciando carga de datos automatizada en el nodo Localhost (Hardhat 3)...");
  const IDENTITY_REGISTRY_ADDRESS = "0x5FbDB2315678afecb367f032d93F642f64180aa3";
  const VOTING_APP_ADDRESS = "0xe7f1725E7734CE288F8367e1Bb143E90bb3F0512";
  // =========================================================================

  // Definir elecciones con sus candidatos
  const elections = [
    {
      topic: 50n,
      name: "Elección por defecto",
      description: "Votación por defecto",
      candidates: ["Opción 1", "Opción 2", "Opción 3", "Opción 4", "Opción 5"]
    },    
    {
      topic: 51n,
      name: "Elección Decanato",
      description: "Votación para elegir el nuevo Decano de la Facultad de Informática",
      candidates: ["Candidato A (Decanato)", "Candidato B (Decanato)", "Candidato C (Decanato)"]
    },
    {
      topic: 52n,
      name: "Elección Rectorado",
      description: "Votación para elegir el nuevo Rector de la Universidad",
      candidates: ["Candidato A (Rectorado)", "Candidato B (Rectorado)", "Candidato C (Rectorado)"]
    },
    {
      topic: 53n,
      name: "Elección Consejo",
      description: "Votación para los miembros del Consejo de Gobierno",
      candidates: ["Candidato A (Consejo)", "Candidato B (Consejo)", "Candidato C (Consejo)"]
    },
    {
      topic: 54n,
      name: "Elección Cerrada",
      description: "Votación de prueba (Cerrada - No disponible)",
      candidates: ["Candidato 1", "Candidato 2"]
    }
  ];

  // 1. Inicialización nativa de la red y extracción de utilidades en Hardhat 3 
  const context = await hre.network.create(); 

  // 2. Obtener las cuentas del nodo local usando la instancia nativa. Extraemos las utilidades directamente desde el objeto inyectado hre.ethers
  const [admin, voter1, voter2, voter3, voter4] = await context.ethers.getSigners();

  // 3. Instanciar los contratos en local mediante getContractAt nativo
  const identityRegistry = await context.ethers.getContractAt("IdentityRegistry", IDENTITY_REGISTRY_ADDRESS, admin);
  const votingApp = await context.ethers.getContractAt("VotingApp", VOTING_APP_ADDRESS, admin);

  // 4. Registrar los claim topics 51 y 52 (el 50 ya existe por defecto en el Identity Registry)
  console.log("\n Registrando nuevos claim topics en el Identity Registry...");
  console.log("   → Agregando claim topic 51 (Decanato)...");
  await identityRegistry.connect(admin).addClaimTopic(51n, "Votación para elegir el nuevo Decano de la Facultad de Informática");
  console.log("   → Agregando claim topic 52 (Rectorado)...");
  await identityRegistry.connect(admin).addClaimTopic(52n, "Votación para elegir el nuevo Rector de la Universidad");
  console.log("   → Agregando claim topic 53 (Consejo)...");
  await identityRegistry.connect(admin).addClaimTopic(53n, "Votación para los miembros del Consejo de Gobierno");
  console.log("   → Agregando claim topic 54 (Cerrada)...");
  await identityRegistry.connect(admin).addClaimTopic(54n, "Votación de prueba (Cerrada - No disponible)");
  // 5. Abrir periodos electorales y registrar candidatos para cada elección
  for (const election of elections) {
    console.log(`\n Procesando: ${election.name} (Topic: ${election.topic})...`);
    
    // Abrir el período electoral
    console.log(`   → Abriendo período electoral...`);
    await votingApp.connect(admin).changeVotingStatus(election.topic, true);
    
    // Registrar candidatos
    console.log(`   → Registrando ${election.candidates.length} candidatos...`);
    for (const candidate of election.candidates) {
      await votingApp.connect(admin).addCandidate(election.topic, candidate);
    }
    await votingApp.connect(admin).changeVotingStatus(54n, false);
  }

  // 6. Registrar las 5 wallets locales (Admin + los 4 votantes) en el Identity Registry para todos los topics
  console.log("\n Otorgando credenciales ERC-3643 a las wallets locales para todos los topics...");
  const wallets = [admin, voter1, voter2, voter3, voter4];
  
  for (const election of elections) {
    console.log(`   → Registrando votantes para Topic ${election.topic} (${election.name})...`);
    for (let i = 0; i < wallets.length; i++) {
      const wallet = wallets[i];
      
      // Excluir voter4 (índice 4) de la elección con topic 53
      if (election.topic === 53n && i === 4) {
        console.log(`        Saltando voter4 para la Elección Consejo (Topic 53)`);
        continue;
      }
      
      const address = await wallet.getAddress();
      await identityRegistry.connect(admin).addVoter(address, election.topic, "0x00");
    }
  }

  console.log("\n ¡Nodo local cargado con éxito!");
  console.log("-----------------------------------------------------------------");
  console.log("Se han configurado 5 elecciones (Topics 50, 51, 52, 53, 54):");
  for (const election of elections) {
    console.log(`   • ${election.name}: ${election.candidates.length} candidatos`);
  }
  console.log("\n  NOTAS:");
  console.log("   • Voter4 NO está autorizado para votar en la Elección Consejo (Topic 53)");
  console.log("   • La Elección Cerrada (Topic 54) está configurada como CERRADA (no se puede votar)");
  console.log("-----------------------------------------------------------------");
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
