// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {ReentrancyGuard} from "@openzeppelin/contracts/utils/ReentrancyGuard.sol";

/**
 * @title Divvy
 * @notice Payment splitter for native BOT on BOT Testnet.
 * Tagline: "Everyone gets their cut."
 */
contract Divvy is ReentrancyGuard {
    struct Split {
        address creator;
        string name;
        uint256 totalReceived;
        uint64 createdAt;
    }

    uint256 public splitCount;

    // Splits storage
    mapping(uint256 => Split) private _splits;
    mapping(uint256 => address[]) private _splitMembers;
    mapping(uint256 => mapping(address => uint16)) private _bps;
    mapping(uint256 => mapping(address => uint256)) private _released;
    mapping(address => uint256[]) private _splitIdsByMember;

    // Events
    event SplitCreated(uint256 indexed id, address indexed creator);
    event Paid(uint256 indexed id, address indexed payer, uint256 amount);
    event Withdrawn(uint256 indexed id, address indexed member, uint256 amount);

    // Custom errors
    error InvalidNameLength();
    error InvalidMemberCount();
    error ArrayLengthMismatch();
    error ZeroAddress();
    error DuplicateMember();
    error InvalidBps();
    error TotalBpsNot10000();
    error SplitDoesNotExist();
    error ZeroPayment();
    error NotAMember();
    error NothingOwed();
    error TransferFailed();

    /**
     * @notice Create a new split.
     * @param name Name of the split (1 to 50 bytes).
     * @param members Array of member addresses (2 to 20 unique non-zero addresses).
     * @param bps Array of basis point shares corresponding to members (each > 0, sum == 10_000).
     * @return id The ID of the newly created split.
     */
    function createSplit(
        string calldata name,
        address[] calldata members,
        uint16[] calldata bps
    ) external returns (uint256 id) {
        uint256 nameLen = bytes(name).length;
        if (nameLen < 1 || nameLen > 50) revert InvalidNameLength();

        uint256 memberCount = members.length;
        if (memberCount < 2 || memberCount > 20) revert InvalidMemberCount();
        if (memberCount != bps.length) revert ArrayLengthMismatch();

        uint256 totalBps = 0;
        for (uint256 i = 0; i < memberCount; ++i) {
            address member = members[i];
            if (member == address(0)) revert ZeroAddress();

            uint16 memberBps = bps[i];
            if (memberBps == 0) revert InvalidBps();

            // Check for duplicates
            for (uint256 j = 0; j < i; ++j) {
                if (members[j] == member) revert DuplicateMember();
            }

            totalBps += memberBps;
        }

        if (totalBps != 10_000) revert TotalBpsNot10000();

        id = ++splitCount;
        // forge-lint: disable-next-line(unsafe-typecast)
        uint64 createdAt = uint64(block.timestamp);

        _splits[id] = Split({
            creator: msg.sender,
            name: name,
            totalReceived: 0,
            createdAt: createdAt
        });

        _splitMembers[id] = members;

        for (uint256 i = 0; i < memberCount; ++i) {
            address member = members[i];
            _bps[id][member] = bps[i];
            _splitIdsByMember[member].push(id);
        }

        emit SplitCreated(id, msg.sender);
    }

    /**
     * @notice Send native BOT to a split.
     * @param id The ID of the split.
     */
    function pay(uint256 id) external payable nonReentrant {
        if (id == 0 || id > splitCount) revert SplitDoesNotExist();
        if (msg.value == 0) revert ZeroPayment();

        _splits[id].totalReceived += msg.value;

        emit Paid(id, msg.sender, msg.value);
    }

    /**
     * @notice Withdraw claimable share from a split.
     * @param id The ID of the split.
     */
    function withdraw(uint256 id) external nonReentrant {
        if (id == 0 || id > splitCount) revert SplitDoesNotExist();

        uint16 memberBps = _bps[id][msg.sender];
        if (memberBps == 0) revert NotAMember();

        uint256 totalReceived = _splits[id].totalReceived;
        uint256 totalEntitled = (totalReceived * uint256(memberBps)) / 10_000;
        uint256 alreadyReleased = _released[id][msg.sender];

        if (totalEntitled <= alreadyReleased) revert NothingOwed();
        uint256 owed = totalEntitled - alreadyReleased;

        // Checks-Effects-Interactions: state updated before external call
        _released[id][msg.sender] = alreadyReleased + owed;
        emit Withdrawn(id, msg.sender, owed);

        (bool success, ) = msg.sender.call{value: owed}("");
        if (!success) revert TransferFailed();
    }

    /**
     * @notice View split details by ID.
     */
    function getSplit(uint256 id) external view returns (Split memory) {
        if (id == 0 || id > splitCount) revert SplitDoesNotExist();
        return _splits[id];
    }

    /**
     * @notice View members and their basis point allocations for a split.
     */
    function getMembers(uint256 id) external view returns (address[] memory members, uint16[] memory bps) {
        if (id == 0 || id > splitCount) revert SplitDoesNotExist();
        members = _splitMembers[id];
        uint256 len = members.length;
        bps = new uint16[](len);
        for (uint256 i = 0; i < len; ++i) {
            bps[i] = _bps[id][members[i]];
        }
    }

    /**
     * @notice View claimable amount for an account in a split.
     */
    function claimable(uint256 id, address account) external view returns (uint256) {
        if (id == 0 || id > splitCount) return 0;
        uint16 memberBps = _bps[id][account];
        if (memberBps == 0) return 0;

        uint256 totalEntitled = (_splits[id].totalReceived * uint256(memberBps)) / 10_000;
        uint256 alreadyReleased = _released[id][account];
        if (totalEntitled <= alreadyReleased) return 0;
        return totalEntitled - alreadyReleased;
    }

    /**
     * @notice View already released amount for an account in a split.
     */
    function released(uint256 id, address account) external view returns (uint256) {
        return _released[id][account];
    }

    /**
     * @notice View all split IDs where account is a member.
     */
    function getSplitIdsByMember(address account) external view returns (uint256[] memory) {
        return _splitIdsByMember[account];
    }
}
