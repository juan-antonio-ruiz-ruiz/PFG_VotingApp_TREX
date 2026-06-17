import { expect } from "chai";
import hre from "hardhat";
import type { Signer } from "ethers";

describe("PRUEBAS UNITARIAS EXHAUSTIVAS - SISTEMA DE VOTACIÓN MÚLTIPLE ERC-3643", function () {
  let identityRegistry: any;
  let votingApp: any;
  let admin: Signer;
  let voter1: Signer;
  let voter2: Signer;
  let voter3: Signer;
  let voter4: Signer;
  let attacker: Signer;
  
  let adminAddress: string;
  let v1: string;
  let v2: string;
  let v3: string;
  let v4: string;
  let attackerAddress: string;
  
  let ethers: any;

  const TOPIC_A = 50n; // Elección A (Iniciada por defecto en constructor)
  const TOPIC_B = 60n; // Elección B (Añadida dinámicamente)

  beforeEach(async function () {
    // 1. Inicialización del entorno aislado de Hardhat 3
    const context = await hre.network.create(); 
    ethers = context.ethers;

    // 2. Configuración de los 4 votantes y el atacante
    [admin, voter1, voter2, voter3, voter4, attacker] = await ethers.getSigners();
    adminAddress = await admin.getAddress();
    v1 = await voter1.getAddress();
    v2 = await voter2.getAddress();
    v3 = await voter3.getAddress();
    v4 = await voter4.getAddress();
    attackerAddress = await attacker.getAddress();

    // 3. Despliegue de la infraestructura de contratos
    identityRegistry = await ethers.deployContract("IdentityRegistry");
    const identityAddress = await identityRegistry.getAddress();
    votingApp = await ethers.deployContract("VotingApp", [identityAddress]);

    // 4. Inicialización de la Elección B en el registro
    await identityRegistry.connect(admin).addClaimTopic(TOPIC_B);

    // 5. Configuración de 2 Candidatos para cada una de las elecciones (A y B)
    await votingApp.connect(admin).addCandidate(TOPIC_A, "Candidato A1");
    await votingApp.connect(admin).addCandidate(TOPIC_A, "Candidato A2");

    await votingApp.connect(admin).addCandidate(TOPIC_B, "Candidato B1");
    await votingApp.connect(admin).addCandidate(TOPIC_B, "Candidato B2");
  });

  // =========================================================================
  // BLOQUE 1: PRUEBAS EN IDENTITYREGISTRY.SOL
  // =========================================================================

  it("Validación 1: Debería impedir que se duplique un Claim Topic existente", async function () {
    await expect(
      identityRegistry.connect(admin).addClaimTopic(TOPIC_A)
    ).to.be.revertedWith("La votacion ya existe");
  });

  it("Validación 2: Debería rechazar el registro de un votante con la dirección cero (0x0)", async function () {
    await expect(
      identityRegistry.connect(admin).addVoter(ethers.ZeroAddress, TOPIC_A, "0x00")
    ).to.be.revertedWith("Direccion invalida");
  });

  it("Validación 3: Debería impedir registrar un votante en una elección no permitida", async function () {
    const TOPIC_FALSO = 999n;
    await expect(
      identityRegistry.connect(admin).addVoter(v1, TOPIC_FALSO, "0x00")
    ).to.be.revertedWith("Esta votacion no esta permitida");
  });

  it("Validación 4: Debería permitir revocar la credencial a un votante activo y dar de baja su derecho", async function () {
    await identityRegistry.connect(admin).addVoter(v1, TOPIC_A, "0x00");
    expect(await identityRegistry.isVerified(v1, TOPIC_A)).to.be.true;

    // Revocación por el administrador
    await identityRegistry.connect(admin).revokeVoter(v1, TOPIC_A);
    expect(await identityRegistry.isVerified(v1, TOPIC_A)).to.be.false;
  });

  it("Validación 5: Debería denegar la revocación de un votante que no está registrado", async function () {
    await expect(
      identityRegistry.connect(admin).revokeVoter(v2, TOPIC_A)
    ).to.be.revertedWith("El usuario no esta registrado en esa votacion");
  });

  it("Validación 6: Control de accesos (Ownable) - Solo el Admin puede añadir topics o votantes", async function () {
    await expect(
      identityRegistry.connect(attacker).addClaimTopic(70n)
    ).to.be.revertedWithCustomError(identityRegistry, "OwnableUnauthorizedAccount");

    await expect(
      identityRegistry.connect(attacker).addVoter(v1, TOPIC_A, "0x00")
    ).to.be.revertedWithCustomError(identityRegistry, "OwnableUnauthorizedAccount");
  });

  // =========================================================================
  // BLOQUE 2: PRUEBAS EN VOTINGAPP.SOL (ESCENARIO DE 4 VOTANTES Y 2 CANDIDATOS)
  // =========================================================================

  it("Validación 7: Debería listar de forma transparente los topics permitidos", async function () {
    const topics = await identityRegistry.getAllowedClaimTopics();
    expect(topics[0]).to.equal(TOPIC_A);
    expect(topics[1]).to.equal(TOPIC_B);
  });

  it("Validación 8: Debería impedir añadir candidatos en un topic no permitido", async function () {
    await expect(
      votingApp.connect(admin).addCandidate(999n, "Candidato Fantasma")
    ).to.be.revertedWith("Votacion no permitida");
  });

  it("Validación 9: Debería rechazar votos a candidatos que no existen en el rango", async function () {
    await votingApp.connect(admin).changeVotingStatus(TOPIC_A, true);
    await identityRegistry.connect(admin).addVoter(v1, TOPIC_A, "0x00");

    // Intentar votar al candidato ID 2 (solo existen el 0 y el 1)
    await expect(
      votingApp.connect(voter1).addVote(TOPIC_A, 2n)
    ).to.be.revertedWith("El candidato elegido no existe en esta eleccion");
  });

  it("Validación 10: Procesamiento masivo de votos (Flujo Feliz con los 4 votantes)", async function () {
    // Abrimos los dos sufragios
    await votingApp.connect(admin).changeVotingStatus(TOPIC_A, true);
    await votingApp.connect(admin).changeVotingStatus(TOPIC_B, true);

    // Verificamos de forma cruzada a los 4 usuarios
    await identityRegistry.connect(admin).addVoter(v1, TOPIC_A, "0x00"); // Votante 1 -> Elección A
    await identityRegistry.connect(admin).addVoter(v2, TOPIC_A, "0x00"); // Votante 2 -> Elección A
    await identityRegistry.connect(admin).addVoter(v3, TOPIC_B, "0x00"); // Votante 3 -> Elección B
    await identityRegistry.connect(admin).addVoter(v4, TOPIC_B, "0x00"); // Votante 4 -> Elección B

    // Emisión coordinada de sufragios
    await votingApp.connect(voter1).addVote(TOPIC_A, 0n); // Voto para Candidato A1
    await votingApp.connect(voter2).addVote(TOPIC_A, 1n); // Voto para Candidato A2
    await votingApp.connect(voter3).addVote(TOPIC_B, 0n); // Voto para Candidato B1
    await votingApp.connect(voter4).addVote(TOPIC_B, 0n); // Voto para Candidato B1

    // Verificación del escrutinio final e independiente
    const candA1 = await votingApp.getCandidate(TOPIC_A, 0n);
    const candA2 = await votingApp.getCandidate(TOPIC_A, 1n);
    const candB1 = await votingApp.getCandidate(TOPIC_B, 0n);
    const candB2 = await votingApp.getCandidate(TOPIC_B, 1n);

    expect(candA1.votes).to.equal(1n);
    expect(candA2.votes).to.equal(1n);
    expect(candB1.votes).to.equal(2n); // Recibió dos votos (voter3 y voter4)
    expect(candB2.votes).to.equal(0n);
  });

  it("Validación 11: Control del ciclo de vida temporal (Periodo Cerrado)", async function () {
    // Dejamos la votación cerrada de forma explícita
    await votingApp.connect(admin).changeVotingStatus(TOPIC_A, false);
    await identityRegistry.connect(admin).addVoter(v1, TOPIC_A, "0x00");

    await expect(
      votingApp.connect(voter1).addVote(TOPIC_A, 0n)
    ).to.be.revertedWith("Transaccion rechazada: Periodo de votacion cerrado");
  });

  it("Validación 12: Resiliencia ante la Parada de Emergencia global (Pausable)", async function () {
    await votingApp.connect(admin).changeVotingStatus(TOPIC_A, true);
    await identityRegistry.connect(admin).addVoter(v1, TOPIC_A, "0x00");

    // Congelación por parte del propietario
    await votingApp.connect(admin).pauseVoting();

    await expect(
      votingApp.connect(voter1).addVote(TOPIC_A, 0n)
    ).to.be.revertedWithCustomError(votingApp, "EnforcedPause");

    // Activación y restauración del servicio
    await votingApp.connect(admin).unpauseVoting();
    await votingApp.connect(voter1).addVote(TOPIC_A, 0n);
    
    const candidate = await votingApp.getCandidate(TOPIC_A, 0n);
    expect(candidate.votes).to.equal(1n);
  });
});
