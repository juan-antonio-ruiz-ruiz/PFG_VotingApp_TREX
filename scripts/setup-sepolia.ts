import hre from "hardhat";

async function main() {
  console.log(" Iniciando inyección automatizada de datos en Ethereum Sepolia...");

  const IDENTITY_REGISTRY_ADDRESS = "0xc3Bf3125412a927D0F800a75c4C651AC42b54fbe";
  const VOTING_APP_ADDRESS = "0x1CEF18874De432A735Bd1aB7d716afC2d12d6dDc";

  // Definición de elecciones y sus candidatos
  const elections = [  
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

  // 1. Extraemos las utilidades de Ethers en Hardhat 3
  const context = await hre.network.create(); 

  // 2. Obtenemos la cuenta Administradora 
  const [admin] = await context.ethers.getSigners();
  const adminAddress = await admin.getAddress();
  console.log(` Operando en red pública con el Administrador: ${adminAddress}`);

  // 3. Instanciar los contratos enlazados a la red de pruebas Sepolia
  const identityRegistry = await context.ethers.getContractAt("IdentityRegistry", IDENTITY_REGISTRY_ADDRESS, admin);
  const votingApp = await context.ethers.getContractAt("VotingApp", VOTING_APP_ADDRESS, admin);

  // 4. Bucle para registrar Topics, abrir periodos y meter candidatos en internet
  for (const election of elections) {
    console.log(`\n Procesando en Sepolia: ${election.name} (Topic: ${election.topic})...`);
        
    // Comprobamos si la elección ya fue dada de alta previamente en internet
    const yaExisteTopic = await identityRegistry.isAllowedClaimTopic(election.topic);
    
    if (!yaExisteTopic) {
      console.log(`   → Agregando elección ${election.topic} al Registro de Identidades...`);
      const txTopic = await identityRegistry.connect(admin).addClaimTopic(election.topic, election.description);
      await txTopic.wait(1); // Espera obligatoria de minado en bloque real 
    }

    // Abrir el período electoral en la dApp de votación
    console.log(`   → Abriendo período electoral en el Sistema de Votación Múltiple Descentralizado con Protocolo T-REX...`);
    const txStatus = await votingApp.connect(admin).changeVotingStatus(election.topic, true);
    await txStatus.wait(1);
    
    // Registrar los candidatos asociados uno a uno
    console.log(`   → Registrando ${election.candidates.length} candidatos on-chain...`);
    for (const candidate of election.candidates) {
      console.log(`     * Subiendo candidato: "${candidate}"`);
      const txCandidate = await votingApp.connect(admin).addCandidate(election.topic, candidate);
      await txCandidate.wait(1);
    }
  }

  // Forzar el cierre de la votación de prueba 54 para validar el comportamiento en la GUI
  console.log("\n Cerrando ventana electoral del Topic 53 para pruebas de cumplimiento...");
  const txClose = await votingApp.connect(admin).changeVotingStatus(54n, false);
  await txClose.wait(1);

  // 5. Registrar a la wallet del Administrador en todos los sufragios de la red real
  console.log("\n Otorgando credenciales de cumplimiento (Modular Compliance ERC-3643)...");
  for (const election of elections) {
    console.log(`   → Autorizando wallet admin para votar en Topic ${election.topic}...`);
    const txVoter = await identityRegistry.connect(admin).addVoter(adminAddress, election.topic, "0x00");
    await txVoter.wait(1);
  }

  console.log("\n ¡Ecosistema descentralizado cargado con éxito en Ethereum Sepolia!");
  console.log("-----------------------------------------------------------------");
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
