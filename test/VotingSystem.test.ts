import { expect } from "chai";
import hre from "hardhat";
import type { Signer } from "ethers";

describe("PRUEBAS UNITARIAS - SISTEMA DE VOTACIÓN ERC-3643", function () {
  let identityRegistry: any;
  let votingApp: any;
  let admin: Signer;
  let voter1: Signer;
  let voter1Address: string;
  let ethers: any; // Instancia dinámica de Ethers para Hardhat 3 

  beforeEach(async function () {
    // 1. Inicialización nativa de la red y extracción de utilidades en Hardhat 3
    const context = await hre.network.create(); 
    ethers = context.ethers; // Asignamos la instancia local aislada 

    // 2. Obtener cuentas locales simuladas
    [admin, voter1] = await ethers.getSigners();
    voter1Address = await voter1.getAddress();

    // 3. Desplegar contratos en cascada usando la instancia nativa
    identityRegistry = await ethers.deployContract("IdentityRegistry");
    const identityAddress = await identityRegistry.getAddress();

    // Desplegamos VotingApp requiriendo el Topic 50 
    votingApp = await ethers.deployContract("VotingApp", [identityAddress, 50n]);

    // 4. Añadir candidato de prueba inicial
    await votingApp.connect(admin).addCandidate("Candidato PFG");
  });

  it("Test 1: Debería bloquear el voto si el usuario no tiene credenciales", async function () {
    await expect(
      votingApp.connect(voter1).addVote(0)
    ).to.be.revertedWith("Transaccion rechazada: Identidad no verificada para el topic requerido");
  });

  it("Test 2: Debería bloquear el voto si tiene un Topic erróneo (ej: 60)", async function () {
    await identityRegistry.connect(admin).setTopicStatus(60n, true);
    await identityRegistry.connect(admin).addVoterCredential(voter1Address, 60n, "0x00");

    await expect(
      votingApp.connect(voter1).addVote(0)
    ).to.be.revertedWith("Transaccion rechazada: Identidad no verificada para el topic requerido");
  });

  it("Test 3: Debería permitir el voto con el Topic correcto (50) y sumar el voto", async function () {
    await identityRegistry.connect(admin).addVoterCredential(voter1Address, 50n, "0x00");
    
    await votingApp.connect(voter1).addVote(0);
    const candidate = await votingApp.getCandidate(0);
    expect(candidate.name).to.equal("Candidato PFG");
    expect(candidate.votes).to.equal(1n);
  });

  it("Test 4: Debería impedir votar al mismo usuario por segunda vez (Fraude)", async function () {
    await identityRegistry.connect(admin).addVoterCredential(voter1Address, 50n, "0x00");
    await votingApp.connect(voter1).addVote(0); // Primer voto

    await expect(
      votingApp.connect(voter1).addVote(0)
    ).to.be.revertedWith("Transaccion rechazada: El usuario ya ha votado");
  });

  it("Test 5: Debería bloquear el voto si el Admin activa la pausa de emergencia ⚠️", async function () {
    await identityRegistry.connect(admin).addVoterCredential(voter1Address, 50n, "0x00");
    await votingApp.connect(admin).pauseVoting(); // Pausa activada

    await expect(
      votingApp.connect(voter1).addVote(0)
    ).to.be.revertedWithCustomError(votingApp, "EnforcedPause"); // Error nativo de OpenZeppelin Pausable
  });
});
