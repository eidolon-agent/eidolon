// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

contract ERC8004ValidationRegistry {
    event CredentialIssued(uint256 indexed credentialId, uint256 indexed agentId, bytes32 capability);
    event CredentialRevoked(uint256 indexed credentialId);

    struct Credential {
        uint256 agentId;
        bytes32 capability;
        bytes32 dataHash;
        uint256 expiresAt;
        bool revoked;
    }

    mapping(uint256 => Credential) public credentials;
    address public identityRegistry;
    uint256 public nextCredentialId = 1;

    constructor(address _identityRegistry) {
        identityRegistry = _identityRegistry;
    }

    modifier onlyOperator(uint256 agentId) {
        require(IdentityRegistry(identityRegistry).operatorOf(agentId) == msg.sender, "Not authorized");
        _;
    }

    function issueCredential(
        uint256 agentId,
        bytes32 capability,
        bytes32 dataHash,
        uint256 expiresAt
    ) external onlyOperator(agentId) returns (uint256 credentialId) {
        credentialId = nextCredentialId++;
        credentials[credentialId] = Credential({
            agentId: agentId,
            capability: capability,
            dataHash: dataHash,
            expiresAt: expiresAt,
            revoked: false
        });
        emit CredentialIssued(credentialId, agentId, capability);
    }

    function verifyCredential(
        uint256 agentId,
        bytes32 capability,
        bytes32 dataHash
    ) external view returns (bool) {
        for (uint256 i = 1; i < nextCredentialId; i++) {
            Credential storage c = credentials[i];
            if (!c.revoked && c.agentId == agentId && c.capability == capability && c.dataHash == dataHash && block.timestamp < c.expiresAt) {
                return true;
            }
        }
        return false;
    }

    function revokeCredential(uint256 credentialId) external {
        require(!credentials[credentialId].revoked, "Already revoked");
        // Only operator of the agent can revoke
        uint256 agentId = credentials[credentialId].agentId;
        require(IdentityRegistry(identityRegistry).operatorOf(agentId) == msg.sender, "Not authorized");
        credentials[credentialId].revoked = true;
        emit CredentialRevoked(credentialId);
    }
}
