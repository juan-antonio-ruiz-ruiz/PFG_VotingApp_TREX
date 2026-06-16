// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "./Ownable.sol";

/**
 * @title identityRegistry
 * @author Juan Antonio Ruiz (PFG - ETSI Informatica UNED)
 * @notice Este contrato actúa como el motor de elegibilidad on-chain (Identity Registry).
 * @dev Recrea de forma simplificada el comportamiento del estandard ERC-3643 (Protocolo T-REX),
 * gestionando el alta, baja y validación de claims (credenciales de identidad).
 */
contract IdentityRegistry is Ownable {
    
    // --- VARIABLES DE ESTADO ---
   
    // Constante numerica que identifica el tipo de certificado (Claim Topic) exigido.
    // El numero 50 actua en este contexto como el código que define "Usuario con Derecho a Voto".
    uint256 public constant CLAIM_TOPIC = 50;

    // --- ESTRUCTURAS DE DATOS ---
    // Representa la estructura interna de una credencial ERC-3643 guardada on-chain
    struct Credential {
        uint256 claimTopic;     // Identificador del tipo de credencial (ej: 50)
        address issuer;   // Quien firma el certificado (en este MVP, el administrador)
        bytes signature;      // Firma criptográfica generada off-chain para auditorias futuras
        bool valid;      // Estado de la credencial (true = activa, false = cancelada)
    }

    // --- ALMACENAMIENTO (PERSISTENCIA) ---
    // Mapeo clave-valor: Clave publica del usuario => Datos de su credencial de identidad.
    // Se declara 'private' por buenas practicas de encapsulamiento; se accede mediante 'isVerified'.
    mapping(address => Credential) private _credentialRegistry;

    // --- EVENTOS (INDEXADOS PARA FACILITAR LA LECTURA DEL FRONTEND) ---
    // Se emite cuando se autoriza una nueva wallet en el sistema
    event CredentialAuthorized(address indexed user, address indexed issuer, uint256 claimTopic);
    // Se emite cuando el administrador retira el derecho a voto de una wallet
    event CredentialRevoked(address indexed user);


    // --- FUNCIONES EXTERNAS (ESCRITURA) ---
    /**
     * @notice Registra un nuevo votante asignándole una credencial válida en el sistema.
     * @dev Simula la funcion "addClaim" del componente ONCHAINID (ERC-735).
     * @param _user Dirección de la billetera del usuario.
     * @param _signature Datos criptograficos de la firma (simulada durante las pruebas).
     */
    function addVoter(address _user, bytes memory _signature) external onlyOwner {
        // Evita registrar la direccion cero (invalida/quemada)
        require(_user != address(0), "Direccion invalida");
        
        // Escritura en STORAGE: Guardamos la estructura en el mapeo de persistencia
        _credentialRegistry[_user] = Credential({
            claimTopic: CLAIM_TOPIC,
            issuer: owner(),
            signature: _signature,
            valid: true
        });

        // Emitimos el evento para que los servidores Web3 o el frontend capturen el cambio al instante
        emit CredentialAuthorized(_user, owner(), CLAIM_TOPIC);
    }

    /**
     * @notice Invalida la credencial de un usuario, retirándole el permiso para participar.
     * @param _user Dirección de la billetera que se desea revocar.
     */
    function revokeVoter(address _user) external onlyOwner {
        // Control de errores: No se puede revocar a alguien que no esta activo
        require(_credentialRegistry[_user].valid, "El usuario no esta registrado");
        
        // Modificacion en STORAGE: Apagamos el interruptor de validez
        _credentialRegistry[_user].valid = false;
        
        emit CredentialRevoked(_user);
    }

    // --- FUNCIONES DE CONSULTA (LECTURA/VIEW) ---

    /**
     * @notice Funcion CORE exigida por el Whitepaper de ERC-3643 (Identity Registry).
     * @dev Es una funcion de tipo 'view', no consume Gas cuando se llama desde una aplicacion cliente (web).
     * @param _user Direccion de la billetera que desea interactuar con la dApp.
     * @return true si la wallet posee una credencial activa, del tema correcto y firmada por el administrador.
     */
    function isVerified(address _user) external view returns (bool) {
        // Recuperamos temporalmente la estructura desde el storage a la memoria volatil
        Credential memory cred = _credentialRegistry[_user];
        
        // Evaluacion logica de los 3 requisitos de cumplimiento del protocolo T-REX
        return (cred.valid && cred.claimTopic == CLAIM_TOPIC && cred.issuer == owner());
    }
}
