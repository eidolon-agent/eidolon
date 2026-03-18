// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

/**
 * @title ValidationRegistry
 * @dev Manages capability validations, credential issuance, and proof verification
 * Agents can validate each other's capabilities and issue verifiable credentials
 */

import "./interfaces.sol";

contract ValidationRegistry {
    using interfaces.IERC8004Identity for IERC8004Identity;
    using interfaces.IReputationRegistry for IReputationRegistry;

        bytes32 agentId;
        bytes32 capabilityHash;
        bytes32 validatorId;
        uint256 issuedAt;
        uint256 expiresAt;
        uint256 confidenceScore;
        string evidenceURI;
        bool isRevoked;
        bytes signature;
    }

    struct ValidationRequest {
        bytes32 requestId;
        bytes32 agentId;
        bytes32 capabilityHash;
        address requester;
        uint256 requestedAt;
        uint256 timeout;
        bytes dataHash;
        bool fulfilled;
    }

    struct Scope {
        bytes32 scopeId;
        string name;
        string description;
        bytes32[] allowedActions;
    }

    mapping(bytes32 => Credential[]) public agentCredentials;
    mapping(bytes32 => Credential) public credentialById;
    mapping(bytes32 => ValidationRequest) public validationRequests;
    mapping(bytes32 => bool) public scopesExist;
    mapping(bytes32 => Scope) public scopes;
    mapping(bytes32 => mapping(bytes32 => bool)) public revokedCredentials;

    IERC8004Identity public identityRegistry;
    IReputationRegistry public reputationRegistry;

    event CredentialIssued(
        bytes32 indexed credentialId,
        bytes32 indexed agentId,
        bytes32 indexed capabilityHash,
        bytes32 indexed validatorId,
        uint256 expiresAt,
        uint256 confidenceScore
    );
    event CredentialRevoked(bytes32 indexed credentialId, bytes32 indexed agentId, address revokedBy);
    event ValidationRequestCreated(
        bytes32 indexed requestId,
        bytes32 indexed agentId,
        bytes32 capabilityHash,
        address requester,
        uint256 timeout
    );
    event ValidationFulfilled(
        bytes32 indexed requestId,
        bytes32 credentialId,
        bytes32 indexed validatorId
    );
    event ScopeDefined(bytes32 indexed scopeId, string name, string description);

    constructor(address _identityRegistry, address _reputationRegistry) {
        identityRegistry = IERC8004Identity(_identityRegistry);
        reputationRegistry = IReputationRegistry(_reputationRegistry);
    }

    function _getValidatorId(address addr) internal view returns (bytes32) {
        bytes32[] memory agents = reputationRegistry.getOperatorAgents(addr);
        return agents.length > 0 ? agents[0] : bytes32(0);
    }

    function _isCredentialRevoked(bytes32 agentId, bytes32 capabilityHash) internal view returns (bool) {
        return revokedCredentials[agentId][capabilityHash];
    }

    function _isCredentialExpired(Credential memory cred) internal pure returns (bool) {
        return cred.expiresAt > 0 && block.timestamp >= cred.expiresAt;
    }

    function _isValidator(address addr) internal view returns (bool) {
        bytes32 validatorId = _getValidatorId(addr);
        return validatorId != 0 && reputationRegistry.isValidator(validatorId);
    }

    function issueCredential(
        bytes32 agentId,
        bytes32 capabilityHash,
        uint256 expiresAt,
        uint256 confidenceScore,
        string memory evidenceURI,
        bytes memory signature
    ) external returns (bytes32) {
        require(!_isCredentialRevoked(agentId, capabilityHash), "Revoked credential for this capability");
        require(confidenceScore >= 500, "Confidence too low");
        
        bytes32 validatorId = _getValidatorId(msg.sender);
        require(validatorId != 0, "Not a registered validator");

        bytes32 credentialId = keccak256(abi.encodePacked(
            agentId,
            capabilityHash,
            validatorId,
            block.timestamp
        ));

        if (credentialById[credentialId].issuedAt > 0) {
            return credentialId;
        }

        Credential storage cred = Credential({
            credentialId: credentialId,
            agentId: agentId,
            capabilityHash: capabilityHash,
            validatorId: validatorId,
            issuedAt: block.timestamp,
            expiresAt: expiresAt,
            confidenceScore: confidenceScore,
            evidenceURI: evidenceURI,
            isRevoked: false,
            signature: signature
        });

        credentialById[credentialId] = cred;
        agentCredentials[agentId].push(cred);

        emit CredentialIssued(
            credentialId,
            agentId,
            capabilityHash,
            validatorId,
            expiresAt,
            confidenceScore
        );

        reputationRegistry.updateReputation(
            agentId,
            0, 0,
            int256(confidenceScore) / 100,
            0, 0
        );

        return credentialId;
    }

    function createValidationRequest(
        bytes32 agentId,
        bytes32 capabilityHash,
        uint256 timeout,
        bytes32 dataHash
    ) external returns (bytes32) {
        require(msg.sender != address(0), "Invalid sender");
        require(timeout > block.timestamp, "Invalid timeout");

        bytes32 requestId = keccak256(abi.encodePacked(
            agentId,
            capabilityHash,
            msg.sender,
            block.timestamp
        ));

        require(validationRequests[requestId].requestedAt == 0, "Request already exists");

        ValidationRequest storage req = ValidationRequest({
            requestId: requestId,
            agentId: agentId,
            capabilityHash: capabilityHash,
            requester: msg.sender,
            requestedAt: block.timestamp,
            timeout: timeout,
            dataHash: dataHash,
            fulfilled: false
        });

        validationRequests[requestId] = req;

        emit ValidationRequestCreated(
            requestId,
            agentId,
            capabilityHash,
            msg.sender,
            timeout
        );

        return requestId;
    }

    function fulfillValidationRequest(
        bytes32 requestId,
        bool passed,
        uint256 confidenceScore,
        string memory evidenceURI
    ) external returns (bytes32) {
        ValidationRequest storage req = validationRequests[requestId];
        require(req.requestedAt > 0, "Request doesn't exist");
        require(!req.fulfilled, "Request already fulfilled");
        require(block.timestamp < req.timeout, "Request expired");
        
        bytes32 validatorId = _getValidatorId(msg.sender);
        require(validatorId != 0, "Not a validator");
        require(confidenceScore >= 500, "Confidence too low");

        req.fulfilled = true;

        if (passed) {
            bytes32 credentialId = issueCredential(
                req.agentId,
                req.capabilityHash,
                0,
                confidenceScore,
                evidenceURI,
                bytes("")
            );
            emit ValidationFulfilled(requestId, credentialId, validatorId);
            return credentialId;
        } else {
            reputationRegistry.recordValidation(
                req.agentId,
                req.capabilityHash,
                false,
                evidenceURI
            );
            return bytes32(0);
        }
    }

    function revokeCredential(bytes32 credentialId, address revokedBy) external {
        Credential storage cred = credentialById[credentialId];
        require(cred.issuedAt > 0, "Credential doesn't exist");
        require(!cred.isRevoked, "Already revoked");
        require(
            revokedBy == address(this) ||
            _isValidator(revokedBy) ||
            cred.validatorId == _getValidatorId(revokedBy)
        );

        cred.isRevoked = true;
        revokedCredentials[cred.agentId][cred.capabilityHash] = true;

        emit CredentialRevoked(credentialId, cred.agentId, revokedBy);

        reputationRegistry.updateReputation(
            cred.agentId,
            0, 0,
            -50,
            0, 0
        );
    }

    function defineScope(
        bytes32 scopeId,
        string memory name,
        string memory description,
        bytes32[] memory allowedActions
    ) external {
        require(!scopesExist[scopeId], "Scope already exists");
        require(bytes(name).length > 0, "Name required");

        Scope storage scope = scopes[scopeId];
        scope.scopeId = scopeId;
        scope.name = name;
        scope.description = description;
        scope.allowedActions = allowedActions;
        scopesExist[scopeId] = true;

        emit ScopeDefined(scopeId, name, description);
    }

    function hasValidCredential(
        bytes32 agentId,
        bytes32 capabilityHash,
        uint256 minConfidence
    ) external view returns (bool, uint256, uint256) {
        Credential[] memory creds = agentCredentials[agentId];
        
        for (uint256 i = 0; i < creds.length; i++) {
            Credential memory cred = creds[i];
            if (cred.capabilityHash == capabilityHash && 
                !cred.isRevoked &&
                !_isCredentialExpired(cred) &&
                cred.confidenceScore >= minConfidence) {
                return (true, cred.confidenceScore, cred.issuedAt);
            }
        }
        
        return (false, 0, 0);
    }

    function getAgentCredentials(bytes32 agentId) external view returns (Credential[] memory) {
        return agentCredentials[agentId];
    }

    function getAgentName(bytes32 agentId) external view returns (string memory) {
        (, , , , , string memory name, ) = identityRegistry.identities(agentId);
        return name;
    }
}
