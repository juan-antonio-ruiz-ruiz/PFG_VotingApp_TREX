// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/access/Ownable.sol";

/**
 * @title AdminManager
 * @author Juan Antonio Ruiz (PFG - ETSI Informatica UNED)
 * @notice Contrato base reutilizable que añade un rol de administrador delegado
 * sobre el control de propiedad estándar de OpenZeppelin (Ownable).
 * @dev Hereda de Ownable. Tanto IdentityRegistry como VotingApp heredan de este
 * contrato para evitar duplicar la lógica de gestión de administradores.
 */
abstract contract AdminManager is Ownable {

    // --- CONSTRUCTOR ---

    // Inicializa Ownable con msg.sender. Los contratos hijos no necesitan llamar a Ownable(msg.sender).
    constructor() Ownable(msg.sender) {}

    // --- ALMACENAMIENTO ---

    /// @notice Registro de administradores delegados (distintos del owner).
    mapping(address => bool) public admins;

    // --- EVENTOS ---

    /// @notice Se emite cuando el owner concede el rol de administrador.
    event AdminAdded(address indexed admin);
    /// @notice Se emite cuando el owner revoca el rol de administrador.
    event AdminRemoved(address indexed admin);

    // --- MODIFICADOR DE ROL ---

    /**
     * @notice Permite la ejecución solo al owner o a administradores delegados.
     */
    modifier onlyAdmin() {
        require(
            owner() == msg.sender || admins[msg.sender],
            "No autorizado: se requiere rol de administrador"
        );
        _;
    }

    // --- FUNCIONES DE GESTIÓN DE ADMINS ---

    /**
     * @notice El owner puede delegar el rol de administrador a otra dirección.
     * @param _admin Dirección a la que se concede el rol de administrador.
     */
    function addAdmin(address _admin) external onlyOwner {
        require(_admin != address(0), "Direccion invalida");
        require(_admin != owner(), "El owner ya tiene todos los permisos");
        admins[_admin] = true;
        emit AdminAdded(_admin);
    }

    /**
     * @notice El owner puede revocar el rol de administrador de una dirección.
     * @param _admin Dirección a la que se revoca el rol de administrador.
     */
    function removeAdmin(address _admin) external onlyOwner {
        require(admins[_admin], "La direccion no es administrador");
        admins[_admin] = false;
        emit AdminRemoved(_admin);
    }

    /**
     * @notice Comprueba si una dirección tiene rol de administrador (owner o delegado).
     * @param _addr Dirección a consultar.
     * @return true si es owner o admin delegado.
     */
    function isAdmin(address _addr) external view returns (bool) {
        return _addr == owner() || admins[_addr];
    }
}
