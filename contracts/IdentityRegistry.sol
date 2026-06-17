// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/access/Ownable.sol";

/**
 * @title identityRegistry
 * @author Juan Antonio Ruiz (PFG - ETSI Informatica UNED)
 * @notice Este contrato actúa como el motor de elegibilidad on-chain (Identity Registry). 
 * Gestiona múltiples tipos de credenciales de identidad (Claim Topics) dinámicamente.
 * @dev Recrea de forma simplificada el comportamiento del estandard ERC-3643 (Protocolo T-REX),
 * gestionando el alta, baja y validación de claims (credenciales de identidad).
 */
contract IdentityRegistry is Ownable {
    
    // --- VARIABLES DE ESTADO ---
   
    // Array que almacenará los sufragios (Claim Topics) permitidos.    
    uint256[] private allowedClaimTopics;
    // Mapeo para búsqueda rápida de topics permitidos
    mapping(uint256 => bool) private isClaimTopicAllowed;
    // Mapeo para almacenar la descripción de cada claim topic
    mapping(uint256 => string) private claimTopicDescriptions;

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
    mapping(address => mapping(uint256 => Credential)) private _credentialRegistry;

    // --- EVENTOS (INDEXADOS PARA FACILITAR LA LECTURA DEL FRONTEND) ---
    // Se emite cuando se autoriza una nueva wallet en el sistema
    event CredentialAuthorized(address indexed user, address indexed issuer, uint256 claimTopic);
    // Se emite cuando el administrador retira el derecho a voto de una wallet
    event CredentialRevoked(address indexed user, uint256 claimTopic);
    // Se emite cuando se agrega un nuevo tipo de credencial permitido
    event ClaimTopicAdded(uint256 indexed claimTopic, string description);


    // --- CONSTRUCTOR ---

    // Pasamos el msg.sender al constructor base de Ownable de OpenZeppelin
    constructor() Ownable(msg.sender) {
        // Ownable guardará internamente al dueño del contrato (administrador de la mesa electoral)
        // Inicializamos con un topic por defecto: 50
        allowedClaimTopics.push(50);
        isClaimTopicAllowed[50] = true;
        claimTopicDescriptions[50] = "Votacion por defecto";
    }

    // --- FUNCIONES EXTERNAS (ESCRITURA) ---

    /**
     * @notice Permite al administrador agregar una nueva votación.
     * @param _claimTopic El nuevo identificador de tipo de credencial a permitir.
     * @param _description Descripción de la elección para mostrar en la GUI.
     */
    function addClaimTopic(uint256 _claimTopic, string memory _description) external onlyOwner {
        require(!isClaimTopicAllowed[_claimTopic], "La votacion ya existe");
        require(bytes(_description).length > 0, "La descripcion no puede estar vacia");
        
        allowedClaimTopics.push(_claimTopic);
        isClaimTopicAllowed[_claimTopic] = true;
        claimTopicDescriptions[_claimTopic] = _description;
        
        emit ClaimTopicAdded(_claimTopic, _description);
    }

    /**
     * @notice Registra un nuevo votante asignándole una credencial válida en el sistema.
     * @dev Simula la funcion "addClaim" del componente ONCHAINID (ERC-735).
     * @param _user Dirección de la billetera del usuario.
     * @param _claimTopic El tipo de credencial a asignar (debe estar en allowedClaimTopics).
     * @param _signature Datos criptograficos de la firma (simulada durante las pruebas).
     */
    function addVoter(address _user, uint256 _claimTopic, bytes memory _signature) external onlyOwner {
        // Evita registrar la direccion cero (invalida/quemada)
        require(_user != address(0), "Direccion invalida");
        // Valida que el claim topic sea permitido
        require(isClaimTopicAllowed[_claimTopic], "Esta votacion no esta permitida");
        
        // Escritura en STORAGE: Guardamos la estructura en el mapeo de persistencia
        _credentialRegistry[_user][_claimTopic] = Credential({
            claimTopic: _claimTopic,
            issuer: owner(),
            signature: _signature,
            valid: true
        });

        // Emitimos el evento para que los servidores Web3 o el frontend capturen el cambio al instante
        emit CredentialAuthorized(_user, owner(), _claimTopic);
    }

    /**
     * @notice Invalida la credencial de un usuario, retirándole el permiso para participar.
     * @param _user Dirección de la billetera que se desea revocar.
     * @param _claimTopic El tema de la credencial que se desea revocar.
     */
    function revokeVoter(address _user, uint256 _claimTopic) external onlyOwner {
        // Control de errores: No se puede revocar a alguien que no esta activo
        require(_credentialRegistry[_user][_claimTopic].valid, "El usuario no esta registrado en esa votacion");
        
        // Modificacion en STORAGE: Apagamos el interruptor de validez
        _credentialRegistry[_user][_claimTopic].valid = false;
        
        emit CredentialRevoked(_user, _claimTopic);
    }

    // --- FUNCIONES DE CONSULTA (LECTURA/VIEW) ---

    /**
     * @notice Devuelve la lista de claim topics permitidos.
     * @return Array con los identificadores de tipos de credencial permitidos.
     */
    function getAllowedClaimTopics() external view returns (uint256[] memory) {
        return allowedClaimTopics;
    }

    /**
     * @notice Verifica si un claim topic específico está permitido en el sistema.
     * @param _claimTopic El identificador del tipo de credencial a validar.
     * @return true si el claim topic está permitido, false en caso contrario.
     */
    function isAllowedClaimTopic(uint256 _claimTopic) external view returns (bool) {
        return isClaimTopicAllowed[_claimTopic];
    }

    /**
     * @notice Obtiene la descripción de un claim topic.
     * @param _claimTopic El identificador del tipo de credencial.
     * @return La descripción de la elección.
     */
    function getClaimTopicDescription(uint256 _claimTopic) external view returns (string memory) {
        require(isClaimTopicAllowed[_claimTopic], "El claim topic no existe");
        return claimTopicDescriptions[_claimTopic];
    }

    /**
     * @notice Funcion CORE exigida por el Whitepaper de ERC-3643 (Identity Registry).
     * @dev Es una funcion de tipo 'view', no consume Gas cuando se llama desde una aplicacion cliente (web).
     * @param _user Direccion de la billetera que desea interactuar con la dApp.
     * @return true si la wallet posee una credencial activa, de un tema permitido y firmada por el administrador.
     */
    function isVerified(address _user, uint256 _topic) external view returns (bool) {
        // Recuperamos temporalmente la estructura desde el storage a la memoria volatil
        Credential memory cred = _credentialRegistry[_user][_topic];
        
        // Evaluacion logica de los 3 requisitos de cumplimiento del protocolo T-REX
        return (cred.valid && cred.claimTopic == _topic &&isClaimTopicAllowed[cred.claimTopic] && cred.issuer == owner());
    }
}
