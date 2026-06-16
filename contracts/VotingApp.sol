// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "./Ownable.sol";

/**
 * @title IIdentityRegistry (Interfaz)
 * @dev Define el plano o la "firma" de la funcion que queremos consultar del contrato externo.
 * Recrea de forma simplificada el componente de Gestión de Identidad (ONCHAINID / ERC-735) del ecosistema T-REX.
 * El sistema de votación solo necesita saber una única cosa de la identidad: si el usuario está verificado o no 
 * (con la función isVerified)
 */
interface IIdentityRegistry {
    function isVerified(address usuario) external view returns (bool);
}

/**
 * @title VotingApp
 * @author Juan Antonio Ruiz Ruiz (PFG - ETSI Informatica UNED)
 * @notice Controla la lógica de negocio del sistema de votación (alta de candidatos y recuento).
 * @dev Implementa el contrato "Modular Compliance" del estandard ERC-3643, aplicando filtros
 * de elegibilidad dinamicos antes de procesar cualquier voto en la blockchain.
 */
contract VotingApp {
    
    // --- VARIABLES DE INTERCONEXION Y ESTADO ---
    // Variable de tipo Interfaz que almacena la dirección donde esta desplegado el contrato de identidad
    IIdentityRegistry public identityRegistry;
    // Cuenta administradora de la mesa electoral (crea candidatos y abre/cierra la votación)
    address private _administrator;
    // Variable global para abrir/cerrar la votación. true = votación abierta, false = votación cerrada
    bool public openVote;

    // --- ESTRUCTURAS DE DATOS ---
    struct Candidate {
        uint256 id;        // Identificador numerico unico (0, 1, 2...)
        string name;     // Nombre de la votación
        uint256 votes;     // Contador de votos recibidos
    }

    // --- ALMACENAMIENTO (PERSISTENCIA) ---
    // Array dinámico que almacena la lista completa de candidatos disponibles (opciones de la votación)
    Candidate[] public candidates;
    // Contador global de candidatos 
    uint256 public totalCandidates;

    // Control para evitar doble voto: Mapeo que registra si una dirección de billetera ya ha participado
    mapping(address => bool) public hasVoted;

    // --- EVENTOS ---
    event VoteAdded(address indexed voter, uint256 indexed candidateId);
    event VotingStatusChanged(bool open);

    // --- MODIFICADORES DE ACCESO ---
    modifier onlyAdmin() {
        require(msg.sender == _administrator, "No eres es el administrador");
        _;
    }

    /**
     * @notice Indica si el votante cumple las reglas de elegibilidad (Modular Compliance de ERC-3643).
     * @dev Intercepta la transaccion de voto y aplica una triple verificación de seguridad on-chain.
     */
    modifier isEligible() {
        // 1. FILTRO DE IDENTIDAD (Inter-contract call): Llama al contrato externo de Registro
        require(identityRegistry.isVerified(msg.sender), "Transaccion rechazada: Identidad no verificada");
        
        // 2. FILTRO DE REGLA TEMPORAL: Comprueba si el periodo electoral sigue activo
        require(openVote, "Transaccion rechazada: Periodo de votacion cerrado");
        
        // 3. FILTRO DE RESTRICCION DE NEGOCIO: Evita el fraude del doble voto
        require(!hasVoted[msg.sender], "Transaccion rechazada: El usuario ya ha votado");
        
        _; // Si los 3 requisitos son exitosos, se ejecuta la función addVote
    }

    // --- CONSTRUCTOR ---
    /**
     * @notice Constructor del sistema de votación.
     * @param _initialIdentityRegistry Dirección real (0x...) del contrato IdentityRegistry previamente desplegado.
     */
    constructor(address _initialIdentityRegistry)  {        
        _administrator = msg.sender;
        openVote = true; // Por defecto, la votación se inicia abierta al desplegar
        identityRegistry = IIdentityRegistry(_initialIdentityRegistry);  //direccion del contrato externo de identidad desplegado previamente
    }

    // --- FUNCIONES DE ESCRITURA (MODIFICAN EL ESTADO / CONSUMEN GAS) ---
    
    // Enlazamos la interfaz con la direccion del contrato externo de identidad (si ha cambiado)
    /**
    * @param _identityAddress Direccion real (0x...) del contrato IdentityRegistry previamente desplegado.
    */
    function setIdentityRegistry(address _identityAddress) external onlyAdmin {
        identityRegistry = IIdentityRegistry(_identityAddress);
    }

    /**
     * @notice Permite al administrador añadir nuevas opciones a la votación 
     * @param _name Cadena de texto. 
     */
    function addCandidate(string memory _name) external onlyAdmin {
        // Insertamos el nuevo candidato al final del array 'candidates'
        candidates.push(Candidate({
            id: totalCandidates,
            name: _name,
            votes: 0 // Inicia con cero votos acumulados
        }));
        
        // Incrementamos el contador para el ID del siguiente candidato
        totalCandidates++;
    }

    /**
     * @notice Registra el voto en la blockchain.
     * @dev Utiliza el modificador 'isEligible' para denegar el voto a votantes no autorizados.
     * @param candidateId El numero identificador de la opción elegida.
     */
    function addVote(uint256 candidateId) external isEligible {
        //Garantiza que el ID enviado existe dentro del rango de candidatos dados de alta
        require(candidateId < totalCandidates, "El candidato elegido no existe");

        // Cambiamos el estado del votante en el almacenamiento para evitar que vuelva a llamar a la funcion
        hasVoted[msg.sender] = true;
        
        // Incrementamos el contador de votos del candidato seleccionado dentro del array
        candidates[candidateId].votes++;

        // Emitimos el evento de exito para auditar la transaccion
        emit VoteAdded(msg.sender, candidateId);
    }

    /**
     * @notice Cierra o abre la votación digital segun las necesidades de la mesa electoral.
     */
    function changeVotingStatus(bool status) external onlyAdmin {
        openVote = status;
        emit VotingStatusChanged(status);
    }

    // --- FUNCIONES DE LECTURA (VIEW / GRATUITAS) ---

    /**
     * @notice Devuelve la informacion publica de un candidato especifico.
     * @dev Utilizado por el script 'app.js' del frontend para pintar los resultados en la interfaz web.
     */
    function getCandidate(uint256 candidateId) external view returns (string memory name, uint256 votes) {
        require(candidateId < totalCandidates, "El candidato seleccionado no existe");
        
        // Recuperamos el candidato de la persistencia del contrato
        Candidate memory candidate = candidates[candidateId];
        
        // Retornamos multiples valores (el nombre de tipo string en memory y el numero de votos)
        return (candidate.name, candidate.votes);
    }
}
