# 🗳️ Plataforma Electoral Descentralizada ERC-3643 (Protocolo T-REX)

[![Solidity Version](https://shields.io)](https://soliditylang.org)
[![Hardhat 3](https://shields.io)](https://hardhat.org)
[![OpenZeppelin](https://shields.io)](https://openzeppelin.com)
[![Ethers.js](https://shields.io)](https://ethers.org)

Proyecto Final de Grado (PFG) desarrollado para la **ETSI Informática de la UNED**. Se trata de un sistema de votación electrónica múltiple, confidencial e inmutable que implementa un motor de **Modular Compliance** inspirado en el estándar de seguridad industrial **ERC-3643 (Protocolo T-REX)** para la gestión y validación de identidades (*on-chain*).

---

## 🏗️ Arquitectura de Contratos Inteligentes

El ecosistema se divide en dos contratos inteligentes desacoplados e interconectados mediante llamadas internas (*inter-contract calls*):

1. **`IdentityRegistry.sol`**: Actúa como el motor de cumplimiento de identidad. Gestiona el alta dinámica de procesos electorales (*Claim Topics*) y el registro de credenciales de votantes autorizados mediante firmas criptográficas.
2. **`VotingApp.sol`**: Controla la lógica de negocio electoral. Almacena candidatos en arrays privados (encapsulamiento estricto) e intercepta cada transacción de voto mediante el modificador de elegibilidad `isEligible`, aplicando un triple filtro de seguridad *on-chain*:
   * **Filtro de Identidad**: Valida que la wallet del usuario posea la credencial activa del proceso electoral consultado.
   * **Filtro Temporal**: Comprueba si el periodo electoral de ese *Topic* sigue activo.
   * **Filtro de Negocio**: Mitiga el fraude del doble voto de forma inmutable.

El sistema hereda las librerías oficiales de **OpenZeppelin (v5.x)** `Ownable` (para el control de accesos restringido a la mesa electoral) y `Pausable` (mecanismo de parada de emergencia o congelación ante migraciones).

---

## 🛠️ Tecnologías y Entorno de Desarrollo

* **Lenguaje:** Solidity `^0.8.20` e TypeScript para los scripts de control.
* **Framework Backend:** **Hardhat 3 (Versión 2026)** utilizando el motor asíncrono avanzado EDR (Ethereum Developer Runtime).
* **Frontend:** HTML5, CSS3 clásico y **Ethers.js v6** (distribución UMD local para ejecución sin dependencias de red externas).
* **Red de Despliegue:** Ethereum Localhost (Nodo 8545 / Chain ID `31337`) y Testnet pública **Ethereum Sepolia**.

---

## 📊 Auditoría, Calidad y Cobertura de Código

Para certificar la robustez e inmunidad del código frente a vulnerabilidades del *OWASP Top 10* de Smart Contracts, el proyecto se ha sometido a un riguroso control de calidad:

* **Pruebas Unitarias:** Suite de 14 vectores de prueba deterministas implementados en Hardhat 3.
* **Métricas de Cobertura (*Code Coverage*):** **100.00% absoluto** de líneas, funciones y bifurcaciones lógicas testeadas de forma exitosa.
* **Auditoría Estática:** Analizado mediante **Slither v0.10.x** (101 detectores ejecutados), reportando **Cero (0) vulnerabilidades de criticidad Alta, Media o Baja**.

---

## 🚀 Instrucciones de Despliegue y Uso Local

### 1. Instalación de Dependencias
```bash
npm install
```

### 2. Compilación de Contratos
```bash
npx hardhat compile
```

### 3. Ejecución de la Suite de Calidad y Cobertura
```bash
npx hardhat test --coverage
```

### 4. Levantamiento del Entorno Local Interactivo
En una terminal secundaria, arrancamos la blockchain simulada:
```bash
npx hardhat node
```

En tu terminal principal, desplegamos los contratos mediante **Hardhat Ignition**:
```bash
npx hardhat ignition deploy ignition/modules/VotingSystem.ts --network localhost --reset
```

### 5. Inyección Automatizada de Datos de Prueba
```bash
npx hardhat run scripts/setup-local.ts --network localhost

npx hardhat run scripts/setup-sepolia.ts --network sepolia
```

---

## 🌐 Despliegue en Producción (GitHub Pages)

La dApp interactiva se encuentra desplegada de forma pública e independiente en la nube a través de **GitHub Pages**, conectada directamente a los contratos inteligentes validados y verificados en la red de pruebas pública **Ethereum Sepolia**. 

https://juan-antonio-ruiz-ruiz.github.io/PFG_VotingApp_TREX/

La interfaz implementa un **sistema de doble rol dinámico**: lee la firma digital del usuario y despliega las pestañas de administración exclusivas si la dirección coincide con el *Owner* (Mesa Electoral), bloqueando de raíz cualquier intento de interacción fraudulenta externa.

---
**Autor:** Juan Antonio Ruiz Ruiz  
**Entidad:** Escuela Técnica Superior de Ingenieros Informáticos (ETSI) - UNED  
