// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/access/Ownable.sol"; //Estándar de propiedad de OpenZeppelin
import "@openzeppelin/contracts/utils/Pausable.sol"; //Estándar de pausa de OpenZeppelin

/**
 * @title IIdentityRegistry (Interfaz)
 * @dev Define el plano o la "firma" de las funciones que queremos consultar del contrato externo.
 * Recrea de forma simplificada el componente de Gestión de Identidad (ONCHAINID / ERC-735) del ecosistema T-REX.
 * El sistema de votación solo necesita validar que el usuario tenga una credencial válida.
 */
interface IIdentityRegistry {
    function isVerified(address user, uint256 topic) external view returns (bool);
    function isAllowedClaimTopic(uint256 claimTopic) external view returns (bool);
}

/**
 * @title VotingApp
 * @author Juan Antonio Ruiz Ruiz (PFG - ETSI Informatica UNED)
 * @notice Controla la lógica de negocio del sistema de votación (alta de candidatos y recuento).
 * @dev Implementa el contrato "Modular Compliance" del estandard ERC-3643, aplicando filtros
 * de elegibilidad dinamicos antes de procesar cualquier voto en la blockchain. Implementa control de ciclo de vida (Pausable).
 */
contract VotingApp is Ownable, Pausable {
    
    // --- VARIABLES DE INTERCONEXION Y ESTADO ---

    // Variable de tipo Interfaz que almacena la dirección donde esta desplegado el contrato de identidad
    IIdentityRegistry public identityRegistry;

    // --- ESTRUCTURAS DE DATOS ---

    struct Candidate {
        uint256 id;              // Identificador numerico unico dentro de cada elección
        uint256 claimTopic;      // Tipo de credencial asociado a esta elección
        string name;             // Nombre del candidato
        uint256 votes;           // Contador de votos recibidos
    }

    // --- ALMACENAMIENTO (PERSISTENCIA) ---

    // Mapping que almacena si la votación esta abierta por cada claim topic
    mapping(uint256 => bool) public openVote;
    
    // Mapping que almacena los candidatos para cada claim topic
    mapping(uint256 => Candidate[]) private candidates;
    
    // Mapping que almacena el contador de candidatos para cada claim topic
    mapping(uint256 => uint256) public totalCandidates;

    // Control para evitar doble voto: Mapeo que registra si una dirección ya ha votado en cada claim topic
    mapping(address => mapping(uint256 => bool)) public hasVoted;

    // --- EVENTOS ---
    event VoteAdded(address indexed voter, uint256 indexed claimTopic, uint256 indexed candidateId);
    event VotingStatusChanged(uint256 indexed claimTopic, bool open);


    /**
     * @notice Indica si el votante cumple las reglas de elegibilidad (Modular Compliance de ERC-3643).
     * @dev Intercepta la transaccion de voto y aplica una triple verificación de seguridad on-chain.
     * @param _claimTopic El tipo de credencial de la elección en la que desea votar.
     */
    modifier isEligible(uint256 _claimTopic) {
        // 1. FILTRO DE IDENTIDAD (Inter-contract call): Llama al contrato externo de Registro
        require(identityRegistry.isVerified(msg.sender, _claimTopic), "Transaccion rechazada: Identidad no verificada");
        
        // 2. FILTRO DE REGLA DE NEGOCIO: Comprueba que el claim topic es permitido en el sistema
        require(identityRegistry.isAllowedClaimTopic(_claimTopic), "Transaccion rechazada: Votacion no permitida");

        // 3. FILTRO DE REGLA TEMPORAL: Comprueba si el periodo electoral sigue activo para este topic
        require(openVote[_claimTopic], "Transaccion rechazada: Periodo de votacion cerrado");
        
        // 4. FILTRO DE RESTRICCION DE NEGOCIO: Evita el fraude del doble voto en esta elección
        require(!hasVoted[msg.sender][_claimTopic], "Transaccion rechazada: El usuario ya ha votado en esta eleccion");
        
        _; // Si los 3 requisitos son exitosos, se ejecuta la función addVote
    }

    // --- CONSTRUCTOR ---
    
    /**
     * @notice Constructor del sistema de votación. Pasamos el msg.sender al constructor base de Ownable de OpenZeppelin
     * @param _initialIdentityRegistry Dirección real del contrato IdentityRegistry previamente desplegado.
     */
    constructor(address _initialIdentityRegistry) Ownable(msg.sender) {        
        require(_initialIdentityRegistry != address(0), "Direccion de identidad invalida");
        
        identityRegistry = IIdentityRegistry(_initialIdentityRegistry);
    }

    // --- FUNCIONES DE CONTROL DE CICLO DE VIDA

    /**
     * @notice Detiene las votaciones ante una emergencia o migración.
     */
    function pauseVoting() external onlyOwner {
        _pause(); // Función interna de OpenZeppelin Pausable
    }

    /**
     * @notice Reanuda las votaciones detenidas.
     */
    function unpauseVoting() external onlyOwner {
        _unpause(); // Función interna de OpenZeppelin Pausable
    }

    // --- FUNCIONES DE ESCRITURA (MODIFICAN EL ESTADO / CONSUMEN GAS) ---
    
    // Enlazamos la interfaz con la direccion del contrato externo de identidad (si ha cambiado)
    /**
    * @param _identityAddress Direccion real (0x...) del contrato IdentityRegistry previamente desplegado.
    */
    function setIdentityRegistry(address _identityAddress) external onlyOwner {
        identityRegistry = IIdentityRegistry(_identityAddress);
    }

    /**
     * @notice Permite al administrador añadir nuevas opciones a una votación.
     * @dev Cada candidato se asocia a un claim topic específico (tipo de credencial).
     * @param _claimTopic El tipo de credencial para la cual se registra el candidato.
     * @param _name Nombre del candidato.
     */
    function addCandidate(uint256 _claimTopic, string memory _name) external onlyOwner {
        // Validamos que el claim topic es permitido en el sistema
        require(identityRegistry.isAllowedClaimTopic(_claimTopic), "Votacion no permitida");
        
        // Insertamos el nuevo candidato al final del array de ese claim topic
        candidates[_claimTopic].push(Candidate({
            id: totalCandidates[_claimTopic],
            claimTopic: _claimTopic,
            name: _name,
            votes: 0 // Inicia con cero votos acumulados
        }));
        
        // Incrementamos el contador para el ID del siguiente candidato en ese topic
        totalCandidates[_claimTopic]++;
    }

    /**
     * @notice Registra el voto en la blockchain para una elección específica.
     * @dev Utiliza el modificador 'isEligible' para denegar el voto a votantes no autorizados.
     * Añadido 'whenNotPaused' para congelar la función si se pausa el contrato.
     * @param _claimTopic El tipo de credencial de la elección en la que desea votar.
     * @param _candidateId El numero identificador del candidato elegido.
     */
    function addVote(uint256 _claimTopic, uint256 _candidateId) external whenNotPaused isEligible(_claimTopic) {
        require(identityRegistry.isAllowedClaimTopic(_claimTopic), "Votacion no permitida");

        //Garantiza que el ID enviado existe dentro del rango de candidatos de este claim topic
        require(_candidateId < totalCandidates[_claimTopic], "El candidato elegido no existe en esta eleccion");

        // Cambiamos el estado del votante en el almacenamiento para evitar que vuelva a llamar a la funcion
        hasVoted[msg.sender][_claimTopic] = true;
        
        // Incrementamos el contador de votos del candidato seleccionado
        candidates[_claimTopic][_candidateId].votes++;

        // Emitimos el evento de exito para auditar la transaccion
        emit VoteAdded(msg.sender, _claimTopic, _candidateId);
    }

    /**
     * @notice Cierra o abre la votación digital para un claim topic específico.
     * @param _claimTopic El tipo de credencial de la elección a modificar.
     * @param _status true para abrir, false para cerrar.
     */
    function changeVotingStatus(uint256 _claimTopic, bool _status) external onlyOwner {
        // Validamos que el claim topic es permitido en el sistema
        require(identityRegistry.isAllowedClaimTopic(_claimTopic), "Votacion no permitida");
        
        openVote[_claimTopic] = _status;
        emit VotingStatusChanged(_claimTopic, _status);
    }

    // --- FUNCIONES DE LECTURA (VIEW / GRATUITAS) ---

    /**
     * @notice Devuelve la informacion publica de un candidato especifico.
     * @dev Utilizado por el script 'app.js' del frontend para pintar los resultados en la interfaz web.
     * @param _claimTopic El tipo de credencial de la elección.
     * @param _candidateId El identificador del candidato.
     */
    function getCandidate(uint256 _claimTopic, uint256 _candidateId) external view returns (string memory name, uint256 votes) {
        require(_candidateId < totalCandidates[_claimTopic], "El candidato seleccionado no existe en esa eleccion");
        
        // Recuperamos el candidato de la persistencia del contrato
        Candidate memory candidate = candidates[_claimTopic][_candidateId];
        
        // Retornamos multiples valores (el nombre de tipo string en memory y el numero de votos)
        return (candidate.name, candidate.votes);
    }
}
