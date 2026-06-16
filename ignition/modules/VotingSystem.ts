import { buildModule } from "@nomicfoundation/hardhat-ignition/modules";

export default buildModule("VotingSystemModule", (m) => {
  
  // 1. Desplegamos el registro de identidad de forma nativa
  const identityRegistry = m.contract("IdentityRegistry");
  
  // 2. Desplegamos VotingApp inyectando dinámicamente la dirección del anterior
  // Ignition desplegará VotingApp cuando IdentityRegistry esté listo
  const votingApp = m.contract("VotingApp", [identityRegistry]);

  // Retornamos ambos contratos para tener acceso a sus instancias
  return { identityRegistry, votingApp };
});